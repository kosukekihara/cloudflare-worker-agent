import type { PrismaClient } from '@prisma/client';
import type { SaveUserInput, UserRecord, UserRepository } from '~/application/ports/repositories/user/user.repository';

const USER_SELECT = {
	createdAt: true,
	email: true,
	id: true,
	updatedAt: true,
} as const;

/**
 * Prisma を使った UserRepository の具象実装
 */
export class PrismaUserRepository implements UserRepository {
	private readonly prisma: PrismaClient;

	public constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	public async findById(id: string): Promise<UserRecord | null> {
		const record = await this.prisma.user.findUnique({
			select: USER_SELECT,
			where: { id },
		});

		if (!record) {
			return null;
		}

		return record;
	}

	public async save(input: SaveUserInput): Promise<UserRecord> {
		const record = await this.prisma.user.create({
			data: {
				email: input.email,
			},
			select: USER_SELECT,
		});

		return record;
	}

	public async findByEmail(email: string): Promise<UserRecord | null> {
		const record = await this.prisma.user.findFirst({
			select: USER_SELECT,
			where: { email },
		});

		if (!record) {
			return null;
		}

		return record;
	}

	public async findAll(): Promise<UserRecord[]> {
		return this.prisma.user.findMany({
			select: USER_SELECT,
			orderBy: { createdAt: 'desc' },
		});
	}

	public async updateById(id: string, data: { email: string }): Promise<UserRecord> {
		return this.prisma.user.update({
			data: { email: data.email },
			select: USER_SELECT,
			where: { id },
		});
	}

	public async deleteById(id: string): Promise<void> {
		await this.prisma.user.delete({ where: { id } });
	}
}
