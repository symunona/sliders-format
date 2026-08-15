/**
 * The "last scene" handoff.
 *
 * New in the Sliders fork.
 *
 * The Twine editor writes the `[scene]` block an author is editing to
 * localStorage; the toolbar here reads it back, so "Insert Last Scene" can drop
 * that scene into the next passage instead of making the author copy-paste it.
 *
 * localStorage is the only channel the two sides share. Format extensions run
 * inside the editor page, but they are handed a CodeMirror instance and nothing
 * else — they cannot see Twine's stores, the story, or the passage list.
 *
 * BOTH SIDES MUST AGREE on the key and the record shape. The writer lives in
 * twinejs-sliders/src/dialogs/passage-edit/scene-preview/use-last-scene.ts.
 */

/** The last scene edited, whatever it was. What "Insert Last Scene" pastes. */
export const LAST_SCENE_KEY = 'sliders-last-scene';

/**
 * The last scene edited that had an `id:`. Only a named scene can be the target
 * of a `from:` overlay, and the scenes an author writes in between — a pasted
 * copy, a quick anonymous stage — would otherwise erase the overlay's target.
 */
export const LAST_NAMED_SCENE_KEY = 'sliders-last-named-scene';

export interface LastScene {
	/** The scene block body, with the `[scene]` line itself removed. */
	text: string;
	/** The scene's `id:`, when it had one. Needed to write `from:`. */
	id?: string;
	/** Entity ids, so an overlay can name the cast and props it inherits. */
	cast?: string[];
	props?: string[];
	/** Passage the scene was written in. Shown in the menu when there is no id. */
	passageName?: string;
	/** Epoch ms. Unused here, but it makes a stale record obvious in devtools. */
	updated?: number;
}

/** A stored scene, or undefined if there is nothing usable to insert. */
export function readLastScene(
	key: string = LAST_SCENE_KEY
): LastScene | undefined {
	let raw: string | null = null;

	try {
		raw = window.localStorage.getItem(key);
	} catch (error) {
		return undefined; // Storage disabled or blocked. Nothing to insert.
	}

	if (!raw) {
		return undefined;
	}

	try {
		const record = JSON.parse(raw) as LastScene;

		if (!record || typeof record.text !== 'string' || record.text.trim() === '') {
			return undefined;
		}

		return record;
	} catch (error) {
		return undefined; // Someone else's key, or a truncated write.
	}
}

/** The last scene that can be pointed at with `from:`. */
export function readLastNamedScene(): LastScene | undefined {
	const last = readLastScene(LAST_NAMED_SCENE_KEY);

	return last?.id ? last : undefined;
}

/** What to call the stored scene in a menu label. */
export function lastSceneLabel(last: LastScene): string {
	return last.id ?? last.passageName ?? 'unnamed';
}

const SCENE_OPEN = '\n[scene]\n';
const SCENE_CLOSE = '\n\n[continued]\n';

/**
 * Drop the top-level `id:` line. Ids are globally unique, so a verbatim copy of
 * a scene is a guaranteed `dupe-scene-id` error the moment it is pasted.
 */
function withoutId(text: string): string {
	return text
		.split('\n')
		.filter(line => !/^id\s*:/.test(line))
		.join('\n')
		.replace(/^\n+|\n+$/g, '');
}

/** The last scene, verbatim apart from its id. */
export function lastSceneCopy(last: LastScene): string {
	const note = last.id
		? `# Copy of scene '${last.id}'. Give this one an id: if anything will point at it.`
		: '# Copy of the last scene you edited.';

	return `${SCENE_OPEN}${note}\n${withoutId(last.text)}${SCENE_CLOSE}`;
}

/**
 * A patch scene layered on the last one by name — the `from:` idiom from spec 02.
 * Only meaningful when the last scene had an id; the caller checks that.
 */
export function lastSceneOverlay(last: LastScene): string {
	const from = last.id ?? 'scene-id';
	const cast = last.cast ?? [];
	const props = last.props ?? [];
	// Something concrete to patch beats a placeholder the author has to rename.
	const who = cast[0] ?? 'mira';

	const lines = [
		`id: ${from}-next`,
		`from: ${from}   # its EXIT state. Use ${from}@enter, or ${from}@mark-name.`,
		`# A patch, not a snapshot: every key you leave out is INHERITED.`,
		`# \`${who}: ~\` removes an entity. \`cast: !only {...}\` replaces the whole cast.`,
		...(cast.length > 0 ? [`# Inherited cast: ${cast.join(', ')}`] : []),
		...(props.length > 0 ? [`# Inherited props: ${props.join(', ')}`] : []),
		'cast:',
		`  ${who}: {at: -0.4}   # deltas only`,
		'beats:',
		`  - ${who}: "Say something new."`
	];

	return `${SCENE_OPEN}${lines.join('\n')}${SCENE_CLOSE}`;
}
