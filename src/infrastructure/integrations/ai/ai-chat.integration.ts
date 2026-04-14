import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import type {
	ChatAgentConfig,
	ChatIntegration,
	ChatIntegrationMessage,
	ChatStreamEvent,
} from '~/application/ports/integrations/chat/chat.integration';
import type { EmbeddingIntegration } from '~/application/ports/integrations/embedding/embedding.integration';
import type { PostalCodeIntegration } from '~/application/ports/integrations/postal-code/postal-code.integration';
import type { WeatherIntegration } from '~/application/ports/integrations/weather/weather.integration';
import type { MessageRepository } from '~/application/ports/repositories/message/message.repository';
import type { DeleteUserUseCase } from '~/application/use-cases/user/delete-user.use-case';
import type { GetUsersUseCase } from '~/application/use-cases/user/get-users.use-case';
import type { RegisterUserUseCase } from '~/application/use-cases/user/register-user.use-case';
import type { UpdateUserUseCase } from '~/application/use-cases/user/update-user.use-case';
import { buildDynamicChatAgent } from '~/infrastructure/integrations/ai/agents/dynamic-chat.agent';
import { buildGeminiChatToolSet } from '~/infrastructure/integrations/ai/gemini-chat-tool-set';

/**
 * Google Gemini / OpenAI + ToolLoopAgent による ChatIntegration
 *
 * streamReply 呼び出しのたびに agentConfig に従ってエージェントをビルドする。
 * モデル・インストラクション・有効ツールはすべて agentConfig で動的に決定される。
 *
 * modelId のフォーマット:
 * - `openai:<model>` → OpenAI プロバイダー (例: openai:gpt-5.4-mini)
 * - `<model>` のみ → Google Gemini プロバイダー (例: gemini-3.1-flash-lite-preview)
 */
export class GeminiChatIntegration implements ChatIntegration {
	private readonly googleApiKey: string;
	private readonly openaiApiKey: string;
	private readonly postalCodeIntegration: PostalCodeIntegration;
	private readonly weatherIntegration: WeatherIntegration;
	private readonly registerUserUseCase: RegisterUserUseCase;
	private readonly getUsersUseCase: GetUsersUseCase;
	private readonly updateUserUseCase: UpdateUserUseCase;
	private readonly deleteUserUseCase: DeleteUserUseCase;
	private readonly embeddingIntegration: EmbeddingIntegration;
	private readonly messageRepository: MessageRepository;

	public constructor(
		googleApiKey: string,
		openaiApiKey: string,
		postalCodeIntegration: PostalCodeIntegration,
		weatherIntegration: WeatherIntegration,
		registerUserUseCase: RegisterUserUseCase,
		getUsersUseCase: GetUsersUseCase,
		updateUserUseCase: UpdateUserUseCase,
		deleteUserUseCase: DeleteUserUseCase,
		embeddingIntegration: EmbeddingIntegration,
		messageRepository: MessageRepository,
	) {
		this.googleApiKey = googleApiKey;
		this.openaiApiKey = openaiApiKey;
		this.postalCodeIntegration = postalCodeIntegration;
		this.weatherIntegration = weatherIntegration;
		this.registerUserUseCase = registerUserUseCase;
		this.getUsersUseCase = getUsersUseCase;
		this.updateUserUseCase = updateUserUseCase;
		this.deleteUserUseCase = deleteUserUseCase;
		this.embeddingIntegration = embeddingIntegration;
		this.messageRepository = messageRepository;
	}

	public async *streamReply(
		messages: ChatIntegrationMessage[],
		agentConfig: ChatAgentConfig,
	): AsyncGenerator<ChatStreamEvent, void, unknown> {
		try {
			let provider: string;
			let modelName: string;
			if (agentConfig.modelId.includes(':')) {
				[provider, modelName] = agentConfig.modelId.split(':', 2) as [string, string];
			} else {
				provider = 'google';
				modelName = agentConfig.modelId;
			}

			const model = (() => {
				if (provider === 'openai') {
					return createOpenAI({ apiKey: this.openaiApiKey })(modelName);
				} else {
					return createGoogleGenerativeAI({ apiKey: this.googleApiKey })(modelName);
				}
			})();

			const allTools = buildGeminiChatToolSet({
				postalCodeIntegration: this.postalCodeIntegration,
				weatherIntegration: this.weatherIntegration,
				registerUserUseCase: this.registerUserUseCase,
				getUsersUseCase: this.getUsersUseCase,
				updateUserUseCase: this.updateUserUseCase,
				deleteUserUseCase: this.deleteUserUseCase,
				embeddingIntegration: this.embeddingIntegration,
				messageRepository: this.messageRepository,
			});

			const enabledSet = new Set(agentConfig.enabledTools);
			const filteredTools = Object.fromEntries(Object.entries(allTools).filter(([key]) => enabledSet.has(key)));

			const agent = buildDynamicChatAgent(model, filteredTools, agentConfig.instruction);

			const result = await agent.stream({
				messages: messages.map(m => ({ content: m.content, role: m.role })),
			});

			for await (const part of result.fullStream) {
				if (part.type === 'text-delta') {
					if (part.text === undefined) {
						continue;
					}
					yield { type: 'text', text: part.text };
				} else if (part.type === 'tool-call') {
					if (part.toolName === undefined) {
						continue;
					}
					yield { type: 'tool_call', toolName: part.toolName };
				} else if (part.type === 'tool-result') {
					if (part.toolName === undefined) {
						continue;
					}
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
			throw new InfrastructureError(`Gemini ストリーミング中にエラーが発生しました: ${message}`);
		}
	}
}
