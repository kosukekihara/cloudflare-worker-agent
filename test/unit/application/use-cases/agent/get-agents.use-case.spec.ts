import { describe, expect, it } from 'vitest';
import type { AgentRecord } from '~/application/ports/repositories/agent/agent.repository';
import { GetAgentsUseCase } from '~/application/use-cases/agent/get-agents.use-case';
import { createMockAgentRepository } from '~mock/application/repositories/agent/agent.repository.mock';

describe('GetAgentsUseCase', () => {
	const now = new Date('2026-03-01T00:00:00Z');

	// findAll の各レコードがシリアライズされたエージェント配列に変換されることを検証する
	it('should map repository records to serialized agents', async () => {
		const mockRepo = createMockAgentRepository();
		const records: AgentRecord[] = [
			{
				createdAt: now,
				enabledTools: [],
				id: 'a1',
				instruction: 'I1',
				modelId: 'm1',
				name: 'One',
				updatedAt: now,
			},
		];
		mockRepo.findAll = async () => records;

		const useCase = new GetAgentsUseCase(mockRepo);
		const result = await useCase.execute();

		expect(result.agents).toHaveLength(1);
		expect(result.agents[0]).toEqual({
			createdAt: '2026-03-01T00:00:00.000Z',
			enabledTools: [],
			id: 'a1',
			instruction: 'I1',
			modelId: 'm1',
			name: 'One',
			updatedAt: '2026-03-01T00:00:00.000Z',
		});
	});
});
