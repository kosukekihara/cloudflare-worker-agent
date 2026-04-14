import { component$ } from '@builder.io/qwik';
import { type DocumentHead, Form, Link, type RequestEventAction, routeAction$, zod$ } from '@builder.io/qwik-city';
import { Button } from '../../../components/primitives/button/Button';
import styles from './index.module.css';
import { createAgentHandler } from './index.server';

/** 利用可能なモデルの一覧 */
const AVAILABLE_MODELS = [{ id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite' }] as const;

/** 利用可能なツールの一覧 */
const AVAILABLE_TOOLS = [
	'postalCodeLookup',
	'weather',
	'createUser',
	'getUsers',
	'updateUser',
	'deleteUser',
	'searchSimilarMessages',
] as const;

/** createAgentHandler のラッパー。テストから直接呼び出し可能。 */
export async function handleCreateAgent(
	data: { name: string; modelId: string; instruction: string; enabledTools: string[] },
	requestEvent: RequestEventAction,
) {
	return createAgentHandler(data, requestEvent);
}

/** エージェント作成アクション */
// zod$ のコールバック形式で qwik-city 内蔵の Zod v3 インスタンスを使用することで Zod v4 との非互換を回避する
export const useCreateAgent = routeAction$(
	handleCreateAgent,
	zod$(z =>
		z.object({
			enabledTools: z
				.union([z.string(), z.array(z.string())])
				.optional()
				.transform(v => {
					if (v === undefined) {
						return [];
					}
					if (Array.isArray(v)) {
						return v;
					}
					return [v];
				}),
			instruction: z.string().min(1),
			modelId: z.string().min(1),
			name: z.string().min(1).max(100),
		}),
	),
);

/**
 * エージェント新規作成ページ
 */
export default component$(() => {
	const action = useCreateAgent();

	return (
		<main class={styles.container}>
			<header class={styles.header}>
				<Link class={styles.backLink} href="/agents">
					← Back
				</Link>
				<h1 class={styles.title}>New Agent</h1>
			</header>

			<Form action={action} class={styles.formSection}>
				<div class={styles.field}>
					<label class={styles.label} for="name">
						Name
					</label>
					<input class={styles.input} id="name" name="name" placeholder="My Agent" required type="text" />
				</div>

				<div class={styles.field}>
					<label class={styles.label} for="modelId">
						Model
					</label>
					<select class={styles.select} id="modelId" name="modelId" required>
						{AVAILABLE_MODELS.map(model => (
							<option key={model.id} value={model.id}>
								{model.label}
							</option>
						))}
					</select>
				</div>

				<div class={styles.field}>
					<label class={styles.label} for="instruction">
						Instruction
					</label>
					<textarea
						class={styles.textarea}
						id="instruction"
						name="instruction"
						placeholder="You are a helpful assistant..."
						required
					/>
				</div>

				<div class={styles.field}>
					<span class={styles.label}>Tools</span>
					<div class={styles.toolsGrid}>
						{AVAILABLE_TOOLS.map(toolName => (
							<label class={styles.toolItem} key={toolName}>
								<input name="enabledTools" type="checkbox" value={toolName} />
								<span class={styles.toolItemLabel}>{toolName}</span>
							</label>
						))}
					</div>
				</div>

				<div class={styles.formActions}>
					<Button type="submit">Create Agent</Button>
				</div>
			</Form>
		</main>
	);
});

/** エージェント新規作成ページの meta 情報と title を定義する。 */
export const head: DocumentHead = {
	title: 'New Agent',
};
