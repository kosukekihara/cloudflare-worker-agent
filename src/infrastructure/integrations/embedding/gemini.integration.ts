import { z } from 'zod';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import type { EmbeddingIntegration } from '~/application/ports/integrations/embedding/embedding.integration';

const geminiEmbedResponseSchema = z.object({
	embedding: z.object({
		values: z.array(z.number()),
	}),
});

/**
 * Google AI Studio (gemini-embedding-001) を使った EmbeddingIntegration の具象実装
 *
 * https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent
 * に POST リクエストを送り、テキストを 3072 次元の埋め込みベクトルに変換する。
 *
 * @url https://ai.google.dev/api/embeddings
 */
export class GeminiEmbeddingIntegration implements EmbeddingIntegration {
	private readonly apiKey: string;

	public constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	public async embed(text: string): Promise<number[]> {
		try {
			const response = await fetch(
				`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${this.apiKey}`,
				{
					body: JSON.stringify({
						content: { parts: [{ text }] },
						model: 'models/gemini-embedding-001',
					}),
					headers: { 'Content-Type': 'application/json' },
					method: 'POST',
				},
			);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const json: unknown = await response.json();
			const parsed = geminiEmbedResponseSchema.parse(json);
			return parsed.embedding.values;
		} catch (error) {
			const message = (() => {
				if (error instanceof Error) {
					return error.message;
				} else {
					return String(error);
				}
			})();
			throw new InfrastructureError(`Gemini Embedding API エラー: ${message}`);
		}
	}
}
