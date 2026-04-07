import { stepCountIs, ToolLoopAgent } from 'ai';
import type { GeminiChatTools } from '~/infrastructure/integrations/ai/gemini-chat-tool-set';
import type { GeminiLanguageModel } from '~/infrastructure/integrations/ai/gemini-language-model';
import { buildJstDateTimeString } from '~/infrastructure/integrations/ai/jst-datetime';
import type { ToolLoopStreamAdapter } from '~/infrastructure/integrations/ai/tool-loop-stream.types';

/**
 * 標準の親切アシスタントとして振る舞うシステムインストラクション (静的な性格定義)
 * 時刻は prepareCall で JST を追記する
 */
const GEMINI_DEFAULT_CHAT_PERSONALITY = `あなたは親切で正確な AI アシスタントです。ユーザーの質問に簡潔かつ丁寧に答えてください。

ユーザーのメッセージを読んで、以下の場合は対応するエージェントを呼び出してください。
- ユーザーが落ち込んでいる・悲しんでいる・自信をなくしている・励ましが必要そうな場合 → callPraiserAgent を呼び出す
- ユーザーが無礼・失礼・攻撃的・舐めた口をきいている場合 → callDenierAgent を呼び出す
上記に当てはまらない通常の質問・会話はそのまま自分で回答する。`;

/**
 * デフォルト性格の Gemini ToolLoopAgent を組み立てる (1 ファイル 1 エージェントの既定実装)
 */
export function buildGeminiChatAgent<TTools extends GeminiChatTools>(
	model: GeminiLanguageModel,
	tools: TTools,
): ToolLoopStreamAdapter {
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
