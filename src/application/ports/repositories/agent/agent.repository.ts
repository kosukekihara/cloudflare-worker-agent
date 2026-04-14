/**
 * エージェントのリポジトリレコード型
 */
export interface AgentRecord {
	readonly id: string;
	readonly name: string;
	readonly modelId: string;
	readonly instruction: string;
	readonly enabledTools: string[];
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

/**
 * エージェント保存時の入力型
 */
export interface SaveAgentInput {
	readonly name: string;
	readonly modelId: string;
	readonly instruction: string;
	readonly enabledTools: string[];
}

/**
 * エージェント更新時の入力型
 */
export interface UpdateAgentInput {
	readonly name?: string;
	readonly modelId?: string;
	readonly instruction?: string;
	readonly enabledTools?: string[];
}

/**
 * エージェントリポジトリのインターフェース
 */
export interface AgentRepository {
	/**
	 * ID でエージェントを検索する
	 *
	 * @param id エージェント ID
	 * @returns エージェントレコード、存在しない場合は null
	 */
	findById(id: string): Promise<AgentRecord | null>;

	/**
	 * 全エージェントを取得する
	 *
	 * @returns エージェントレコードの配列
	 */
	findAll(): Promise<AgentRecord[]>;

	/**
	 * エージェントを保存する
	 *
	 * @param input 保存するエージェントの情報
	 * @returns 保存されたエージェントレコード
	 */
	save(input: SaveAgentInput): Promise<AgentRecord>;

	/**
	 * ID でエージェントを更新する
	 *
	 * @param id 更新するエージェントの ID
	 * @param data 更新するフィールド
	 * @returns 更新されたエージェントレコード
	 */
	updateById(id: string, data: UpdateAgentInput): Promise<AgentRecord>;

	/**
	 * ID でエージェントを削除する
	 *
	 * @param id 削除するエージェントの ID
	 */
	deleteById(id: string): Promise<void>;
}
