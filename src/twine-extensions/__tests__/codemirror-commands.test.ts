// New in the Sliders fork.
import {beforeEach, describe, expect, it} from 'vitest';
import {extractSceneBlock} from '@sliders/scene-index';
import {parseScene, TOP_LEVEL_KEYS} from '@sliders/scene-schema';
import {commands, SCENE_SKELETON} from '../codemirror-commands';
import {LAST_NAMED_SCENE_KEY, LAST_SCENE_KEY} from '../last-scene';

function parseSkeleton(text: string) {
	const block = extractSceneBlock(text);

	if (!block) {
		throw new Error('No [scene] block in the inserted text.');
	}

	return parseScene(block.text);
}

/** A CodeMirror stand-in that records what a command inserted. */
function fakeEditor() {
	const inserted: string[] = [];

	return {
		inserted,
		editor: {
			focus: () => undefined,
			replaceSelection: (text: string) => inserted.push(text)
		} as never
	};
}

describe('the scene skeleton', () => {
	it('parses with no errors', () =>
		expect(parseSkeleton(SCENE_SKELETON).errors).toEqual([]));

	it('demonstrates every top-level key', () => {
		for (const key of TOP_LEVEL_KEYS) {
			expect(SCENE_SKELETON).toMatch(new RegExp(`^${key}:`, 'm'));
		}
	});

	it('demonstrates every beat form', () => {
		const {scene} = parseSkeleton(SCENE_SKELETON);
		const kinds = new Set(scene.beats.map(beat => beat.kind));

		expect([...kinds].sort()).toEqual([
			'box',
			'fx',
			'mark',
			'say',
			'set',
			'wait'
		]);
	});

	it('declares cast, props, fx, camera and links', () => {
		const {scene} = parseSkeleton(SCENE_SKELETON);
		const kinds = Object.values(scene.entities).map(entity => entity?.kind);

		expect(kinds).toContain('cast');
		expect(kinds).toContain('prop');
		expect(scene.fx).toHaveLength(1);
		expect(scene.camera).toEqual({at: {x: 0, y: 0}, zoom: 1});
		expect(Object.keys(scene.links).sort()).toEqual(['back', 'onward']);
	});

	// Twine's own link parser reads the passage source, so a `[[...]]` anywhere
	// in the skeleton — even inside a YAML comment — silently creates a passage.
	it('contains no literal wiki links', () =>
		expect(SCENE_SKELETON).not.toContain('[['));
});

describe('insertLastScene', () => {
	beforeEach(() => window.localStorage.clear());

	it('falls back to the skeleton when nothing is stored', () => {
		const {editor, inserted} = fakeEditor();

		commands.insertLastScene(editor);
		expect(inserted).toEqual([SCENE_SKELETON]);
	});

	it('inserts the stored scene without its id', () => {
		window.localStorage.setItem(
			LAST_SCENE_KEY,
			JSON.stringify({
				cast: ['mira'],
				id: 'tavern-night',
				text: 'id: tavern-night\nbg: tavern/night\ncast:\n  mira: {at: -0.4}'
			})
		);

		const {editor, inserted} = fakeEditor();

		commands.insertLastScene(editor);
		expect(inserted[0]).toContain('bg: tavern/night');
		expect(inserted[0]).not.toMatch(/^id: tavern-night$/m);
		expect(parseSkeleton(inserted[0]).errors).toEqual([]);
	});
});

describe('insertLastSceneOverlay', () => {
	beforeEach(() => window.localStorage.clear());

	it('writes a patch that points at the last named scene', () => {
		window.localStorage.setItem(
			LAST_NAMED_SCENE_KEY,
			JSON.stringify({
				cast: ['mira', 'joren'],
				id: 'tavern-night',
				text: 'id: tavern-night\ncast:\n  mira: {at: -0.4}'
			})
		);
		// An id-less scene edited since — a pasted copy, say — must not take the
		// overlay's target away.
		window.localStorage.setItem(
			LAST_SCENE_KEY,
			JSON.stringify({text: 'bg: street-dusk'})
		);

		const {editor, inserted} = fakeEditor();

		commands.insertLastSceneOverlay(editor);

		const {errors, scene} = parseSkeleton(inserted[0]);

		expect(errors).toEqual([]);
		expect(scene.from).toBe('tavern-night');
		expect(scene.id).toBe('tavern-night-next');
		expect(Object.keys(scene.entities)).toEqual(['mira']);
	});

	it('falls back to the skeleton when no scene has been named', () => {
		window.localStorage.setItem(
			LAST_SCENE_KEY,
			JSON.stringify({text: 'bg: tavern/night'})
		);

		const {editor, inserted} = fakeEditor();

		commands.insertLastSceneOverlay(editor);
		expect(inserted).toEqual([SCENE_SKELETON]);
	});
});
