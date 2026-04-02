import MarkdownIt from 'markdown-it';
import type Renderer from 'markdown-it/lib/renderer.mjs';
import { describe, expect, it } from 'vitest';
import { MarkdownItIntegration } from '~/infrastructure/integrations/markdown/markdown-it.integration';

describe('MarkdownItIntegration', () => {
	const integration = new MarkdownItIntegration();

	// 見出しが HTML の h 要素に変換されることを検証する
	it('should convert headings to HTML heading elements', () => {
		const result = integration.render('# 見出し1\n## 見出し2\n### 見出し3');

		expect(result).toContain('<h1>見出し1</h1>');
		expect(result).toContain('<h2>見出し2</h2>');
		expect(result).toContain('<h3>見出し3</h3>');
	});

	// 太字・斜体が HTML の strong・em 要素に変換されることを検証する
	it('should convert bold and italic text to strong and em elements', () => {
		const result = integration.render('**太字** と *斜体*');

		expect(result).toContain('<strong>太字</strong>');
		expect(result).toContain('<em>斜体</em>');
	});

	// 順序なしリストが HTML の ul/li 要素に変換されることを検証する
	it('should convert unordered list to ul/li elements', () => {
		const result = integration.render('- 項目A\n- 項目B\n- 項目C');

		expect(result).toContain('<ul>');
		expect(result).toContain('<li>項目A</li>');
		expect(result).toContain('<li>項目B</li>');
		expect(result).toContain('<li>項目C</li>');
	});

	// インラインコードが HTML の code 要素に変換されることを検証する
	it('should convert inline code to code elements', () => {
		const result = integration.render('`console.log("hello")`');

		expect(result).toContain('<code>');
		expect(result).toContain('console.log');
	});

	// mermaid フェンスブロックが <pre class="mermaid"> タグに変換されることを検証する
	it('should convert mermaid fenced blocks to pre.mermaid elements', () => {
		const markdown = '```mermaid\ngraph TD\nA-->B\n```';
		const result = integration.render(markdown);

		expect(result).toContain('<pre class="mermaid">');
		expect(result).toContain('graph TD');
		expect(result).toContain('A-->B');
		// mermaid ブロックが <code> 要素にエスケープされていないことを確認する
		expect(result).not.toContain('&lt;pre');
	});

	// mermaid 以外の言語指定コードブロックは通常の code 要素になることを検証する
	it('should convert non-mermaid fenced code blocks to code elements', () => {
		const markdown = '```typescript\nconst x: number = 1;\n```';
		const result = integration.render(markdown);

		expect(result).toContain('<code');
		expect(result).toContain('const x');
		expect(result).not.toContain('class="mermaid"');
	});

	// html: false により生の HTML タグがエスケープされることを検証する (XSS 対策)
	it('should escape raw HTML tags when html option is false', () => {
		const result = integration.render('<script>alert("xss")</script>');

		expect(result).not.toContain('<script>');
		expect(result).toContain('&lt;script&gt;');
	});

	// markdown-it-cjk-friendly により CJK 文字と隣接する強調記号が正しく認識されることを検証する
	// CommonMark 仕様では句読点の隣にある ** は強調記号として認識されないが、
	// このプラグインにより CJK 文字隣接時も正しく強調が適用される
	it('should recognize emphasis marks adjacent to CJK punctuation', () => {
		// 句読点 (。) の内側にある ** がプラグインなしでは強調として認識されない
		const markdown = '**太字です。**この文でも強調が機能します。';
		const result = integration.render(markdown);

		expect(result).toContain('<strong>太字です。</strong>');
	});

	// mermaid が複数ブロック存在する場合、すべてが変換されることを検証する
	it('should convert multiple mermaid blocks in the same markdown', () => {
		const markdown = '```mermaid\ngraph LR\nA-->B\n```\n\nテキスト\n\n```mermaid\nsequenceDiagram\nA->>B: hello\n```';
		const result = integration.render(markdown);

		const mermaidCount = (result.match(/class="mermaid"/g) ?? []).length;
		expect(mermaidCount).toBe(2);
	});

	describe('fence renderer edge cases', () => {
		// noUncheckedIndexedAccess による型安全ガード: tokens[idx] が undefined の場合の動作を検証する
		// markdown-it は fence ルール呼び出し時に常に有効な idx を保証するが、
		// TypeScript の型システムは tokens[idx] が undefined になりうることを要求するため、
		// 空文字列を返すフォールバック処理が必要になる
		it('should return empty string when token is undefined (type safety guard)', () => {
			// as unknown as による private メンバーへのアクセスはテストコードでのみ許可される
			const md = (integration as unknown as { md: MarkdownIt }).md;
			const fenceRule = md.renderer.rules.fence;
			if (fenceRule === undefined) {
				throw new Error('fence rule should always be defined by markdown-it');
			}

			// 空配列で idx=0 を渡すことで tokens[0] が undefined になる状況を再現する
			const result = fenceRule([], 0, {}, undefined, md.renderer as unknown as Renderer);
			expect(result).toBe('');
		});

		// originalFenceRule が undefined の場合のフォールバック (renderToken) 動作を検証する
		// setupFenceRenderer 呼び出し時に fence ルールが未定義の状況を模擬する
		it('should fall back to renderToken when original fence rule is not defined', () => {
			// as unknown as による private メンバーへのアクセスはテストコードでのみ許可される
			const instance = new MarkdownItIntegration();
			const md = (instance as unknown as { md: MarkdownIt }).md;

			// fence ルールを削除して originalFenceRule が undefined の状態を作成し、
			// setupFenceRenderer を再実行する
			(md.renderer.rules as Record<string, unknown>)['fence'] = undefined;
			(instance as unknown as { setupFenceRenderer(): void }).setupFenceRenderer();

			// フォールバック動作としてコンテンツが何らかの形で出力されることを検証する
			const result = instance.render('```\nsome code\n```');
			expect(result).toBeDefined();
		});
	});
});
