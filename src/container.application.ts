import { createContainer } from 'katagami';
import type { ChatIntegration } from '~/application/ports/integrations/chat/chat.integration';
import { CreateAgentUseCase } from '~/application/use-cases/agent/create-agent.use-case';
import { DeleteAgentUseCase } from '~/application/use-cases/agent/delete-agent.use-case';
import { GetAgentUseCase } from '~/application/use-cases/agent/get-agent.use-case';
import { GetAgentsUseCase } from '~/application/use-cases/agent/get-agents.use-case';
import { UpdateAgentUseCase } from '~/application/use-cases/agent/update-agent.use-case';
import { SendChatMessageUseCase } from '~/application/use-cases/conversation/send-chat-message.use-case';
import { StartConversationUseCase } from '~/application/use-cases/conversation/start-conversation.use-case';
import { DeleteUserUseCase } from '~/application/use-cases/user/delete-user.use-case';
import { GetUsersUseCase } from '~/application/use-cases/user/get-users.use-case';
import { RegisterUserUseCase } from '~/application/use-cases/user/register-user.use-case';
import { UpdateUserUseCase } from '~/application/use-cases/user/update-user.use-case';
import type { InfrastructureService } from '~/container.infrastructure';
// import { OpenAIChatIntegration } from '~/infrastructure/integrations/chat/openai.integration';
import { GeminiChatIntegration } from '~/infrastructure/integrations/ai/ai-chat.integration';

/** Application 層のトークン型マップ */
export interface ApplicationService {
	ChatIntegration: ChatIntegration;
	CreateAgentUseCase: CreateAgentUseCase;
	DeleteAgentUseCase: DeleteAgentUseCase;
	DeleteUserUseCase: DeleteUserUseCase;
	GetAgentUseCase: GetAgentUseCase;
	GetAgentsUseCase: GetAgentsUseCase;
	GetUsersUseCase: GetUsersUseCase;
	RegisterUserUseCase: RegisterUserUseCase;
	SendChatMessageUseCase: SendChatMessageUseCase;
	StartConversationUseCase: StartConversationUseCase;
	UpdateAgentUseCase: UpdateAgentUseCase;
	UpdateUserUseCase: UpdateUserUseCase;
}

/** Application 層のサービスを登録したコンテナを構築する */
export function buildApplicationContainer(env: Env) {
	return createContainer<InfrastructureService & ApplicationService>()
		.registerTransient('CreateAgentUseCase', r => new CreateAgentUseCase(r.resolve('AgentRepository')))
		.registerTransient('GetAgentsUseCase', r => new GetAgentsUseCase(r.resolve('AgentRepository')))
		.registerTransient('GetAgentUseCase', r => new GetAgentUseCase(r.resolve('AgentRepository')))
		.registerTransient('UpdateAgentUseCase', r => new UpdateAgentUseCase(r.resolve('AgentRepository')))
		.registerTransient('DeleteAgentUseCase', r => new DeleteAgentUseCase(r.resolve('AgentRepository')))
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
				// new OpenAIChatIntegration(
				// 	env.OPENAI_API_KEY,
				// 	r.resolve('PostalCodeIntegration'),
				// 	r.resolve('WeatherIntegration'),
				// 	r.resolve('RegisterUserUseCase'),
				// 	r.resolve('GetUsersUseCase'),
				// 	r.resolve('UpdateUserUseCase'),
				// 	r.resolve('DeleteUserUseCase'),
				// 	r.resolve('EmbeddingIntegration'),
				// 	r.resolve('MessageRepository'),
				// ),
				new GeminiChatIntegration(
					env.GOOGLE_AI_STUDIO_API_KEY,
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
