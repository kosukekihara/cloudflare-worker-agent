import { describe, expect, it, vi } from 'vitest';
import type { ChatStreamEvent } from '~/application/ports/integrations/chat/chat.integration';
import type { ConversationRecord } from '~/application/ports/repositories/conversation/conversation.repository';
import type { MessageRecord } from '~/application/ports/repositories/message/message.repository';
import { SendChatMessageUseCase } from '~/application/use-cases/conversation/send-chat-message.use-case';
import { ConversationNotFoundError } from '~/domain/errors/conversation-not-found.error';
import { createMockChatIntegration } from '~mock/infrastructure/integrations/chat/chat.integration.mock';
import { createMockEmbeddingIntegration } from '~mock/infrastructure/integrations/embedding/embedding.integration.mock';
import { createMockConversationRepository } from '~mock/application/repositories/conversation/conversation.repository.mock';
import { createMockMessageRepository } from '~mock/application/repositories/message/message.repository.mock';

describe('SendChatMessageUseCase', () => {
	const now = new Date('2026-01-01T00:00:00Z');

	function createConversationRecord(overrides?: Partial<ConversationRecord>): ConversationRecord {
		return {
			id: 'conv_01',
			userId: 'user_01',
			createdAt: now,
			updatedAt: now,
			...overrides,
		};
	}

	function createMessageRecord(overrides?: Partial<MessageRecord>): MessageRecord {
		return {
			id: 'msg_01',
			conversationId: 'conv_01',
			role: 'user',
			content: 'こんにちは',
			createdAt: now,
			...overrides,
		};
	}

	async function* mockStream(events: ChatStreamEvent[]) {
		for (const event of events) {
			yield event;
		}
	}

	// 正常系: ストリームイベントが yield され、AI 応答のテキストが DB に保存されることを検証する
	it('should yield events from chatIntegration and save assistant message after stream ends', async () => {
		const mockConvRepo = createMockConversationRepository();
		const mockMsgRepo = createMockMessageRepository();
		const mockChat = createMockChatIntegration();
		const mockEmbedding = createMockEmbeddingIntegration();
		const convRecord = createConversationRecord();
		const savedUserMsg = createMessageRecord();
		const savedAssistantMsg = createMessageRecord({ role: 'assistant', content: 'お手伝いします' });

		mockConvRepo.findById = async () => convRecord;
		mockMsgRepo.findByConversationId = async () => [];
		let saveCallCount = 0;
		mockMsgRepo.save = async input => {
			saveCallCount++;
			if (input.role === 'user') {
				return savedUserMsg;
			}
			return savedAssistantMsg;
		};
		mockChat.streamReply = () =>
			mockStream([
				{ type: 'text', text: 'お手' },
				{ type: 'text', text: '伝いします' },
			]);

		const useCase = new SendChatMessageUseCase(mockConvRepo, mockMsgRepo, mockChat, mockEmbedding);
		const events: ChatStreamEvent[] = [];
		for await (const event of useCase.execute({ conversationId: 'conv_01', content: 'こんにちは' })) {
			events.push(event);
		}

		expect(events).toEqual([
			{ type: 'text', text: 'お手' },
			{ type: 'text', text: '伝いします' },
		]);
		// user メッセージと assistant メッセージの 2 回保存されることを検証する
		expect(saveCallCount).toBe(2);
	});

	// 正常系: tool_call / tool_result イベントが透過的に yield されることを検証する
	it('should yield tool_call and tool_result events transparently', async () => {
		const mockConvRepo = createMockConversationRepository();
		const mockMsgRepo = createMockMessageRepository();
		const mockChat = createMockChatIntegration();
		const mockEmbedding = createMockEmbeddingIntegration();
		const convRecord = createConversationRecord();
		const savedMsg = createMessageRecord();

		mockConvRepo.findById = async () => convRecord;
		mockMsgRepo.findByConversationId = async () => [];
		mockMsgRepo.save = async () => savedMsg;
		mockChat.streamReply = () =>
			mockStream([
				{ type: 'tool_call', toolName: 'postalCodeLookup' },
				{ type: 'tool_result', toolName: 'postalCodeLookup', result: '東京都千代田区大手町' },
				{ type: 'text', text: '東京都千代田区大手町です' },
			]);

		const useCase = new SendChatMessageUseCase(mockConvRepo, mockMsgRepo, mockChat, mockEmbedding);
		const events: ChatStreamEvent[] = [];
		for await (const event of useCase.execute({ conversationId: 'conv_01', content: 'テスト' })) {
			events.push(event);
		}

		expect(events).toEqual([
			{ type: 'tool_call', toolName: 'postalCodeLookup' },
			{ type: 'tool_result', toolName: 'postalCodeLookup', result: '東京都千代田区大手町' },
			{ type: 'text', text: '東京都千代田区大手町です' },
		]);
	});

	// 正常系: ユーザーメッセージが正しい引数で保存されることを検証する
	it('should save user message with correct input', async () => {
		const mockConvRepo = createMockConversationRepository();
		const mockMsgRepo = createMockMessageRepository();
		const mockChat = createMockChatIntegration();
		const mockEmbedding = createMockEmbeddingIntegration();
		const convRecord = createConversationRecord();
		const savedMsg = createMessageRecord();

		mockConvRepo.findById = async () => convRecord;
		mockMsgRepo.findByConversationId = async () => [];
		const capturedInputs: unknown[] = [];
		mockMsgRepo.save = async input => {
			capturedInputs.push(input);
			return savedMsg;
		};
		mockChat.streamReply = () => mockStream([{ type: 'text', text: '応答' }]);

		const useCase = new SendChatMessageUseCase(mockConvRepo, mockMsgRepo, mockChat, mockEmbedding);
		for await (const _ of useCase.execute({ conversationId: 'conv_01', content: 'テスト' })) {
			// drain
		}

		// 最初の save 呼び出しがユーザーメッセージであることを検証する
		expect(capturedInputs[0]).toEqual({
			content: 'テスト',
			conversationId: 'conv_01',
			role: 'user',
		});
	});

	// 正常系: ストリーム完了後に AI 応答のテキスト全文が assistant メッセージとして保存されることを検証する
	it('should save assistant message with full concatenated text content after stream completes', async () => {
		const mockConvRepo = createMockConversationRepository();
		const mockMsgRepo = createMockMessageRepository();
		const mockChat = createMockChatIntegration();
		const mockEmbedding = createMockEmbeddingIntegration();
		const convRecord = createConversationRecord();
		const savedMsg = createMessageRecord();

		mockConvRepo.findById = async () => convRecord;
		mockMsgRepo.findByConversationId = async () => [];
		const capturedInputs: unknown[] = [];
		mockMsgRepo.save = async input => {
			capturedInputs.push(input);
			return savedMsg;
		};
		// tool_call / tool_result は DB 保存に含まれず、text のみが結合されることを検証する
		mockChat.streamReply = () =>
			mockStream([
				{ type: 'tool_call', toolName: 'postalCodeLookup' },
				{ type: 'tool_result', toolName: 'postalCodeLookup', result: '東京都' },
				{ type: 'text', text: 'Hello' },
				{ type: 'text', text: ', ' },
				{ type: 'text', text: 'World' },
			]);

		const useCase = new SendChatMessageUseCase(mockConvRepo, mockMsgRepo, mockChat, mockEmbedding);
		for await (const _ of useCase.execute({ conversationId: 'conv_01', content: 'Hi' })) {
			// drain
		}

		// 2 番目の save 呼び出しが text チャンクのみを結合した assistant メッセージであることを検証する
		expect(capturedInputs[1]).toEqual({
			content: 'Hello, World',
			conversationId: 'conv_01',
			role: 'assistant',
		});
	});

	// 正常系: 既存の会話履歴が chatIntegration に渡されることを検証する
	it('should pass existing message history to chatIntegration', async () => {
		const mockConvRepo = createMockConversationRepository();
		const mockMsgRepo = createMockMessageRepository();
		const mockChat = createMockChatIntegration();
		const mockEmbedding = createMockEmbeddingIntegration();
		const convRecord = createConversationRecord();
		const existingMessages = [
			createMessageRecord({ id: 'msg_00', role: 'user', content: '前の質問' }),
			createMessageRecord({ id: 'msg_01', role: 'assistant', content: '前の回答' }),
		];
		const savedMsg = createMessageRecord();

		mockConvRepo.findById = async () => convRecord;
		mockMsgRepo.findByConversationId = async () => existingMessages;
		mockMsgRepo.save = async () => savedMsg;
		let capturedMessages: unknown;
		mockChat.streamReply = messages => {
			capturedMessages = messages;
			return mockStream([{ type: 'text', text: '返答' }]);
		};

		const useCase = new SendChatMessageUseCase(mockConvRepo, mockMsgRepo, mockChat, mockEmbedding);
		for await (const _ of useCase.execute({ conversationId: 'conv_01', content: '新しい質問' })) {
			// drain
		}

		// 履歴 + 新しいユーザーメッセージが渡されることを検証する
		expect(capturedMessages).toEqual([
			{ content: '前の質問', role: 'user' },
			{ content: '前の回答', role: 'assistant' },
			{ content: '新しい質問', role: 'user' },
		]);
	});

	// 異常系: 指定 ID の会話が存在しない場合に ConversationNotFoundError がスローされることを検証する
	it('should throw ConversationNotFoundError when conversation is not found', async () => {
		const mockConvRepo = createMockConversationRepository();
		const mockMsgRepo = createMockMessageRepository();
		const mockChat = createMockChatIntegration();
		const mockEmbedding = createMockEmbeddingIntegration();
		mockConvRepo.findById = async () => null;

		const useCase = new SendChatMessageUseCase(mockConvRepo, mockMsgRepo, mockChat, mockEmbedding);
		const gen = useCase.execute({ conversationId: 'nonexistent', content: 'Hi' });

		await expect(gen.next()).rejects.toThrow(ConversationNotFoundError);
	});

	// 正常系: ユーザーメッセージ保存後に embed がユーザー内容で呼ばれることを検証する
	it('should call embed with user content after saving user message', async () => {
		const mockConvRepo = createMockConversationRepository();
		const mockMsgRepo = createMockMessageRepository();
		const mockChat = createMockChatIntegration();
		const mockEmbedding = createMockEmbeddingIntegration();
		const convRecord = createConversationRecord();
		const savedMsg = createMessageRecord();

		mockConvRepo.findById = async () => convRecord;
		mockMsgRepo.findByConversationId = async () => [];
		mockMsgRepo.save = async () => savedMsg;
		mockChat.streamReply = () => mockStream([{ type: 'text', text: '返答' }]);

		const useCase = new SendChatMessageUseCase(mockConvRepo, mockMsgRepo, mockChat, mockEmbedding);
		for await (const _ of useCase.execute({ conversationId: 'conv_01', content: 'テスト内容' })) {
			// drain
		}

		// embed の最初の呼び出しがユーザーメッセージの内容で行われることを検証する
		expect(vi.mocked(mockEmbedding.embed)).toHaveBeenNthCalledWith(1, 'テスト内容');
	});

	// 正常系: ユーザーメッセージの埋め込み結果で updateEmbedding が呼ばれることを検証する
	it('should call updateEmbedding with user message id and embedding vector', async () => {
		const mockConvRepo = createMockConversationRepository();
		const mockMsgRepo = createMockMessageRepository();
		const mockChat = createMockChatIntegration();
		const userEmbedding = new Array(3072).fill(0.1);
		const mockEmbedding = createMockEmbeddingIntegration({
			embed: vi.fn().mockResolvedValue(userEmbedding),
		});
		const convRecord = createConversationRecord();
		const savedUserMsg = createMessageRecord({ id: 'user_msg_id', role: 'user' });

		mockConvRepo.findById = async () => convRecord;
		mockMsgRepo.findByConversationId = async () => [];
		mockMsgRepo.save = async input => {
			if (input.role === 'user') {
				return savedUserMsg;
			}
			return createMessageRecord({ id: 'asst_msg_id', role: 'assistant' });
		};
		mockChat.streamReply = () => mockStream([{ type: 'text', text: '返答' }]);

		const useCase = new SendChatMessageUseCase(mockConvRepo, mockMsgRepo, mockChat, mockEmbedding);
		for await (const _ of useCase.execute({ conversationId: 'conv_01', content: 'テスト' })) {
			// drain
		}

		// ユーザーメッセージの ID と埋め込みベクトルで updateEmbedding が呼ばれることを検証する
		expect(vi.mocked(mockMsgRepo.updateEmbedding)).toHaveBeenCalledWith('user_msg_id', userEmbedding);
	});

	// 正常系: AI 応答保存後に embed がアシスタント内容で呼ばれることを検証する
	it('should call embed with assistant content after stream completes', async () => {
		const mockConvRepo = createMockConversationRepository();
		const mockMsgRepo = createMockMessageRepository();
		const mockChat = createMockChatIntegration();
		const mockEmbedding = createMockEmbeddingIntegration();
		const convRecord = createConversationRecord();
		const savedMsg = createMessageRecord();

		mockConvRepo.findById = async () => convRecord;
		mockMsgRepo.findByConversationId = async () => [];
		mockMsgRepo.save = async () => savedMsg;
		mockChat.streamReply = () =>
			mockStream([
				{ type: 'text', text: 'AI の' },
				{ type: 'text', text: '返答です' },
			]);

		const useCase = new SendChatMessageUseCase(mockConvRepo, mockMsgRepo, mockChat, mockEmbedding);
		for await (const _ of useCase.execute({ conversationId: 'conv_01', content: 'テスト' })) {
			// drain
		}

		// embed の 2 番目の呼び出しが結合された AI 応答で行われることを検証する
		expect(vi.mocked(mockEmbedding.embed)).toHaveBeenNthCalledWith(2, 'AI の返答です');
	});

	// 正常系: AI 応答の埋め込み結果で updateEmbedding が呼ばれることを検証する
	it('should call updateEmbedding with assistant message id and embedding vector', async () => {
		const mockConvRepo = createMockConversationRepository();
		const mockMsgRepo = createMockMessageRepository();
		const mockChat = createMockChatIntegration();
		const assistantEmbedding = new Array(3072).fill(0.5);
		const mockEmbedding = createMockEmbeddingIntegration({
			embed: vi.fn().mockResolvedValue(assistantEmbedding),
		});
		const convRecord = createConversationRecord();
		const savedAssistantMsg = createMessageRecord({ id: 'asst_msg_id', role: 'assistant' });

		mockConvRepo.findById = async () => convRecord;
		mockMsgRepo.findByConversationId = async () => [];
		mockMsgRepo.save = async input => {
			if (input.role === 'assistant') {
				return savedAssistantMsg;
			}
			return createMessageRecord({ id: 'user_msg_id', role: 'user' });
		};
		mockChat.streamReply = () => mockStream([{ type: 'text', text: '返答' }]);

		const useCase = new SendChatMessageUseCase(mockConvRepo, mockMsgRepo, mockChat, mockEmbedding);
		for await (const _ of useCase.execute({ conversationId: 'conv_01', content: 'テスト' })) {
			// drain
		}

		// AI 応答メッセージの ID と埋め込みベクトルで updateEmbedding が呼ばれることを検証する
		expect(vi.mocked(mockMsgRepo.updateEmbedding)).toHaveBeenCalledWith('asst_msg_id', assistantEmbedding);
	});
});
