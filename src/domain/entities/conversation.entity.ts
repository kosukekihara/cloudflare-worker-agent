import type { IEntity } from '~/app-kernel/types/entity';

/**
 * Conversation エンティティのプロパティ (ドメイン内用スナップショット)
 */
export interface IConversationEntity {
	readonly id: string;
	readonly userId: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

/**
 * シリアライズ境界を越える会話スナップショット (Date → string)
 */
export interface IConversationSerializedEntity {
	readonly id: string;
	readonly userId: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

/**
 * チャット会話セッションエンティティ
 *
 * ID (cuid) で識別する。
 */
export class ConversationEntity implements IEntity<IConversationEntity, IConversationSerializedEntity> {
	public readonly id: string;
	public readonly userId: string;
	public readonly createdAt: Date;
	public readonly updatedAt: Date;

	public constructor(entity: IConversationEntity) {
		this.id = entity.id;
		this.userId = entity.userId;
		this.createdAt = entity.createdAt;
		this.updatedAt = entity.updatedAt;
	}

	public serialize(): IConversationSerializedEntity {
		return {
			id: this.id,
			userId: this.userId,
			createdAt: this.createdAt.toISOString(),
			updatedAt: this.updatedAt.toISOString(),
		};
	}
}
