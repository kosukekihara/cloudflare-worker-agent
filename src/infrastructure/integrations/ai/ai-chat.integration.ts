import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import type {
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
import { buildCasualChatAgent } from '~/infrastructure/integrations/ai/agents/casual-chat.agent';
import { buildDenierChatAgent } from '~/infrastructure/integrations/ai/agents/denier-chat.agent';
import { buildGeminiChatAgent } from '~/infrastructure/integrations/ai/agents/gemini-chat.agent';
import { buildPraiserChatAgent } from '~/infrastructure/integrations/ai/agents/praiser-chat.agent';
import { ACTIVE_AI_CHAT_AGENT, type AiChatAgentKind } from '~/infrastructure/integrations/ai/ai-chat-agent-kind';
import { buildSubAgentTool } from '~/infrastructure/integrations/ai/build-sub-agent-tool';
import { buildGeminiChatToolSet } from '~/infrastructure/integrations/ai/gemini-chat-tool-set';
import type { ToolLoopStreamAdapter } from '~/infrastructure/integrations/ai/tool-loop-stream.types';

/**
 * チャット生成で用いる Gemini モデル ID
 * モデルだけ差し替える場合はここを変更する
 */
export const GEMINI_CHAT_MODEL_ID = 'gemini-3.1-flash-lite-preview' as const;

/**
 * Google Gemini + ToolLoopAgent による ChatIntegration
 *
 * 性格・システムインストラクションは `agents/*.agent.ts` のビルダーに委譲する。
 * 利用するビルダーは ACTIVE_AI_CHAT_AGENT またはコンストラクタ末尾の agentKindOverride で選ぶ。
 */
export class GeminiChatIntegration implements ChatIntegration {
	private readonly apiKey: string;
	private readonly postalCodeIntegration: PostalCodeIntegration;
	private readonly weatherIntegration: WeatherIntegration;
	private readonly registerUserUseCase: RegisterUserUseCase;
	private readonly getUsersUseCase: GetUsersUseCase;
	private readonly updateUserUseCase: UpdateUserUseCase;
	private readonly deleteUserUseCase: DeleteUserUseCase;
	private readonly embeddingIntegration: EmbeddingIntegration;
	private readonly messageRepository: MessageRepository;
	private readonly agentKind: AiChatAgentKind;
	private readonly agent: ToolLoopStreamAdapter;

	public constructor(
		apiKey: string,
		postalCodeIntegration: PostalCodeIntegration,
		weatherIntegration: WeatherIntegration,
		registerUserUseCase: RegisterUserUseCase,
		getUsersUseCase: GetUsersUseCase,
		updateUserUseCase: UpdateUserUseCase,
		deleteUserUseCase: DeleteUserUseCase,
		embeddingIntegration: EmbeddingIntegration,
		messageRepository: MessageRepository,
		agentKindOverride?: AiChatAgentKind,
	) {
		this.apiKey = apiKey;
		this.postalCodeIntegration = postalCodeIntegration;
		this.weatherIntegration = weatherIntegration;
		this.registerUserUseCase = registerUserUseCase;
		this.getUsersUseCase = getUsersUseCase;
		this.updateUserUseCase = updateUserUseCase;
		this.deleteUserUseCase = deleteUserUseCase;
		this.embeddingIntegration = embeddingIntegration;
		this.messageRepository = messageRepository;
		this.agentKind = agentKindOverride ?? ACTIVE_AI_CHAT_AGENT;
		this.agent = this.buildAgent();
	}

	private buildAgent(): ToolLoopStreamAdapter {
		const google = createGoogleGenerativeAI({ apiKey: this.apiKey });
		const model = google(GEMINI_CHAT_MODEL_ID);
		const tools = buildGeminiChatToolSet({
			postalCodeIntegration: this.postalCodeIntegration,
			weatherIntegration: this.weatherIntegration,
			registerUserUseCase: this.registerUserUseCase,
			getUsersUseCase: this.getUsersUseCase,
			updateUserUseCase: this.updateUserUseCase,
			deleteUserUseCase: this.deleteUserUseCase,
			embeddingIntegration: this.embeddingIntegration,
			messageRepository: this.messageRepository,
		});

		if (this.agentKind === 'praiser') {
			return buildPraiserChatAgent(model, tools);
		}
		if (this.agentKind === 'casual') {
			return buildCasualChatAgent(model, tools);
		}

		// gemini_default: サブエージェントツールを組み込んだメインエージェントを構築する
		// サブエージェント自体は baseTools のみ持ち、無限再帰呼び出しを防ぐ
		const praiserAgent = buildPraiserChatAgent(model, tools);
		const denierAgent = buildDenierChatAgent(model, tools);
		const mainTools = {
			...tools,
			callPraiserAgent: buildSubAgentTool({
				name: 'callPraiserAgent',
				description:
					'ユーザーの気分が落ち込んでいる・元気がない・励ましや肯定が必要と判断したときに呼び出す全力肯定エージェント',
				agent: praiserAgent,
			}),
			callDenierAgent: buildSubAgentTool({
				name: 'callDenierAgent',
				description: 'ユーザーが無礼・失礼・舐めた口をきいていると判断したときに呼び出す全力否定エージェント',
				agent: denierAgent,
			}),
		};
		return buildGeminiChatAgent(model, mainTools);
	}

	public async *streamReply(messages: ChatIntegrationMessage[]): AsyncGenerator<ChatStreamEvent, void, unknown> {
		try {
			const result = await this.agent.stream({
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
