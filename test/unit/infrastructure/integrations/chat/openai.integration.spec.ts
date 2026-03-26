import { describe, expect, it, vi } from 'vitest';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import type { ChatStreamEvent } from '~/application/ports/integrations/chat/chat.integration';
import type { PostalCodeIntegration } from '~/application/ports/integrations/postal-code/postal-code.integration';
import type { WeatherIntegration } from '~/application/ports/integrations/weather/weather.integration';
import { OpenAIChatIntegration } from '~/infrastructure/integrations/chat/openai.integration';

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

describe('OpenAIChatIntegration', () => {
	// 正常系: fullStream の text-delta パートが text イベントとして yield されることを検証する
	it('should yield text events from text-delta parts', async () => {
		const { streamText } = await import('ai');
		vi.mocked(streamText).mockResolvedValue({
			fullStream: makeFullStream([
				{ type: 'text-delta', text: 'Hello' },
				{ type: 'text-delta', text: ', ' },
				{ type: 'text-delta', text: 'World' },
			]),
		} as never);

		const integration = new OpenAIChatIntegration(
			'test-api-key',
			createLocalMockPostalCodeIntegration(),
			createLocalMockWeatherIntegration(),
		);
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
		vi.mocked(streamText).mockResolvedValue({
			fullStream: makeFullStream([
				{ type: 'tool-call', toolCallId: 'id1', toolName: 'postalCodeLookup', args: { zipCode: '1000001' } },
			]),
		} as never);

		const integration = new OpenAIChatIntegration(
			'test-api-key',
			createLocalMockPostalCodeIntegration(),
			createLocalMockWeatherIntegration(),
		);
		const events: ChatStreamEvent[] = [];
		for await (const event of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			events.push(event);
		}

		expect(events).toEqual([{ type: 'tool_call', toolName: 'postalCodeLookup' }]);
	});

	// 正常系: tool-result パートが tool_result イベントとして yield されることを検証する
	it('should yield tool_result event from tool-result part', async () => {
		const { streamText } = await import('ai');
		vi.mocked(streamText).mockResolvedValue({
			fullStream: makeFullStream([
				{ type: 'tool-result', toolCallId: 'id1', toolName: 'postalCodeLookup', output: '東京都千代田区大手町' },
			]),
		} as never);

		const integration = new OpenAIChatIntegration(
			'test-api-key',
			createLocalMockPostalCodeIntegration(),
			createLocalMockWeatherIntegration(),
		);
		const events: ChatStreamEvent[] = [];
		for await (const event of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			events.push(event);
		}

		expect(events).toEqual([{ type: 'tool_result', toolName: 'postalCodeLookup', result: '東京都千代田区大手町' }]);
	});

	// 正常系: finish 等の未知パートは無視されることを検証する
	it('should ignore unknown part types like finish', async () => {
		const { streamText } = await import('ai');
		vi.mocked(streamText).mockResolvedValue({
			fullStream: makeFullStream([
				{ type: 'step-finish', finishReason: 'stop' },
				{ type: 'finish', finishReason: 'stop' },
				{ type: 'text-delta', text: 'OK' },
			]),
		} as never);

		const integration = new OpenAIChatIntegration(
			'test-api-key',
			createLocalMockPostalCodeIntegration(),
			createLocalMockWeatherIntegration(),
		);
		const events: ChatStreamEvent[] = [];
		for await (const event of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			events.push(event);
		}

		expect(events).toEqual([{ type: 'text', text: 'OK' }]);
	});

	// 正常系: streamText にメッセージ履歴が正しく渡されることを検証する
	it('should pass messages to streamText correctly', async () => {
		const { streamText } = await import('ai');
		vi.mocked(streamText).mockResolvedValue({
			fullStream: makeFullStream([]),
		} as never);

		const integration = new OpenAIChatIntegration(
			'test-api-key',
			createLocalMockPostalCodeIntegration(),
			createLocalMockWeatherIntegration(),
		);
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
		vi.mocked(streamText).mockRejectedValue(new Error('API 接続エラー'));

		const integration = new OpenAIChatIntegration(
			'test-api-key',
			createLocalMockPostalCodeIntegration(),
			createLocalMockWeatherIntegration(),
		);
		const gen = integration.streamReply([{ role: 'user', content: 'Hi' }]);

		await expect(gen.next()).rejects.toThrow(InfrastructureError);
	});

	// 異常系: streamText が非 Error をスローした場合にも InfrastructureError にラップされることを検証する
	it('should throw InfrastructureError when streamText throws a non-Error value', async () => {
		const { streamText } = await import('ai');
		vi.mocked(streamText).mockRejectedValue('string error');

		const integration = new OpenAIChatIntegration(
			'test-api-key',
			createLocalMockPostalCodeIntegration(),
			createLocalMockWeatherIntegration(),
		);
		const gen = integration.streamReply([{ role: 'user', content: 'Hi' }]);

		await expect(gen.next()).rejects.toThrow(InfrastructureError);
	});

	// 正常系: ツールの execute が住所を返す場合に文字列を返すことを検証する
	it('should return address string from tool execute when address is found', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockResolvedValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockPostalCode = createLocalMockPostalCodeIntegration();
		vi.mocked(mockPostalCode.lookup).mockResolvedValue({
			prefecture: '東京都',
			city: '千代田区',
			town: '大手町',
		});

		const integration = new OpenAIChatIntegration('test-api-key', mockPostalCode, createLocalMockWeatherIntegration());
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

	// 正常系: ツールの execute が住所が見つからない場合に案内文字列を返すことを検証する
	it('should return not-found message from tool execute when address is null', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockResolvedValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockPostalCode = createLocalMockPostalCodeIntegration();
		vi.mocked(mockPostalCode.lookup).mockResolvedValue(null);

		const integration = new OpenAIChatIntegration('test-api-key', mockPostalCode, createLocalMockWeatherIntegration());
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

	// 正常系: currentTime ツールの execute が JST 形式の文字列を返すことを検証する
	it('should return JST datetime string from currentTime tool execute', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockResolvedValue({
			fullStream: makeFullStream([]),
		} as never);

		const integration = new OpenAIChatIntegration(
			'test-api-key',
			createLocalMockPostalCodeIntegration(),
			createLocalMockWeatherIntegration(),
		);
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain して tool を登録させる
		}

		// currentTime ツールは登録順の 2 番目 (startIndex + 1)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 1]?.[0] as unknown as {
			execute: (input: Record<string, never>) => Promise<string>;
		};
		const result = await toolConfig.execute({});

		// JST 形式 (YYYY年MM月DD日 HH:MM (JST)) であることを検証する
		expect(result).toMatch(/^\d{4}年\d{2}月\d{2}日 \d{2}:\d{2} \(JST\)$/);
	});

	// 正常系: weather ツールの execute が天気情報文字列を返すことを検証する
	it('should return weather info string from weather tool execute', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockResolvedValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockWeather = createLocalMockWeatherIntegration();
		vi.mocked(mockWeather.lookup).mockResolvedValue({
			description: 'Partly cloudy',
			humidity: 70,
			temperatureCelsius: 15,
		});

		const integration = new OpenAIChatIntegration('test-api-key', createLocalMockPostalCodeIntegration(), mockWeather);
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain して tool を登録させる
		}

		// weather ツールは登録順の 3 番目 (startIndex + 2)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 2]?.[0] as unknown as {
			execute: (input: { address: string }) => Promise<string>;
		};
		const result = await toolConfig.execute({ address: '東京都千代田区' });

		expect(result).toBe('東京都千代田区の現在の天気: Partly cloudy、気温: 15°C、湿度: 70%');
	});

	// 正常系: weather ツールの execute が null 返却時に案内文字列を返すことを検証する
	it('should return not-found message from weather tool execute when weather is null', async () => {
		const { streamText, tool: toolFn } = await import('ai');
		vi.mocked(streamText).mockResolvedValue({
			fullStream: makeFullStream([]),
		} as never);

		const mockWeather = createLocalMockWeatherIntegration();
		vi.mocked(mockWeather.lookup).mockResolvedValue(null);

		const integration = new OpenAIChatIntegration('test-api-key', createLocalMockPostalCodeIntegration(), mockWeather);
		const startIndex = vi.mocked(toolFn).mock.calls.length;
		for await (const _ of integration.streamReply([{ role: 'user', content: 'Hi' }])) {
			// drain
		}

		// weather ツールは登録順の 3 番目 (startIndex + 2)
		const toolConfig = vi.mocked(toolFn).mock.calls[startIndex + 2]?.[0] as unknown as {
			execute: (input: { address: string }) => Promise<string>;
		};
		const result = await toolConfig.execute({ address: '不明な場所' });

		expect(result).toBe('天気情報を取得できませんでした');
	});
});
