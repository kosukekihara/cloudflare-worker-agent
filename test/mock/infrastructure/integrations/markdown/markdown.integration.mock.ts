import { vi } from 'vitest';
import type { MarkdownIntegration } from '~/application/ports/integrations/markdown/markdown.integration';

export function createMockMarkdownIntegration(overrides: Partial<MarkdownIntegration> = {}): MarkdownIntegration {
	const mock: MarkdownIntegration = {
		render: vi.fn().mockReturnValue('<p>mock html</p>'),
	};
	return Object.assign(mock, overrides);
}
