import type { PrismaClient } from '@prisma/client';
import type {
	ConversationRecord,
	ConversationRepository,
	SaveConversationInput,
} from '~/application/ports/repositories/conversation/conversation.repository';

const CONVERSATION_SELECT = {
	createdAt: true,
	id: true,
	updatedAt: true,
	userId: true,
} as const;

/**
 * Prisma を使った ConversationRepository の具象実装
 */
export class PrismaConversationRepository implements ConversationRepository {
	private readonly prisma: PrismaClient;

	public constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	public async findById(id: string): Promise<ConversationRecord | null> {
		const record = await this.prisma.conversation.findUnique({
			select: CONVERSATION_SELECT,
			where: { id },
		});

		if (!record) {
			return null;
		}

		return record;
	}

	public async findByUserId(userId: string): Promise<ConversationRecord[]> {
		return this.prisma.conversation.findMany({
			orderBy: { createdAt: 'desc' },
			select: CONVERSATION_SELECT,
			where: { userId },
		});
	}

	public async save(input: SaveConversationInput): Promise<ConversationRecord> {
		const record = await this.prisma.conversation.create({
			data: {
				userId: input.userId,
			},
			select: CONVERSATION_SELECT,
		});

		return record;
	}

	public async deleteById(id: string): Promise<void> {
		await this.prisma.conversation.delete({ where: { id } });
	}
}
