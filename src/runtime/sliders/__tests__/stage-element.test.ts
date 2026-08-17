// New in the Sliders fork. The one test that proves the whole path: author
// YAML -> modifier -> <sliders-stage> -> renderer -> a played beat.

import {beforeEach, describe, expect, it} from 'vitest';
import {sceneModifier} from '../../template/modifiers/scene';
import {ModifierOutput} from '../../template/modifiers/types';
import {set} from '../../state';
import {initSliders} from '..';
import {AUTO_ADVANCE_VAR} from '../stage-element';

const source = [
	'id: tavern-night',
	'bg: tavern/night',
	'cast:',
	'  mira: {at: -0.4, frame: idle}',
	'beats:',
	'  - mira: "You shouldn\'t have come back."',
	'links:',
	'  go: {to: Street}'
].join('\n');

async function renderScene(text = source) {
	const output: ModifierOutput = {startsNewParagraph: true, text};

	sceneModifier.processRaw?.(output, {invocation: 'scene', state: {}});
	document.body.innerHTML = output.text;

	// connectedCallback is async: it mounts a renderer and resolves assets.
	await new Promise(resolve => setTimeout(resolve, 100));

	return document.querySelector('sliders-stage') as HTMLElement;
}

const twoLines = [
	'id: two-lines',
	'cast:',
	'  mira: {at: -0.4}',
	'beats:',
	'  - mira: "First."',
	'  - mira: "Second."'
].join('\n');

function bubbleText(stage: HTMLElement) {
	return stage.querySelector('.sliders-bubble')?.textContent ?? '';
}

describe('<sliders-stage>', () => {
	beforeEach(() => {
		initSliders();
		document.body.innerHTML = '';
	});

	it('mounts a rendered stage from modifier output', async () => {
		const stage = await renderScene();

		expect(stage).not.toBeNull();
		expect(stage.querySelectorAll('*').length).toBeGreaterThan(3);
	});

	it('plays the first beat and waits for a click', async () => {
		const stage = await renderScene();

		expect(stage.getAttribute('data-waiting')).toBe('beat');
	});

	it('stops waiting once the beats run out', async () => {
		const stage = await renderScene('id: still\nbg: tavern/night');

		expect(stage.hasAttribute('data-waiting')).toBe(false);
	});

	it('runs the next beat on its own once the line has held', async () => {
		// Long enough that it cannot have fired during the mount above.
		set(AUTO_ADVANCE_VAR, 0.25);

		const stage = await renderScene(twoLines);

		expect(bubbleText(stage)).toContain('First');

		await new Promise(resolve => setTimeout(resolve, 400));

		expect(bubbleText(stage)).toContain('Second');
	});

	it('waits for a click instead when auto advance is off', async () => {
		set(AUTO_ADVANCE_VAR, 0);

		const stage = await renderScene(twoLines);

		await new Promise(resolve => setTimeout(resolve, 200));

		expect(bubbleText(stage)).toContain('First');
		expect(stage.getAttribute('data-waiting')).toBe('beat');
	});

	it('tears down cleanly when removed', async () => {
		const stage = await renderScene();

		expect(() => stage.remove()).not.toThrow();
	});
});
