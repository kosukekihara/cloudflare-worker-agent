import { describe, expect, it } from 'vitest';
import { MessageEntity } from '~/domain/entities/message.entity';

describe('MessageEntity', () => {
	const now = new Date('2026-01-01T00:00:00Z');

	function createMessageEntity() {
		return new MessageEntity({
			id: 'msg_01',
			conversationId: 'conv_01',
			role: 'user',
			content: 'こんにちは',
			createdAt: now,
		});
	}

	// constructor でプロパティが正しく設定されることを検証する
	it('should set all properties from constructor input', () => {
		const message = createMessageEntity();

		expect(message.id).toBe('msg_01');
		expect(message.conversationId).toBe('conv_01');
		expect(message.role).toBe('user');
		expect(message.content).toBe('こんにちは');
		expect(message.createdAt).toBe(now);
	});

	// serialize() が createdAt を ISO 文字列に変換したプレーンオブジェクトを返すことを検証する
	it('should serialize to a plain object with date converted to ISO string', () => {
		const message = createMessageEntity();
		const serialized = message.serialize();

		expect(serialized).toEqual({
			id: 'msg_01',
			conversationId: 'conv_01',
			role: 'user',
			content: 'こんにちは',
			createdAt: '2026-01-01T00:00:00.000Z',
		});
	});

	// assistant ロールのメッセージも正しくシリアライズできることを検証する
	it('should serialize assistant role message correctly', () => {
		const message = new MessageEntity({
			id: 'msg_02',
			conversationId: 'conv_01',
			role: 'assistant',
			content: 'お手伝いします',
			createdAt: now,
		});
		const serialized = message.serialize();

		expect(serialized.role).toBe('assistant');
	});

	// serialize() の戻り値がクラスインスタンスではなくプレーンオブジェクトであることを検証する
	it('should return a plain object from serialize, not a class instance', () => {
		const message = createMessageEntity();
		const serialized = message.serialize();

		expect(serialized).not.toBeInstanceOf(MessageEntity);
	});
});
