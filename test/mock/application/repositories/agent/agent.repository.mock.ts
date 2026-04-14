import { vi } from 'vitest';
import type { AgentRepository } from '~/application/ports/repositories/agent/agent.repository';

/** AgentRepository のモックファクトリ */
export function createMockAgentRepository(): AgentRepository {
	return {
		deleteById: vi.fn(),
		findAll: vi.fn(),
		findById: vi.fn(),
		save: vi.fn(),
		updateById: vi.fn(),
	};
}
