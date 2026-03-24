import type { ConversationRepository } from '~/application/ports/repositories/conversation/conversation.repository';
import type { UserRepository } from '~/application/ports/repositories/user/user.repository';
import type { IConversationSerializedEntity } from '~/domain/entities/conversation.entity';
import { ConversationEntity } from '~/domain/entities/conversation.entity';
import { UserNotFoundError } from '~/domain/errors/user-not-found.error';

export interface StartConversationInput {
	readonly userEmail: string;
}

export interface StartConversationOutput {
	readonly conversation: IConversationSerializedEntity;
}

/**
 * 会話を新規作成するユースケース
 *
 * 指定メールアドレスのユーザーを検索し、そのユーザーの会話を作成する。
 *
 * @throws UserNotFoundError 指定メールアドレスのユーザーが存在しない場合
 */
export class StartConversationUseCase {
	private readonly userRepository: UserRepository;
	private readonly conversationRepository: ConversationRepository;

	public constructor(userRepository: UserRepository, conversationRepository: ConversationRepository) {
		this.userRepository = userRepository;
		this.conversationRepository = conversationRepository;
	}

	public async execute(input: StartConversationInput): Promise<StartConversationOutput> {
		const user = await this.userRepository.findByEmail(input.userEmail);
		if (!user) {
			throw new UserNotFoundError(`User with email "${input.userEmail}" not found`);
		}

		const record = await this.conversationRepository.save({ userId: user.id });
		const conversation = new ConversationEntity(record);

		return { conversation: conversation.serialize() };
	}
}
