import { afterEach, describe, expect, it, vi } from 'vitest';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import { WttrInWeatherIntegration } from '~/infrastructure/integrations/weather/wttrin.integration';

describe('WttrInWeatherIntegration', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	// 正常系: 住所に対応する天気情報が返されることを検証する
	it('should return weather info when address is found', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				json: async () => ({
					current_condition: [
						{
							humidity: '70',
							temp_C: '15',
							weatherDesc: [{ value: 'Partly cloudy' }],
						},
					],
				}),
			}),
		);

		const integration = new WttrInWeatherIntegration();
		const result = await integration.lookup('東京都千代田区');

		expect(result).toEqual({
			description: 'Partly cloudy',
			humidity: 70,
			temperatureCelsius: 15,
		});
	});

	// 正常系: current_condition が空配列のとき null が返されることを検証する
	it('should return null when current_condition is empty', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				json: async () => ({ current_condition: [] }),
			}),
		);

		const integration = new WttrInWeatherIntegration();
		const result = await integration.lookup('東京都千代田区');

		expect(result).toBeNull();
	});

	// 正常系: リクエスト URL に住所が URL エンコードされて含まれることを検証する
	it('should URL-encode the address in the request', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			json: async () => ({
				current_condition: [
					{
						humidity: '60',
						temp_C: '20',
						weatherDesc: [{ value: 'Sunny' }],
					},
				],
			}),
		});
		vi.stubGlobal('fetch', fetchMock);

		const integration = new WttrInWeatherIntegration();
		await integration.lookup('東京都 大阪城');

		expect(fetchMock).toHaveBeenCalledWith(`https://wttr.in/${encodeURIComponent('東京都 大阪城')}?format=j1`);
	});

	// 正常系: weatherDesc が空配列のとき description が空文字になることを検証する
	it('should return empty description when weatherDesc is empty', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				json: async () => ({
					current_condition: [
						{
							humidity: '50',
							temp_C: '10',
							weatherDesc: [],
						},
					],
				}),
			}),
		);

		const integration = new WttrInWeatherIntegration();
		const result = await integration.lookup('東京');

		expect(result).toEqual({
			description: '',
			humidity: 50,
			temperatureCelsius: 10,
		});
	});

	// 異常系: API が不正なレスポンス構造を返した場合に InfrastructureError がスローされることを検証する
	it('should throw InfrastructureError when response has invalid structure', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				json: async () => ({ invalid: 'structure' }),
			}),
		);

		const integration = new WttrInWeatherIntegration();
		await expect(integration.lookup('東京')).rejects.toThrow(InfrastructureError);
	});

	// 異常系: fetch がエラーをスローした場合に InfrastructureError がスローされることを検証する
	it('should throw InfrastructureError when fetch throws an Error', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

		const integration = new WttrInWeatherIntegration();
		await expect(integration.lookup('東京')).rejects.toThrow(InfrastructureError);
	});

	// 異常系: fetch が非 Error をスローした場合にも InfrastructureError がスローされることを検証する
	it('should throw InfrastructureError when fetch throws a non-Error value', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue('string error'));

		const integration = new WttrInWeatherIntegration();
		await expect(integration.lookup('東京')).rejects.toThrow(InfrastructureError);
	});
});
