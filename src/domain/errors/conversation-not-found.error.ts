import { DomainError } from '~/app-kernel/errors/domain.error';

/**
 * 指定した ID の会話が存在しない場合にスローするエラー
 */
export class ConversationNotFoundError extends DomainError {}
