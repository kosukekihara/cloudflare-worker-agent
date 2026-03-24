import type { PrismaClient } from '@prisma/client';
import type {
	MessageRecord,
	MessageRepository,
	SaveMessageInput,
} from '~/application/ports/repositories/message/message.repository';
import type { MessageRole } from '~/domain/entities/message.entity';

// embedding は Unsupported("vector(3072)") 型のため select から除外する
const MESSAGE_SELECT = {
	content: true,
	conversationId: true,
	createdAt: true,
	id: true,
	role: true,
} as const;

/**
 * Prisma を使った MessageRepository の具象実装
 */
export class PrismaMessageRepository implements MessageRepository {
	private readonly prisma: PrismaClient;

	public constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	public async findByConversationId(conversationId: string): Promise<MessageRecord[]> {
		const records = await this.prisma.message.findMany({
			orderBy: { createdAt: 'asc' },
			select: MESSAGE_SELECT,
			where: { conversationId },
		});

		return records.map(record => ({
			...record,
			// Prisma の MessageRole enum を Domain の MessageRole 文字列リテラル型に変換する
			role: record.role as MessageRole,
		}));
	}

	public async save(input: SaveMessageInput): Promise<MessageRecord> {
		const record = await this.prisma.message.create({
			data: {
				content: input.content,
				conversationId: input.conversationId,
				role: input.role,
			},
			select: MESSAGE_SELECT,
		});

		return {
			...record,
			// Prisma の MessageRole enum を Domain の MessageRole 文字列リテラル型に変換する
			role: record.role as MessageRole,
		};
	}
}
