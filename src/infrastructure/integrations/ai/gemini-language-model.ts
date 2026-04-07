import type { createGoogleGenerativeAI } from '@ai-sdk/google';

/**
 * createGoogleGenerativeAI(...)(modelId) の戻り型。
 * エージェントビルダーが受け取る model 引数の型として利用する。
 */
export type GeminiLanguageModel = ReturnType<ReturnType<typeof createGoogleGenerativeAI>>;
