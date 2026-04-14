import { describe, expect, it } from 'vitest';
import { AgentEntity } from '~/domain/entities/agent.entity';

describe('AgentEntity', () => {
	const createdAt = new Date('2026-04-01T12:00:00.000Z');
	const updatedAt = new Date('2026-04-02T15:30:00.000Z');

	// serialize が Date を ISO 文字列に変換し、全フィールドを保持することを検証する
	it('should serialize dates to ISO strings and preserve fields', () => {
		const entity = new AgentEntity({
			createdAt,
			enabledTools: ['weather'],
			id: 'agent_1',
			instruction: 'Be helpful',
			modelId: 'gemini-test',
			name: 'Test Agent',
			updatedAt,
		});

		expect(entity.serialize()).toEqual({
			createdAt: '2026-04-01T12:00:00.000Z',
			enabledTools: ['weather'],
			id: 'agent_1',
			instruction: 'Be helpful',
			modelId: 'gemini-test',
			name: 'Test Agent',
			updatedAt: '2026-04-02T15:30:00.000Z',
		});
	});
});
