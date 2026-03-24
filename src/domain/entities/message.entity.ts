import type { IEntity } from '~/app-kernel/types/entity';

/**
 * メッセージの送信者ロール
 */
export type MessageRole = 'user' | 'assistant';

/**
 * Message エンティティのプロパティ (ドメイン内用スナップショット)
 */
export interface IMessageEntity {
	readonly id: string;
	readonly conversationId: string;
	readonly role: MessageRole;
	readonly content: string;
	readonly createdAt: Date;
}

/**
 * シリアライズ境界を越えるメッセージスナップショット (Date → string)
 */
export interface IMessageSerializedEntity {
	readonly id: string;
	readonly conversationId: string;
	readonly role: MessageRole;
	readonly content: string;
	readonly createdAt: string;
}

/**
 * チャットメッセージエンティティ
 *
 * ID (cuid) で識別する。
 */
export class MessageEntity implements IEntity<IMessageEntity, IMessageSerializedEntity> {
	public readonly id: string;
	public readonly conversationId: string;
	public readonly role: MessageRole;
	public readonly content: string;
	public readonly createdAt: Date;

	public constructor(entity: IMessageEntity) {
		this.id = entity.id;
		this.conversationId = entity.conversationId;
		this.role = entity.role;
		this.content = entity.content;
		this.createdAt = entity.createdAt;
	}

	public serialize(): IMessageSerializedEntity {
		return {
			id: this.id,
			conversationId: this.conversationId,
			role: this.role,
			content: this.content,
			createdAt: this.createdAt.toISOString(),
		};
	}
}
