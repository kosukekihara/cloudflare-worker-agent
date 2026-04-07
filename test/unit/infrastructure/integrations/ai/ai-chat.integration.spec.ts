import { describe, expect, it, vi } from 'vitest';
import { ToolLoopAgent } from 'ai';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import type { ChatStreamEvent } from '~/application/ports/integrations/chat/chat.integration';
import type { PostalCodeIntegration } from '~/application/ports/integrations/postal-code/postal-code.integration';
import type { WeatherIntegration } from '~/application/ports/integrations/weather/weather.integration';
import type { DeleteUserUseCase } from '~/application/use-cases/user/delete-user.use-case';
import type { GetUsersUseCase } from '~/application/use-cases/user/get-users.use-case';
import type { RegisterUserUseCase } from '~/application/use-cases/user/register-user.use-case';
import type { UpdateUserUseCase } from '~/application/use-cases/user/update-user.use-case';
import { UserNotFoundError } from '~/domain/errors/user-not-found.error';
import type { AiChatAgentKind } from '~/infrastructure/integrations/ai/ai-chat-agent-kind';
import { GeminiChatIntegration } from '~/infrastructure/integrations/ai/ai-chat.integration';
import { createMockEmbeddingIntegration } from '~mock/infrastructure/integrations/embedding/embedding.integration.mock';
import { createMockMessageRepository } from '~mock/application/repositories/message/message.repository.mock';

// @ai-sdk/google と ai (ToolLoopAgent 等) をモックする
vi.mock('@ai-sdk/google', () => ({
	createGoogleGenerativeAI: vi.fn(() => (modelId: string) => ({ id: modelId })),
}));

vi.mock('ai', () => ({
	stepCountIs: vi.fn((n: number) => n),
	ToolLoopAgent: vi.fn(),
	tool: vi.fn((config: unknown) => config),
	zodSchema: vi.fn((schema: unknown) => schema),
}));

/** fullStream 用のストリームパートを生成するヘルパー */
async function* makeFullStream(parts: Array<Record<string, unknown>>) {
	for (const part of parts) {
		yield part;
	}
}

/**
 * ToolLoopAgent コンストラクタモックと stream モックを設定する
 * createIntegration() より前に呼ぶこと
 *
 * 実装は名前付き function にする (new 式で呼ばれるため Vitest の推奨に合わせる)
 */
function setupMockAgent(parts: Array<Record<string, unknown>> = []) {
	const mockStream = vi.fn().mockResolvedValue({ fullStream: makeFullStream(parts) });
	vi.mocked(ToolLoopAgent).mockImplementation(function MockToolLoopAgent() {
		return {
			version: 'agent-v1' as const,
			id: undefined,
			tools: {},
			stream: mockStream,
			generate: vi.fn(),
		} as never;
	});
	return mockStream;
}

/** PostalCodeIntegration のローカルモック */
function createLocalMockPostalCodeIntegration(): PostalCodeIntegration {
	return {
		lookup: vi.fn().mockResolvedValue(null),
	};
}

/** WeatherIntegration のローカルモック */
function createLocalMockWeatherIntegration(): WeatherIntegration {
	return {
		lookup: vi.fn().mockResolvedValue(null),
	};
}

/** RegisterUserUseCase のローカルモック */
function createLocalMockRegisterUserUseCase(): RegisterUserUseCase {
	return {
		execute: vi
			.fn()
			.mockResolvedValue({ user: { id: 'user_01', email: 'test@example.com', createdAt: '', updatedAt: '' } }),
	} as unknown as RegisterUserUseCase;
}

/** GetUsersUseCase のローカルモック */
function createLocalMockGetUsersUseCase(): GetUsersUseCase {
	return {
		execute: vi.fn().mockResolvedValue({ users: [] }),
	} as unknown as GetUsersUseCase;
}

/** UpdateUserUseCase のローカルモック */
function createLocalMockUpdateUserUseCase(): UpdateUserUseCase {
	return {
		execute: vi
			.fn()
			.mockResolvedValue({ user: { id: 'user_01', email: 'updated@example.com', createdAt: '', updatedAt: '' } }),
	} as unknown as UpdateUserUseCase;
}

/** DeleteUserUseCase のローカルモック */
function createLocalMockDeleteUserUseCase(): DeleteUserUseCase {
	return {
		execute: vi.fn().mockResolvedValue({}),
	} as unknown as DeleteUserUseCase;
}

/** テスト用の GeminiChatIntegration を生成するヘルパー (デフォルトモックを使用) */
function createIntegration(
	overrides: {
		postalCode?: PostalCodeIntegration;
		weather?: WeatherIntegration;
		registerUser?: RegisterUserUseCase;
		getUsers?: GetUsersUseCase;
		updateUser?: UpdateUserUseCase;
		deleteUser?: DeleteUserUseCase;
		embedding?: ReturnType<typeof createMockEmbeddingIntegration>;
		messageRepo?: ReturnType<typeof createMockMessageRepository>;
	} = {},
	agentKind?: AiChatAgentKind,
): GeminiChatIntegration {
	return new GeminiChatIntegration(
		'test-api-key',
		overrides.postalCode ?? createLocalMockPostalCodeIntegration(),
		overrides.weather ?? createLocalMockWeatherIntegration(),
		overrides.registerUser ?? createLocalMockRegisterUserUseCase(),
		overrides.getUsers ?? createLocalMockGetUsersUseCase(),
		overrides.updateUser ?? createLocalMockUpdateUserUseCase(),
		overrides.deleteUser ?? createLocalMockDeleteUserUseCase(),
		overrides.embedding ?? createMockEmbeddingIntegration(),
		overrides.messageRepo ?? createMockMessageRepository(),
		agentKind,
	);
}

describe('GeminiChatIntegration', () => {
	// 正常系: fullStream の text-delta パートが text イベントとして yield されることを検証する
	it('should yield text events from text-delta parts', async () => {
		setupMockAgent([
			{ type: 'text-delta', text: 'Hello' },
			{ type: 'text-delta', text: ', ' },
			{ type: 'text-delta', text: 'World' },
		]);

		const integration = createIntegration();
		const events: ChatStreamEvent[] = [];
		for await (const event of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			events.push(event);
		}

		expect(events).toEqual([
			{ type: 'text', text: 'Hello' },
			{ type: 'text', text: ', ' },
			{ type: 'text', text: 'World' },
		]);
	});

	// 正常系: tool-call パートが tool_call イベントとして yield されることを検証する
	it('should yield tool_call event from tool-call part', async () => {
		setupMockAgent([
			{ type: 'tool-call', toolCallId: 'id1', toolName: 'postalCodeLookup', args: { zipCode: '1000001' } },
		]);

		const integration = createIntegration();
		const events: ChatStreamEvent[] = [];
		for await (const event of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			events.push(event);
		}

		expect(events).toEqual([{ type: 'tool_call', toolName: 'postalCodeLookup' }]);
	});

	// 正常系: tool-result パートが tool_result イベントとして yield されることを検証する
	it('should yield tool_result event from tool-result part', async () => {
		setupMockAgent([
			{ type: 'tool-result', toolCallId: 'id1', toolName: 'postalCodeLookup', output: '東京都千代田区大手町' },
		]);

		const integration = createIntegration();
		const events: ChatStreamEvent[] = [];
		for await (const event of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			events.push(event);
		}

		expect(events).toEqual([{ type: 'tool_result', toolName: 'postalCodeLookup', result: '東京都千代田区大手町' }]);
	});

	// 正常系: finish 等の未知パートは無視されることを検証する
	it('should ignore unknown part types like finish', async () => {
		setupMockAgent([
			{ type: 'step-finish', finishReason: 'stop' },
			{ type: 'finish', finishReason: 'stop' },
			{ type: 'text-delta', text: 'OK' },
		]);

		const integration = createIntegration();
		const events: ChatStreamEvent[] = [];
		for await (const event of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			events.push(event);
		}

		expect(events).toEqual([{ type: 'text', text: 'OK' }]);
	});

	// 正常系: text-delta で text が無いパートはスキップし、後続の有効な delta のみ yield する
	it('should skip text-delta parts when text is undefined', async () => {
		setupMockAgent([{ type: 'text-delta' }, { type: 'text-delta', text: 'only' }]);

		const integration = createIntegration();
		const events: ChatStreamEvent[] = [];
		for await (const event of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			events.push(event);
		}

		expect(events).toEqual([{ type: 'text', text: 'only' }]);
	});

	// 正常系: tool-call で toolName が無いパートはスキップする
	it('should skip tool-call parts when toolName is undefined', async () => {
		setupMockAgent([
			{ type: 'tool-call', toolCallId: 'id0' },
			{ type: 'tool-call', toolCallId: 'id1', toolName: 'weather' },
		]);

		const integration = createIntegration();
		const events: ChatStreamEvent[] = [];
		for await (const event of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			events.push(event);
		}

		expect(events).toEqual([{ type: 'tool_call', toolName: 'weather' }]);
	});

	// 正常系: tool-result で toolName が無いパートはスキップする
	it('should skip tool-result parts when toolName is undefined', async () => {
		setupMockAgent([
			{ type: 'tool-result', toolCallId: 'id0', output: 'ignored' },
			{ type: 'tool-result', toolCallId: 'id1', toolName: 'weather', output: '晴れ' },
		]);

		const integration = createIntegration();
		const events: ChatStreamEvent[] = [];
		for await (const event of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			events.push(event);
		}

		expect(events).toEqual([{ type: 'tool_result', toolName: 'weather', result: '晴れ' }]);
	});

	// 正常系: agent.stream にメッセージ履歴が正しく渡されることを検証する
	it('should pass messages to agent.stream correctly', async () => {
		const mockStream = setupMockAgent([]);

		const integration = createIntegration();
		const messages = [
			{ role: 'user' as const, content: '質問' },
			{ role: 'assistant' as const, content: '回答' },
		];
		for await (const _ of integration.streamReply(messages)) {
			// drain
		}

		expect(mockStream).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					{ role: 'user', content: '質問' },
					{ role: 'assistant', content: '回答' },
				],
			}),
		);
	});

	// 異常系: agent.stream が Error を拒否した場合に InfrastructureError にラップされることを検証する
	it('should throw InfrastructureError when agent.stream rejects with an Error', async () => {
		const mockStream = setupMockAgent([]);
		mockStream.mockRejectedValue(new Error('API 接続エラー'));

		const integration = createIntegration();
		const gen = integration.streamReply([{ role: 'user', content: 'Hi' }]);

		await expect(gen.next()).rejects.toThrow(InfrastructureError);
	});

	// 異常系: agent.stream が非 Error を拒否した場合にも InfrastructureError にラップされることを検証する
	it('should throw InfrastructureError when agent.stream rejects with a non-Error value', async () => {
		const mockStream = setupMockAgent([]);
		mockStream.mockRejectedValue('string error');

		const integration = createIntegration();
		const gen = integration.streamReply([{ role: 'user', content: 'Hi' }]);

		await expect(gen.next()).rejects.toThrow(InfrastructureError);
	});

	// 正常系: prepareCall の instructions に JST 形式の日時文字列が含まれることを検証する (既定エージェント)
	it('should set prepareCall instructions containing JST datetime', async () => {
		setupMockAgent([]);

		createIntegration({}, 'gemini_default');

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as
			| { prepareCall?: (options: Record<string, unknown>) => { instructions?: string } }
			| undefined;
		// 本番は baseCallArgs をスプレッドするため、空オブジェクトでも instructions のみ検証できる
		const prepared = ctorSettings?.prepareCall?.({});
		expect(prepared?.instructions).toMatch(/\d{4}年\d{2}月\d{2}日 \d{2}:\d{2} \(JST\)/);
	});

	// 正常系: praiser エージェントでは称賛系の性格リテラルが instructions に含まれることを検証する
	it('should include praiser personality in prepareCall when agent kind is praiser', async () => {
		setupMockAgent([]);

		createIntegration({}, 'praiser');

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as
			| { prepareCall?: (options: Record<string, unknown>) => { instructions?: string } }
			| undefined;
		const prepared = ctorSettings?.prepareCall?.({});
		expect(prepared?.instructions).toContain('称賛');
		expect(prepared?.instructions).toMatch(/\d{4}年\d{2}月\d{2}日 \d{2}:\d{2} \(JST\)/);
	});

	// 正常系: gemini_default エージェントに callPraiserAgent と callDenierAgent ツールが組み込まれることを検証する
	it('should include callPraiserAgent and callDenierAgent tools in gemini_default agent', async () => {
		setupMockAgent([]);

		createIntegration({}, 'gemini_default');

		// ToolLoopAgent は praiser/denier/main の順に3回呼ばれ、lastCall がメインエージェントを指す
		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: Record<string, unknown>;
		};
		expect(ctorSettings?.tools).toHaveProperty('callPraiserAgent');
		expect(ctorSettings?.tools).toHaveProperty('callDenierAgent');
	});

	// 正常系: gemini_default では denier サブエージェントの prepareCall に否定系の性格リテラルが含まれることを検証する
	it('should include denier personality in prepareCall of denier sub-agent when agent kind is gemini_default', async () => {
		setupMockAgent([]);

		createIntegration({}, 'gemini_default');

		// gemini_default では ToolLoopAgent が praiser/denier/main の順に3回作られる
		// 末尾から2番目が denier サブエージェントのコンストラクタ引数
		const allCalls = vi.mocked(ToolLoopAgent).mock.calls;
		const denierCtorSettings = allCalls.at(-2)?.[0] as
			| { prepareCall?: (options: Record<string, unknown>) => { instructions?: string } }
			| undefined;
		const prepared = denierCtorSettings?.prepareCall?.({});
		expect(prepared?.instructions).toContain('否定');
		expect(prepared?.instructions).toMatch(/\d{4}年\d{2}月\d{2}日 \d{2}:\d{2} \(JST\)/);
	});

	// 正常系: casual エージェントではタメ口の性格リテラルが instructions に含まれることを検証する
	it('should include casual personality in prepareCall when agent kind is casual', async () => {
		setupMockAgent([]);

		createIntegration({}, 'casual');

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as
			| { prepareCall?: (options: Record<string, unknown>) => { instructions?: string } }
			| undefined;
		const prepared = ctorSettings?.prepareCall?.({});
		expect(prepared?.instructions).toContain('タメ口');
		expect(prepared?.instructions).toMatch(/\d{4}年\d{2}月\d{2}日 \d{2}:\d{2} \(JST\)/);
	});

	// 正常系: postalCodeLookup ツールの execute が住所を返す場合に文字列を返すことを検証する
	it('should return address string from postalCodeLookup tool execute when address is found', async () => {
		setupMockAgent([]);

		const mockPostalCode = createLocalMockPostalCodeIntegration();
		vi.mocked(mockPostalCode.lookup).mockResolvedValue({
			prefecture: '東京都',
			city: '千代田区',
			town: '大手町',
		});

		createIntegration({ postalCode: mockPostalCode });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { postalCodeLookup?: { execute: (input: { zipCode: string }) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.postalCodeLookup;
		const result = await toolConfig?.execute({ zipCode: '1000001' });

		expect(result).toBe('東京都千代田区大手町');
	});

	// 正常系: postalCodeLookup ツールの execute が住所が見つからない場合に案内文字列を返すことを検証する
	it('should return not-found message from postalCodeLookup tool execute when address is null', async () => {
		setupMockAgent([]);

		const mockPostalCode = createLocalMockPostalCodeIntegration();
		vi.mocked(mockPostalCode.lookup).mockResolvedValue(null);

		createIntegration({ postalCode: mockPostalCode });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { postalCodeLookup?: { execute: (input: { zipCode: string }) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.postalCodeLookup;
		const result = await toolConfig?.execute({ zipCode: '9999999' });

		expect(result).toBe('該当する住所が見つかりませんでした');
	});

	// 正常系: weather ツールの execute が天気情報文字列を返すことを検証する
	it('should return weather info string from weather tool execute', async () => {
		setupMockAgent([]);

		const mockWeather = createLocalMockWeatherIntegration();
		vi.mocked(mockWeather.lookup).mockResolvedValue({
			description: 'Partly cloudy',
			humidity: 70,
			temperatureCelsius: 15,
		});

		createIntegration({ weather: mockWeather });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { weather?: { execute: (input: { address: string }) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.weather;
		const result = await toolConfig?.execute({ address: '東京都千代田区' });

		expect(result).toBe('東京都千代田区の現在の天気: Partly cloudy、気温: 15°C、湿度: 70%');
	});

	// 正常系: weather ツールの execute が null 返却時に案内文字列を返すことを検証する
	it('should return not-found message from weather tool execute when weather is null', async () => {
		setupMockAgent([]);

		const mockWeather = createLocalMockWeatherIntegration();
		vi.mocked(mockWeather.lookup).mockResolvedValue(null);

		createIntegration({ weather: mockWeather });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { weather?: { execute: (input: { address: string }) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.weather;
		const result = await toolConfig?.execute({ address: '不明な場所' });

		expect(result).toBe('天気情報を取得できませんでした');
	});

	// 正常系: createUser ツールの execute が作成成功時に ID とメールを含む文字列を返すことを検証する
	it('should return created user info from createUser tool execute', async () => {
		setupMockAgent([]);

		const mockRegisterUser = createLocalMockRegisterUserUseCase();
		vi.mocked(mockRegisterUser.execute).mockResolvedValue({
			user: { id: 'user_new', email: 'new@example.com', createdAt: '', updatedAt: '' },
		});

		createIntegration({ registerUser: mockRegisterUser });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { createUser?: { execute: (input: { email: string }) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.createUser;
		const result = await toolConfig?.execute({ email: 'new@example.com' });

		expect(result).toBe('ユーザーを作成しました: ID=user_new、メール=new@example.com');
	});

	// 正常系: getUsers ツールの execute がユーザー一覧を整形した文字列を返すことを検証する
	it('should return formatted user list from getUsers tool execute', async () => {
		setupMockAgent([]);

		const mockGetUsers = createLocalMockGetUsersUseCase();
		vi.mocked(mockGetUsers.execute).mockResolvedValue({
			users: [
				{ id: 'user_01', email: 'a@example.com', createdAt: '', updatedAt: '' },
				{ id: 'user_02', email: 'b@example.com', createdAt: '', updatedAt: '' },
			],
		});

		createIntegration({ getUsers: mockGetUsers });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { getUsers?: { execute: (input: Record<string, never>) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.getUsers;
		const result = await toolConfig?.execute({});

		expect(result).toBe('ID: user_01、メール: a@example.com\nID: user_02、メール: b@example.com');
	});

	// 正常系: getUsers ツールの execute がユーザー 0 件の場合に案内文字列を返すことを検証する
	it('should return empty message from getUsers tool execute when no users exist', async () => {
		setupMockAgent([]);

		const mockGetUsers = createLocalMockGetUsersUseCase();
		vi.mocked(mockGetUsers.execute).mockResolvedValue({ users: [] });

		createIntegration({ getUsers: mockGetUsers });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { getUsers?: { execute: (input: Record<string, never>) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.getUsers;
		const result = await toolConfig?.execute({});

		expect(result).toBe('ユーザーが登録されていません');
	});

	// 正常系: updateUser ツールの execute が更新成功時に結果文字列を返すことを検証する
	it('should return updated user info from updateUser tool execute', async () => {
		setupMockAgent([]);

		const mockUpdateUser = createLocalMockUpdateUserUseCase();
		vi.mocked(mockUpdateUser.execute).mockResolvedValue({
			user: { id: 'user_01', email: 'updated@example.com', createdAt: '', updatedAt: '' },
		});

		createIntegration({ updateUser: mockUpdateUser });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { updateUser?: { execute: (input: { id: string; email: string }) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.updateUser;
		const result = await toolConfig?.execute({ id: 'user_01', email: 'updated@example.com' });

		expect(result).toBe('ユーザーを更新しました: ID=user_01、メール=updated@example.com');
	});

	// 正常系: updateUser ツールの execute が UserNotFoundError 時に案内文字列を返すことを検証する
	it('should return not-found message from updateUser tool execute when user is not found', async () => {
		setupMockAgent([]);

		const mockUpdateUser = createLocalMockUpdateUserUseCase();
		vi.mocked(mockUpdateUser.execute).mockRejectedValue(new UserNotFoundError('not found'));

		createIntegration({ updateUser: mockUpdateUser });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { updateUser?: { execute: (input: { id: string; email: string }) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.updateUser;
		const result = await toolConfig?.execute({ id: 'nonexistent', email: 'x@example.com' });

		expect(result).toBe('ユーザーが見つかりませんでした');
	});

	// 正常系: deleteUser ツールの execute が削除成功時に確認文字列を返すことを検証する
	it('should return deleted confirmation from deleteUser tool execute', async () => {
		setupMockAgent([]);

		const mockDeleteUser = createLocalMockDeleteUserUseCase();
		vi.mocked(mockDeleteUser.execute).mockResolvedValue({});

		createIntegration({ deleteUser: mockDeleteUser });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { deleteUser?: { execute: (input: { id: string }) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.deleteUser;
		const result = await toolConfig?.execute({ id: 'user_01' });

		expect(result).toBe('ユーザー (ID: user_01) を削除しました');
	});

	// 正常系: deleteUser ツールの execute が UserNotFoundError 時に案内文字列を返すことを検証する
	it('should return not-found message from deleteUser tool execute when user is not found', async () => {
		setupMockAgent([]);

		const mockDeleteUser = createLocalMockDeleteUserUseCase();
		vi.mocked(mockDeleteUser.execute).mockRejectedValue(new UserNotFoundError('not found'));

		createIntegration({ deleteUser: mockDeleteUser });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { deleteUser?: { execute: (input: { id: string }) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.deleteUser;
		const result = await toolConfig?.execute({ id: 'nonexistent' });

		expect(result).toBe('ユーザーが見つかりませんでした');
	});

	// 異常系: updateUser ツールの execute が UserNotFoundError 以外のエラーをスローした場合に re-throw することを検証する
	it('should re-throw non-UserNotFoundError from updateUser tool execute', async () => {
		setupMockAgent([]);

		const mockUpdateUser = createLocalMockUpdateUserUseCase();
		vi.mocked(mockUpdateUser.execute).mockRejectedValue(new Error('unexpected error'));

		createIntegration({ updateUser: mockUpdateUser });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { updateUser?: { execute: (input: { id: string; email: string }) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.updateUser;

		await expect(toolConfig?.execute({ id: 'user_01', email: 'x@example.com' })).rejects.toThrow('unexpected error');
	});

	// 異常系: deleteUser ツールの execute が UserNotFoundError 以外のエラーをスローした場合に re-throw することを検証する
	it('should re-throw non-UserNotFoundError from deleteUser tool execute', async () => {
		setupMockAgent([]);

		const mockDeleteUser = createLocalMockDeleteUserUseCase();
		vi.mocked(mockDeleteUser.execute).mockRejectedValue(new Error('unexpected error'));

		createIntegration({ deleteUser: mockDeleteUser });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { deleteUser?: { execute: (input: { id: string }) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.deleteUser;

		await expect(toolConfig?.execute({ id: 'user_01' })).rejects.toThrow('unexpected error');
	});

	// 正常系: searchSimilarMessages ツールの execute が embedding と searchSimilar を正しい引数で呼ぶことを検証する
	it('should call embed and searchSimilar with correct arguments from searchSimilarMessages tool execute', async () => {
		setupMockAgent([]);

		const mockEmbedding = createMockEmbeddingIntegration();
		const mockMessageRepo = createMockMessageRepository();
		const fakeVector = new Array(3072).fill(0.1);
		vi.mocked(mockEmbedding.embed).mockResolvedValue(fakeVector);
		vi.mocked(mockMessageRepo.searchSimilar).mockResolvedValue([
			{
				id: 'msg_01',
				conversationId: 'conv_01',
				role: 'user',
				content: '過去のメッセージ',
				createdAt: new Date(),
				similarity: 0.92,
			},
		]);

		createIntegration({ embedding: mockEmbedding, messageRepo: mockMessageRepo });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { searchSimilarMessages?: { execute: (input: { query: string; limit: number }) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.searchSimilarMessages;
		const result = await toolConfig?.execute({ query: '過去の話題', limit: 3 });

		expect(mockEmbedding.embed).toHaveBeenCalledWith('過去の話題');
		expect(mockMessageRepo.searchSimilar).toHaveBeenCalledWith(fakeVector, 3);
		expect(result).toContain('過去のメッセージ');
		expect(result).toContain('92.0%');
	});

	// 正常系: searchSimilarMessages ツールの execute が結果 0 件の場合に案内文字列を返すことを検証する
	it('should return not-found message from searchSimilarMessages tool execute when no results', async () => {
		setupMockAgent([]);

		const mockEmbedding = createMockEmbeddingIntegration();
		const mockMessageRepo = createMockMessageRepository();
		vi.mocked(mockEmbedding.embed).mockResolvedValue(new Array(3072).fill(0));
		vi.mocked(mockMessageRepo.searchSimilar).mockResolvedValue([]);

		createIntegration({ embedding: mockEmbedding, messageRepo: mockMessageRepo });

		const ctorSettings = vi.mocked(ToolLoopAgent).mock.lastCall?.[0] as {
			tools?: { searchSimilarMessages?: { execute: (input: { query: string; limit: number }) => Promise<string> } };
		};
		const toolConfig = ctorSettings?.tools?.searchSimilarMessages;
		const result = await toolConfig?.execute({ query: '存在しない話題', limit: 5 });

		expect(result).toBe('類似したメッセージは見つかりませんでした');
	});
});
