import type { IEntity } from '~/app-kernel/types/entity';

/**
 * Agent エンティティのプロパティ (ドメイン内用スナップショット)
 */
export interface IAgentEntity {
	readonly id: string;
	readonly name: string;
	readonly modelId: string;
	readonly instruction: string;
	readonly enabledTools: string[];
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

/**
 * シリアライズ境界を越えるエージェントスナップショット (Date → string)
 */
export interface IAgentSerializedEntity {
	readonly id: string;
	readonly name: string;
	readonly modelId: string;
	readonly instruction: string;
	readonly enabledTools: string[];
	readonly createdAt: string;
	readonly updatedAt: string;
}

/**
 * AIエージェント設定エンティティ
 *
 * ID (cuid) で識別する。
 */
export class AgentEntity implements IEntity<IAgentEntity, IAgentSerializedEntity> {
	public readonly id: string;
	public readonly name: string;
	public readonly modelId: string;
	public readonly instruction: string;
	public readonly enabledTools: string[];
	public readonly createdAt: Date;
	public readonly updatedAt: Date;

	public constructor(entity: IAgentEntity) {
		this.id = entity.id;
		this.name = entity.name;
		this.modelId = entity.modelId;
		this.instruction = entity.instruction;
		this.enabledTools = entity.enabledTools;
		this.createdAt = entity.createdAt;
		this.updatedAt = entity.updatedAt;
	}

	public serialize(): IAgentSerializedEntity {
		return {
			id: this.id,
			name: this.name,
			modelId: this.modelId,
			instruction: this.instruction,
			enabledTools: this.enabledTools,
			createdAt: this.createdAt.toISOString(),
			updatedAt: this.updatedAt.toISOString(),
		};
	}
}
