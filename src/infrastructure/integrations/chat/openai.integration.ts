import { createOpenAI } from '@ai-sdk/openai';
import { stepCountIs, streamText, tool, zodSchema } from 'ai';
import { z } from 'zod';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import type {
	ChatIntegration,
	ChatIntegrationMessage,
	ChatStreamEvent,
} from '~/application/ports/integrations/chat/chat.integration';
import type { EmbeddingIntegration } from '~/application/ports/integrations/embedding/embedding.integration';
import type { PostalCodeIntegration } from '~/application/ports/integrations/postal-code/postal-code.integration';
import type { WeatherIntegration } from '~/application/ports/integrations/weather/weather.integration';
import type { MessageRepository } from '~/application/ports/repositories/message/message.repository';
import type { DeleteUserUseCase } from '~/application/use-cases/user/delete-user.use-case';
import type { GetUsersUseCase } from '~/application/use-cases/user/get-users.use-case';
import type { RegisterUserUseCase } from '~/application/use-cases/user/register-user.use-case';
import type { UpdateUserUseCase } from '~/application/use-cases/user/update-user.use-case';
import { UserNotFoundError } from '~/domain/errors/user-not-found.error';

/** 現在時刻を JST の日時文字列 (YYYY年MM月DD日 HH:MM) に変換する */
function buildJstDateTimeString(): string {
	const now = new Date();
	const jstOffsetMs = 9 * 60 * 60 * 1000;
	const jst = new Date(now.getTime() + jstOffsetMs);
	const year = jst.getUTCFullYear();
	const month = String(jst.getUTCMonth() + 1).padStart(2, '0');
	const day = String(jst.getUTCDate()).padStart(2, '0');
	const hours = String(jst.getUTCHours()).padStart(2, '0');
	const minutes = String(jst.getUTCMinutes()).padStart(2, '0');
	return `${year}年${month}月${day}日 ${hours}:${minutes}`;
}

/**
 * OpenAI を使った ChatIntegration の具象実装
 *
 * ai-sdk の streamText を使用してテキストおよびツールイベントをストリーミング生成する。
 * システムプロンプトに現在の JST 時刻を埋め込み、各種ツールを提供する。
 */
export class OpenAIChatIntegration implements ChatIntegration {
	private readonly apiKey: string;
	private readonly postalCodeIntegration: PostalCodeIntegration;
	private readonly weatherIntegration: WeatherIntegration;
	private readonly registerUserUseCase: RegisterUserUseCase;
	private readonly getUsersUseCase: GetUsersUseCase;
	private readonly updateUserUseCase: UpdateUserUseCase;
	private readonly deleteUserUseCase: DeleteUserUseCase;
	private readonly embeddingIntegration: EmbeddingIntegration;
	private readonly messageRepository: MessageRepository;

	public constructor(
		apiKey: string,
		postalCodeIntegration: PostalCodeIntegration,
		weatherIntegration: WeatherIntegration,
		registerUserUseCase: RegisterUserUseCase,
		getUsersUseCase: GetUsersUseCase,
		updateUserUseCase: UpdateUserUseCase,
		deleteUserUseCase: DeleteUserUseCase,
		embeddingIntegration: EmbeddingIntegration,
		messageRepository: MessageRepository,
	) {
		this.apiKey = apiKey;
		this.postalCodeIntegration = postalCodeIntegration;
		this.weatherIntegration = weatherIntegration;
		this.registerUserUseCase = registerUserUseCase;
		this.getUsersUseCase = getUsersUseCase;
		this.updateUserUseCase = updateUserUseCase;
		this.deleteUserUseCase = deleteUserUseCase;
		this.embeddingIntegration = embeddingIntegration;
		this.messageRepository = messageRepository;
	}

	public async *streamReply(messages: ChatIntegrationMessage[]): AsyncGenerator<ChatStreamEvent, void, unknown> {
		try {
			const openai = createOpenAI({ apiKey: this.apiKey });

			const postalCodeTool = tool({
				description: '郵便番号から都道府県・市区町村・町域を検索する',
				inputSchema: zodSchema(
					z.object({
						zipCode: z.string().describe('郵便番号 (ハイフンあり・なし両方可。例: 100-0001 または 1000001)'),
					}),
				),
				execute: async (input: { zipCode: string }) => {
					const address = await this.postalCodeIntegration.lookup(input.zipCode);
					if (!address) {
						return '該当する住所が見つかりませんでした';
					}
					return `${address.prefecture}${address.city}${address.town}`;
				},
			});

			const weatherTool = tool({
				description: '住所を渡すとその地点付近の現在の天気と気温を返す',
				inputSchema: zodSchema(
					z.object({
						address: z.string().describe('天気を調べたい住所や地名 (例: 東京都千代田区、大阪城)'),
					}),
				),
				execute: async (input: { address: string }) => {
					const info = await this.weatherIntegration.lookup(input.address);
					if (!info) {
						return '天気情報を取得できませんでした';
					}
					return `${input.address}の現在の天気: ${info.description}、気温: ${info.temperatureCelsius}°C、湿度: ${info.humidity}%`;
				},
			});

			const createUserTool = tool({
				description: 'メールアドレスを指定して新しいユーザーを作成する',
				inputSchema: zodSchema(
					z.object({
						email: z.string().describe('作成するユーザーのメールアドレス'),
					}),
				),
				execute: async (input: { email: string }) => {
					const result = await this.registerUserUseCase.execute({ email: input.email });
					return `ユーザーを作成しました: ID=${result.user.id}、メール=${result.user.email}`;
				},
			});

			const getUsersTool = tool({
				description: '登録されているすべてのユーザーの一覧を取得する',
				inputSchema: zodSchema(z.object({})),
				execute: async () => {
					const result = await this.getUsersUseCase.execute();
					if (result.users.length === 0) {
						return 'ユーザーが登録されていません';
					}
					return result.users.map(u => `ID: ${u.id}、メール: ${u.email}`).join('\n');
				},
			});

			const updateUserTool = tool({
				description: '指定した ID のユーザーのメールアドレスを更新する',
				inputSchema: zodSchema(
					z.object({
						id: z.string().describe('更新するユーザーの ID'),
						email: z.string().describe('新しいメールアドレス'),
					}),
				),
				execute: async (input: { id: string; email: string }) => {
					try {
						const result = await this.updateUserUseCase.execute({ id: input.id, email: input.email });
						return `ユーザーを更新しました: ID=${result.user.id}、メール=${result.user.email}`;
					} catch (error) {
						if (error instanceof UserNotFoundError) {
							return 'ユーザーが見つかりませんでした';
						}
						throw error;
					}
				},
			});

			const deleteUserTool = tool({
				description: '指定した ID のユーザーを削除する',
				inputSchema: zodSchema(
					z.object({
						id: z.string().describe('削除するユーザーの ID'),
					}),
				),
				execute: async (input: { id: string }) => {
					try {
						await this.deleteUserUseCase.execute({ id: input.id });
						return `ユーザー (ID: ${input.id}) を削除しました`;
					} catch (error) {
						if (error instanceof UserNotFoundError) {
							return 'ユーザーが見つかりませんでした';
						}
						throw error;
					}
				},
			});

			const searchSimilarMessagesTool = tool({
				description:
					'過去の会話から意味的に近いメッセージを検索する。ユーザーが以前に話したトピックや、類似した質問・回答を探すときに使用する',
				inputSchema: zodSchema(
					z.object({
						query: z.string().describe('検索したい内容を表すテキスト'),
						limit: z.number().int().min(1).max(10).describe('取得する件数 (1〜10)').default(5),
					}),
				),
				execute: async (input: { query: string; limit: number }) => {
					const embedding = await this.embeddingIntegration.embed(input.query);
					const results = await this.messageRepository.searchSimilar(embedding, input.limit);
					if (results.length === 0) {
						return '類似したメッセージは見つかりませんでした';
					}
					return results
						.map((m, i) => `${i + 1}. [${m.role}] ${m.content} (類似度: ${(m.similarity * 100).toFixed(1)}%)`)
						.join('\n');
				},
			});

			const result = streamText({
				messages: messages.map(m => ({ content: m.content, role: m.role })),
				model: openai('gpt-4o-mini'),
				stopWhen: stepCountIs(5),
				system: `あなたは親切な AI アシスタントです。現在の日本時間は ${buildJstDateTimeString()} (JST) です。`,
				tools: {
					createUser: createUserTool,
					deleteUser: deleteUserTool,
					getUsers: getUsersTool,
					postalCodeLookup: postalCodeTool,
					searchSimilarMessages: searchSimilarMessagesTool,
					updateUser: updateUserTool,
					weather: weatherTool,
				},
			});

			for await (const part of result.fullStream) {
				if (part.type === 'text-delta') {
					yield { type: 'text', text: part.text };
				} else if (part.type === 'tool-call') {
					yield { type: 'tool_call', toolName: part.toolName };
				} else if (part.type === 'tool-result') {
					yield { type: 'tool_result', toolName: part.toolName, result: String(part.output) };
				}
			}
		} catch (error) {
			const message = (() => {
				if (error instanceof Error) {
					return error.message;
				} else {
					return String(error);
				}
			})();
			throw new InfrastructureError(`OpenAI ストリーミング中にエラーが発生しました: ${message}`);
		}
	}
}
