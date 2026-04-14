import type { RequestEventLoader } from '@builder.io/qwik-city';
import { useContainer } from '~/container';
import type { IAgentSerializedEntity } from '~/domain/entities/agent.entity';

/** レイアウト用エージェント一覧取得のサーバーハンドラー (routeLoader 用) */
export async function getAgentsForLayoutHandler(
	requestEvent: RequestEventLoader,
): Promise<{ agents: IAgentSerializedEntity[] }> {
	const container = await useContainer(requestEvent.platform.env);
	const useCase = container.resolve('GetAgentsUseCase');
	const result = await useCase.execute();

	return { agents: result.agents };
}
