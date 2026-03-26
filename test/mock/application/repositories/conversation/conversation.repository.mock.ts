import { vi } from 'vitest';
import type { ConversationRepository } from '~/application/ports/repositories/conversation/conversation.repository';

/** ConversationRepository のモックファクトリ */
export function createMockConversationRepository(): ConversationRepository {
	return {
		deleteById: vi.fn(),
		findById: vi.fn(),
		findByUserId: vi.fn(),
		save: vi.fn(),
	};
}
