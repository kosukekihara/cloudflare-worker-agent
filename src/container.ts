import { createContainer, createScope } from 'katagami';
import { type ApplicationService, buildApplicationContainer } from '~/container.application';
import type { InfrastructureService } from '~/container.infrastructure';
import { buildInterfaceContainer, type InterfaceService } from '~/container.interface';

/**
 * 全層のトークン型マップ (Composition Root)
 */
export type Service = InfrastructureService & ApplicationService & InterfaceService;

/** DI Container の型 */
type AppContainer = Awaited<ReturnType<typeof buildContainer>>;

/**
 * Cloudflare Workers の同一 isolate 内でコンテナをキャッシュする。
 * Promise をキャッシュすることで、並行リクエストが buildContainer を重複実行するのを防ぐ。
 */
let containerPromise: Promise<AppContainer> | undefined;

/**
 * DI Container を取得する
 *
 * @param env Cloudflare Workers の Env (requestEvent.platform.env)
 */
export async function useContainer(env: Env): Promise<AppContainer> {
	if (containerPromise === undefined) {
		containerPromise = buildContainer(env);
	}

	return containerPromise;
}

/**
 * 全レイヤーのコンテナを組み合わせた DI Container を構築する。
 *
 * Infrastructure → Interface → Application の順でレイヤーを合成する。
 */
async function buildContainer(env: Env) {
	const { buildInfrastructureContainer } = await import('~/container.infrastructure');
	const infrastructureContainer = buildInfrastructureContainer(env);
	const interfaceContainer = buildInterfaceContainer();
	const applicationContainer = buildApplicationContainer(env);

	const container = createContainer<Service>()
		.use(infrastructureContainer)
		.use(interfaceContainer)
		.use(applicationContainer);

	return createScope(container);
}
