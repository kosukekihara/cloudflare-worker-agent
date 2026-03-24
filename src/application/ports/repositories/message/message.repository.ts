import type { MessageRole } from '~/domain/entities/message.entity';

/**
 * DB に保存されるメッセージデータ
 */
export interface MessageRecord {
	readonly id: string;
	readonly conversationId: string;
	readonly role: MessageRole;
	readonly content: string;
	readonly createdAt: Date;
}

/**
 * メッセージ保存時の入力データ
 */
export interface SaveMessageInput {
	readonly conversationId: string;
	readonly role: MessageRole;
	readonly content: string;
}

/**
 * メッセージリポジトリのインターフェース
 */
export interface MessageRepository {
	/**
	 * 会話 ID に紐づくメッセージを全件取得する
	 *
	 * @param conversationId 会話 ID
	 * @returns メッセージデータの配列 (createdAt 昇順)
	 */
	findByConversationId(conversationId: string): Promise<MessageRecord[]>;

	/**
	 * メッセージを永続化する (新規作成)
	 *
	 * @param input メッセージ保存データ
	 * @returns 保存されたメッセージデータ
	 */
	save(input: SaveMessageInput): Promise<MessageRecord>;
}
