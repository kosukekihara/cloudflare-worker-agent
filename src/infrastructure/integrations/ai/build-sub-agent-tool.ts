import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import type { ToolLoopStreamAdapter } from '~/infrastructure/integrations/ai/tool-loop-stream.types';

/** buildSubAgentTool に渡すパラメーター */
export interface BuildSubAgentToolParams {
	/** ツールの識別名 (デバッグログに使用) */
	name: string;
	/** メインエージェントがツール選択の判断に使う説明文 */
	description: string;
	/** 呼び出し対象のサブエージェント */
	agent: ToolLoopStreamAdapter;
}

/**
 * ToolLoopStreamAdapter を tool() でラップし、メインエージェントから呼び出せるサブエージェントツールを組み立てる
 *
 * @param params - サブエージェントの説明とエージェントインスタンス
 * @returns メインエージェントのツールセットに追加できる tool オブジェクト
 */
export function buildSubAgentTool(params: BuildSubAgentToolParams) {
	return tool({
		description: params.description,
		inputSchema: zodSchema(
			z.object({
				task: z.string().describe('サブエージェントに実行させるタスクの説明'),
			}),
		),
		execute: async (input: { task: string }) => {
			// biome-ignore lint/suspicious/noConsole: サブエージェント呼び出しのデバッグログ (意図的な出力)
			console.debug(`[SubAgent] ${params.name} が呼び出されました (task: "${input.task}")`);
			try {
				const result = await params.agent.stream({
					messages: [{ role: 'user', content: input.task }],
				});

				const textParts: string[] = [];
				for await (const part of result.fullStream) {
					if (part.type === 'text-delta' && part.text !== undefined) {
						textParts.push(part.text);
					}
				}

				return textParts.join('') || 'サブエージェントから応答がありませんでした';
			} catch (error) {
				const message = (() => {
					if (error instanceof Error) {
						return error.message;
					} else {
						return String(error);
					}
				})();
				throw new InfrastructureError(`サブエージェントの実行中にエラーが発生しました: ${message}`);
			}
		},
	});
}
