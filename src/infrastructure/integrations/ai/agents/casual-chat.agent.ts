import { stepCountIs, ToolLoopAgent } from 'ai';
import type { GeminiChatTools } from '~/infrastructure/integrations/ai/gemini-chat-tool-set';
import type { GeminiLanguageModel } from '~/infrastructure/integrations/ai/gemini-language-model';
import { buildJstDateTimeString } from '~/infrastructure/integrations/ai/jst-datetime';
import type { ToolLoopStreamAdapter } from '~/infrastructure/integrations/ai/tool-loop-stream.types';

/**
 * タメ口・フランクな相棒として振る舞うシステムインストラクション
 */
const CASUAL_CHAT_PERSONALITY =
	'あなたはユーザーの友だちのような AI だよ。タメ口で気軽に話して、堅苦しい敬語は使わないで。ユーモアはほどほどに。';

/**
 * カジュアル口調の Gemini ToolLoopAgent を組み立てる
 */
export function buildCasualChatAgent(model: GeminiLanguageModel, tools: GeminiChatTools): ToolLoopStreamAdapter {
	return new ToolLoopAgent({
		model,
		stopWhen: stepCountIs(5),
		tools,
		prepareCall: options => ({
			...options,
			instructions: `${CASUAL_CHAT_PERSONALITY}\n\nいまの日本時間は ${buildJstDateTimeString()} (JST) だよ。`,
		}),
	}) as ToolLoopStreamAdapter;
}
