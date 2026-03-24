import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import type { ChatIntegration, ChatIntegrationMessage } from '~/application/ports/integrations/chat/chat.integration';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

/**
 * OpenAI を使った ChatIntegration の具象実装
 *
 * ai-sdk の streamText を使用してテキストをストリーミング生成する。
 */
export class OpenAIChatIntegration implements ChatIntegration {
	private readonly apiKey: string;

	public constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	public async *streamReply(messages: ChatIntegrationMessage[]): AsyncGenerator<string, void, unknown> {
		try {
			const openai = createOpenAI({ apiKey: this.apiKey });
			const result = await streamText({
				messages: messages.map(m => ({ content: m.content, role: m.role })),
				model: openai('gpt-4o-mini'),
			});

			for await (const chunk of result.textStream) {
				yield chunk;
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
