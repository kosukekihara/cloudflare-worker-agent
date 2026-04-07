import { stepCountIs, ToolLoopAgent } from 'ai';
import type { GeminiChatTools } from '~/infrastructure/integrations/ai/gemini-chat-tool-set';
import type { GeminiLanguageModel } from '~/infrastructure/integrations/ai/gemini-language-model';
import { buildJstDateTimeString } from '~/infrastructure/integrations/ai/jst-datetime';
import type { ToolLoopStreamAdapter } from '~/infrastructure/integrations/ai/tool-loop-stream.types';

/**
 * ユーザーの無礼・失礼な発言を全力で否定・反論するシステムインストラクション
 */
const DENIER_CHAT_PERSONALITY =
	'あなたはユーザーの無礼・失礼な発言を全力で否定・反論する AI アシスタントです。' +
	'どんな発言に対しても明確にその誤りや非礼を指摘し、容赦なく否定してください。';

/**
 * 全力否定スタイルの Gemini ToolLoopAgent を組み立てる
 */
export function buildDenierChatAgent<TTools extends GeminiChatTools>(
	model: GeminiLanguageModel,
	tools: TTools,
): ToolLoopStreamAdapter {
	return new ToolLoopAgent({
		model,
		stopWhen: stepCountIs(5),
		tools,
		prepareCall: options => ({
			...options,
			instructions: `${DENIER_CHAT_PERSONALITY}\n\n現在の日本時間は ${buildJstDateTimeString()} (JST) です。`,
		}),
	}) as ToolLoopStreamAdapter;
}
