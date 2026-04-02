import { describe, expect, it, vi } from 'vitest';
import type { SimilarMessageRecord } from '~/application/ports/repositories/message/message.repository';
import { PrismaMessageRepository } from '~/infrastructure/repositories/message/message.repository';

/** PrismaClient の最小モック */
function createMockPrisma(overrides: { $queryRaw?: ReturnType<typeof vi.fn> } = {}) {
	return {
		$executeRaw: vi.fn().mockResolvedValue(1),
		$queryRaw: overrides.$queryRaw ?? vi.fn().mockResolvedValue([]),
		message: {
			create: vi.fn(),
			findMany: vi.fn().mockResolvedValue([]),
		},
	};
}

describe('PrismaMessageRepository.searchSimilar', () => {
	// 正常系: $queryRaw の結果を SimilarMessageRecord[] に変換して返すことを検証する
	it('should return SimilarMessageRecord array mapped from raw query rows', async () => {
		const rawRows = [
			{
				id: 'msg_01',
				conversation_id: 'conv_01',
				role: 'user',
				content: 'こんにちは',
				created_at: new Date('2024-01-01'),
				similarity: 0.95,
			},
			{
				id: 'msg_02',
				conversation_id: 'conv_01',
				role: 'assistant',
				content: 'はい、何でしょう？',
				created_at: new Date('2024-01-01'),
				similarity: 0.88,
			},
		];
		const mockPrisma = createMockPrisma({ $queryRaw: vi.fn().mockResolvedValue(rawRows) });
		const repository = new PrismaMessageRepository(mockPrisma as never);

		const result: SimilarMessageRecord[] = await repository.searchSimilar(new Array(3072).fill(0.1), 5);

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			id: 'msg_01',
			conversationId: 'conv_01',
			role: 'user',
			content: 'こんにちは',
			createdAt: new Date('2024-01-01'),
			similarity: 0.95,
		});
		expect(result[1]).toEqual({
			id: 'msg_02',
			conversationId: 'conv_01',
			role: 'assistant',
			content: 'はい、何でしょう？',
			createdAt: new Date('2024-01-01'),
			similarity: 0.88,
		});
	});

	// 正常系: 結果が 0 件の場合は空配列を返すことを検証する
	it('should return empty array when $queryRaw returns no rows', async () => {
		const mockPrisma = createMockPrisma({ $queryRaw: vi.fn().mockResolvedValue([]) });
		const repository = new PrismaMessageRepository(mockPrisma as never);

		const result = await repository.searchSimilar(new Array(3072).fill(0), 5);

		expect(result).toEqual([]);
	});

	// 異常系: $queryRaw がエラーをスローした場合にそのエラーが伝播することを検証する
	it('should propagate error when $queryRaw throws', async () => {
		const mockPrisma = createMockPrisma({
			$queryRaw: vi.fn().mockRejectedValue(new Error('DB connection error')),
		});
		const repository = new PrismaMessageRepository(mockPrisma as never);

		await expect(repository.searchSimilar(new Array(3072).fill(0), 5)).rejects.toThrow('DB connection error');
	});
});
