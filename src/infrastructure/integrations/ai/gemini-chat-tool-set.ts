import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import type { EmbeddingIntegration } from '~/application/ports/integrations/embedding/embedding.integration';
import type { PostalCodeIntegration } from '~/application/ports/integrations/postal-code/postal-code.integration';
import type { WeatherIntegration } from '~/application/ports/integrations/weather/weather.integration';
import type { MessageRepository } from '~/application/ports/repositories/message/message.repository';
import type { DeleteUserUseCase } from '~/application/use-cases/user/delete-user.use-case';
import type { GetUsersUseCase } from '~/application/use-cases/user/get-users.use-case';
import type { RegisterUserUseCase } from '~/application/use-cases/user/register-user.use-case';
import type { UpdateUserUseCase } from '~/application/use-cases/user/update-user.use-case';
import { UserNotFoundError } from '~/domain/errors/user-not-found.error';

/** buildGeminiChatToolSet に渡す依存関係 */
export interface GeminiChatToolSetDeps {
	postalCodeIntegration: PostalCodeIntegration;
	weatherIntegration: WeatherIntegration;
	registerUserUseCase: RegisterUserUseCase;
	getUsersUseCase: GetUsersUseCase;
	updateUserUseCase: UpdateUserUseCase;
	deleteUserUseCase: DeleteUserUseCase;
	embeddingIntegration: EmbeddingIntegration;
	messageRepository: MessageRepository;
}

/**
 * Gemini チャット用の共有ツール群 (全エージェント種別で同一)
 */
export function buildGeminiChatToolSet(deps: GeminiChatToolSetDeps) {
	const postalCodeTool = tool({
		description: '郵便番号から都道府県・市区町村・町域を検索する',
		inputSchema: zodSchema(
			z.object({
				zipCode: z.string().describe('郵便番号 (ハイフンあり・なし両方可。例: 100-0001 または 1000001)'),
			}),
		),
		execute: async (input: { zipCode: string }) => {
			const address = await deps.postalCodeIntegration.lookup(input.zipCode);
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
			const info = await deps.weatherIntegration.lookup(input.address);
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
			const result = await deps.registerUserUseCase.execute({ email: input.email });
			return `ユーザーを作成しました: ID=${result.user.id}、メール=${result.user.email}`;
		},
	});

	const getUsersTool = tool({
		description: '登録されているすべてのユーザーの一覧を取得する',
		inputSchema: zodSchema(z.object({})),
		execute: async () => {
			const result = await deps.getUsersUseCase.execute();
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
				const result = await deps.updateUserUseCase.execute({ id: input.id, email: input.email });
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
				await deps.deleteUserUseCase.execute({ id: input.id });
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
			const embedding = await deps.embeddingIntegration.embed(input.query);
			const results = await deps.messageRepository.searchSimilar(embedding, input.limit);
			if (results.length === 0) {
				return '類似したメッセージは見つかりませんでした';
			}
			return results
				.map((m, i) => `${i + 1}. [${m.role}] ${m.content} (類似度: ${(m.similarity * 100).toFixed(1)}%)`)
				.join('\n');
		},
	});

	return {
		createUser: createUserTool,
		deleteUser: deleteUserTool,
		getUsers: getUsersTool,
		postalCodeLookup: postalCodeTool,
		searchSimilarMessages: searchSimilarMessagesTool,
		updateUser: updateUserTool,
		weather: weatherTool,
	};
}

export type GeminiChatTools = ReturnType<typeof buildGeminiChatToolSet>;
