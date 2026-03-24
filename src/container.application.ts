import { createContainer } from 'katagami';
import { SendChatMessageUseCase } from '~/application/use-cases/conversation/send-chat-message.use-case';
import { StartConversationUseCase } from '~/application/use-cases/conversation/start-conversation.use-case';
import { DeleteUserUseCase } from '~/application/use-cases/user/delete-user.use-case';
import { GetUsersUseCase } from '~/application/use-cases/user/get-users.use-case';
import { RegisterUserUseCase } from '~/application/use-cases/user/register-user.use-case';
import type { InfrastructureService } from '~/container.infrastructure';

/** Application 層のトークン型マップ */
export interface ApplicationService {
	DeleteUserUseCase: DeleteUserUseCase;
	GetUsersUseCase: GetUsersUseCase;
	RegisterUserUseCase: RegisterUserUseCase;
	SendChatMessageUseCase: SendChatMessageUseCase;
	StartConversationUseCase: StartConversationUseCase;
}

/** Application 層のサービスを登録したコンテナを構築する */
export function buildApplicationContainer() {
	return createContainer<InfrastructureService & ApplicationService>()
		.registerTransient('RegisterUserUseCase', r => new RegisterUserUseCase(r.resolve('UserRepository')))
		.registerTransient('GetUsersUseCase', r => new GetUsersUseCase(r.resolve('UserRepository')))
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
				),
		);
}
