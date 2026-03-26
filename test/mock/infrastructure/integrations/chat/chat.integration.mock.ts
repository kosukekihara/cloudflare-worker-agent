import { vi } from 'vitest';
import type { ChatIntegration } from '~/application/ports/integrations/chat/chat.integration';

/** ChatIntegration のモックファクトリ */
export function createMockChatIntegration(): ChatIntegration {
	return {
		streamReply: vi.fn(),
	};
}
