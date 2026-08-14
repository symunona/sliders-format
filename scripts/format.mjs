// Builds ONLY format.js (runtime + Twine editor extensions) to
// dist/use/<version>/. This is the fast path -- scripts/website.mjs does this
// too, but also builds typedoc API docs and the honkit guide, which takes
// minutes and is irrelevant when you just want to install the format in Twine.
//
// New in the Sliders fork.

/* eslint-disable no-console */
import fs from 'fs-extra';
import path from 'path';
import {build, loadConfigFromFile} from 'vite';
import {fileURLToPath} from 'url';

process.env.NODE_ENV = 'production';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(`${__dirname}/..`);
const pkg = JSON.parse(
	await fs.readFile(path.resolve(root, 'package.json'), 'utf8')
);
const formatDest = path.resolve(`${root}/dist/use/${pkg.version}`);

const {config: runtimeConfig} = await loadConfigFromFile(
	{},
	'vite.runtime.config.js'
);
const {config: extensionsConfig} = await loadConfigFromFile(
	{},
	'vite.extensions.config.js'
);

const {output: runtimeOutput} = await build(runtimeConfig);
const [extensionsOutput] = await build(extensionsConfig);

const format = {
	source: runtimeOutput[0].source,
	author: pkg.author.replace(/ <.*>/, ''),
	description: pkg.description,
	hydrate: extensionsOutput.output[0].code,
	image: 'logo.svg',
	name: pkg.name,
	proofing: false,
	url: pkg.repository,
	version: pkg.version
};

await fs.mkdirp(formatDest);
await fs.writeFile(
	`${formatDest}/format.js`,
	`window.storyFormat(${JSON.stringify(format)})`,
	'utf8'
);
await fs.copy(`${root}/src/logo.svg`, `${formatDest}/logo.svg`);
await fs.remove(`${root}/build`);
console.log(`Wrote ${formatDest}/format.js (${format.name} ${format.version}).`);
