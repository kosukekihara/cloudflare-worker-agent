import { describe, expect, it, vi } from 'vitest';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import { GeminiEmbeddingIntegration } from '~/infrastructure/integrations/embedding/gemini.integration';

// fetch をグローバルモックする
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

/** 正常なレスポンスを返す fetch モックを生成するヘルパー */
function makeFetchSuccess(values: number[]) {
	return Promise.resolve({
		ok: true,
		json: () => Promise.resolve({ embedding: { values } }),
	} as Response);
}

/** エラーレスポンスを返す fetch モックを生成するヘルパー */
function makeFetchError(status: number, statusText: string) {
	return Promise.resolve({
		ok: false,
		status,
		statusText,
		json: () => Promise.resolve({}),
	} as Response);
}

describe('GeminiEmbeddingIntegration', () => {
	// 正常系: fetch が成功した場合に埋め込みベクトルを返すことを検証する
	it('should return embedding values when fetch succeeds', async () => {
		const expectedValues = new Array(3072).fill(0).map((_, i) => i * 0.001);
		fetchMock.mockReturnValue(makeFetchSuccess(expectedValues));

		const integration = new GeminiEmbeddingIntegration('test-api-key');
		const result = await integration.embed('テストテキスト');

		expect(result).toEqual(expectedValues);
		expect(result).toHaveLength(3072);
	});

	// 正常系: 正しい URL・ヘッダー・ボディで fetch が呼ばれることを検証する
	it('should call fetch with correct URL, headers and body', async () => {
		fetchMock.mockReturnValue(makeFetchSuccess([0.1, 0.2, 0.3]));

		const integration = new GeminiEmbeddingIntegration('my-api-key');
		await integration.embed('Hello');

		expect(fetchMock).toHaveBeenCalledWith(
			'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=my-api-key',
			{
				body: JSON.stringify({
					content: { parts: [{ text: 'Hello' }] },
					model: 'models/gemini-embedding-001',
				}),
				headers: { 'Content-Type': 'application/json' },
				method: 'POST',
			},
		);
	});

	// 異常系: fetch が 4xx を返した場合に InfrastructureError がスローされることを検証する
	it('should throw InfrastructureError when fetch returns 4xx', async () => {
		fetchMock.mockReturnValue(makeFetchError(400, 'Bad Request'));

		const integration = new GeminiEmbeddingIntegration('test-api-key');

		await expect(integration.embed('テスト')).rejects.toThrow(InfrastructureError);
	});

	// 異常系: fetch が 5xx を返した場合に InfrastructureError がスローされることを検証する
	it('should throw InfrastructureError when fetch returns 5xx', async () => {
		fetchMock.mockReturnValue(makeFetchError(500, 'Internal Server Error'));

		const integration = new GeminiEmbeddingIntegration('test-api-key');

		await expect(integration.embed('テスト')).rejects.toThrow(InfrastructureError);
	});

	// 異常系: レスポンス形式が不正な場合 (embedding フィールドなし) に InfrastructureError がスローされることを検証する
	it('should throw InfrastructureError when response format is invalid', async () => {
		fetchMock.mockReturnValue(
			Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ unexpectedField: true }),
			} as Response),
		);

		const integration = new GeminiEmbeddingIntegration('test-api-key');

		await expect(integration.embed('テスト')).rejects.toThrow(InfrastructureError);
	});

	// 異常系: fetch 自体がネットワークエラーをスローした場合に InfrastructureError がスローされることを検証する
	it('should throw InfrastructureError when fetch throws a network error', async () => {
		fetchMock.mockImplementation(() => {
			throw new Error('Network error');
		});

		const integration = new GeminiEmbeddingIntegration('test-api-key');

		await expect(integration.embed('テスト')).rejects.toThrow(InfrastructureError);
	});

	// 異常系: fetch が非 Error 値をスローした場合にも InfrastructureError がスローされることを検証する
	it('should throw InfrastructureError when fetch throws a non-Error value', async () => {
		fetchMock.mockImplementation(() => {
			throw 'string error';
		});

		const integration = new GeminiEmbeddingIntegration('test-api-key');

		await expect(integration.embed('テスト')).rejects.toThrow(InfrastructureError);
	});
});
