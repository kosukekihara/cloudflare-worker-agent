import { afterEach, describe, expect, it, vi } from 'vitest';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import { ZipCloudPostalCodeIntegration } from '~/infrastructure/integrations/postal-code/zipcloud.integration';

describe('ZipCloudPostalCodeIntegration', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// 正常系: 郵便番号に対応する住所が返されることを検証する
	it('should return address when zipcode is found', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				json: async () => ({
					results: [{ address1: '東京都', address2: '千代田区', address3: '大手町' }],
				}),
			}),
		);

		const integration = new ZipCloudPostalCodeIntegration();
		const result = await integration.lookup('100-0004');

		expect(result).toEqual({
			prefecture: '東京都',
			city: '千代田区',
			town: '大手町',
		});
	});

	// 正常系: results が null の場合に null が返されることを検証する
	it('should return null when results is null', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				json: async () => ({ results: null }),
			}),
		);

		const integration = new ZipCloudPostalCodeIntegration();
		const result = await integration.lookup('0000000');

		expect(result).toBeNull();
	});

	// 正常系: results が空配列の場合に null が返されることを検証する
	it('should return null when results is empty array', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				json: async () => ({ results: [] }),
			}),
		);

		const integration = new ZipCloudPostalCodeIntegration();
		const result = await integration.lookup('9999999');

		expect(result).toBeNull();
	});

	// 正常系: ハイフンを除去した郵便番号で API が呼ばれることを検証する
	it('should strip hyphen from zipcode before calling API', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			json: async () => ({ results: null }),
		});
		vi.stubGlobal('fetch', fetchMock);

		const integration = new ZipCloudPostalCodeIntegration();
		await integration.lookup('100-0004');

		expect(fetchMock).toHaveBeenCalledWith('https://zipcloud.ibsnet.co.jp/api/search?zipcode=1000004');
	});

	// 異常系: API が不正なレスポンス構造を返した場合に InfrastructureError がスローされることを検証する
	it('should throw InfrastructureError when response has invalid structure', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				json: async () => ({ invalid: 'structure' }),
			}),
		);

		const integration = new ZipCloudPostalCodeIntegration();
		await expect(integration.lookup('1000004')).rejects.toThrow(InfrastructureError);
	});

	// 異常系: fetch がエラーをスローした場合に InfrastructureError がスローされることを検証する
	// 異常系: fetch がエラーをスローした場合に InfrastructureError がスローされることを検証する
	it('should throw InfrastructureError when fetch throws', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

		const integration = new ZipCloudPostalCodeIntegration();
		await expect(integration.lookup('1000004')).rejects.toThrow(InfrastructureError);
	});

	// 異常系: fetch が非 Error をスローした場合にも InfrastructureError がスローされることを検証する
	it('should throw InfrastructureError when fetch throws a non-Error value', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'));

		const integration = new ZipCloudPostalCodeIntegration();
		await expect(integration.lookup('1000004')).rejects.toThrow(InfrastructureError);
	});
});
