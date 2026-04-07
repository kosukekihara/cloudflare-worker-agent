import { describe, expect, it, vi } from 'vitest';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import { buildSubAgentTool } from '~/infrastructure/integrations/ai/build-sub-agent-tool';
import type { ToolLoopStreamAdapter } from '~/infrastructure/integrations/ai/tool-loop-stream.types';

// tool() と zodSchema() は設定オブジェクトをそのまま返すスタブにする
vi.mock('ai', () => ({
	tool: vi.fn((config: unknown) => config),
	zodSchema: vi.fn((schema: unknown) => schema),
}));

/** fullStream 用の非同期ジェネレーターヘルパー */
async function* makeFullStream(parts: Array<Record<string, unknown>>) {
	for (const part of parts) {
		yield part;
	}
}

/** ToolLoopStreamAdapter のローカルモック */
function createMockAdapter(parts: Array<Record<string, unknown>> = []): ToolLoopStreamAdapter {
	return {
		stream: vi.fn().mockResolvedValue({ fullStream: makeFullStream(parts) }),
	};
}

/** buildSubAgentTool の戻り値から execute 関数を取り出すヘルパー */
function extractExecute(toolResult: ReturnType<typeof buildSubAgentTool>) {
	return (toolResult as unknown as { execute: (input: { task: string }) => Promise<string> }).execute;
}

describe('buildSubAgentTool', () => {
	describe('execute', () => {
		// text-delta パートを連結して返すことを検証する
		it('text-delta を複数受け取ってテキストを連結して返す', async () => {
			// Arrange
			const agent = createMockAdapter([
				{ type: 'text-delta', text: 'こんにちは' },
				{ type: 'tool-call', toolName: 'someTool' }, // text-delta 以外は無視される
				{ type: 'text-delta', text: '、世界！' },
			]);
			const execute = extractExecute(buildSubAgentTool({ name: 'testAgent', description: 'テスト用', agent }));

			// Act
			const result = await execute({ task: 'タスク説明' });

			// Assert
			expect(result).toBe('こんにちは、世界！');
		});

		// text-delta が1件もない場合のデフォルトメッセージを検証する
		it('テキストが空の場合にデフォルトメッセージを返す', async () => {
			// Arrange: text-delta なし (tool-call のみ)
			const agent = createMockAdapter([{ type: 'tool-call', toolName: 'someTool' }]);
			const execute = extractExecute(buildSubAgentTool({ name: 'testAgent', description: 'テスト用', agent }));

			// Act
			const result = await execute({ task: 'タスク説明' });

			// Assert
			expect(result).toBe('サブエージェントから応答がありませんでした');
		});

		// agent.stream() に渡す引数が正しいことを検証する
		it('agent.stream() が正しい引数で呼ばれる', async () => {
			// Arrange
			const agent = createMockAdapter([{ type: 'text-delta', text: '応答' }]);
			const execute = extractExecute(buildSubAgentTool({ name: 'testAgent', description: 'テスト用', agent }));

			// Act
			await execute({ task: '郵便番号を調べて' });

			// Assert: task 文字列が user ロールの単一メッセージとして渡されること
			expect(agent.stream).toHaveBeenCalledWith({
				messages: [{ role: 'user', content: '郵便番号を調べて' }],
			});
		});

		// エラーが InfrastructureError にラップされることを検証する
		it('サブエージェントがエラーをスローしたとき InfrastructureError にラップされる', async () => {
			// Arrange
			const agent: ToolLoopStreamAdapter = {
				stream: vi.fn().mockRejectedValue(new Error('Gemini API エラー')),
			};
			const execute = extractExecute(buildSubAgentTool({ name: 'testAgent', description: 'テスト用', agent }));

			// Act & Assert
			await expect(execute({ task: 'タスク' })).rejects.toThrow(InfrastructureError);
		});

		// Error 以外のスロー値も InfrastructureError にラップされることを検証する
		it('Error 以外のスロー値も InfrastructureError にラップされる', async () => {
			// Arrange: string がスローされるケース
			const agent: ToolLoopStreamAdapter = {
				stream: vi.fn().mockRejectedValue('予期しない文字列エラー'),
			};
			const execute = extractExecute(buildSubAgentTool({ name: 'testAgent', description: 'テスト用', agent }));

			// Act & Assert
			await expect(execute({ task: 'タスク' })).rejects.toThrow(InfrastructureError);
		});

		// text が undefined の text-delta はスキップされることを検証する
		it('text が undefined の text-delta はスキップして残りのテキストを返す', async () => {
			// Arrange: text が undefined のパートが混在する
			const agent = createMockAdapter([
				{ type: 'text-delta', text: undefined },
				{ type: 'text-delta', text: '正常テキスト' },
			]);
			const execute = extractExecute(buildSubAgentTool({ name: 'testAgent', description: 'テスト用', agent }));

			// Act
			const result = await execute({ task: 'タスク説明' });

			// Assert: undefined はスキップされ、正常なテキストのみ連結される
			expect(result).toBe('正常テキスト');
		});
	});
});
