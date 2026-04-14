import { describe, expect, it, vi } from 'vitest';
import { UserNotFoundError } from '~/domain/errors/user-not-found.error';
import { buildGeminiChatToolSet } from '~/infrastructure/integrations/ai/gemini-chat-tool-set';
import { createMockEmbeddingIntegration } from '~mock/infrastructure/integrations/embedding/embedding.integration.mock';
import { createMockMessageRepository } from '~mock/application/repositories/message/message.repository.mock';
import { createMockWeatherIntegration } from '~mock/infrastructure/integrations/weather/weather.integration.mock';

// tool / zodSchema は実行時に設定をそのまま返すスタブにする (tool の実体は不要)
vi.mock('ai', () => ({
	tool: vi.fn((config: unknown) => config),
	zodSchema: vi.fn((schema: unknown) => schema),
}));

// jst-datetime をモックして固定値を返す
vi.mock('~/infrastructure/integrations/ai/jst-datetime', () => ({
	buildJstDateTimeString: vi.fn(() => '2026年04月14日 10:00'),
}));

/** PostalCodeIntegration のローカルモック */
function createMockPostalCodeIntegration() {
	return {
		lookup: vi.fn().mockResolvedValue(null),
	};
}

/** RegisterUserUseCase のローカルモック */
function createMockRegisterUserUseCase() {
	return {
		execute: vi
			.fn()
			.mockResolvedValue({ user: { id: 'user_01', email: 'new@example.com', createdAt: '', updatedAt: '' } }),
	};
}

/** GetUsersUseCase のローカルモック */
function createMockGetUsersUseCase() {
	return {
		execute: vi.fn().mockResolvedValue({ users: [] }),
	};
}

/** UpdateUserUseCase のローカルモック */
function createMockUpdateUserUseCase() {
	return {
		execute: vi
			.fn()
			.mockResolvedValue({ user: { id: 'user_01', email: 'updated@example.com', createdAt: '', updatedAt: '' } }),
	};
}

/** DeleteUserUseCase のローカルモック */
function createMockDeleteUserUseCase() {
	return {
		execute: vi.fn().mockResolvedValue({}),
	};
}

/** テスト用のツールセットを生成するヘルパー */
function buildToolSet(overrides: Partial<Parameters<typeof buildGeminiChatToolSet>[0]> = {}) {
	return buildGeminiChatToolSet({
		postalCodeIntegration: createMockPostalCodeIntegration(),
		weatherIntegration: createMockWeatherIntegration(),
		registerUserUseCase: createMockRegisterUserUseCase() as never,
		getUsersUseCase: createMockGetUsersUseCase() as never,
		updateUserUseCase: createMockUpdateUserUseCase() as never,
		deleteUserUseCase: createMockDeleteUserUseCase() as never,
		embeddingIntegration: createMockEmbeddingIntegration(),
		messageRepository: createMockMessageRepository(),
		...overrides,
	});
}

describe('buildGeminiChatToolSet', () => {
	describe('getCurrentTime', () => {
		// 正常系: jst-datetime の文字列をそのまま返すことを検証する
		it('現在の JST 日時文字列を返す', async () => {
			const tools = buildToolSet();
			const result = await (tools.getCurrentTime as { execute: () => Promise<string> }).execute();
			expect(result).toBe('2026年04月14日 10:00');
		});
	});

	describe('lookupAddress', () => {
		// 正常系: 住所が見つかった場合に都道府県+市区町村+町名の文字列を返す
		it('住所が見つかった場合に住所文字列を返す', async () => {
			const postalCodeIntegration = {
				lookup: vi.fn().mockResolvedValue({ prefecture: '東京都', city: '千代田区', town: '千代田' }),
			};
			const tools = buildToolSet({ postalCodeIntegration });
			const result = await (
				tools.lookupAddress as { execute: (input: { zipCode: string }) => Promise<string> }
			).execute({ zipCode: '100-0001' });
			expect(result).toBe('東京都千代田区千代田');
		});

		// 異常系: 住所が見つからない場合にエラーメッセージを返す
		it('住所が見つからない場合に該当なしメッセージを返す', async () => {
			const postalCodeIntegration = { lookup: vi.fn().mockResolvedValue(null) };
			const tools = buildToolSet({ postalCodeIntegration });
			const result = await (
				tools.lookupAddress as { execute: (input: { zipCode: string }) => Promise<string> }
			).execute({ zipCode: '0000000' });
			expect(result).toBe('該当する住所が見つかりませんでした');
		});
	});

	describe('getWeather', () => {
		// 正常系: 天気情報が取得できた場合にフォーマット済み文字列を返す
		it('天気情報が取得できた場合に天気文字列を返す', async () => {
			const weatherIntegration = {
				lookup: vi.fn().mockResolvedValue({ description: '晴れ', temperatureCelsius: 22, humidity: 50 }),
			};
			const tools = buildToolSet({ weatherIntegration });
			const result = await (tools.getWeather as { execute: (input: { address: string }) => Promise<string> }).execute({
				address: '東京',
			});
			expect(result).toBe('東京の現在の天気: 晴れ、気温: 22°C、湿度: 50%');
		});

		// 異常系: 天気情報が取得できない場合にエラーメッセージを返す
		it('天気情報が取得できない場合にエラーメッセージを返す', async () => {
			const weatherIntegration = { lookup: vi.fn().mockResolvedValue(null) };
			const tools = buildToolSet({ weatherIntegration });
			const result = await (tools.getWeather as { execute: (input: { address: string }) => Promise<string> }).execute({
				address: '存在しない地名',
			});
			expect(result).toBe('天気情報を取得できませんでした');
		});
	});

	describe('createUser', () => {
		// 正常系: ユーザー作成成功時に ID とメールを含むメッセージを返す
		it('ユーザー作成成功時に作成完了メッセージを返す', async () => {
			const tools = buildToolSet();
			const result = await (tools.createUser as { execute: (input: { email: string }) => Promise<string> }).execute({
				email: 'new@example.com',
			});
			expect(result).toContain('ユーザーを作成しました');
			expect(result).toContain('user_01');
		});
	});

	describe('listUsers', () => {
		// 正常系: ユーザーが存在する場合に一覧文字列を返す
		it('ユーザーが存在する場合に一覧を返す', async () => {
			const getUsersUseCase = {
				execute: vi.fn().mockResolvedValue({
					users: [
						{ id: 'u1', email: 'a@example.com' },
						{ id: 'u2', email: 'b@example.com' },
					],
				}),
			};
			const tools = buildToolSet({ getUsersUseCase: getUsersUseCase as never });
			const result = await (tools.listUsers as { execute: () => Promise<string> }).execute();
			expect(result).toContain('u1');
			expect(result).toContain('a@example.com');
		});

		// 正常系: ユーザーが 0 件の場合に登録なしメッセージを返す
		it('ユーザーが 0 件の場合に登録なしメッセージを返す', async () => {
			const tools = buildToolSet();
			const result = await (tools.listUsers as { execute: () => Promise<string> }).execute();
			expect(result).toBe('ユーザーが登録されていません');
		});
	});

	describe('updateUser', () => {
		// 正常系: 更新成功時に更新完了メッセージを返す
		it('更新成功時に更新完了メッセージを返す', async () => {
			const tools = buildToolSet();
			const result = await (
				tools.updateUser as { execute: (input: { id: string; email: string }) => Promise<string> }
			).execute({ id: 'user_01', email: 'updated@example.com' });
			expect(result).toContain('ユーザーを更新しました');
		});

		// 異常系: UserNotFoundError がスローされた場合に見つからないメッセージを返す
		it('UserNotFoundError の場合にユーザー不在メッセージを返す', async () => {
			const updateUserUseCase = {
				execute: vi.fn().mockRejectedValue(new UserNotFoundError('user_99')),
			};
			const tools = buildToolSet({ updateUserUseCase: updateUserUseCase as never });
			const result = await (
				tools.updateUser as { execute: (input: { id: string; email: string }) => Promise<string> }
			).execute({ id: 'user_99', email: 'x@example.com' });
			expect(result).toBe('ユーザーが見つかりませんでした');
		});
	});

	describe('deleteUser', () => {
		// 正常系: 削除成功時に削除完了メッセージを返す
		it('削除成功時に削除完了メッセージを返す', async () => {
			const tools = buildToolSet();
			const result = await (tools.deleteUser as { execute: (input: { id: string }) => Promise<string> }).execute({
				id: 'user_01',
			});
			expect(result).toContain('user_01');
			expect(result).toContain('削除しました');
		});

		// 異常系: UserNotFoundError がスローされた場合に見つからないメッセージを返す
		it('UserNotFoundError の場合にユーザー不在メッセージを返す', async () => {
			const deleteUserUseCase = {
				execute: vi.fn().mockRejectedValue(new UserNotFoundError('user_99')),
			};
			const tools = buildToolSet({ deleteUserUseCase: deleteUserUseCase as never });
			const result = await (tools.deleteUser as { execute: (input: { id: string }) => Promise<string> }).execute({
				id: 'user_99',
			});
			expect(result).toBe('ユーザーが見つかりませんでした');
		});
	});

	describe('searchSimilarMessages', () => {
		// 正常系: 類似メッセージが見つかった場合にフォーマット済みリストを返す
		it('類似メッセージが見つかった場合に検索結果リストを返す', async () => {
			const messageRepository = {
				...createMockMessageRepository(),
				searchSimilar: vi.fn().mockResolvedValue([{ role: 'user', content: 'こんにちは', similarity: 0.95 }]),
			};
			const embeddingIntegration = {
				embed: vi.fn().mockResolvedValue([0.1, 0.2]),
			};
			const tools = buildToolSet({ messageRepository, embeddingIntegration: embeddingIntegration as never });
			const result = await (
				tools.searchSimilarMessages as { execute: (input: { query: string; limit: number }) => Promise<string> }
			).execute({ query: 'test', limit: 5 });
			expect(result).toContain('こんにちは');
			expect(result).toContain('95.0%');
		});

		// 正常系: 類似メッセージが 0 件の場合に見つからないメッセージを返す
		it('類似メッセージが 0 件の場合に見つからないメッセージを返す', async () => {
			const tools = buildToolSet();
			const result = await (
				tools.searchSimilarMessages as { execute: (input: { query: string; limit: number }) => Promise<string> }
			).execute({ query: 'test', limit: 5 });
			expect(result).toBe('類似したメッセージは見つかりませんでした');
		});
	});
});
