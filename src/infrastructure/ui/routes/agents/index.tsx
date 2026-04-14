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
				<h1 class={styles.title}>エージェント管理</h1>
				<Link href="/agents/new">
					<Button type="button">新規作成</Button>
				</Link>
			</header>

			<div class={styles.card}>
				<div class={styles.cardHeader}>
					<span class={styles.cardTitle}>エージェント一覧</span>
					<span class={styles.badge}>{agents.length}</span>
				</div>

				{(() => {
					if (agents.length > 0) {
						return (
							<table class={styles.table}>
								<thead>
									<tr>
										<th class={styles.th}>名前</th>
										<th class={styles.th}>モデル</th>
										<th class={styles.th}>ツール数</th>
										<th class={styles.th}>作成日</th>
										<th class={styles.th}>操作</th>
									</tr>
								</thead>
								<tbody>
									{agents.map(agent => {
										const createdAt = new Date(agent.createdAt);
										const formattedDate = `${createdAt.getFullYear()}年${createdAt.getMonth() + 1}月${createdAt.getDate()}日`;

										return (
											<tr class={styles.tr} key={agent.id}>
												<td class={styles.td}>{agent.name}</td>
												<td class={styles.td}>{agent.modelId}</td>
												<td class={styles.td}>{agent.enabledTools.length}</td>
												<td class={styles.td}>{formattedDate}</td>
												<td class={`${styles.td} ${styles.actionsCell}`}>
													<Link class={styles.editLink} href={`/agents/${agent.id}/edit`}>
														編集
													</Link>
													<Form action={deleteAction}>
														<input name="id" type="hidden" value={agent.id} />
														<button class={styles.deleteButton} type="submit">
															削除
														</button>
													</Form>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						);
					}

					return (
						<div class={styles.emptyState}>
							<p>エージェントがありません。最初のエージェントを作成してください。</p>
						</div>
					);
				})()}
			</div>
		</main>
	);
});

/** エージェント一覧ページの meta 情報と title を定義する。 */
export const head: DocumentHead = {
	title: 'エージェント管理',
};
