import { component$, Slot } from '@builder.io/qwik';
import { ChatDrawer } from '../components/primitives/chat-drawer/ChatDrawer';

/**
 * 全ルート共通のレイアウト
 */
export default component$(() => {
	return (
		<>
			<Slot />
			<ChatDrawer />
		</>
	);
});
