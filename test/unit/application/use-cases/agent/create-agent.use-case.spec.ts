import { describe, expect, it } from 'vitest';
import type { AgentRecord } from '~/application/ports/repositories/agent/agent.repository';
import { CreateAgentUseCase } from '~/application/use-cases/agent/create-agent.use-case';
import { createMockAgentRepository } from '~mock/application/repositories/agent/agent.repository.mock';

describe('CreateAgentUseCase', () => {
	const now = new Date('2026-01-01T00:00:00Z');

	function createSavedRecord(overrides?: Partial<AgentRecord>): AgentRecord {
		return {
			createdAt: now,
			enabledTools: ['weather'],
			id: 'agent_new',
			instruction: 'Help',
			modelId: 'm1',
			name: 'A',
			updatedAt: now,
			...overrides,
		};
	}

	// save の引数と戻り値のシリアライズが期待どおりであることを検証する
	it('should save via repository and return serialized agent', async () => {
		const mockRepo = createMockAgentRepository();
		const savedRecord = createSavedRecord();
		mockRepo.save = async () => savedRecord;

		const useCase = new CreateAgentUseCase(mockRepo);
		const result = await useCase.execute({
			enabledTools: ['weather'],
			instruction: 'Help',
			modelId: 'm1',
			name: 'A',
		});

		expect(result.agent).toEqual({
			createdAt: '2026-01-01T00:00:00.000Z',
			enabledTools: ['weather'],
			id: 'agent_new',
			instruction: 'Help',
			modelId: 'm1',
			name: 'A',
			updatedAt: '2026-01-01T00:00:00.000Z',
		});
	});

	// Repository.save に execute の入力がそのまま渡ることを検証する
	it('should pass execute input to repository save', async () => {
		const mockRepo = createMockAgentRepository();
		const savedRecord = createSavedRecord();
		let captured: unknown;
		mockRepo.save = async input => {
			captured = input;
			return savedRecord;
		};

		const useCase = new CreateAgentUseCase(mockRepo);
		await useCase.execute({
			enabledTools: ['a', 'b'],
			instruction: 'Inst',
			modelId: 'mid',
			name: 'N',
		});

		expect(captured).toEqual({
			enabledTools: ['a', 'b'],
			instruction: 'Inst',
			modelId: 'mid',
			name: 'N',
		});
	});
});
