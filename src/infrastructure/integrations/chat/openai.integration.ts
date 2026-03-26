import { createOpenAI } from '@ai-sdk/openai';
import { stepCountIs, streamText, tool, zodSchema } from 'ai';
import { z } from 'zod';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import type {
	ChatIntegration,
	ChatIntegrationMessage,
	ChatStreamEvent,
} from '~/application/ports/integrations/chat/chat.integration';
import type { PostalCodeIntegration } from '~/application/ports/integrations/postal-code/postal-code.integration';
import type { WeatherIntegration } from '~/application/ports/integrations/weather/weather.integration';

/**
 * OpenAI を使った ChatIntegration の具象実装
 *
 * ai-sdk の streamText を使用してテキストおよびツールイベントをストリーミング生成する。
 * 郵便番号検索ツール・JST現在時刻ツール・天気ツールを提供し、LLM がツールを呼び出せるようにする。
 */
export class OpenAIChatIntegration implements ChatIntegration {
	private readonly apiKey: string;
	private readonly postalCodeIntegration: PostalCodeIntegration;
	private readonly weatherIntegration: WeatherIntegration;

	public constructor(
		apiKey: string,
		postalCodeIntegration: PostalCodeIntegration,
		weatherIntegration: WeatherIntegration,
	) {
		this.apiKey = apiKey;
		this.postalCodeIntegration = postalCodeIntegration;
		this.weatherIntegration = weatherIntegration;
	}

	public async *streamReply(messages: ChatIntegrationMessage[]): AsyncGenerator<ChatStreamEvent, void, unknown> {
		try {
			const openai = createOpenAI({ apiKey: this.apiKey });

			const postalCodeTool = tool({
				description: '郵便番号から都道府県・市区町村・町域を検索する',
				inputSchema: zodSchema(
					z.object({
						zipCode: z.string().describe('郵便番号 (ハイフンあり・なし両方可。例: 100-0001 または 1000001)'),
					}),
				),
				execute: async (input: { zipCode: string }) => {
					const address = await this.postalCodeIntegration.lookup(input.zipCode);
					if (!address) {
						return '該当する住所が見つかりませんでした';
					}
					return `${address.prefecture}${address.city}${address.town}`;
				},
			});

			const currentTimeTool = tool({
				description: '現在の日本時間 (JST) を返す',
				inputSchema: zodSchema(z.object({})),
				execute: async () => {
					const now = new Date();
					// UTC+9 に変換
					const jstOffsetMs = 9 * 60 * 60 * 1000;
					const jst = new Date(now.getTime() + jstOffsetMs);
					const year = jst.getUTCFullYear();
					const month = String(jst.getUTCMonth() + 1).padStart(2, '0');
					const day = String(jst.getUTCDate()).padStart(2, '0');
					const hours = String(jst.getUTCHours()).padStart(2, '0');
					const minutes = String(jst.getUTCMinutes()).padStart(2, '0');
					return `${year}年${month}月${day}日 ${hours}:${minutes} (JST)`;
				},
			});

			const weatherTool = tool({
				description: '住所を渡すとその地点付近の現在の天気と気温を返す',
				inputSchema: zodSchema(
					z.object({
						address: z.string().describe('天気を調べたい住所や地名 (例: 東京都千代田区、大阪城)'),
					}),
				),
				execute: async (input: { address: string }) => {
					const info = await this.weatherIntegration.lookup(input.address);
					if (!info) {
						return '天気情報を取得できませんでした';
					}
					return `${input.address}の現在の天気: ${info.description}、気温: ${info.temperatureCelsius}°C、湿度: ${info.humidity}%`;
				},
			});

			const result = await streamText({
				messages: messages.map(m => ({ content: m.content, role: m.role })),
				model: openai('gpt-4o-mini'),
				stopWhen: stepCountIs(5),
				tools: { currentTime: currentTimeTool, postalCodeLookup: postalCodeTool, weather: weatherTool },
			});

			for await (const part of result.fullStream) {
				if (part.type === 'text-delta') {
					yield { type: 'text', text: part.text };
				} else if (part.type === 'tool-call') {
					yield { type: 'tool_call', toolName: part.toolName };
				} else if (part.type === 'tool-result') {
					yield { type: 'tool_result', toolName: part.toolName, result: String(part.output) };
				}
			}
		} catch (error) {
			const message = (() => {
				if (error instanceof Error) {
					return error.message;
				} else {
					return String(error);
				}
			})();
			throw new InfrastructureError(`OpenAI ストリーミング中にエラーが発生しました: ${message}`);
		}
	}
}
