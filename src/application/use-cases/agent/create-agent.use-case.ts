import type { AgentRepository } from '~/application/ports/repositories/agent/agent.repository';
import type { IAgentSerializedEntity } from '~/domain/entities/agent.entity';
import { AgentEntity } from '~/domain/entities/agent.entity';

/** エージェント作成の入力 */
export interface CreateAgentInput {
	readonly name: string;
	readonly modelId: string;
	readonly instruction: string;
	readonly enabledTools: string[];
}

/** エージェント作成の出力 */
export interface CreateAgentOutput {
	readonly agent: IAgentSerializedEntity;
}

/**
 * エージェント作成ユースケース
 *
 * 新規エージェントを作成し、永続化する。
 */
export class CreateAgentUseCase {
	private readonly agentRepository: AgentRepository;

	public constructor(agentRepository: AgentRepository) {
		this.agentRepository = agentRepository;
	}

	/**
	 * エージェントを作成する
	 *
	 * @param input エージェント作成データ
	 * @returns 作成されたエージェント
	 */
	public async execute(input: CreateAgentInput): Promise<CreateAgentOutput> {
		const record = await this.agentRepository.save({
			name: input.name,
			modelId: input.modelId,
			instruction: input.instruction,
			enabledTools: input.enabledTools,
		});

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
