import type { ChatIntegration, ChatIntegrationMessage } from '~/application/ports/integrations/chat/chat.integration';
import type { ConversationRepository } from '~/application/ports/repositories/conversation/conversation.repository';
import type { MessageRepository } from '~/application/ports/repositories/message/message.repository';
import { ConversationNotFoundError } from '~/domain/errors/conversation-not-found.error';

export interface SendChatMessageInput {
	readonly conversationId: string;
	readonly content: string;
}

/**
 * ユーザーメッセージを送信し AI 応答をストリーミングで返すユースケース
 *
 * - ユーザーメッセージを DB に保存する
 * - 会話履歴をもとに LLM にストリーミングで問い合わせる
 * - 各テキストチャンクを yield する
 * - ストリーム完了後、AI 応答全文を DB に保存する
 *
 * @throws ConversationNotFoundError 指定 ID の会話が存在しない場合
 */
export class SendChatMessageUseCase {
	private readonly conversationRepository: ConversationRepository;
	private readonly messageRepository: MessageRepository;
	private readonly chatIntegration: ChatIntegration;

	public constructor(
		conversationRepository: ConversationRepository,
		messageRepository: MessageRepository,
		chatIntegration: ChatIntegration,
	) {
		this.conversationRepository = conversationRepository;
		this.messageRepository = messageRepository;
		this.chatIntegration = chatIntegration;
	}

	public async *execute(input: SendChatMessageInput): AsyncGenerator<string, void, unknown> {
		const conversation = await this.conversationRepository.findById(input.conversationId);
		if (!conversation) {
			throw new ConversationNotFoundError(`Conversation with id "${input.conversationId}" not found`);
		}

		const existingMessages = await this.messageRepository.findByConversationId(input.conversationId);

		await this.messageRepository.save({
			content: input.content,
			conversationId: input.conversationId,
			role: 'user',
		});

		const history: ChatIntegrationMessage[] = existingMessages.map(m => ({
			content: m.content,
			role: m.role,
		}));

		const userMessage: ChatIntegrationMessage = { content: input.content, role: 'user' };
		const messages: ChatIntegrationMessage[] = [...history, userMessage];

		const chunks: string[] = [];

		for await (const chunk of this.chatIntegration.streamReply(messages)) {
			chunks.push(chunk);
			yield chunk;
		}

		await this.messageRepository.save({
			content: chunks.join(''),
			conversationId: input.conversationId,
			role: 'assistant',
		});
	}
}
