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
 * 類似度検索結果のメッセージデータ
 */
export interface SimilarMessageRecord extends MessageRecord {
	readonly similarity: number;
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

	/**
	 * メッセージの埋め込みベクトルを更新する
	 *
	 * @param id 対象メッセージ ID
	 * @param embedding 埋め込みベクトル (3072 次元)
	 */
	updateEmbedding(id: string, embedding: number[]): Promise<void>;

	/**
	 * 埋め込みベクトルで意味的に近いメッセージを検索する
	 *
	 * @param embedding 検索クエリの埋め込みベクトル (3072 次元)
	 * @param limit 返却件数の上限
	 * @returns 類似度降順のメッセージ配列
	 */
	searchSimilar(embedding: number[], limit: number): Promise<SimilarMessageRecord[]>;
}
