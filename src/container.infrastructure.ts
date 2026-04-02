import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { createContainer } from 'katagami';
import type { EmbeddingIntegration } from '~/application/ports/integrations/embedding/embedding.integration';
import type { PostalCodeIntegration } from '~/application/ports/integrations/postal-code/postal-code.integration';
import type { WeatherIntegration } from '~/application/ports/integrations/weather/weather.integration';
import type { ConversationRepository } from '~/application/ports/repositories/conversation/conversation.repository';
import type { MessageRepository } from '~/application/ports/repositories/message/message.repository';
import type { UserRepository } from '~/application/ports/repositories/user/user.repository';
import { GeminiEmbeddingIntegration } from '~/infrastructure/integrations/embedding/gemini.integration';
import { ZipCloudPostalCodeIntegration } from '~/infrastructure/integrations/postal-code/zipcloud.integration';
import { WttrInWeatherIntegration } from '~/infrastructure/integrations/weather/wttrin.integration';
import { PrismaConversationRepository } from '~/infrastructure/repositories/conversation/conversation.repository';
import { PrismaMessageRepository } from '~/infrastructure/repositories/message/message.repository';
import { PrismaUserRepository } from '~/infrastructure/repositories/user/user.repository';

/** Infrastructure 層のトークン型マップ */
export interface InfrastructureService {
	ConversationRepository: ConversationRepository;
	EmbeddingIntegration: EmbeddingIntegration;
	MessageRepository: MessageRepository;
	PostalCodeIntegration: PostalCodeIntegration;
	UserRepository: UserRepository;
	WeatherIntegration: WeatherIntegration;
}

/** DATABASE_URL のプロトコルに応じた PrismaClient を生成し、URL ごとに isolate 内でキャッシュする */
const createPrismaClient: (databaseUrl: string) => PrismaClient = (() => {
	const cache = new Map<string, PrismaClient>();

	return (databaseUrl: string): PrismaClient => {
		const cached = cache.get(databaseUrl);
		if (cached !== undefined) {
			return cached;
		}

		let client: PrismaClient;
		if (databaseUrl.startsWith('prisma://') || databaseUrl.startsWith('prisma+postgres://')) {
			// $extends() の戻り値型は PrismaClient と構造非互換だが、
			// 拡張クライアントは PrismaClient の完全なスーパーセットのため明示的にキャストする
			client = new PrismaClient({ datasourceUrl: databaseUrl }).$extends(withAccelerate()) as unknown as PrismaClient;
		} else {
			client = new PrismaClient({ datasourceUrl: databaseUrl });
		}

		cache.set(databaseUrl, client);
		return client;
	};
})();

/** Infrastructure 層のサービスを登録したコンテナを構築する */
export function buildInfrastructureContainer(env: Env) {
	const prismaClient = createPrismaClient(env.DATABASE_URL);

	return createContainer<InfrastructureService>()
		.registerSingleton('UserRepository', () => new PrismaUserRepository(prismaClient))
		.registerSingleton('ConversationRepository', () => new PrismaConversationRepository(prismaClient))
		.registerSingleton('MessageRepository', () => new PrismaMessageRepository(prismaClient))
		.registerSingleton('PostalCodeIntegration', () => new ZipCloudPostalCodeIntegration())
		.registerSingleton('WeatherIntegration', () => new WttrInWeatherIntegration())
		.registerSingleton('EmbeddingIntegration', () => new GeminiEmbeddingIntegration(env.GOOGLE_AI_STUDIO_API_KEY));
}
