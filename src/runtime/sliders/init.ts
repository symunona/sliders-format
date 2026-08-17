// New in the Sliders fork.

import {setDefaults} from '../state';
import {defineElements} from '../util/custom-element';
import {resetAssets} from './assets';
import {CINEMA_DEFAULTS} from './cinema';
import {initSceneIndex} from './scene-index';
import {
	AUTO_ADVANCE_VAR,
	DEFAULT_AUTO_ADVANCE,
	SlidersStage
} from './stage-element';

/**
 * Initializes Sliders. Must run after the story has been loaded, because the
 * scene index reads every passage.
 */
export function initSliders() {
	setDefaults({
		[AUTO_ADVANCE_VAR]: DEFAULT_AUTO_ADVANCE,
		...CINEMA_DEFAULTS
	});
	resetAssets();
	initSceneIndex();
	defineElements({'sliders-stage': SlidersStage});
}
