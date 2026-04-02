import type { UserRepository } from '~/application/ports/repositories/user/user.repository';
import type { IUserSerializedEntity } from '~/domain/entities/user.entity';
import { UserEntity } from '~/domain/entities/user.entity';
import { UserNotFoundError } from '~/domain/errors/user-not-found.error';

/** ユーザー更新の入力 */
export interface UpdateUserInput {
	readonly id: string;
	readonly email: string;
}

/** ユーザー更新の出力 */
export interface UpdateUserOutput {
	readonly user: IUserSerializedEntity;
}

/**
 * ユーザー更新ユースケース
 *
 * 指定された ID のユーザーのメールアドレスを更新する。
 */
export class UpdateUserUseCase {
	private readonly userRepository: UserRepository;

	public constructor(userRepository: UserRepository) {
		this.userRepository = userRepository;
	}

	/**
	 * ユーザーを更新する
	 *
	 * @param input 更新するユーザーの入力
	 * @returns 更新されたユーザー
	 * @throws {UserNotFoundError} 指定された ID のユーザーが存在しない場合
	 */
	public async execute(input: UpdateUserInput): Promise<UpdateUserOutput> {
		const existing = await this.userRepository.findById(input.id);

		if (!existing) {
			throw new UserNotFoundError(`User with id "${input.id}" not found`);
		}

		const record = await this.userRepository.updateById(input.id, { email: input.email });

		const user = new UserEntity({
			id: record.id,
			email: record.email,
			createdAt: record.createdAt,
			updatedAt: record.updatedAt,
		});

		return { user: user.serialize() };
	}
}
