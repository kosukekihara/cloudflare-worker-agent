import { z } from 'zod';
import { InfrastructureError } from '~/app-kernel/errors/infrastructure.error';
import type { WeatherInfo, WeatherIntegration } from '~/application/ports/integrations/weather/weather.integration';

const wttrCurrentConditionSchema = z.object({
	humidity: z.string(),
	temp_C: z.string(),
	weatherDesc: z.array(z.object({ value: z.string() })),
});

const wttrResponseSchema = z.object({
	current_condition: z.array(wttrCurrentConditionSchema),
});

/**
 * wttr.in を使った WeatherIntegration の具象実装
 *
 * https://wttr.in/{address}?format=j1 に GET リクエストを送り、天気情報を取得する。
 * 認証不要の無料 API を使用する。
 */
export class WttrInWeatherIntegration implements WeatherIntegration {
	public async lookup(address: string): Promise<WeatherInfo | null> {
		try {
			const encoded = encodeURIComponent(address);
			const response = await fetch(`https://wttr.in/${encoded}?format=j1`);
			const json: unknown = await response.json();
			const parsed = wttrResponseSchema.parse(json);
			const current = parsed.current_condition[0];
			if (!current) {
				return null;
			}
			return {
				description: current.weatherDesc[0]?.value ?? '',
				humidity: Number(current.humidity),
				temperatureCelsius: Number(current.temp_C),
			};
		} catch (error) {
			const message = (() => {
				if (error instanceof Error) {
					return error.message;
				} else {
					return String(error);
				}
			})();
			throw new InfrastructureError(`wttr.in API エラー: ${message}`);
		}
	}
}
