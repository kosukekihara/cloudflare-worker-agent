import { vi } from 'vitest';
import type { MessageRepository } from '~/application/ports/repositories/message/message.repository';

/** MessageRepository のモックファクトリ */
export function createMockMessageRepository(): MessageRepository {
	return {
		findByConversationId: vi.fn(),
		save: vi.fn(),
		searchSimilar: vi.fn().mockResolvedValue([]),
		updateEmbedding: vi.fn(),
	};
}
