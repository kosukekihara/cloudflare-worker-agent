import type { RequestHandler } from '@builder.io/qwik-city';
import { useContainer } from '~/container';

// いったん固定ユーザーのメールアドレスを使用する
const CHAT_USER_EMAIL = 'kosuke.kihara@andco.group';

const encoder = new TextEncoder();

function sseData(payload: Record<string, unknown>): Uint8Array {
	return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export const onPost: RequestHandler = async requestEvent => {
	const body = await requestEvent.request.json<{ conversationId: string | null; content: string }>();

	const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
	const writer = writable.getWriter();

	// レスポンスを throw する前に IIFE を開始する (throw 後は実行されないため)
	void (async () => {
		try {
			const container = await useContainer(requestEvent.platform.env);

			let { conversationId } = body;

			if (!conversationId) {
				const startUseCase = container.resolve('StartConversationUseCase');
				const result = await startUseCase.execute({ userEmail: CHAT_USER_EMAIL });
				conversationId = result.conversation.id;
				await writer.write(sseData({ conversationId, type: 'conversation' }));
			}

			const sendUseCase = container.resolve('SendChatMessageUseCase');

			for await (const event of sendUseCase.execute({ content: body.content, conversationId })) {
				if (event.type === 'text') {
					await writer.write(sseData({ text: event.text, type: 'chunk' }));
				} else if (event.type === 'tool_call') {
					await writer.write(sseData({ toolName: event.toolName, type: 'tool_call' }));
				} else if (event.type === 'tool_result') {
					await writer.write(sseData({ result: event.result, toolName: event.toolName, type: 'tool_result' }));
				}
			}

			await writer.write(sseData({ type: 'done' }));
		} catch (error) {
			const message = (() => {
				if (error instanceof Error) {
					return error.message;
				} else {
					return String(error);
				}
			})();
			await writer.write(sseData({ message, type: 'error' }));
		} finally {
			await writer.close();
		}
	})();

	// send(new Response) のコードパスを使うことで pipeTo() が正しく呼ばれる
	// send(statusCode, body) のコードパスでは ReadableStream が writer.write() に直接渡されエラーになる
	throw requestEvent.send(
		new Response(readable, {
			headers: {
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
				'Content-Type': 'text/event-stream',
			},
			status: 200,
		}),
	);
};
