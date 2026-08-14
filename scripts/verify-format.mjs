// Loads a built format.js exactly the way Twine does -- as JSONP against a
// global `window.storyFormat` -- and asserts the things that must be true for
// Twine to accept it.
//
// Usage: node scripts/verify-format.mjs [path/to/format.js]
//
// New in the Sliders fork.

/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(`${__dirname}/..`);
const pkg = JSON.parse(fs.readFileSync(`${root}/package.json`, 'utf8'));
const target = path.resolve(
	process.argv[2] ?? `${root}/dist/use/${pkg.version}/format.js`
);

let failures = 0;

function check(label, condition, detail) {
	const ok = Boolean(condition);

	console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` -- ${detail}` : ''}`);

	if (!ok) {
		failures++;
	}
}

console.log(`Verifying ${target}\n`);

let format;
const sandbox = {window: {storyFormat: value => (format = value)}};

sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(target, 'utf8'), sandbox, {filename: target});

check('window.storyFormat was called', format !== undefined);

if (!format) {
	process.exit(1);
}

check('name === "Sliders"', format.name === 'Sliders', `got ${format.name}`);
check(
	'version === "0.1.0"',
	format.version === '0.1.0',
	`got ${format.version}`
);
check('author is set', typeof format.author === 'string' && format.author, format.author);
check('proofing === false', format.proofing === false);
check('image === "logo.svg"', format.image === 'logo.svg');
check(
	'logo.svg sits beside format.js',
	fs.existsSync(path.join(path.dirname(target), 'logo.svg'))
);
check(
	'source contains {{STORY_DATA}}',
	typeof format.source === 'string' && format.source.includes('{{STORY_DATA}}')
);
check(
	'source mentions <sliders-stage>',
	typeof format.source === 'string' && format.source.includes('sliders-stage')
);
check('hydrate is a string', typeof format.hydrate === 'string');

// Hydrate exactly the way EXTENDING.md describes: build a function from the
// source and call it with `this` bound to a fresh object.

const hydrated = {};

new Function(format.hydrate).call(hydrated);

const ranges = Object.keys(hydrated.editorExtensions?.twine ?? {});

check(
	'hydrating yields editorExtensions.twine',
	ranges.length > 0,
	`ranges: ${ranges.join(', ')}`
);

const range = ranges[0];
const extensions = hydrated.editorExtensions?.twine?.[range] ?? {};

check(
	`editorExtensions.twine["${range}"].codeMirror.mode is a function`,
	typeof extensions.codeMirror?.mode === 'function'
);
check(
	`editorExtensions.twine["${range}"].codeMirror.toolbar is a function`,
	typeof extensions.codeMirror?.toolbar === 'function'
);
check(
	`editorExtensions.twine["${range}"].references.parsePassageText is a function`,
	typeof extensions.references?.parsePassageText === 'function'
);
check(
	'codeMirror.commands includes insertScene',
	typeof extensions.codeMirror?.commands?.insertScene === 'function'
);

// The mode must actually tokenize. Run it over a scene block and collect the
// token names it produces, then confirm they are all CodeMirror 5 built-ins.

const CM5_TOKENS = new Set([
	'atom',
	'attribute',
	'bracket',
	'builtin',
	'comment',
	'def',
	'error',
	'header',
	'hr',
	'keyword',
	'link',
	'meta',
	'number',
	'operator',
	'property',
	'punctuation',
	'qualifier',
	'quote',
	'string',
	'string-2',
	'tag',
	'text',
	'variable',
	'variable-2',
	'variable-3'
]);

const mode = extensions.codeMirror.mode();

check('mode() returns a startState function', typeof mode.startState === 'function');
check('mode() returns a token function', typeof mode.token === 'function');

const sourceLines = [
	'mood: tense',
	'--',
	'[scene]',
	'id: tavern-night',
	'bg: tavern/night',
	'cast:',
	'  mira: {at: -0.4, frame: arms-crossed}',
	'beats:',
	'  - mira: "You shouldn\'t have come back."',
	'links:',
	'  stay: {to: Tavern Fight}'
];

/** The slice of CodeMirror's StringStream this mode actually uses. */
function makeStream(line, lines, lineIndex) {
	let pos = 0;
	let start = 0;

	return {
		get string() {
			return line;
		},
		get pos() {
			return pos;
		},
		sol: () => pos === 0,
		eol: () => pos >= line.length,
		peek: () => line.charAt(pos) || undefined,
		next: () => (pos < line.length ? line.charAt(pos++) : undefined),
		current: () => line.slice(start, pos),
		skipToEnd() {
			pos = line.length;
		},
		skipTo(char) {
			const found = line.indexOf(char, pos);

			if (found === -1) {
				return false;
			}

			pos = found;
			return true;
		},
		eatSpace() {
			const from = pos;

			while (/\s/.test(line.charAt(pos))) {
				pos++;
			}

			return pos > from;
		},
		eatWhile(test) {
			const from = pos;

			while (pos < line.length && test.test(line.charAt(pos))) {
				pos++;
			}

			return pos > from;
		},
		match(pattern, consume = true) {
			const found = pattern.exec(line.slice(pos));

			if (!found || found.index !== 0) {
				return null;
			}

			if (consume) {
				pos += found[0].length;
			}

			return found;
		},
		lookAhead: n => lines[lineIndex + n],
		startToken() {
			start = pos;
		}
	};
}

const tokens = new Set();
const state = mode.startState();

for (let i = 0; i < sourceLines.length; i++) {
	const stream = makeStream(sourceLines[i], sourceLines, i);
	let guard = 0;

	while (!stream.eol()) {
		const before = stream.pos;

		stream.startToken();

		const token = mode.token(stream, state);

		if (token) {
			tokens.add(token);
		}

		if (stream.pos === before) {
			// A mode that consumes nothing would hang CodeMirror.
			check(`mode consumes input on line ${i + 1}`, false, sourceLines[i]);
			break;
		}

		if (++guard > 500) {
			check(`mode terminates on line ${i + 1}`, false, sourceLines[i]);
			break;
		}
	}
}

check(
	'mode produces tokens over a scene block',
	tokens.size > 0,
	[...tokens].sort().join(', ')
);

const custom = [...tokens].filter(token => !CM5_TOKENS.has(token));

check(
	'mode only emits CodeMirror 5 built-in token names',
	custom.length === 0,
	custom.length ? `custom: ${custom.join(', ')}` : 'none'
);

// The reference parser must find the scene's link target.

const references = extensions.references.parsePassageText(
	sourceLines.join('\n')
);

check(
	'parsePassageText finds the scene link target',
	references.includes('Tavern Fight'),
	JSON.stringify(references)
);
check(
	'parsePassageText returns [] for plain text',
	extensions.references.parsePassageText('Nothing here.').length === 0
);

// The toolbar must offer the scene menu, and its command must insert a scene.
// It base64-encodes its icons through window.btoa, which Twine provides and
// Node does not.

globalThis.window = globalThis.window ?? {btoa};

const toolbar = extensions.codeMirror.toolbar(
	{getDoc: () => ({somethingSelected: () => false})},
	{appTheme: 'light', foregroundColor: '#000', locale: 'en'}
);
const sceneMenu = toolbar.find(item => item.label === 'Scene');

check('toolbar includes a Scene menu', Boolean(sceneMenu));
check(
	'the Scene menu offers insertScene',
	Boolean(sceneMenu?.items?.some(item => item.command === 'insertScene'))
);

let inserted = '';

extensions.codeMirror.commands.insertScene({
	replaceSelection: text => (inserted = text),
	focus: () => undefined
});

check(
	'insertScene inserts a [scene] block',
	inserted.includes('[scene]') && inserted.includes('beats:'),
	JSON.stringify(inserted.split('\n')[1] ?? '')
);

console.log(
	`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`
);
process.exit(failures === 0 ? 0 : 1);
