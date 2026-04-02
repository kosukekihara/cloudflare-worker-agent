import { describe, expect, it } from 'vitest';
import type { UserRecord } from '~/application/ports/repositories/user/user.repository';
import { UpdateUserUseCase } from '~/application/use-cases/user/update-user.use-case';
import { UserNotFoundError } from '~/domain/errors/user-not-found.error';
import { createMockUserRepository } from '~mock/application/repositories/user/user.repository.mock';

describe('UpdateUserUseCase', () => {
	const now = new Date('2026-01-01T00:00:00Z');

	function createUserRecord(overrides?: Partial<UserRecord>): UserRecord {
		return {
			id: 'user_01',
			email: 'test@example.com',
			createdAt: now,
			updatedAt: now,
			...overrides,
		};
	}

	// 正常系: ユーザーが存在する場合、updateById が正しい引数で呼ばれ更新後のユーザーを返すことを検証する
	it('should call updateById with the given id and email and return updated user', async () => {
		const mockRepo = createMockUserRepository();
		const existing = createUserRecord();
		const updated = createUserRecord({ email: 'new@example.com' });
		let capturedId: unknown;
		let capturedData: unknown;

		mockRepo.findById = async () => existing;
		mockRepo.updateById = async (id, data) => {
			capturedId = id;
			capturedData = data;
			return updated;
		};

		const useCase = new UpdateUserUseCase(mockRepo);
		const result = await useCase.execute({ id: 'user_01', email: 'new@example.com' });

		expect(capturedId).toBe('user_01');
		expect(capturedData).toEqual({ email: 'new@example.com' });
		expect(result.user.email).toBe('new@example.com');
	});

	// 正常系: 更新されたメールアドレスがシリアライズ結果に反映されることを検証する
	it('should reflect the updated email in the serialized output', async () => {
		const mockRepo = createMockUserRepository();
		mockRepo.findById = async () => createUserRecord();
		mockRepo.updateById = async () =>
			createUserRecord({ email: 'updated@example.com', updatedAt: new Date('2026-06-01T00:00:00Z') });

		const useCase = new UpdateUserUseCase(mockRepo);
		const result = await useCase.execute({ id: 'user_01', email: 'updated@example.com' });

		expect(result.user.id).toBe('user_01');
		expect(result.user.email).toBe('updated@example.com');
		expect(result.user.updatedAt).toBe('2026-06-01T00:00:00.000Z');
	});

	// 異常系: 存在しない ID を渡した場合に UserNotFoundError がスローされ、updateById が呼ばれないことを検証する
	it('should throw UserNotFoundError and not call updateById when user does not exist', async () => {
		const mockRepo = createMockUserRepository();
		mockRepo.findById = async () => null;
		let updateCalled = false;
		mockRepo.updateById = async () => {
			updateCalled = true;
			return createUserRecord();
		};

		const useCase = new UpdateUserUseCase(mockRepo);

		await expect(useCase.execute({ id: 'nonexistent_id', email: 'new@example.com' })).rejects.toThrow(
			UserNotFoundError,
		);
		expect(updateCalled).toBe(false);
	});
});
