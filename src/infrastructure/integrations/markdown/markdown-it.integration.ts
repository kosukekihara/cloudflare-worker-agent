import MarkdownIt from 'markdown-it';
import cjkFriendly from 'markdown-it-cjk-friendly';
import type { MarkdownIntegration } from '~/application/ports/integrations/markdown/markdown.integration';

/**
 * markdown-it と markdown-it-cjk-friendly を使った MarkdownIntegration の具象実装
 *
 * - markdown-it: Markdown テキストを HTML に変換する
 * - markdown-it-cjk-friendly: CJK 文字 (日本語・中国語・韓国語) に隣接する強調記号 (**) の
 *   認識問題を修正する
 * - mermaid フェンスコードブロックは <pre class="mermaid"> タグに変換し、
 *   クライアント側で mermaid.run() によって描画される
 */
export class MarkdownItIntegration implements MarkdownIntegration {
	private readonly md: MarkdownIt;

	public constructor() {
		this.md = new MarkdownIt({
			html: false, // XSS 対策: 生の HTML タグをエスケープする
			breaks: true, // 改行を <br> に変換する
			linkify: true, // URL を自動でリンク化する
		}).use(cjkFriendly);

		this.setupFenceRenderer();
	}

	/**
	 * Markdown テキストを HTML 文字列に変換する
	 *
	 * mermaid フェンスコードブロック (```mermaid ... ```) を
	 * <pre class="mermaid"> タグに変換してから markdown-it でレンダリングする。
	 *
	 * @param markdown 変換対象の Markdown テキスト
	 * @returns HTML 文字列
	 */
	public render(markdown: string): string {
		return this.md.render(markdown);
	}

	/**
	 * mermaid フェンスブロックを <pre class="mermaid"> に変換するレンダラーを設定する
	 *
	 * markdown-it の html オプションが false の場合、前処理で注入した <pre> タグが
	 * エスケープされるため、レンダラールールのオーバーライドで対応する。
	 */
	private setupFenceRenderer(): void {
		const originalFenceRule = this.md.renderer.rules.fence;

		this.md.renderer.rules.fence = (tokens, idx, options, env, self) => {
			const token = tokens[idx];
			if (token === undefined) {
				return '';
			}

			const info = token.info.trim();
			if (info === 'mermaid') {
				return `<pre class="mermaid">${token.content.trim()}</pre>\n`;
			}

			if (originalFenceRule !== undefined) {
				return originalFenceRule(tokens, idx, options, env, self);
			}
			return self.renderToken(tokens, idx, options);
		};
	}
}
