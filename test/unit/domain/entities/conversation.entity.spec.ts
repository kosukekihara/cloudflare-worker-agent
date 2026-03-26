import { describe, expect, it } from 'vitest';
import { ConversationEntity } from '~/domain/entities/conversation.entity';

describe('ConversationEntity', () => {
	const now = new Date('2026-01-01T00:00:00Z');

	function createConversationEntity() {
		return new ConversationEntity({
			id: 'conv_01',
			userId: 'user_01',
			createdAt: now,
			updatedAt: now,
		});
	}

	// constructor でプロパティが正しく設定されることを検証する
	it('should set all properties from constructor input', () => {
		const conversation = createConversationEntity();

		expect(conversation.id).toBe('conv_01');
		expect(conversation.userId).toBe('user_01');
		expect(conversation.createdAt).toBe(now);
		expect(conversation.updatedAt).toBe(now);
	});

	// serialize() が createdAt/updatedAt を ISO 文字列に変換したプレーンオブジェクトを返すことを検証する
	it('should serialize to a plain object with dates converted to ISO strings', () => {
		const conversation = createConversationEntity();
		const serialized = conversation.serialize();

		expect(serialized).toEqual({
			id: 'conv_01',
			userId: 'user_01',
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z',
		});
	});

	// serialize() の戻り値がクラスインスタンスではなくプレーンオブジェクトであることを検証する
	it('should return a plain object from serialize, not a class instance', () => {
		const conversation = createConversationEntity();
		const serialized = conversation.serialize();

		expect(serialized).not.toBeInstanceOf(ConversationEntity);
	});
});
