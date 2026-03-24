/**
 * DB に保存される会話データ
 */
export interface ConversationRecord {
	readonly id: string;
	readonly userId: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

/**
 * 会話保存時の入力データ
 */
export interface SaveConversationInput {
	readonly userId: string;
}

/**
 * 会話リポジトリのインターフェース
 */
export interface ConversationRepository {
	/**
	 * ID で会話を検索する
	 *
	 * @param id 会話 ID
	 * @returns 会話データ。見つからない場合は null
	 */
	findById(id: string): Promise<ConversationRecord | null>;

	/**
	 * ユーザー ID に紐づく会話を全件取得する
	 *
	 * @param userId ユーザー ID
	 * @returns 会話データの配列 (createdAt 降順)
	 */
	findByUserId(userId: string): Promise<ConversationRecord[]>;

	/**
	 * 会話を永続化する (新規作成)
	 *
	 * @param input 会話保存データ
	 * @returns 保存された会話データ
	 */
	save(input: SaveConversationInput): Promise<ConversationRecord>;

	/**
	 * ID で会話を削除する (関連メッセージも CASCADE 削除される)
	 *
	 * @param id 会話 ID
	 */
	deleteById(id: string): Promise<void>;
}
