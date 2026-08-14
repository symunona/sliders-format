// New in the Sliders fork.

import {defineElements} from '../util/custom-element';
import {resetAssets} from './assets';
import {initSceneIndex} from './scene-index';
import {SlidersStage} from './stage-element';

/**
 * Initializes Sliders. Must run after the story has been loaded, because the
 * scene index reads every passage.
 */
export function initSliders() {
	resetAssets();
	initSceneIndex();
	defineElements({'sliders-stage': SlidersStage});
}
