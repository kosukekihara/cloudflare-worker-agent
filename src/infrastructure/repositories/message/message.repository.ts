import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type {
	MessageRecord,
	MessageRepository,
	SaveMessageInput,
	SimilarMessageRecord,
} from '~/application/ports/repositories/message/message.repository';
import type { MessageRole } from '~/domain/entities/message.entity';

const similarMessageRowSchema = z.object({
	id: z.string(),
	conversation_id: z.string(),
	role: z.string(),
	content: z.string(),
	created_at: z.date(),
	similarity: z.number(),
});
const similarMessageRowsSchema = z.array(similarMessageRowSchema);

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

	public async updateEmbedding(id: string, embedding: number[]): Promise<void> {
		// Unsupported("vector(3072)") 型は Prisma ORM では扱えないため raw SQL で更新する
		const vector = `[${embedding.join(',')}]`;
		await this.prisma.$executeRaw`UPDATE messages SET embedding = ${vector}::vector WHERE id = ${id}`;
	}

	public async searchSimilar(embedding: number[], limit: number): Promise<SimilarMessageRecord[]> {
		// Unsupported("vector(3072)") 型は Prisma ORM では扱えないため raw SQL で検索する
		const vector = `[${embedding.join(',')}]`;
		const rows: unknown = await this.prisma.$queryRaw`
			SELECT
				id,
				conversation_id,
				role,
				content,
				created_at,
				1 - (embedding <=> ${vector}::vector) AS similarity
			FROM messages
			WHERE embedding IS NOT NULL
			ORDER BY embedding <=> ${vector}::vector
			LIMIT ${limit}
		`;

		const parsed = similarMessageRowsSchema.parse(rows);
		return parsed.map(row => ({
			id: row.id,
			conversationId: row.conversation_id,
			role: row.role as MessageRole,
			content: row.content,
			createdAt: row.created_at,
			similarity: row.similarity,
		}));
	}
}
