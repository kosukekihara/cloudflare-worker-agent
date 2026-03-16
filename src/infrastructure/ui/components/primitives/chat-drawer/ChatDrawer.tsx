import { $, component$, useSignal } from '@builder.io/qwik';
import styles from './ChatDrawer.module.css';

interface Message {
	id: string;
	role: 'user' | 'assistant';
	content: string;
}

/** 画面右に固定されるAIチャットドロワー */
export const ChatDrawer = component$(() => {
	const isOpen = useSignal(false);
	const messages = useSignal<Message[]>([
		{
			id: '1',
			role: 'assistant',
			content: 'こんにちは！何かお手伝いできることはありますか？',
		},
	]);
	const inputValue = useSignal('');

	const sendMessage$ = $(() => {
		const content = inputValue.value.trim();
		if (!content) {
			return;
		}

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			content,
		};

		messages.value = [...messages.value, userMessage];
		inputValue.value = '';

		// TODO: バックエンド実装後にAI応答を取得する
		const stubReply: Message = {
			id: crypto.randomUUID(),
			role: 'assistant',
			content: '（AIの応答はバックエンド実装後に有効になります）',
		};
		messages.value = [...messages.value, stubReply];
	});

	const handleKeyDown$ = $((event: KeyboardEvent) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage$();
		}
	});

	const toggleLabel = (() => {
		if (isOpen.value) {
			return 'チャットを閉じる';
		} else {
			return 'AIチャットを開く';
		}
	})();

	const toggleIcon = (() => {
		if (isOpen.value) {
			return (
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
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			);
		} else {
			return (
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
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
				</svg>
			);
		}
	})();

	const drawerClass = (() => {
		if (isOpen.value) {
			return [styles.drawer, styles.drawerOpen].join(' ');
		} else {
			return styles.drawer;
		}
	})();

	return (
		<>
			{/* トグルボタン */}
			<button
				aria-label={toggleLabel}
				class={styles.toggleButton}
				onClick$={() => {
					isOpen.value = !isOpen.value;
				}}
				type="button"
			>
				{toggleIcon}
			</button>

			{/* ドロワー */}
			<aside aria-label="AIチャット" class={drawerClass}>
				{/* ヘッダー */}
				<div class={styles.drawerHeader}>
					<div class={styles.drawerHeaderInfo}>
						<div class={styles.drawerAvatar} />
						<div>
							<p class={styles.drawerName}>AI アシスタント</p>
							<p class={styles.drawerStatus}>オンライン</p>
						</div>
					</div>
					<button
						aria-label="チャットを閉じる"
						class={styles.drawerClose}
						onClick$={() => {
							isOpen.value = false;
						}}
						type="button"
					>
						<svg
							aria-hidden="true"
							fill="none"
							height="18"
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							viewBox="0 0 24 24"
							width="18"
						>
							<path d="M18 6L6 18M6 6l12 12" />
						</svg>
					</button>
				</div>

				{/* メッセージエリア (column-reverse で自動スクロール) */}
				<div class={styles.drawerMessages}>
					{[...messages.value].reverse().map(message => {
						const messageClass = (() => {
							if (message.role === 'user') {
								return [styles.message, styles.messageUser].join(' ');
							} else {
								return [styles.message, styles.messageAssistant].join(' ');
							}
						})();

						return (
							<div class={messageClass} key={message.id}>
								{message.role === 'assistant' && <div class={styles.messageAvatar} />}
								<div class={styles.messageBubble}>{message.content}</div>
							</div>
						);
					})}
				</div>

				{/* 入力エリア */}
				<div class={styles.drawerInputArea}>
					<textarea
						class={styles.drawerTextarea}
						onInput$={(_, el) => {
							inputValue.value = el.value;
						}}
						onKeyDown$={handleKeyDown$}
						placeholder="メッセージを入力... (Shift+Enter で改行)"
						rows={1}
						value={inputValue.value}
					/>
					<button
						aria-label="送信"
						class={styles.drawerSend}
						disabled={!inputValue.value.trim()}
						onClick$={sendMessage$}
						type="button"
					>
						<svg aria-hidden="true" fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
							<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
						</svg>
					</button>
				</div>
			</aside>

			{/* オーバーレイ (モバイル用) */}
			{isOpen.value && (
				<div
					aria-hidden="true"
					class={styles.overlay}
					onClick$={() => {
						isOpen.value = false;
					}}
				/>
			)}
		</>
	);
});
