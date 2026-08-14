import {Mode} from 'codemirror';
// New in the Sliders fork. The key lists come from the parser itself, so the
// editor can never disagree with the runtime about what a scene key is.
import {
	BEAT_COMMAND_KEYS,
	ENTITY_KEYS,
	LINK_KEYS,
	TOP_LEVEL_KEYS
} from '@sliders/scene-schema';

/** A Chapbook modifier line: `[something]` alone on its line, never `[[link]]`. */
const MODIFIER_LINE = /^\s*\[(?!\[)[^\]]*\]\s*$/;

/** The line that opens a scene block. */
const SCENE_LINE = /^\s*\[scene\]\s*$/i;

interface SlidersModeState {
	hasVarsSection?: boolean;
	inVarsSection?: boolean;
	/** New in the Sliders fork: are we inside a `[scene]` block? */
	inScene?: boolean;
	/** Indentation of the line being tokenized, for scene blocks. */
	sceneIndent?: number;
	/** How deep inside `{...}` / `[...]` we are, so flow keys aren't mistaken
	 * for top-level ones. */
	flowDepth?: number;
}

// This mode may only return CodeMirror 5's BUILT-IN token names. Twine styles
// those and adapts them to the user's theme; a custom name would simply be
// unstyled, and EXTENDING.md forbids it. The scene grammar is mapped onto:
//
//   keyword  top-level scene keys, and modifier lines
//   def      entity ids, link names, and nested keys
//   atom     booleans, null, tags like !only, and beat keywords
//   number   coordinates, zoom, wait durations
//   string   dialogue and other quoted scalars
//   link     [[wiki links]]
//   comment  # comments
//   error    a top-level key that is not part of the scene grammar
//
// Returning null means "no styling", which is what structural punctuation
// (`-`, `:`, `{`, `}`) should get.

const ALL_NESTED_KEYS: string[] = [
	...ENTITY_KEYS,
	...LINK_KEYS,
	'x',
	'y',
	'amount'
];
const SCENE_KEYS: string[] = [...TOP_LEVEL_KEYS];
const BEAT_KEYWORDS: string[] = [...BEAT_COMMAND_KEYS, 'say'];

/**
 * Tokenizes one step inside a scene block. Returns a token name, or null for
 * unstyled text.
 */
function tokenizeScene(
	stream: Parameters<NonNullable<Mode<SlidersModeState>['token']>>[0],
	state: SlidersModeState
): string | null {
	if (stream.sol()) {
		state.sceneIndent = /^\s*/.exec(stream.string)?.[0].length ?? 0;
		state.flowDepth = 0;

		// A modifier line ends the scene block. Let the caller handle it.
		if (MODIFIER_LINE.test(stream.string)) {
			state.inScene = false;
			return null;
		}
	}

	if (stream.eatSpace()) {
		return null;
	}

	// Comments run to end of line.

	if (stream.peek() === '#') {
		stream.skipToEnd();
		return 'comment';
	}

	// Wiki links inside dialogue.

	if (stream.match(/^\[\[[^\]]+?\]\]/)) {
		return 'link';
	}

	// Quoted scalars.

	if (stream.match(/^"(?:[^"\\]|\\.)*"/) || stream.match(/^'(?:[^'\\]|\\.)*'/)) {
		return 'string';
	}

	// Tags, e.g. `!only`.

	if (stream.match(/^![a-z]+/i)) {
		return 'atom';
	}

	// Keys. `key:` must be followed by a space or end of line to count.

	const key = stream.match(/^[A-Za-z_][\w. -]*(?=\s*:(\s|$))/) as
		| RegExpMatchArray
		| null;

	if (key) {
		const name = key[0].trim();
		const topLevel =
			(state.sceneIndent ?? 0) === 0 &&
			(state.flowDepth ?? 0) === 0 &&
			!stream.string.trimStart().startsWith('- ');

		if (topLevel) {
			return SCENE_KEYS.includes(name) ? 'keyword' : 'error';
		}

		if (BEAT_KEYWORDS.includes(name)) {
			return 'atom';
		}

		// Nested: either a known key of an entity/link, or an author-chosen id.
		return ALL_NESTED_KEYS.includes(name) ? 'keyword' : 'def';
	}

	// Numbers, including negative and fractional coordinates.

	if (stream.match(/^-?(\d+\.?\d*|\.\d+)\b/)) {
		return 'number';
	}

	// Booleans, null, and the `@mark` half of a `from:` reference.

	if (stream.match(/^(true|false|yes|no|null|~)\b/)) {
		return 'atom';
	}

	if (stream.match(/^@[\w-]+/)) {
		return 'atom';
	}

	// Structural punctuation and list markers get no styling.

	const punctuation = stream.match(/^[-:{}[\],]/) as RegExpMatchArray | null;

	if (punctuation) {
		if (punctuation[0] === '{' || punctuation[0] === '[') {
			state.flowDepth = (state.flowDepth ?? 0) + 1;
		} else if (punctuation[0] === '}' || punctuation[0] === ']') {
			state.flowDepth = Math.max(0, (state.flowDepth ?? 0) - 1);
		}

		return null;
	}

	// Anything else is a bare scalar: asset ids, frame names, passage names.

	if (stream.eatWhile(/[^\s:,{}[\]#]/)) {
		return 'string';
	}

	stream.next();
	return null;
}

export function mode(): Mode<SlidersModeState> {
	return {
		startState() {
			return {inVarsSection: false, inScene: false, flowDepth: 0};
		},
		token(stream, state) {
			if (state.hasVarsSection === undefined) {
				// Scan forward to see if there's any vars section at all.

				for (
					let i = 1, nextLine = stream.lookAhead(1);
					nextLine && state.hasVarsSection === undefined;
					nextLine = stream.lookAhead(++i)
				) {
					if (nextLine === '--') {
						state.hasVarsSection = true;
						state.inVarsSection = true;
					}
				}

				// If we didn't find it already, it doesn't exist.

				if (state.hasVarsSection === undefined) {
					state.hasVarsSection = false;
				}
			}

			if (state.hasVarsSection && state.inVarsSection) {
				// We're in the vars section.

				if (stream.sol()) {
					if (stream.match(/^--$/)) {
						state.inVarsSection = false;
						stream.skipToEnd();
						return 'punctuation';
					} else {
						if (stream.skipTo(':')) {
							stream.next();
							return 'def';
						}

						// The line is malformed.

						stream.skipToEnd();
						return 'text';
					}
				}
			}

			// New in the Sliders fork: scene blocks own everything from the
			// `[scene]` line until the next modifier line.

			if (state.inScene) {
				const token = tokenizeScene(stream, state);

				if (state.inScene || token !== null) {
					return token;
				}

				// Fell out of the block on a modifier line; fall through so it gets
				// highlighted as one.
			}

			// We're in body text.

			// Modifiers are on a line by themselves.

			if (stream.sol() && stream.match(/^\[[^[].*\]$/)) {
				state.inScene = SCENE_LINE.test(stream.current());
				return 'keyword';
			}

			// Are we at an insert?

			if (stream.match(/^\{.+?\}/)) {
				return 'keyword';
			}

			// Are we at a link?

			if (stream.match(/^\[\[[^\]]+?\]\]/)) {
				return 'link';
			}

			// Try scanning forward to an insert or link.

			if (stream.eatWhile(/[^[{]/)) {
				return 'text';
			}

			// If not, the line just holds plain text.

			stream.skipToEnd();
			return 'text';
		}
	};
}
