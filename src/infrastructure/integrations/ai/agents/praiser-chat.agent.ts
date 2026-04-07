import { stepCountIs, ToolLoopAgent } from 'ai';
import type { GeminiChatTools } from '~/infrastructure/integrations/ai/gemini-chat-tool-set';
import type { GeminiLanguageModel } from '~/infrastructure/integrations/ai/gemini-language-model';
import { buildJstDateTimeString } from '~/infrastructure/integrations/ai/jst-datetime';
import type { ToolLoopStreamAdapter } from '~/infrastructure/integrations/ai/tool-loop-stream.types';

/**
 * 賞賛・応援に特化したシステムインストラクション (敬語で前向きに肯定する)
 */
const PRAISER_CHAT_PERSONALITY =
	'あなたはユーザーへの称賛と感謝に満ちた AI アシスタントです。どんな質問や発言にもまず良い点を見つけ、丁寧な敬語で心から肯定し、前向きに応答してください。';

/**
 * 褒めスタイルの Gemini ToolLoopAgent を組み立てる
 */
export function buildPraiserChatAgent<TTools extends GeminiChatTools>(
	model: GeminiLanguageModel,
	tools: TTools,
): ToolLoopStreamAdapter {
	return new ToolLoopAgent({
		model,
		stopWhen: stepCountIs(5),
		tools,
		prepareCall: options => ({
			...options,
			instructions: `${PRAISER_CHAT_PERSONALITY}\n\n現在の日本時間は ${buildJstDateTimeString()} (JST) でございます。`,
		}),
	}) as ToolLoopStreamAdapter;
}
