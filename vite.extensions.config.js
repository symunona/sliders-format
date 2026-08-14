import {defineConfig} from 'vite';
// New in the Sliders fork.
import {slidersAliases} from './vite.sliders-alias.js';

export default defineConfig(async () => ({
	resolve: {alias: slidersAliases()},
	build: {
		emptyOutDir: true,
		lib: {
			entry: 'index.ts',
			formats: ['iife'],
			name: 'chapbook' // Not actually used in output, it appears.
		},
		minify: true,
		outDir: '../../build/',
		rollupOptions: {
			// We use ___format as a placeholder for the `this` that the IIFE we
			// bundle will be bound to. See src/twine-extensions/index.ts for where
			// this is done.
			external: ['___format'],
			output: {
				globals: {
					___format: 'this'
				}
			}
		}
	},
	root: './src/twine-extensions',
	server: {
		open: true
	}
}));
