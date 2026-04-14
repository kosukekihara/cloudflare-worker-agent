import { describe, expect, it } from 'vitest';
import type { AgentRecord } from '~/application/ports/repositories/agent/agent.repository';
import { GetAgentUseCase } from '~/application/use-cases/agent/get-agent.use-case';
import { AgentNotFoundError } from '~/domain/errors/agent-not-found.error';
import { createMockAgentRepository } from '~mock/application/repositories/agent/agent.repository.mock';

describe('GetAgentUseCase', () => {
	const now = new Date('2026-02-01T00:00:00Z');

	function sampleRecord(): AgentRecord {
		return {
			createdAt: now,
			enabledTools: ['postalCodeLookup'],
			id: 'x1',
			instruction: 'Sys',
			modelId: 'model-x',
			name: 'Agent X',
			updatedAt: now,
		};
	}

	// 存在する ID ではシリアライズされたエージェントが返ることを検証する
	it('should return serialized agent when found', async () => {
		const mockRepo = createMockAgentRepository();
		const record = sampleRecord();
		mockRepo.findById = async () => record;

		const useCase = new GetAgentUseCase(mockRepo);
		const result = await useCase.execute({ id: 'x1' });

		expect(result.agent.id).toBe('x1');
		expect(result.agent.name).toBe('Agent X');
		expect(result.agent.createdAt).toBe('2026-02-01T00:00:00.000Z');
	});

	// 存在しない ID では AgentNotFoundError を投げることを検証する
	it('should throw AgentNotFoundError when agent is missing', async () => {
		const mockRepo = createMockAgentRepository();
		mockRepo.findById = async () => null;

		const useCase = new GetAgentUseCase(mockRepo);
		await expect(useCase.execute({ id: 'missing' })).rejects.toThrow(AgentNotFoundError);
	});
});
