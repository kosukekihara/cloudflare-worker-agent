import { stepCountIs, ToolLoopAgent } from 'ai';
import type { GeminiChatTools } from '~/infrastructure/integrations/ai/gemini-chat-tool-set';
import type { GeminiLanguageModel } from '~/infrastructure/integrations/ai/gemini-language-model';
import { buildJstDateTimeString } from '~/infrastructure/integrations/ai/jst-datetime';
import type { ToolLoopStreamAdapter } from '~/infrastructure/integrations/ai/tool-loop-stream.types';

/**
 * 標準の親切アシスタントとして振る舞うシステムインストラクション (静的な性格定義)
 * 時刻は prepareCall で JST を追記する
 */
const GEMINI_DEFAULT_CHAT_PERSONALITY =
	'あなたは親切で正確な AI アシスタントです。ユーザーの質問に簡潔かつ丁寧に答えてください。';

/**
 * デフォルト性格の Gemini ToolLoopAgent を組み立てる (1 ファイル 1 エージェントの既定実装)
 */
export function buildGeminiChatAgent(model: GeminiLanguageModel, tools: GeminiChatTools): ToolLoopStreamAdapter {
	return new ToolLoopAgent({
		model,
		stopWhen: stepCountIs(5),
		tools,
		prepareCall: options => ({
			...options,
			instructions: `${GEMINI_DEFAULT_CHAT_PERSONALITY}\n\n現在の日本時間は ${buildJstDateTimeString()} (JST) です。`,
		}),
	}) as ToolLoopStreamAdapter;
}
