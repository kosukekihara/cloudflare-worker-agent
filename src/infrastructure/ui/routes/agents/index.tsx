import { component$ } from '@builder.io/qwik';
import {
	type DocumentHead,
	Form,
	Link,
	type RequestEventAction,
	type RequestEventLoader,
	routeAction$,
	routeLoader$,
	zod$,
} from '@builder.io/qwik-city';
import { Button } from '../../components/primitives/button/Button';
import styles from './index.module.css';
import { deleteAgentHandler, getAgentsHandler } from './index.server';

/** getAgentsHandler のラッパー。テストから直接呼び出し可能。 */
export async function loadAgents(requestEvent: RequestEventLoader) {
	return getAgentsHandler(requestEvent);
}

/** エージェント一覧ローダー */
export const useAgents = routeLoader$(loadAgents);

/** deleteAgentHandler のラッパー。テストから直接呼び出し可能。 */
export async function handleDeleteAgent(data: { id: string }, requestEvent: RequestEventAction) {
	return deleteAgentHandler(data, requestEvent);
}

/** エージェント削除アクション */
// zod$ のコールバック形式で qwik-city 内蔵の Zod v3 インスタンスを使用することで Zod v4 との非互換を回避する
export const useDeleteAgent = routeAction$(
	handleDeleteAgent,
	zod$(z => z.object({ id: z.string().min(1) })),
);

/**
 * エージェント一覧ページ
 */
export default component$(() => {
	const loader = useAgents();
	const deleteAction = useDeleteAgent();
	const agents = loader.value.agents;

	return (
		<main class={styles.container}>
			<header class={styles.header}>
				<h1 class={styles.title}>Agents</h1>
				<Link href="/agents/new">
					<Button type="button">+ New Agent</Button>
				</Link>
			</header>

			{(() => {
				if (agents.length > 0) {
					return (
						<div class={styles.agentList}>
							{agents.map(agent => (
								<div class={styles.agentCard} key={agent.id}>
									<div class={styles.agentInfo}>
										<p class={styles.agentName}>{agent.name}</p>
										<div class={styles.agentMeta}>
											<span>{agent.modelId}</span>
											<span>{agent.enabledTools.length} tools</span>
										</div>
										<p class={styles.agentInstruction}>{agent.instruction}</p>
									</div>
									<div class={styles.agentActions}>
										<Link class={styles.editLink} href={`/agents/${agent.id}/edit`}>
											Edit
										</Link>
										<Form action={deleteAction}>
											<input name="id" type="hidden" value={agent.id} />
											<button class={styles.deleteButton} type="submit">
												Delete
											</button>
										</Form>
									</div>
								</div>
							))}
						</div>
					);
				}

				return (
					<div class={styles.emptyState}>
						<p>No agents yet. Create your first agent!</p>
					</div>
				);
			})()}
		</main>
	);
});

/** エージェント一覧ページの meta 情報と title を定義する。 */
export const head: DocumentHead = {
	title: 'Agents',
};
