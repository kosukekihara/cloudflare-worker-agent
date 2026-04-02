import { createContainer } from 'katagami';
import type { ChatIntegration } from '~/application/ports/integrations/chat/chat.integration';
import { SendChatMessageUseCase } from '~/application/use-cases/conversation/send-chat-message.use-case';
import { StartConversationUseCase } from '~/application/use-cases/conversation/start-conversation.use-case';
import { DeleteUserUseCase } from '~/application/use-cases/user/delete-user.use-case';
import { GetUsersUseCase } from '~/application/use-cases/user/get-users.use-case';
import { RegisterUserUseCase } from '~/application/use-cases/user/register-user.use-case';
import { UpdateUserUseCase } from '~/application/use-cases/user/update-user.use-case';
import type { InfrastructureService } from '~/container.infrastructure';
import { OpenAIChatIntegration } from '~/infrastructure/integrations/chat/openai.integration';

/** Application 層のトークン型マップ */
export interface ApplicationService {
	ChatIntegration: ChatIntegration;
	DeleteUserUseCase: DeleteUserUseCase;
	GetUsersUseCase: GetUsersUseCase;
	RegisterUserUseCase: RegisterUserUseCase;
	SendChatMessageUseCase: SendChatMessageUseCase;
	StartConversationUseCase: StartConversationUseCase;
	UpdateUserUseCase: UpdateUserUseCase;
}

/** Application 層のサービスを登録したコンテナを構築する */
export function buildApplicationContainer(env: Env) {
	return createContainer<InfrastructureService & ApplicationService>()
		.registerTransient('RegisterUserUseCase', r => new RegisterUserUseCase(r.resolve('UserRepository')))
		.registerTransient('GetUsersUseCase', r => new GetUsersUseCase(r.resolve('UserRepository')))
		.registerTransient('UpdateUserUseCase', r => new UpdateUserUseCase(r.resolve('UserRepository')))
		.registerTransient('DeleteUserUseCase', r => new DeleteUserUseCase(r.resolve('UserRepository')))
		.registerTransient(
			'StartConversationUseCase',
			r => new StartConversationUseCase(r.resolve('UserRepository'), r.resolve('ConversationRepository')),
		)
		.registerTransient(
			'SendChatMessageUseCase',
			r =>
				new SendChatMessageUseCase(
					r.resolve('ConversationRepository'),
					r.resolve('MessageRepository'),
					r.resolve('ChatIntegration'),
					r.resolve('EmbeddingIntegration'),
				),
		)
		.registerSingleton(
			'ChatIntegration',
			r =>
				new OpenAIChatIntegration(
					env.OPENAI_API_KEY,
					r.resolve('PostalCodeIntegration'),
					r.resolve('WeatherIntegration'),
					r.resolve('RegisterUserUseCase'),
					r.resolve('GetUsersUseCase'),
					r.resolve('UpdateUserUseCase'),
					r.resolve('DeleteUserUseCase'),
					r.resolve('EmbeddingIntegration'),
					r.resolve('MessageRepository'),
				),
		);
}
