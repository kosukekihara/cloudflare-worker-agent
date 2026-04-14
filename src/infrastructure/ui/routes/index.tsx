import { component$ } from '@builder.io/qwik';
import {
	type DocumentHead,
	Form,
	type RequestEventAction,
	type RequestEventLoader,
	routeAction$,
	routeLoader$,
	zod$,
} from '@builder.io/qwik-city';
import { Badge } from '../components/primitives/badge/Badge';
import { Button } from '../components/primitives/button/Button';
import { Card } from '../components/primitives/card/Card';
import { InputField } from '../components/primitives/input-field/InputField';
import { SuccessMessage } from '../components/primitives/success-message/SuccessMessage';
import styles from './index.module.css';
import { deleteUserHandler, getUsersHandler, registerUserHandler } from './index.server';

/** deleteUserHandler のラッパー。テストから直接呼び出し可能。 */
export async function handleDeleteUser(data: { id: string }, requestEvent: RequestEventAction) {
	return deleteUserHandler(data, requestEvent);
}

/** ユーザー削除アクション */
// zod$ のコールバック形式で qwik-city 内蔵の Zod v3 インスタンスを使用することで Zod v4 との非互換を回避する
export const useDeleteUser = routeAction$(
	handleDeleteUser,
	zod$(z => z.object({ id: z.string().min(1) })),
);

/** registerUserHandler のラッパー。テストから直接呼び出し可能。 */
export async function handleRegisterUser(data: { email: string }, requestEvent: RequestEventAction) {
	return registerUserHandler(data, requestEvent);
}

/** ユーザー登録アクション */
// zod$ のコールバック形式で qwik-city 内蔵の Zod v3 インスタンスを使用することで Zod v4 との非互換を回避する
export const useRegisterUser = routeAction$(
	handleRegisterUser,
	zod$(z => z.object({ email: z.string().email() })),
);

/** getUsersHandler のラッパー。テストから直接呼び出し可能。 */
export async function loadUsers(requestEvent: RequestEventLoader) {
	return getUsersHandler(requestEvent);
}

/** ユーザー一覧ローダー */
export const useUsers = routeLoader$(loadUsers);

/**
 * トップページ: ユーザー登録フォーム + ユーザー一覧テーブル
 */
export default component$(() => {
	const action = useRegisterUser();
	const deleteAction = useDeleteUser();
	const loader = useUsers();
	const users = loader.value.users;

	return (
		<main class={styles.container}>
			<header class={styles.header}>
				<h1 class={styles.title}>ホーム</h1>
			</header>

			<Card>
				<Form action={action}>
					<InputField
						autoComplete="email"
						id="email"
						label="メールアドレス"
						name="email"
						placeholder="you@example.com"
						required
						type="email"
					/>
					<Button type="submit">登録</Button>
				</Form>

				{action.value && 'user' in action.value && (
					<div style={{ marginTop: '1.5rem' }}>
						<SuccessMessage>登録しました: {action.value.user.email}</SuccessMessage>
					</div>
				)}
			</Card>

			<Card>
				<h2 class={styles.sectionTitle}>
					登録済みユーザー
					<Badge>{users.length}</Badge>
				</h2>

				{(() => {
					if (users.length > 0) {
						return (
							<div class={styles.tableWrapper}>
								<table class={styles.table}>
									<thead>
										<tr>
											<th class={styles.th}>メールアドレス</th>
											<th class={styles.th}>作成日</th>
											<th class={styles.th}>操作</th>
										</tr>
									</thead>
									<tbody>
										{users.map(user => {
											const createdAt = new Date(user.createdAt);
											const formattedDate = `${createdAt.getFullYear()}年${createdAt.getMonth() + 1}月${createdAt.getDate()}日`;

											return (
												<tr class={styles.tr} key={user.id}>
													<td class={styles.td}>{user.email}</td>
													<td class={styles.td}>{formattedDate}</td>
													<td class={styles.td}>
														<Form action={deleteAction}>
															<input name="id" type="hidden" value={user.id} />
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
							</div>
						);
					}

					return (
						<div class={styles.emptyState}>
							<p>ユーザーが登録されていません。</p>
						</div>
					);
				})()}
			</Card>
		</main>
	);
});

/** トップページの meta 情報と title を定義する。 */
export const head: DocumentHead = {
	meta: [
		{
			content: 'A minimal, smart, and exciting boilerplate for Cloudflare Workers.',
			name: 'description',
		},
	],
	title: 'Cloudflare Worker Boilerplate',
};
