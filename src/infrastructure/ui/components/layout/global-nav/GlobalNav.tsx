import { component$ } from '@builder.io/qwik';
import { Link, useLocation } from '@builder.io/qwik-city';
import styles from './GlobalNav.module.css';

interface GlobalNavProps {
	agentCount: number;
}

/** 全ページ共通のグローバルナビゲーション */
export const GlobalNav = component$<GlobalNavProps>(({ agentCount }) => {
	const loc = useLocation();
	const isHome = loc.url.pathname === '/';
	const isAgents = loc.url.pathname.startsWith('/agents');

	return (
		<header class={styles.header}>
			<nav class={styles.inner}>
				<Link class={styles.logo} href="/">
					<svg
						aria-hidden="true"
						fill="none"
						height="20"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						viewBox="0 0 24 24"
						width="20"
					>
						<path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.5V12h2a2 2 0 0 1 2 2v6H6v-6a2 2 0 0 1 2-2h2V9.5C8.8 8.8 8 7.5 8 6a4 4 0 0 1 4-4z" />
					</svg>
					<span>AI Agent</span>
				</Link>

				<div class={styles.links}>
					<Link
						class={(() => {
							const classes = [styles.link];
							if (isHome) {
								classes.push(styles.linkActive);
							}
							return classes.join(' ');
						})()}
						href="/"
					>
						ホーム
					</Link>
					<Link
						class={(() => {
							const classes = [styles.link];
							if (isAgents) {
								classes.push(styles.linkActive);
							}
							return classes.join(' ');
						})()}
						href="/agents"
					>
						エージェント管理
						{agentCount > 0 && <span class={styles.badge}>{agentCount}</span>}
					</Link>
				</div>
			</nav>
		</header>
	);
});
