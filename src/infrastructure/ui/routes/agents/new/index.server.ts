import type { RequestEventAction } from '@builder.io/qwik-city';
import { useContainer } from '~/container';

/** エージェント作成のサーバーハンドラー (作成後 /agents にリダイレクトする) */
export async function createAgentHandler(
	data: { name: string; modelId: string; instruction: string; enabledTools: string[] },
	requestEvent: RequestEventAction,
): Promise<Record<string, never>> {
	const container = await useContainer(requestEvent.platform.env);
	const useCase = container.resolve('CreateAgentUseCase');

	await useCase.execute({
		enabledTools: data.enabledTools,
		instruction: data.instruction,
		modelId: data.modelId,
		name: data.name,
	});

	throw requestEvent.redirect(302, '/agents');
}
