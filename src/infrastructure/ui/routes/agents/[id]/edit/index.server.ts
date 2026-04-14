import type { RequestEventAction, RequestEventLoader } from '@builder.io/qwik-city';
import { useContainer } from '~/container';
import type { IAgentSerializedEntity } from '~/domain/entities/agent.entity';
import { AgentNotFoundError } from '~/domain/errors/agent-not-found.error';

/** エージェント取得のサーバーハンドラー (routeLoader 用) */
export async function getAgentHandler(requestEvent: RequestEventLoader): Promise<{ agent: IAgentSerializedEntity }> {
	const container = await useContainer(requestEvent.platform.env);
	const useCase = container.resolve('GetAgentUseCase');

	const routeId = requestEvent.params.id;
	if (routeId === undefined) {
		throw requestEvent.redirect(302, '/agents');
	}

	try {
		const result = await useCase.execute({ id: routeId });
		return { agent: result.agent };
	} catch (error) {
		if (error instanceof AgentNotFoundError) {
			throw requestEvent.redirect(302, '/agents');
		}
		throw error;
	}
}

/** エージェント更新のサーバーハンドラー (作成後 /agents にリダイレクトする) */
export async function updateAgentHandler(
	data: { id: string; name: string; modelId: string; instruction: string; enabledTools: string[] },
	requestEvent: RequestEventAction,
): Promise<Record<string, never>> {
	const container = await useContainer(requestEvent.platform.env);
	const useCase = container.resolve('UpdateAgentUseCase');

	await useCase.execute({
		enabledTools: data.enabledTools,
		id: data.id,
		instruction: data.instruction,
		modelId: data.modelId,
		name: data.name,
	});

	throw requestEvent.redirect(302, '/agents');
}
