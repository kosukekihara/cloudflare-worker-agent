import { describe, expect, it, vi } from 'vitest';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import type { ChatStreamEvent } from '~/application/ports/integrations/chat/chat.integration';
import type { PostalCodeIntegration } from '~/application/ports/integrations/postal-code/postal-code.integration';
import type { WeatherIntegration } from '~/application/ports/integrations/weather/weather.integration';
import type { DeleteUserUseCase } from '~/application/use-cases/user/delete-user.use-case';
import type { GetUsersUseCase } from '~/application/use-cases/user/get-users.use-case';
import type { RegisterUserUseCase } from '~/application/use-cases/user/register-user.use-case';
import type { UpdateUserUseCase } from '~/application/use-cases/user/update-user.use-case';
import { UserNotFoundError } from '~/domain/errors/user-not-found.error';
import { OpenAIChatIntegration } from '~/infrastructure/integrations/chat/openai.integration';
import { createMockEmbeddingIntegration } from '~mock/infrastructure/integrations/embedding/embedding.integration.mock';
import { createMockMessageRepository } from '~mock/application/repositories/message/message.repository.mock';

// @ai-sdk/openai と ai モジュールをモックする
vi.mock('@ai-sdk/openai', () => ({
	createOpenAI: vi.fn(() => (modelId: string) => ({ id: modelId })),
}));

vi.mock('ai', () => ({
	stepCountIs: vi.fn((n: number) => n),
	streamText: vi.fn(),
	tool: vi.fn((config: unknown) => config),
	zodSchema: vi.fn((schema: unknown) => schema),
}));

/** fullStream 用のストリームパートを生成するヘルパー */
async function* makeFullStream(parts: Array<Record<string, unknown>>) {
	for (const part of parts) {
		yield part;
	}
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

/** テスト用の OpenAIChatIntegration を生成するヘルパー (デフォルトモックを使用) */
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
): OpenAIChatIntegration {
	return new OpenAIChatIntegration(
		'test-api-key',
		overrides.postalCode ?? createLocalMockPostalCodeIntegration(),
		overrides.weather ?? createLocalMockWeatherIntegration(),
		overrides.registerUser ?? createLocalMockRegisterUserUseCase(),
		overrides.getUsers ?? createLocalMockGetUsersUseCase(),
		overrides.updateUser ?? createLocalMockUpdateUserUseCase(),
		overrides.deleteUser ?? createLocalMockDeleteUserUseCase(),
		overrides.embedding ?? createMockEmbeddingIntegration(),
		overrides.messageRepo ?? createMockMessageRepository(),
	);
}

describe('OpenAIChatIntegration', () => {
	// 正常系: fullStream の text-delta パートが text イベントとして yield されることを検証する
	it('should yield text events from text-delta parts', async () => {
		const { streamText } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([
				{ type: 'text-delta', text: 'Hello' },
				{ type: 'text-delta', text: ', ' },
				{ type: 'text-delta', text: 'World' },
			]),
		} as never);

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
		const { streamText } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([
				{ type: 'tool-call', toolCallId: 'id1', toolName: 'postalCodeLookup', args: { zipCode: '1000001' } },
			]),
		} as never);

		const integration = createIntegration();
		const events: ChatStreamEvent[] = [];
		for await (const event of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			events.push(event);
		}

		expect(events).toEqual([{ type: 'tool_call', toolName: 'postalCodeLookup' }]);
	});

	// 正常系: tool-result パートが tool_result イベントとして yield されることを検証する
	it('should yield tool_result event from tool-result part', async () => {
		const { streamText } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([
				{ type: 'tool-result', toolCallId: 'id1', toolName: 'postalCodeLookup', output: '東京都千代田区大手町' },
			]),
		} as never);

		const integration = createIntegration();
		const events: ChatStreamEvent[] = [];
		for await (const event of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			events.push(event);
		}

		expect(events).toEqual([{ type: 'tool_result', toolName: 'postalCodeLookup', result: '東京都千代田区大手町' }]);
	});

	// 正常系: finish 等の未知パートは無視されることを検証する
	it('should ignore unknown part types like finish', async () => {
		const { streamText } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([
				{ type: 'step-finish', finishReason: 'stop' },
				{ type: 'finish', finishReason: 'stop' },
				{ type: 'text-delta', text: 'OK' },
			]),
		} as never);

		const integration = createIntegration();
		const events: ChatStreamEvent[] = [];
		for await (const event of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			events.push(event);
		}

		expect(events).toEqual([{ type: 'text', text: 'OK' }]);
	});

	// 正常系: streamText にメッセージ履歴が正しく渡されることを検証する
	it('should pass messages to streamText correctly', async () => {
		const { streamText } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const integration = createIntegration();
		const messages = [
			{ role: 'user' as const, content: '質問' },
			{ role: 'assistant' as const, content: '回答' },
		];
		for await (const _ of integration.streamReply(messages)) {
			// drain
		}

		expect(vi.mocked(streamText)).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: [
					{ role: 'user', content: '質問' },
					{ role: 'assistant', content: '回答' },
				],
			}),
		);
	});

	// 異常系: streamText が Error をスローした場合に InfrastructureError にラップされることを検証する
	it('should throw InfrastructureError when streamText throws an Error', async () => {
		const { streamText } = await import('ai');
		vi.mocked(streamText).mockImplementation(() => {
			throw new Error('API 接続エラー');
		});

		const integration = createIntegration();
		const gen = integration.streamReply([{ role: 'user', content: 'Hi' }]);

		await expect(gen.next()).rejects.toThrow(InfrastructureError);
	});

	// 異常系: streamText が非 Error をスローした場合にも InfrastructureError にラップされることを検証する
	it('should throw InfrastructureError when streamText throws a non-Error value', async () => {
		const { streamText } = await import('ai');
		vi.mocked(streamText).mockImplementation(() => {
			throw 'string error';
		});

		const integration = createIntegration();
		const gen = integration.streamReply([{ role: 'user', content: 'Hi' }]);

		await expect(gen.next()).rejects.toThrow(InfrastructureError);
	});

	// 正常系: streamText に渡される system パラメーターが JST 形式の日時文字列を含むことを検証する
	it('should pass system prompt containing JST datetime to streamText', async () => {
		const { streamText } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const integration = createIntegration();
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain
		}

		const callArg = vi.mocked(streamText).mock.lastCall?.[0] as { system?: string } | undefined;
		// JST 形式の日時文字列 (YYYY年MM月DD日 HH:MM) がシステムプロンプトに含まれることを検証する
		expect(callArg?.system).toMatch(/\d{4}年\d{2}月\d{2}日 \d{2}:\d{2} \(JST\)/);
	});

	// 正常系: postalCodeLookup ツールの execute が住所を返す場合に文字列を返すことを検証する
	it('should return address string from postalCodeLookup tool execute when address is found', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockPostalCode = createLocalMockPostalCodeIntegration();
		vi.mocked(mockPostalCode.lookup).mockResolvedValue({
			prefecture: '東京都',
			city: '千代田区',
			town: '大手町',
		});

		const integration = createIntegration({ postalCode: mockPostalCode });
		// 呼び出し前の tool() コール数を記録してテスト固有の相対インデックスを得る
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain して tool を登録させる
		}

		// postalCodeTool は登録順の 1 番目 (startIndex + 0)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex]?.[0] as unknown as {
			execute: (input: { zipCode: string }) => Promise<string>;
		};
		const result = await toolConfig.execute({ zipCode: '1000001' });

		expect(result).toBe('東京都千代田区大手町');
	});

	// 正常系: postalCodeLookup ツールの execute が住所が見つからない場合に案内文字列を返すことを検証する
	it('should return not-found message from postalCodeLookup tool execute when address is null', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockPostalCode = createLocalMockPostalCodeIntegration();
		vi.mocked(mockPostalCode.lookup).mockResolvedValue(null);

		const integration = createIntegration({ postalCode: mockPostalCode });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain
		}

		// postalCodeTool は登録順の 1 番目 (startIndex + 0)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex]?.[0] as unknown as {
			execute: (input: { zipCode: string }) => Promise<string>;
		};
		const result = await toolConfig.execute({ zipCode: '9999999' });

		expect(result).toBe('該当する住所が見つかりませんでした');
	});

	// 正常系: weather ツールの execute が天気情報文字列を返すことを検証する
	it('should return weather info string from weather tool execute', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockWeather = createLocalMockWeatherIntegration();
		vi.mocked(mockWeather.lookup).mockResolvedValue({
			description: 'Partly cloudy',
			humidity: 70,
			temperatureCelsius: 15,
		});

		const integration = createIntegration({ weather: mockWeather });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain して tool を登録させる
		}

		// weatherTool は登録順の 2 番目 (startIndex + 1)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 1]?.[0] as unknown as {
			execute: (input: { address: string }) => Promise<string>;
		};
		const result = await toolConfig.execute({ address: '東京都千代田区' });

		expect(result).toBe('東京都千代田区の現在の天気: Partly cloudy、気温: 15°C、湿度: 70%');
	});

	// 正常系: weather ツールの execute が null 返却時に案内文字列を返すことを検証する
	it('should return not-found message from weather tool execute when weather is null', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockWeather = createLocalMockWeatherIntegration();
		vi.mocked(mockWeather.lookup).mockResolvedValue(null);

		const integration = createIntegration({ weather: mockWeather });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain
		}

		// weatherTool は登録順の 2 番目 (startIndex + 1)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 1]?.[0] as unknown as {
			execute: (input: { address: string }) => Promise<string>;
		};
		const result = await toolConfig.execute({ address: '不明な場所' });

		expect(result).toBe('天気情報を取得できませんでした');
	});

	// 正常系: createUser ツールの execute が作成成功時に ID とメールを含む文字列を返すことを検証する
	it('should return created user info from createUser tool execute', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockRegisterUser = createLocalMockRegisterUserUseCase();
		vi.mocked(mockRegisterUser.execute).mockResolvedValue({
			user: { id: 'user_new', email: 'new@example.com', createdAt: '', updatedAt: '' },
		});

		const integration = createIntegration({ registerUser: mockRegisterUser });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain して tool を登録させる
		}

		// createUserTool は登録順の 3 番目 (startIndex + 2)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 2]?.[0] as unknown as {
			execute: (input: { email: string }) => Promise<string>;
		};
		const result = await toolConfig.execute({ email: 'new@example.com' });

		expect(result).toBe('ユーザーを作成しました: ID=user_new、メール=new@example.com');
	});

	// 正常系: getUsers ツールの execute がユーザー一覧を整形した文字列を返すことを検証する
	it('should return formatted user list from getUsers tool execute', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockGetUsers = createLocalMockGetUsersUseCase();
		vi.mocked(mockGetUsers.execute).mockResolvedValue({
			users: [
				{ id: 'user_01', email: 'a@example.com', createdAt: '', updatedAt: '' },
				{ id: 'user_02', email: 'b@example.com', createdAt: '', updatedAt: '' },
			],
		});

		const integration = createIntegration({ getUsers: mockGetUsers });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain して tool を登録させる
		}

		// getUsersTool は登録順の 4 番目 (startIndex + 3)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 3]?.[0] as unknown as {
			execute: (input: Record<string, never>) => Promise<string>;
		};
		const result = await toolConfig.execute({});

		expect(result).toBe('ID: user_01、メール: a@example.com\nID: user_02、メール: b@example.com');
	});

	// 正常系: getUsers ツールの execute がユーザー 0 件の場合に案内文字列を返すことを検証する
	it('should return empty message from getUsers tool execute when no users exist', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockGetUsers = createLocalMockGetUsersUseCase();
		vi.mocked(mockGetUsers.execute).mockResolvedValue({ users: [] });

		const integration = createIntegration({ getUsers: mockGetUsers });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain
		}

		// getUsersTool は登録順の 4 番目 (startIndex + 3)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 3]?.[0] as unknown as {
			execute: (input: Record<string, never>) => Promise<string>;
		};
		const result = await toolConfig.execute({});

		expect(result).toBe('ユーザーが登録されていません');
	});

	// 正常系: updateUser ツールの execute が更新成功時に結果文字列を返すことを検証する
	it('should return updated user info from updateUser tool execute', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockUpdateUser = createLocalMockUpdateUserUseCase();
		vi.mocked(mockUpdateUser.execute).mockResolvedValue({
			user: { id: 'user_01', email: 'updated@example.com', createdAt: '', updatedAt: '' },
		});

		const integration = createIntegration({ updateUser: mockUpdateUser });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain して tool を登録させる
		}

		// updateUserTool は登録順の 5 番目 (startIndex + 4)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 4]?.[0] as unknown as {
			execute: (input: { id: string; email: string }) => Promise<string>;
		};
		const result = await toolConfig.execute({ id: 'user_01', email: 'updated@example.com' });

		expect(result).toBe('ユーザーを更新しました: ID=user_01、メール=updated@example.com');
	});

	// 正常系: updateUser ツールの execute が UserNotFoundError 時に案内文字列を返すことを検証する
	it('should return not-found message from updateUser tool execute when user is not found', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockUpdateUser = createLocalMockUpdateUserUseCase();
		vi.mocked(mockUpdateUser.execute).mockRejectedValue(new UserNotFoundError('not found'));

		const integration = createIntegration({ updateUser: mockUpdateUser });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain
		}

		// updateUserTool は登録順の 5 番目 (startIndex + 4)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 4]?.[0] as unknown as {
			execute: (input: { id: string; email: string }) => Promise<string>;
		};
		const result = await toolConfig.execute({ id: 'nonexistent', email: 'x@example.com' });

		expect(result).toBe('ユーザーが見つかりませんでした');
	});

	// 正常系: deleteUser ツールの execute が削除成功時に確認文字列を返すことを検証する
	it('should return deleted confirmation from deleteUser tool execute', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockDeleteUser = createLocalMockDeleteUserUseCase();
		vi.mocked(mockDeleteUser.execute).mockResolvedValue({});

		const integration = createIntegration({ deleteUser: mockDeleteUser });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain して tool を登録させる
		}

		// deleteUserTool は登録順の 6 番目 (startIndex + 5)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 5]?.[0] as unknown as {
			execute: (input: { id: string }) => Promise<string>;
		};
		const result = await toolConfig.execute({ id: 'user_01' });

		expect(result).toBe('ユーザー (ID: user_01) を削除しました');
	});

	// 正常系: deleteUser ツールの execute が UserNotFoundError 時に案内文字列を返すことを検証する
	it('should return not-found message from deleteUser tool execute when user is not found', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockDeleteUser = createLocalMockDeleteUserUseCase();
		vi.mocked(mockDeleteUser.execute).mockRejectedValue(new UserNotFoundError('not found'));

		const integration = createIntegration({ deleteUser: mockDeleteUser });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain
		}

		// deleteUserTool は登録順の 6 番目 (startIndex + 5)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 5]?.[0] as unknown as {
			execute: (input: { id: string }) => Promise<string>;
		};
		const result = await toolConfig.execute({ id: 'nonexistent' });

		expect(result).toBe('ユーザーが見つかりませんでした');
	});

	// 異常系: updateUser ツールの execute が UserNotFoundError 以外のエラーをスローした場合に re-throw することを検証する
	it('should re-throw non-UserNotFoundError from updateUser tool execute', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockUpdateUser = createLocalMockUpdateUserUseCase();
		vi.mocked(mockUpdateUser.execute).mockRejectedValue(new Error('unexpected error'));

		const integration = createIntegration({ updateUser: mockUpdateUser });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain して tool を登録させる
		}

		// updateUserTool は登録順の 5 番目 (startIndex + 4)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 4]?.[0] as unknown as {
			execute: (input: { id: string; email: string }) => Promise<string>;
		};

		await expect(toolConfig.execute({ id: 'user_01', email: 'x@example.com' })).rejects.toThrow('unexpected error');
	});

	// 異常系: deleteUser ツールの execute が UserNotFoundError 以外のエラーをスローした場合に re-throw することを検証する
	it('should re-throw non-UserNotFoundError from deleteUser tool execute', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockDeleteUser = createLocalMockDeleteUserUseCase();
		vi.mocked(mockDeleteUser.execute).mockRejectedValue(new Error('unexpected error'));

		const integration = createIntegration({ deleteUser: mockDeleteUser });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain して tool を登録させる
		}

		// deleteUserTool は登録順の 6 番目 (startIndex + 5)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 5]?.[0] as unknown as {
			execute: (input: { id: string }) => Promise<string>;
		};

		await expect(toolConfig.execute({ id: 'user_01' })).rejects.toThrow('unexpected error');
	});

	// 正常系: searchSimilarMessages ツールの execute が embedding と searchSimilar を正しい引数で呼ぶことを検証する
	it('should call embed and searchSimilar with correct arguments from searchSimilarMessages tool execute', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

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

		const integration = createIntegration({ embedding: mockEmbedding, messageRepo: mockMessageRepo });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain して tool を登録させる
		}

		// searchSimilarMessagesTool は登録順の 7 番目 (startIndex + 6)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 6]?.[0] as unknown as {
			execute: (input: { query: string; limit: number }) => Promise<string>;
		};
		const result = await toolConfig.execute({ query: '過去の話題', limit: 3 });

		expect(mockEmbedding.embed).toHaveBeenCalledWith('過去の話題');
		expect(mockMessageRepo.searchSimilar).toHaveBeenCalledWith(fakeVector, 3);
		expect(result).toContain('過去のメッセージ');
		expect(result).toContain('92.0%');
	});

	// 正常系: searchSimilarMessages ツールの execute が結果 0 件の場合に案内文字列を返すことを検証する
	it('should return not-found message from searchSimilarMessages tool execute when no results', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockReturnValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockEmbedding = createMockEmbeddingIntegration();
		const mockMessageRepo = createMockMessageRepository();
		vi.mocked(mockEmbedding.embed).mockResolvedValue(new Array(3072).fill(0));
		vi.mocked(mockMessageRepo.searchSimilar).mockResolvedValue([]);

		const integration = createIntegration({ embedding: mockEmbedding, messageRepo: mockMessageRepo });
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain
		}

		// searchSimilarMessagesTool は登録順の 7 番目 (startIndex + 6)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 6]?.[0] as unknown as {
			execute: (input: { query: string; limit: number }) => Promise<string>;
		};
		const result = await toolConfig.execute({ query: '存在しない話題', limit: 5 });

		expect(result).toBe('類似したメッセージは見つかりませんでした');
	});
});
