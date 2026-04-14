import type { AgentRepository } from '~/application/ports/repositories/agent/agent.repository';
import type { IAgentSerializedEntity } from '~/domain/entities/agent.entity';
import { AgentEntity } from '~/domain/entities/agent.entity';
import { AgentNotFoundError } from '~/domain/errors/agent-not-found.error';

/** エージェント取得の入力 */
export interface GetAgentInput {
	readonly id: string;
}

/** エージェント取得の出力 */
export interface GetAgentOutput {
	readonly agent: IAgentSerializedEntity;
}

/**
 * エージェント取得ユースケース
 *
 * 指定された ID のエージェントを取得する。
 */
export class GetAgentUseCase {
	private readonly agentRepository: AgentRepository;

	public constructor(agentRepository: AgentRepository) {
		this.agentRepository = agentRepository;
	}

	/**
	 * エージェントを ID で取得する
	 *
	 * @param input 取得するエージェントの入力
	 * @returns エージェント
	 * @throws {AgentNotFoundError} 指定された ID のエージェントが存在しない場合
	 */
	public async execute(input: GetAgentInput): Promise<GetAgentOutput> {
		const record = await this.agentRepository.findById(input.id);

		if (!record) {
			throw new AgentNotFoundError(`Agent with id "${input.id}" not found`);
		}

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
