/**
 * LLM に渡すメッセージ
 */
export interface ChatIntegrationMessage {
	readonly role: 'user' | 'assistant';
	readonly content: string;
}

/**
 * チャット LLM 統合のインターフェース
 *
 * テキストチャンクを逐次 yield する AsyncGenerator を返す。
 */
export interface ChatIntegration {
	/**
	 * メッセージ履歴をもとに AI 応答をストリーミングで生成する
	 *
	 * @param messages 会話履歴 (時系列昇順)
	 * @yields テキストチャンク
	 */
	streamReply(messages: ChatIntegrationMessage[]): AsyncGenerator<string, void, unknown>;
}
