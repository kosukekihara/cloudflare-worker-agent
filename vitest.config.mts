import { qwikVite } from '@builder.io/qwik/optimizer';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [qwikVite(), tsconfigPaths({ root: '.' })],
	server: { watch: null },
	test: {
		include: ['test/unit/**/*.spec.ts', 'test/unit/**/*.spec.tsx', 'test/integration/**/*.spec.ts'],
		globalSetup: ['./test/coverage-global-setup.ts'],
		setupFiles: ['./test/setup.ts'],
		testTimeout: 15000,
		pool: 'threads',
		fileParallelism: true,
		experimental: { fsModuleCache: true },
		coverage: {
			provider: 'istanbul',
			reportsDirectory: './reports/coverage',
			clean: false,
			reportOnFailure: true,
			include: ['src/**/*.ts', 'src/**/*.tsx'],
			exclude: [
				'src/**/*.d.ts',
				'src/infrastructure/database/prisma/generated/**',
				'src/infrastructure/database/prisma/seed/**',
				'src/entry.*.tsx',
				'src/container*.ts',
				'src/app-kernel/errors/**',
				'src/infrastructure/ui/root.tsx',
				'src/infrastructure/ui/routes/**',
				'src/infrastructure/ui/components/**',
				'src/infrastructure/repositories/**',
			],
			thresholds: {
				statements: 85,
				branches: 85,
				functions: 85,
				lines: 85,
				perFile: true,
			},
		},
	},
});
