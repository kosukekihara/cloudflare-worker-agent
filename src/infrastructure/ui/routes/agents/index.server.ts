import type { RequestEventAction, RequestEventLoader } from '@builder.io/qwik-city';
import { useContainer } from '~/container';
import type { IAgentSerializedEntity } from '~/domain/entities/agent.entity';

/** エージェント一覧取得のサーバーハンドラー (routeLoader 用) */
export async function getAgentsHandler(
	requestEvent: RequestEventLoader,
): Promise<{ agents: IAgentSerializedEntity[] }> {
	const container = await useContainer(requestEvent.platform.env);
	const useCase = container.resolve('GetAgentsUseCase');
	const result = await useCase.execute();

	return { agents: result.agents };
}

/** エージェント削除のサーバーハンドラー */
export async function deleteAgentHandler(
	data: { id: string },
	requestEvent: RequestEventAction,
): Promise<Record<string, never>> {
	const container = await useContainer(requestEvent.platform.env);
	const useCase = container.resolve('DeleteAgentUseCase');
	await useCase.execute({ id: data.id });

	return {};
}
