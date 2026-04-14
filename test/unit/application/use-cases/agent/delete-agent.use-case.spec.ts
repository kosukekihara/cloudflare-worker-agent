import { describe, expect, it } from 'vitest';
import type { AgentRecord } from '~/application/ports/repositories/agent/agent.repository';
import { DeleteAgentUseCase } from '~/application/use-cases/agent/delete-agent.use-case';
import { AgentNotFoundError } from '~/domain/errors/agent-not-found.error';
import { createMockAgentRepository } from '~mock/application/repositories/agent/agent.repository.mock';

describe('DeleteAgentUseCase', () => {
	const now = new Date('2026-01-05T00:00:00Z');

	const existing: AgentRecord = {
		createdAt: now,
		enabledTools: [],
		id: 'del1',
		instruction: 'x',
		modelId: 'm',
		name: 'X',
		updatedAt: now,
	};

	// 存在しない場合は AgentNotFoundError を投げることを検証する
	it('should throw AgentNotFoundError when agent is missing', async () => {
		const mockRepo = createMockAgentRepository();
		mockRepo.findById = async () => null;

		const useCase = new DeleteAgentUseCase(mockRepo);
		await expect(useCase.execute({ id: 'missing' })).rejects.toThrow(AgentNotFoundError);
	});

	// 存在する場合は deleteById が正しい ID で呼ばれることを検証する
	it('should call deleteById when agent exists', async () => {
		const mockRepo = createMockAgentRepository();
		mockRepo.findById = async () => existing;
		let deletedId: string | undefined;
		mockRepo.deleteById = async id => {
			deletedId = id;
		};

		const useCase = new DeleteAgentUseCase(mockRepo);
		await useCase.execute({ id: 'del1' });

		expect(deletedId).toBe('del1');
	});
});
