/**
 * LLM に渡すメッセージ
 */
export interface ChatIntegrationMessage {
	readonly role: 'user' | 'assistant';
	readonly content: string;
}

/**
 * チャットストリームのイベント型
 *
 * - text: テキストチャンク
 * - tool_call: ツール呼び出し開始
 * - tool_result: ツール呼び出し結果
 */
export type ChatStreamEvent =
	| { readonly type: 'text'; readonly text: string }
	| { readonly type: 'tool_call'; readonly toolName: string }
	| { readonly type: 'tool_result'; readonly toolName: string; readonly result: string };

/**
 * チャット LLM 統合のインターフェース
 *
 * テキストやツールイベントを逐次 yield する AsyncGenerator を返す。
 */
export interface ChatIntegration {
	/**
	 * メッセージ履歴をもとに AI 応答をストリーミングで生成する
	 *
	 * @param messages 会話履歴 (時系列昇順)
	 * @yields チャットストリームイベント
	 */
	streamReply(messages: ChatIntegrationMessage[]): AsyncGenerator<ChatStreamEvent, void, unknown>;
}
