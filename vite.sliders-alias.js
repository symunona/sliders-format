// New in the Sliders fork.
//
// The scene parser, the differ, the cross-passage index and the renderer do NOT
// live in this repo. They are workspace packages in the twinejs-sliders repo:
//
//   packages/scene-types   the shared type contract (the seam)
//   packages/scene-schema  scene YAML -> ParseResult, and reference scanning
//   packages/scene-core    Scene -> Stage, beats -> state sequence, Stage diffs
//   packages/scene-index   the cross-passage tier: from: DAG, dupe ids, marks
//   packages/render-dom    draws a Stage, and the DOM dialogue layer
//
// They are kept out of this repo on purpose: the twinejs fork, the visual
// editor and this story format must all use ONE parser, or the three of them
// drift and an author sees three different opinions about their scene.
//
// This module resolves `@sliders/*` to those package sources. Set
// SLIDERS_PACKAGES to override the location.

import {existsSync} from 'fs';
import {resolve} from 'path';

// All entry points (npm scripts, scripts/*.mjs) run from the repo root.
const repoRoot = process.cwd();

const packagesDir =
	process.env.SLIDERS_PACKAGES ??
	resolve(repoRoot, '..', 'twinejs-sliders', 'packages');

const packages = [
	'scene-types',
	'scene-schema',
	'scene-core',
	'scene-index',
	'render-dom'
];

export function slidersAliases() {
	const alias = {};
	const missing = [];

	for (const name of packages) {
		const entry = resolve(packagesDir, name, 'src', 'index.ts');

		if (existsSync(entry)) {
			alias[`@sliders/${name}`] = entry;
		} else {
			missing.push(`@sliders/${name} (looked in ${entry})`);
		}
	}

	if (missing.length > 0) {
		throw new Error(
			'Sliders scene packages are missing:\n  ' +
				missing.join('\n  ') +
				'\n\nSliders is developed alongside the twinejs-sliders repo, which owns ' +
				'the scene parser and renderer. Clone it next to this one, or set ' +
				'SLIDERS_PACKAGES to where its packages/ directory lives.'
		);
	}

	return alias;
}
