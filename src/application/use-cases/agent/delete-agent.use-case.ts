import type { AgentRepository } from '~/application/ports/repositories/agent/agent.repository';
import { AgentNotFoundError } from '~/domain/errors/agent-not-found.error';

/** エージェント削除の入力 */
export interface DeleteAgentInput {
	readonly id: string;
}

/** エージェント削除の出力 */
export interface DeleteAgentOutput {}

/**
 * エージェント削除ユースケース
 *
 * 指定された ID のエージェントを削除する。
 */
export class DeleteAgentUseCase {
	private readonly agentRepository: AgentRepository;

	public constructor(agentRepository: AgentRepository) {
		this.agentRepository = agentRepository;
	}

	/**
	 * エージェントを削除する
	 *
	 * @param input 削除するエージェントの入力
	 * @returns 空のオブジェクト
	 * @throws {AgentNotFoundError} 指定された ID のエージェントが存在しない場合
	 */
	public async execute(input: DeleteAgentInput): Promise<DeleteAgentOutput> {
		const existing = await this.agentRepository.findById(input.id);

		if (!existing) {
			throw new AgentNotFoundError(`Agent with id "${input.id}" not found`);
		}

		await this.agentRepository.deleteById(input.id);

		return {};
	}
}
