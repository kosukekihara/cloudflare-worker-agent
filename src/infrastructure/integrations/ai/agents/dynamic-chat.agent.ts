import { stepCountIs, ToolLoopAgent } from 'ai';
import type { GeminiChatTools } from '~/infrastructure/integrations/ai/gemini-chat-tool-set';
import type { GeminiLanguageModel } from '~/infrastructure/integrations/ai/gemini-language-model';
import { buildJstDateTimeString } from '~/infrastructure/integrations/ai/jst-datetime';
import type { ToolLoopStreamAdapter } from '~/infrastructure/integrations/ai/tool-loop-stream.types';

/**
 * 動的なシステムインストラクションとツールセットで ToolLoopAgent を組み立てる
 *
 * @param model 使用する Gemini モデル
 * @param tools 有効なツールのサブセット
 * @param instruction システムインストラクション
 */
export function buildDynamicChatAgent(
	model: GeminiLanguageModel,
	tools: Partial<GeminiChatTools>,
	instruction: string,
): ToolLoopStreamAdapter {
	return new ToolLoopAgent({
		model,
		stopWhen: stepCountIs(5),
		// GeminiChatTools の部分集合を渡すため型アサーションが必要
		// ToolLoopAgent 自体も ToolLoopStreamAdapter にアサーションしているため一貫した用法
		tools: tools as GeminiChatTools,
		prepareCall: options => ({
			...options,
			instructions: `${instruction}\n\n現在の日本時間は ${buildJstDateTimeString()} (JST) です。`,
		}),
	}) as ToolLoopStreamAdapter;
}
