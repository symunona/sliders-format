// New in the Sliders fork.
//
// A story format only ever sees one passage at a time -- except at boot, when
// it has the whole story. That is exactly the moment to build the cross-passage
// scene index, which is the only thing that can catch duplicate ids, unknown
// `from:` targets, unknown `@mark`s and `from:` cycles (spec 02, "Runtime
// validation").
//
// This is the net that still fires in STOCK Twine. The twinejs fork will report
// the same errors much more nicely, but a story published from an unmodified
// Twine still gets them here, in the warning list and backstage. That is what
// keeps the "the format works without the fork" rule real.

import {buildSceneIndex, SceneIndex} from '@sliders/scene-index';
import {emptyStage, Stage} from '@sliders/scene-types';
import {createLoggers} from '../logger';
import {passages} from '../story';

const {warn} = createLoggers('scene');

let index: SceneIndex | undefined;

/**
 * Builds the index over every passage in the story and reports what only the
 * whole story can reveal. Errors go through Chapbook's logger, so they land in
 * `<warning-list>` and backstage when `config.testing` is on and stay invisible
 * to players otherwise.
 */
export function initSceneIndex() {
	index = buildSceneIndex(
		passages().map(passage => ({
			name: passage.name ?? '(unnamed passage)',
			text: passage.source
		}))
	);

	for (const error of index.errors) {
		warn(
			`[scene] line ${error.line}: ${error.message}${
				error.hint ? ` ${error.hint}` : ''
			}`
		);
	}
}

/** Forgets the index. Exposed for tests. */
export function resetSceneIndex() {
	index = undefined;
}

/**
 * Resolves a `from:` reference to the stage it names.
 *
 *   `tavern-night`        that scene's exit state
 *   `tavern-night@enter`  its state at beat 0
 *   `tavern-night@tense`  its state at the beat marked `tense`
 *
 * An unresolvable reference yields an empty stage rather than nothing, so a
 * passage always renders something. The index has already reported why.
 */
export function resolveFrom(ref: string | undefined): Stage {
	if (!ref) {
		return emptyStage();
	}

	return index?.resolve(ref) ?? emptyStage();
}
