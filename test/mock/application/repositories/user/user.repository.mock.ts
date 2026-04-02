import { vi } from 'vitest';
import type { UserRepository } from '~/application/ports/repositories/user/user.repository';

/** UserRepository のモックファクトリ */
export function createMockUserRepository(): UserRepository {
	return {
		deleteById: vi.fn(),
		findAll: vi.fn(),
		findByEmail: vi.fn(),
		findById: vi.fn(),
		save: vi.fn(),
		updateById: vi.fn(),
	};
}
