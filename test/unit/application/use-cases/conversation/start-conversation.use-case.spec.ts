import { describe, expect, it } from 'vitest';
import type { ConversationRecord } from '~/application/ports/repositories/conversation/conversation.repository';
import type { UserRecord } from '~/application/ports/repositories/user/user.repository';
import { StartConversationUseCase } from '~/application/use-cases/conversation/start-conversation.use-case';
import { UserNotFoundError } from '~/domain/errors/user-not-found.error';
import { createMockConversationRepository } from '~mock/application/repositories/conversation/conversation.repository.mock';
import { createMockUserRepository } from '~mock/application/repositories/user/user.repository.mock';

describe('StartConversationUseCase', () => {
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

	function createConversationRecord(overrides?: Partial<ConversationRecord>): ConversationRecord {
		return {
			id: 'conv_01',
			userId: 'user_01',
			createdAt: now,
			updatedAt: now,
			...overrides,
		};
	}

	// 正常系: ユーザーが存在する場合に会話が作成されてシリアライズされた結果が返ることを検証する
	it('should create conversation and return serialized entity when user exists', async () => {
		const mockUserRepo = createMockUserRepository();
		const mockConvRepo = createMockConversationRepository();
		const userRecord = createUserRecord();
		const convRecord = createConversationRecord();
		mockUserRepo.findByEmail = async () => userRecord;
		mockConvRepo.save = async () => convRecord;

		const useCase = new StartConversationUseCase(mockUserRepo, mockConvRepo);
		const result = await useCase.execute({ userEmail: 'test@example.com' });

		expect(result.conversation).toEqual({
			id: 'conv_01',
			userId: 'user_01',
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z',
		});
	});

	// 正常系: conversationRepository.save に正しいユーザー ID が渡されることを検証する
	it('should pass correct userId to conversationRepository.save', async () => {
		const mockUserRepo = createMockUserRepository();
		const mockConvRepo = createMockConversationRepository();
		const userRecord = createUserRecord({ id: 'user_99' });
		const convRecord = createConversationRecord({ userId: 'user_99' });
		let capturedInput: unknown;
		mockUserRepo.findByEmail = async () => userRecord;
		mockConvRepo.save = async input => {
			capturedInput = input;
			return convRecord;
		};

		const useCase = new StartConversationUseCase(mockUserRepo, mockConvRepo);
		await useCase.execute({ userEmail: 'test@example.com' });

		expect(capturedInput).toEqual({ userId: 'user_99' });
	});

	// 異常系: 指定メールアドレスのユーザーが存在しない場合に UserNotFoundError がスローされることを検証する
	it('should throw UserNotFoundError when user is not found', async () => {
		const mockUserRepo = createMockUserRepository();
		const mockConvRepo = createMockConversationRepository();
		mockUserRepo.findByEmail = async () => null;

		const useCase = new StartConversationUseCase(mockUserRepo, mockConvRepo);

		await expect(useCase.execute({ userEmail: 'unknown@example.com' })).rejects.toThrow(UserNotFoundError);
	});
});
