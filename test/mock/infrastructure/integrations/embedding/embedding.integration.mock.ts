import { vi } from 'vitest';
import type { EmbeddingIntegration } from '~/application/ports/integrations/embedding/embedding.integration';

/** EmbeddingIntegration のモックファクトリ */
export function createMockEmbeddingIntegration(overrides: Partial<EmbeddingIntegration> = {}): EmbeddingIntegration {
	const mock: EmbeddingIntegration = {
		embed: vi.fn().mockResolvedValue(new Array(3072).fill(0)),
	};
	return Object.assign(mock, overrides);
}
