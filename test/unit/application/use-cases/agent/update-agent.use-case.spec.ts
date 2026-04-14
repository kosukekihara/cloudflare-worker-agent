import { describe, expect, it } from 'vitest';
import type { AgentRecord } from '~/application/ports/repositories/agent/agent.repository';
import { UpdateAgentUseCase } from '~/application/use-cases/agent/update-agent.use-case';
import { AgentNotFoundError } from '~/domain/errors/agent-not-found.error';
import { createMockAgentRepository } from '~mock/application/repositories/agent/agent.repository.mock';

describe('UpdateAgentUseCase', () => {
	const now = new Date('2026-01-10T00:00:00Z');

	function existingRecord(): AgentRecord {
		return {
			createdAt: now,
			enabledTools: ['weather'],
			id: 'ag1',
			instruction: 'Old',
			modelId: 'm-old',
			name: 'OldName',
			updatedAt: now,
		};
	}

	// 存在しない場合は AgentNotFoundError を投げることを検証する
	it('should throw AgentNotFoundError when agent is missing', async () => {
		const mockRepo = createMockAgentRepository();
		mockRepo.findById = async () => null;

		const useCase = new UpdateAgentUseCase(mockRepo);
		await expect(
			useCase.execute({
				id: 'none',
				name: 'N',
			}),
		).rejects.toThrow(AgentNotFoundError);
	});

	// 渡されたフィールドのみが updateById に渡ることを検証する (部分更新)
	it('should pass only defined fields to repository updateById', async () => {
		const mockRepo = createMockAgentRepository();
		mockRepo.findById = async () => existingRecord();

		const updated: AgentRecord = {
			...existingRecord(),
			name: 'NewName',
		};
		let patchArg: unknown;
		mockRepo.updateById = async (_id, patch) => {
			patchArg = patch;
			return updated;
		};

		const useCase = new UpdateAgentUseCase(mockRepo);
		const result = await useCase.execute({
			id: 'ag1',
			name: 'NewName',
		});

		expect(patchArg).toEqual({ name: 'NewName' });
		expect(result.agent.name).toBe('NewName');
	});

	// 複数フィールドを同時に更新するときに patch に全て含まれることを検証する
	it('should include all provided optional fields in repository patch', async () => {
		const mockRepo = createMockAgentRepository();
		mockRepo.findById = async () => existingRecord();

		const updated: AgentRecord = {
			createdAt: existingRecord().createdAt,
			enabledTools: ['a'],
			id: 'ag1',
			instruction: 'NewInst',
			modelId: 'm-new',
			name: 'N',
			updatedAt: existingRecord().updatedAt,
		};
		let patchArg: unknown;
		mockRepo.updateById = async (_id, patch) => {
			patchArg = patch;
			return updated;
		};

		const useCase = new UpdateAgentUseCase(mockRepo);
		await useCase.execute({
			enabledTools: ['a'],
			id: 'ag1',
			instruction: 'NewInst',
			modelId: 'm-new',
			name: 'N',
		});

		expect(patchArg).toEqual({
			enabledTools: ['a'],
			instruction: 'NewInst',
			modelId: 'm-new',
			name: 'N',
		});
	});
});
