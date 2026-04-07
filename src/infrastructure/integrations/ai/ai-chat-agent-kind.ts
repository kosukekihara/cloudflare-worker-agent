/**
 * Gemini チャットで利用するエージェント種別 (性格・システムインストラクションのセット)
 *
 * 本番の既定は ACTIVE_AI_CHAT_AGENT。テストや一時切り替えは GeminiChatIntegration の引数で上書きする。
 */
export type AiChatAgentKind = 'gemini_default' | 'casual' | 'praiser';

/** 生成層でエージェントを切り替えるときはこの定数を変更する */
export const ACTIVE_AI_CHAT_AGENT: AiChatAgentKind = 'gemini_default';
