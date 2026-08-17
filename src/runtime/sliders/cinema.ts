// New in the Sliders fork.
//
// The player's default format: a scene passage IS the screen. Two halves of the
// same decision, kept together because turning one on without the other looks
// broken.
//
// - `sceneOnlyBlocks` drops everything a passage writes outside its `[scene]`
//   YAML, so director's prose, leftover Chapbook text and stray modifiers never
//   reach the page.
// - the `sliders-cinema` class on <body> makes what is left fill the viewport,
//   the way the editor's preview does in full screen (spec 06, D12).
//
// Both are on by default and both are ordinary variables, so a passage that
// wants Chapbook's page back writes `sliders.sceneOnly: false` or
// `sliders.fullScreen: false` in its vars section.

import {get} from '../state';
import {ContentBlock} from '../template/types';

/**
 * The `[scene]` modifier's pattern. It lives here, not next to the modifier,
 * so that the block filter can recognize a scene block without importing the
 * modifier -- and through it the whole renderer.
 */
export const SCENE_MODIFIER = /^scene$/i;

/** Draw only `[scene]` blocks in a passage that has one? */
export const SCENE_ONLY_VAR = 'sliders.sceneOnly';

/** Let a scene fill the viewport instead of sitting in the page? */
export const FULL_SCREEN_VAR = 'sliders.fullScreen';

export const CINEMA_DEFAULTS = {
	[SCENE_ONLY_VAR]: true,
	[FULL_SCREEN_VAR]: true
};

/**
 * Anything but an explicit `false` counts as on. An author who has never heard
 * of these variables gets the default format.
 */
function on(name: string) {
	return get(name) !== false;
}

export function fullScreenEnabled() {
	return on(FULL_SCREEN_VAR);
}

/**
 * Keeps only the parts of a passage that draw a scene: each run of modifiers
 * containing `[scene]`, plus the text block that run applies to.
 *
 * A run is kept whole rather than reduced to its `[scene]`, so `[if hurt;
 * scene]` still asks its question. A passage with no scene at all is returned
 * untouched -- prose passages are still Chapbook passages.
 */
export function sceneOnlyBlocks(blocks: ContentBlock[]) {
	// Modifiers apply to the one text block that follows them, so a run is
	// "modifiers up to and including the next text block."
	const runs: ContentBlock[][] = [];
	let run: ContentBlock[] = [];

	for (const block of blocks) {
		run.push(block);

		if (block.type === 'text') {
			runs.push(run);
			run = [];
		}
	}

	if (run.length > 0) {
		runs.push(run);
	}

	const scenes = runs.filter(candidate =>
		candidate.some(
			block => block.type === 'modifier' && SCENE_MODIFIER.test(block.content)
		)
	);

	// The variable is only consulted once there is something to hide, so a story
	// with no scenes in it never touches Sliders state at all.
	return scenes.length > 0 && on(SCENE_ONLY_VAR) ? scenes.flat() : blocks;
}

// ---------------------------------------------------------------------------
// The <body> class. Reference counted: a page transition can have the outgoing
// passage's stage still connected while the incoming one arrives, and a plain
// add/remove pair would leave the class off after the crossfade.
// ---------------------------------------------------------------------------

const CINEMA_CLASS = 'sliders-cinema';

let stages = 0;

export function enterCinema() {
	stages++;
	document.body.classList.add(CINEMA_CLASS);
}

export function leaveCinema() {
	stages = Math.max(0, stages - 1);

	if (stages === 0) {
		document.body.classList.remove(CINEMA_CLASS);
	}
}

/** Test seam: forget how many stages are on screen. */
export function resetCinema() {
	stages = 0;
	document.body.classList.remove(CINEMA_CLASS);
}
