import type { PrismaClient } from '@prisma/client';
import type {
	AgentRecord,
	AgentRepository,
	SaveAgentInput,
	UpdateAgentInput,
} from '~/application/ports/repositories/agent/agent.repository';

const AGENT_SELECT = {
	createdAt: true,
	enabledTools: true,
	id: true,
	instruction: true,
	modelId: true,
	name: true,
	updatedAt: true,
} as const;

/**
 * Prisma を使った AgentRepository の具象実装
 */
export class PrismaAgentRepository implements AgentRepository {
	private readonly prisma: PrismaClient;

	public constructor(prisma: PrismaClient) {
		this.prisma = prisma;
	}

	public async findById(id: string): Promise<AgentRecord | null> {
		const record = await this.prisma.agent.findUnique({
			select: AGENT_SELECT,
			where: { id },
		});

		if (!record) {
			return null;
		}

		return record;
	}

	public async findAll(): Promise<AgentRecord[]> {
		return this.prisma.agent.findMany({
			select: AGENT_SELECT,
			orderBy: { createdAt: 'desc' },
		});
	}

	public async save(input: SaveAgentInput): Promise<AgentRecord> {
		return this.prisma.agent.create({
			data: {
				enabledTools: input.enabledTools,
				instruction: input.instruction,
				modelId: input.modelId,
				name: input.name,
			},
			select: AGENT_SELECT,
		});
	}

	public async updateById(id: string, data: UpdateAgentInput): Promise<AgentRecord> {
		const prismaData: {
			enabledTools?: string[];
			instruction?: string;
			modelId?: string;
			name?: string;
		} = {};

		if (data.name !== undefined) {
			prismaData.name = data.name;
		}
		if (data.modelId !== undefined) {
			prismaData.modelId = data.modelId;
		}
		if (data.instruction !== undefined) {
			prismaData.instruction = data.instruction;
		}
		if (data.enabledTools !== undefined) {
			prismaData.enabledTools = data.enabledTools;
		}

		return this.prisma.agent.update({
			data: prismaData,
			select: AGENT_SELECT,
			where: { id },
		});
	}

	public async deleteById(id: string): Promise<void> {
		await this.prisma.agent.delete({ where: { id } });
	}
}
