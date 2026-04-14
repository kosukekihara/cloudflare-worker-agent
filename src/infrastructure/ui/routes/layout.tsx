import { component$, Slot } from '@builder.io/qwik';
import { type RequestEventLoader, routeLoader$ } from '@builder.io/qwik-city';
import { ChatDrawer } from '../components/primitives/chat-drawer/ChatDrawer';
import { getAgentsForLayoutHandler } from './layout.server';

/** getAgentsForLayoutHandler のラッパー。テストから直接呼び出し可能。 */
export async function loadLayoutAgents(requestEvent: RequestEventLoader) {
	return getAgentsForLayoutHandler(requestEvent);
}

/** レイアウト全体で使用するエージェント一覧ローダー */
export const useLayoutAgents = routeLoader$(loadLayoutAgents);

/**
 * 全ルート共通のレイアウト
 */
export default component$(() => {
	const agentsLoader = useLayoutAgents();

	return (
		<>
			<Slot />
			<ChatDrawer agents={agentsLoader.value.agents} />
		</>
	);
});
