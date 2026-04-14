import type {
	ChatAgentConfig,
	ChatIntegration,
	ChatIntegrationMessage,
	ChatStreamEvent,
} from '~/application/ports/integrations/chat/chat.integration';
import type { EmbeddingIntegration } from '~/application/ports/integrations/embedding/embedding.integration';
import type { ConversationRepository } from '~/application/ports/repositories/conversation/conversation.repository';
import type { MessageRepository } from '~/application/ports/repositories/message/message.repository';
import { ConversationNotFoundError } from '~/domain/errors/conversation-not-found.error';

export interface SendChatMessageInput {
	readonly conversationId: string;
	readonly content: string;
	readonly agentConfig: ChatAgentConfig;
}

/**
 * ユーザーメッセージを送信し AI 応答をストリーミングで返すユースケース
 *
 * - ユーザーメッセージを DB に保存し、埋め込みベクトルを生成して更新する
 * - 会話履歴をもとに LLM にストリーミングで問い合わせる
 * - 各テキストチャンクを yield する
 * - ストリーム完了後、AI 応答全文を DB に保存し、埋め込みベクトルを生成して更新する
 *
 * @throws ConversationNotFoundError 指定 ID の会話が存在しない場合
 */
export class SendChatMessageUseCase {
	private readonly conversationRepository: ConversationRepository;
	private readonly messageRepository: MessageRepository;
	private readonly chatIntegration: ChatIntegration;
	private readonly embeddingIntegration: EmbeddingIntegration;

	public constructor(
		conversationRepository: ConversationRepository,
		messageRepository: MessageRepository,
		chatIntegration: ChatIntegration,
		embeddingIntegration: EmbeddingIntegration,
	) {
		this.conversationRepository = conversationRepository;
		this.messageRepository = messageRepository;
		this.chatIntegration = chatIntegration;
		this.embeddingIntegration = embeddingIntegration;
	}

	public async *execute(input: SendChatMessageInput): AsyncGenerator<ChatStreamEvent, void, unknown> {
		const conversation = await this.conversationRepository.findById(input.conversationId);
		if (!conversation) {
			throw new ConversationNotFoundError(`Conversation with id "${input.conversationId}" not found`);
		}

		const existingMessages = await this.messageRepository.findByConversationId(input.conversationId);

		const userRecord = await this.messageRepository.save({
			content: input.content,
			conversationId: input.conversationId,
			role: 'user',
		});

		const userEmbedding = await this.embeddingIntegration.embed(input.content);
		await this.messageRepository.updateEmbedding(userRecord.id, userEmbedding);

		const history: ChatIntegrationMessage[] = existingMessages.map(m => ({
			content: m.content,
			role: m.role,
		}));

		const userMessage: ChatIntegrationMessage = { content: input.content, role: 'user' };
		const messages: ChatIntegrationMessage[] = [...history, userMessage];

		const chunks: string[] = [];

		for await (const event of this.chatIntegration.streamReply(messages, input.agentConfig)) {
			yield event;
			if (event.type === 'text') {
				chunks.push(event.text);
			}
		}

		const assistantContent = chunks.join('');

		const assistantRecord = await this.messageRepository.save({
			content: assistantContent,
			conversationId: input.conversationId,
			role: 'assistant',
		});

		const assistantEmbedding = await this.embeddingIntegration.embed(assistantContent);
		await this.messageRepository.updateEmbedding(assistantRecord.id, assistantEmbedding);
	}
}
