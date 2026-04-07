/**
 * streamReply が使用する ToolLoopAgent.stream の最小契約
 * (クラスフィールドに SDK のツールジェネリクスを載せると exactOptionalPropertyTypes で不整合になる)
 */
export interface ToolLoopStreamAdapter {
	stream(parameters: { messages: Array<{ role: string; content: string }> }): Promise<{
		fullStream: AsyncIterable<{
			type: string;
			text?: string;
			toolName?: string;
			output?: unknown;
		}>;
	}>;
}
