/**
 * Markdown テキストを HTML に変換する Integration の Port インターフェース
 *
 * Mermaid フェンスコードブロックは <pre class="mermaid"> タグに変換し、
 * クライアント側で mermaid.run() によって描画される。
 */
export interface MarkdownIntegration {
	/**
	 * Markdown テキストを HTML 文字列に変換する
	 *
	 * @param markdown 変換対象の Markdown テキスト
	 * @returns HTML 文字列 (mermaid ブロックは <pre class="mermaid"> に変換済み)
	 */
	render(markdown: string): string;
}
