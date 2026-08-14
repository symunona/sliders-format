import {defineConfig} from 'vitest/config';
// New in the Sliders fork.
import {slidersAliases} from './vite.sliders-alias.js';

export default defineConfig({
	resolve: {alias: slidersAliases()},
	test: {
		coverage: {include: ['src/**'], provider: 'v8'},
		environment: 'jsdom',
		include: ['src/**/*.test.ts'],
		setupFiles: ['src/setup-tests.ts']
	}
});
