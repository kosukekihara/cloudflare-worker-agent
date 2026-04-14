import type { AgentRepository } from '~/application/ports/repositories/agent/agent.repository';
import type { IAgentSerializedEntity } from '~/domain/entities/agent.entity';
import { AgentEntity } from '~/domain/entities/agent.entity';
import { AgentNotFoundError } from '~/domain/errors/agent-not-found.error';

/** エージェント更新の入力 */
export interface UpdateAgentInput {
	readonly id: string;
	readonly name?: string;
	readonly modelId?: string;
	readonly instruction?: string;
	readonly enabledTools?: string[];
}

/** エージェント更新の出力 */
export interface UpdateAgentOutput {
	readonly agent: IAgentSerializedEntity;
}

/**
 * エージェント更新ユースケース
 *
 * 指定された ID のエージェントを更新する。
 */
export class UpdateAgentUseCase {
	private readonly agentRepository: AgentRepository;

	public constructor(agentRepository: AgentRepository) {
		this.agentRepository = agentRepository;
	}

	/**
	 * エージェントを更新する
	 *
	 * @param input 更新するエージェントの入力
	 * @returns 更新されたエージェント
	 * @throws {AgentNotFoundError} 指定された ID のエージェントが存在しない場合
	 */
	public async execute(input: UpdateAgentInput): Promise<UpdateAgentOutput> {
		const existing = await this.agentRepository.findById(input.id);

		if (!existing) {
			throw new AgentNotFoundError(`Agent with id "${input.id}" not found`);
		}

		const patch: {
			enabledTools?: string[];
			instruction?: string;
			modelId?: string;
			name?: string;
		} = {};
		if (input.name !== undefined) {
			patch.name = input.name;
		}
		if (input.modelId !== undefined) {
			patch.modelId = input.modelId;
		}
		if (input.instruction !== undefined) {
			patch.instruction = input.instruction;
		}
		if (input.enabledTools !== undefined) {
			patch.enabledTools = input.enabledTools;
		}

		const record = await this.agentRepository.updateById(input.id, patch);

		const agent = new AgentEntity({
			id: record.id,
			name: record.name,
			modelId: record.modelId,
			instruction: record.instruction,
			enabledTools: record.enabledTools,
			createdAt: record.createdAt,
			updatedAt: record.updatedAt,
		});

		return { agent: agent.serialize() };
	}
}
