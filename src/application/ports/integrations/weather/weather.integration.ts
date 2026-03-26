export interface WeatherInfo {
	readonly temperatureCelsius: number;
	readonly description: string;
	readonly humidity: number;
}

export interface WeatherIntegration {
	lookup(address: string): Promise<WeatherInfo | null>;
}
