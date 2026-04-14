import { $, component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { useNavigate } from '@builder.io/qwik-city';
import type { IAgentSerializedEntity } from '~/domain/entities/agent.entity';
import { MarkdownItIntegration } from '~/infrastructure/integrations/markdown/markdown-it.integration';
import styles from './ChatDrawer.module.css';

interface Message {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	renderedHtml?: string;
	toolIndicator?: string;
}

interface ChatDrawerProps {
	agents: IAgentSerializedEntity[];
}

const markdownIntegration = new MarkdownItIntegration();

const DEFAULT_DRAWER_WIDTH = 360;
const MIN_DRAWER_WIDTH = 280;
const DRAWER_WIDTH_STORAGE_KEY = 'chat-drawer-width';

/** 画面右に固定されるAIチャットドロワー */
export const ChatDrawer = component$<ChatDrawerProps>(({ agents }) => {
	const nav = useNavigate();
	const isOpen = useSignal(false);
	const drawerWidth = useSignal(DEFAULT_DRAWER_WIDTH);
	const isResizing = useSignal(false);
	const selectedAgentId = useSignal(agents[0]?.id ?? '');
	const messages = useSignal<Message[]>([
		{
			id: '1',
			role: 'assistant',
			content: 'こんにちは！何かお手伝いできることはありますか？',
			renderedHtml: markdownIntegration.render('こんにちは！何かお手伝いできることはありますか？'),
		},
	]);
	const inputValue = useSignal('');
	const conversationId = useSignal<string | null>(null);
	const isStreaming = useSignal(false);

	const hasAgents = agents.length > 0;

	// mermaid ブロックを含むメッセージが追加されたとき、クライアント側で mermaid.run() を実行する
	useVisibleTask$(({ track }) => {
		const currentMessages = track(() => messages.value);
		const hasMermaid = currentMessages.some(m => m.renderedHtml?.includes('class="mermaid"'));
		if (!hasMermaid) {
			return;
		}
		void import('mermaid').then(({ default: mermaid }) => {
			mermaid.initialize({ startOnLoad: false, theme: 'default' });
			mermaid.run();
		});
	});

	// localStorage からドロワー幅を復元し、ポインターイベントでリサイズを処理する
	useVisibleTask$(({ cleanup }) => {
		const saved = localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY);
		if (saved !== null) {
			const parsed = parseInt(saved, 10);
			if (!Number.isNaN(parsed)) {
				drawerWidth.value = parsed;
			}
		}

		const handlePointerMove = (event: PointerEvent) => {
			if (!isResizing.value) {
				return;
			}
			const newWidth = window.innerWidth - event.clientX;
			const maxWidth = Math.floor(window.innerWidth * 0.85);
			const clamped = Math.max(MIN_DRAWER_WIDTH, Math.min(newWidth, maxWidth));
			drawerWidth.value = clamped;
			localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(clamped));
		};

		const handlePointerUp = () => {
			if (!isResizing.value) {
				return;
			}
			isResizing.value = false;
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
		};

		document.addEventListener('pointermove', handlePointerMove);
		document.addEventListener('pointerup', handlePointerUp);

		cleanup(() => {
			document.removeEventListener('pointermove', handlePointerMove);
			document.removeEventListener('pointerup', handlePointerUp);
		});
	});

	const startResizing$ = $((event: PointerEvent) => {
		event.preventDefault();
		isResizing.value = true;
		document.body.style.cursor = 'ew-resize';
		document.body.style.userSelect = 'none';
	});

	const sendMessage$ = $(async () => {
		const content = inputValue.value.trim();
		if (!content || isStreaming.value || !selectedAgentId.value) {
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
				body: JSON.stringify({
					agentId: selectedAgentId.value,
					content,
					conversationId: conversationId.value,
				}),
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
								if (data.toolName === 'getWeather') {
									return '天気情報を取得しています...';
								} else if (data.toolName === 'createUser') {
									return 'ユーザーを作成しています...';
								} else if (data.toolName === 'listUsers') {
									return 'ユーザー一覧を取得しています...';
								} else if (data.toolName === 'updateUser') {
									return 'ユーザーを更新しています...';
								} else if (data.toolName === 'deleteUser') {
									return 'ユーザーを削除しています...';
								} else if (data.toolName === 'lookupAddress') {
									return '住所を調べています...';
								} else if (data.toolName === 'getCurrentTime') {
									return '現在時刻を取得しています...';
								} else if (data.toolName === 'searchSimilarMessages') {
									return '類似メッセージを検索しています...';
								} else {
									return 'ツールを実行しています...';
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
							// ストリーミング完了後に全文を Markdown レンダリングして HTML に変換する
							messages.value = messages.value.map(m => {
								if (m.id === assistantMessageId && m.role === 'assistant') {
									return { ...m, renderedHtml: markdownIntegration.render(m.content) };
								}
								return m;
							});
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
		const classes = [styles.drawer];
		if (isOpen.value) {
			classes.push(styles.drawerOpen);
		}
		if (isResizing.value) {
			classes.push(styles.drawerResizing);
		}
		return classes.join(' ');
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
			<aside aria-label="AIチャット" class={drawerClass} style={`--drawer-width: ${drawerWidth.value}px`}>
				{/* リサイズハンドル: ドロワー左端のドラッグ可能なエリア */}
				<div aria-hidden="true" class={styles.resizeHandle} onPointerDown$={startResizing$} />

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

				{/* エージェントセレクター */}
				{(() => {
					if (hasAgents) {
						return (
							<div class={styles.drawerAgentSelectArea}>
								<select
									class={styles.drawerAgentSelect}
									onChange$={(_, el) => {
										selectedAgentId.value = el.value;
										conversationId.value = null;
									}}
									value={selectedAgentId.value}
								>
									{agents.map(agent => (
										<option key={agent.id} value={agent.id}>
											{agent.name}
										</option>
									))}
								</select>
								<div class={styles.drawerAgentLinks}>
									<a class={styles.drawerAgentLink} href="/agents">
										一覧・管理
									</a>
									<a class={styles.drawerAgentLink} href="/agents/new">
										＋ 新規作成
									</a>
								</div>
							</div>
						);
					}

					return (
						<div class={styles.drawerNoAgents}>
							エージェントがありません。
							<a class={styles.drawerNoAgentsLink} href="/agents/new">
								作成する
							</a>
						</div>
					);
				})()}

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
									{(() => {
										if (message.renderedHtml !== undefined) {
											return <div class={styles.markdownContent} dangerouslySetInnerHTML={message.renderedHtml} />;
										} else {
											return message.content;
										}
									})()}
								</div>
							</div>
						);
					})}
				</div>

				{/* 入力エリア */}
				<div class={styles.drawerInputArea}>
					<textarea
						class={styles.drawerTextarea}
						disabled={isStreaming.value || !hasAgents}
						onInput$={(_, el) => {
							inputValue.value = el.value;
						}}
						onKeyDown$={handleKeyDown$}
						placeholder={(() => {
							if (hasAgents) {
								return 'メッセージを入力...';
							}
							return 'エージェントを作成してください';
						})()}
						rows={1}
						value={inputValue.value}
					/>
					<button
						aria-label="送信"
						class={styles.drawerSend}
						disabled={!inputValue.value.trim() || isStreaming.value || !hasAgents}
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
