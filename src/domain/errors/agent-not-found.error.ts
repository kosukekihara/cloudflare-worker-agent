import { DomainError } from '~/app-kernel/errors/domain.error';

/**
 * エージェントが見つからない場合のドメインエラー
 */
export class AgentNotFoundError extends DomainError {}
