import { vi } from 'vitest';
import type { WeatherIntegration } from '~/application/ports/integrations/weather/weather.integration';

export function createMockWeatherIntegration(overrides?: Partial<WeatherIntegration>): WeatherIntegration {
	return {
		lookup: vi.fn().mockResolvedValue(null),
		...overrides,
	};
}
