/**
 * DB に保存されるユーザーデータ
 */
export interface UserRecord {
	readonly id: string;
	readonly email: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

/**
 * ユーザー保存時の入力データ
 */
export interface SaveUserInput {
	readonly email: string;
}

/**
 * ユーザーリポジトリのインターフェース
 */
export interface UserRepository {
	/**
	 * ID でユーザーを検索する
	 *
	 * @param id ユーザー ID
	 * @returns ユーザーデータ。見つからない場合は null
	 */
	findById(id: string): Promise<UserRecord | null>;

	/**
	 * ユーザーを永続化する (新規作成)
	 *
	 * @param input ユーザー保存データ
	 * @returns 保存されたユーザーデータ
	 */
	save(input: SaveUserInput): Promise<UserRecord>;

	/**
	 * 全ユーザーを取得する
	 *
	 * @returns ユーザーデータの配列 (createdAt 降順)
	 */
	findAll(): Promise<UserRecord[]>;

	/**
	 * メールアドレスでユーザーを検索する
	 *
	 * @param email メールアドレス
	 * @returns ユーザーデータ。見つからない場合は null
	 */
	findByEmail(email: string): Promise<UserRecord | null>;

	/**
	 * ID でユーザーを更新する
	 *
	 * @param id ユーザー ID
	 * @param data 更新データ
	 * @returns 更新されたユーザーデータ
	 */
	updateById(id: string, data: { email: string }): Promise<UserRecord>;

	/**
	 * ID でユーザーを削除する
	 *
	 * @param id ユーザー ID
	 */
	deleteById(id: string): Promise<void>;
}
