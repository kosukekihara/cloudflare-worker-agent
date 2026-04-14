import type { AgentRepository } from '~/application/ports/repositories/agent/agent.repository';
import type { IAgentSerializedEntity } from '~/domain/entities/agent.entity';
import { AgentEntity } from '~/domain/entities/agent.entity';

/** エージェント一覧取得の出力 */
export interface GetAgentsOutput {
	readonly agents: IAgentSerializedEntity[];
}

/**
 * エージェント一覧取得ユースケース
 *
 * 登録されている全エージェントを取得する。
 */
export class GetAgentsUseCase {
	private readonly agentRepository: AgentRepository;

	public constructor(agentRepository: AgentRepository) {
		this.agentRepository = agentRepository;
	}

	/**
	 * エージェント一覧を取得する
	 *
	 * @returns 全エージェントの一覧
	 */
	public async execute(): Promise<GetAgentsOutput> {
		const records = await this.agentRepository.findAll();

		const agents = records.map(record =>
			new AgentEntity({
				id: record.id,
				name: record.name,
				modelId: record.modelId,
				instruction: record.instruction,
				enabledTools: record.enabledTools,
				createdAt: record.createdAt,
				updatedAt: record.updatedAt,
			}).serialize(),
		);

		return { agents };
	}
}
