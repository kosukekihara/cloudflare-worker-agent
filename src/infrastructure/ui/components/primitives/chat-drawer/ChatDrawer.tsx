import { $, component$, useSignal } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';
import styles from './ChatDrawer.module.css';

interface Message {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	toolIndicator?: string;
}

/** 画面右に固定されるAIチャットドロワー */
export const ChatDrawer = component$(() => {
	const nav = useNavigate();
	const isOpen = useSignal(false);
	const messages = useSignal<Message[]>([
		{
			id: '1',
			role: 'assistant',
			content: 'こんにちは！何かお手伝いできることはありますか？',
		},
	]);
	const inputValue = useSignal('');
	const conversationId = useSignal<string | null>(null);
	const isStreaming = useSignal(false);

	const sendMessage$ = $(async () => {
		const content = inputValue.value.trim();
		if (!content || isStreaming.value) {
			return;
		}

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			content,
		};

		const assistantMessageId = crypto.randomUUID();
		const assistantPlaceholder: Message = {
			id: assistantMessageId,
			role: 'assistant',
			content: '',
		};

		messages.value = [...messages.value, userMessage, assistantPlaceholder];
		inputValue.value = '';
		isStreaming.value = true;

		try {
			const response = await fetch('/api/chat', {
				body: JSON.stringify({ content, conversationId: conversationId.value }),
				headers: { 'Content-Type': 'application/json' },
				method: 'POST',
			});

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('レスポンスストリームを取得できませんでした');
			}

			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					break;
				}

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					if (!line.startsWith('data: ')) {
						continue;
					}

					try {
						const data = JSON.parse(line.slice(6)) as Record<string, unknown>;

						if (data.type === 'conversation' && typeof data.conversationId === 'string') {
							conversationId.value = data.conversationId;
						} else if (data.type === 'chunk' && typeof data.text === 'string') {
							messages.value = messages.value.map(m => {
								if (m.id === assistantMessageId) {
									return { ...m, content: m.content + data.text };
								}
								return m;
							});
						} else if (data.type === 'tool_call' && typeof data.toolName === 'string') {
							const indicator = (() => {
								if (data.toolName === 'weather') {
									return '天気情報を取得しています...';
								} else if (data.toolName === 'createUser') {
									return 'ユーザーを作成しています...';
								} else if (data.toolName === 'getUsers') {
									return 'ユーザー一覧を取得しています...';
								} else if (data.toolName === 'updateUser') {
									return 'ユーザーを更新しています...';
								} else if (data.toolName === 'deleteUser') {
									return 'ユーザーを削除しています...';
								} else {
									return '住所を調べています...';
								}
							})();
							messages.value = messages.value.map(m => {
								if (m.id === assistantMessageId) {
									return { ...m, toolIndicator: indicator };
								}
								return m;
							});
						} else if (data.type === 'tool_result') {
							messages.value = messages.value.map(m => {
								if (m.id === assistantMessageId) {
									// exactOptionalPropertyTypes のため spread では undefined を設定できない
									// destructuring でプロパティを除去する
									const { toolIndicator: _removed, ...rest } = m;
									return rest;
								}
								return m;
							});
							// ユーザーデータを変更するツールの完了後にルートローダーを再実行して UI を更新する
							if (data.toolName === 'createUser' || data.toolName === 'updateUser' || data.toolName === 'deleteUser') {
								await nav();
							}
						} else if (data.type === 'done') {
							isStreaming.value = false;
						} else if (data.type === 'error' && typeof data.message === 'string') {
							messages.value = messages.value.map(m => {
								if (m.id === assistantMessageId) {
									return { ...m, content: `エラーが発生しました: ${data.message}` };
								}
								return m;
							});
							isStreaming.value = false;
						}
					} catch {
						// JSON パース失敗は無視する
					}
				}
			}
		} catch (error) {
			const errorMessage = (() => {
				if (error instanceof Error) {
					return error.message;
				} else {
					return String(error);
				}
			})();
			messages.value = messages.value.map(m => {
				if (m.id === assistantMessageId) {
					return { ...m, content: `エラーが発生しました: ${errorMessage}` };
				}
				return m;
			});
			isStreaming.value = false;
		}
	});

	// isComposing が true の間は IME 変換中のため送信しない (変換確定後の Enter で送信)
	const handleKeyDown$ = $((event: KeyboardEvent) => {
		if (event.key === 'Enter' && !event.isComposing) {
			event.preventDefault();
			sendMessage$();
		}
	});

	const drawerClass = (() => {
		if (isOpen.value) {
			return [styles.drawer, styles.drawerOpen].join(' ');
		} else {
			return styles.drawer;
		}
	})();

	return (
		<>
			{/* トグルボタン: ドロワーが開いているときは非表示 (ヘッダーの閉じるボタンを使用する) */}
			{!isOpen.value && (
				<button
					aria-label="AIチャットを開く"
					class={styles.toggleButton}
					onClick$={() => {
						isOpen.value = true;
					}}
					type="button"
				>
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
				</button>
			)}

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
								<div class={styles.messageBubble}>
									{message.toolIndicator !== undefined && <p>{message.toolIndicator}</p>}
									{message.content}
								</div>
							</div>
						);
					})}
				</div>

				{/* 入力エリア */}
				<div class={styles.drawerInputArea}>
					<textarea
						class={styles.drawerTextarea}
						disabled={isStreaming.value}
						onInput$={(_, el) => {
							inputValue.value = el.value;
						}}
						onKeyDown$={handleKeyDown$}
						placeholder="メッセージを入力..."
						rows={1}
						value={inputValue.value}
					/>
					<button
						aria-label="送信"
						class={styles.drawerSend}
						disabled={!inputValue.value.trim() || isStreaming.value}
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
