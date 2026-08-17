// New in the Sliders fork. The player's default format: a scene passage is the
// whole screen, and nothing written around the YAML is drawn.

import {beforeEach, describe, expect, it} from 'vitest';
import {render} from '../../template';
import {set} from '../../state';
import {initSliders} from '..';
import {
	FULL_SCREEN_VAR,
	SCENE_ONLY_VAR,
	resetCinema,
	sceneOnlyBlocks
} from '../cinema';

const sceneSource = [
	'[scene]',
	'id: tavern-night',
	'cast:',
	'  mira: {at: -0.4}',
	'beats:',
	'  - mira: "You shouldn\'t have come back."',
	'links:',
	'  go: {to: Street}'
].join('\n');

beforeEach(() => {
	document.body.innerHTML = '';
	resetCinema();
	initSliders();
	set(SCENE_ONLY_VAR, true);
	set(FULL_SCREEN_VAR, true);
});

describe('sceneOnlyBlocks()', () => {
	const scene = {type: 'modifier', content: 'scene'} as const;
	const yaml = {type: 'text', content: 'id: a'} as const;
	const prose = {type: 'text', content: 'Once upon a time.'} as const;

	it('drops text that is not attached to a scene', () => {
		expect(sceneOnlyBlocks([prose, scene, yaml, prose])).toEqual([scene, yaml]);
	});

	it('keeps the rest of the modifier run a scene is part of', () => {
		const condition = {type: 'modifier', content: 'if hurt'} as const;

		expect(sceneOnlyBlocks([condition, scene, yaml, prose])).toEqual([
			condition,
			scene,
			yaml
		]);
	});

	it('keeps every scene in a passage that has several', () => {
		const second = {type: 'text', content: 'id: b'} as const;

		expect(sceneOnlyBlocks([scene, yaml, prose, scene, second])).toEqual([
			scene,
			yaml,
			scene,
			second
		]);
	});

	it('leaves a passage with no scene in it alone', () => {
		const note = {type: 'modifier', content: 'note'} as const;

		expect(sceneOnlyBlocks([prose, note, prose])).toEqual([prose, note, prose]);
	});

	it('draws everything when sliders.sceneOnly is false', () => {
		set(SCENE_ONLY_VAR, false);
		expect(sceneOnlyBlocks([prose, scene, yaml])).toEqual([prose, scene, yaml]);
	});
});

describe('rendering a scene passage', () => {
	it('renders the stage and none of the prose around it', () => {
		const html = render(
			`Director: she should feel cornered.\n\n${sceneSource}\n\n[continued]\nNormal Chapbook text.`
		);

		expect(html).toContain('<sliders-stage');
		expect(html).not.toContain('cornered');
		expect(html).not.toContain('Normal Chapbook text');
		// The scene's own links still ride under the stage.
		expect(html).toContain('Street');
	});

	it('keeps the vars section working', () => {
		render(`mood: 'tense'\n--\n${sceneSource}`);
		expect(render('{mood}', true)).toContain('tense');
	});
});

describe('full screen', () => {
	async function play(source: string) {
		document.body.innerHTML = render(source);

		// connectedCallback is async: it mounts a renderer and resolves assets.
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	it('puts the page in full screen while a stage is on it', async () => {
		await play(sceneSource);
		expect(document.body.classList.contains('sliders-cinema')).toBe(true);
	});

	it('leaves full screen when the stage goes away', async () => {
		await play(sceneSource);
		document.body.innerHTML = '';
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(document.body.classList.contains('sliders-cinema')).toBe(false);
	});

	it('stays in the page when sliders.fullScreen is false', async () => {
		set(FULL_SCREEN_VAR, false);
		await play(sceneSource);
		expect(document.body.classList.contains('sliders-cinema')).toBe(false);
		expect(document.querySelector('sliders-stage')).not.toBeNull();
	});
});
