/**
 * テキストを埋め込みベクトルに変換する Integration の Port インターフェース
 */
export interface EmbeddingIntegration {
	/**
	 * テキストを埋め込みベクトルに変換する
	 *
	 * @param text 埋め込み対象のテキスト
	 * @returns 埋め込みベクトル (3072 次元)
	 * @throws {InfrastructureError} API 呼び出しに失敗した場合
	 */
	embed(text: string): Promise<number[]>;
}
