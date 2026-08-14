// New in the Sliders fork. This is THE addition -- everything else in this
// directory is Chapbook's.

import {parseScene} from '@sliders/scene-schema';
import {SceneError} from '@sliders/scene-types';
import {createLoggers} from '../../logger';
import {encodePayload} from '../../sliders/stage-element';
import {get} from '../../state';
import {Modifier} from './types';

const {warn} = createLoggers('scene');

function describe(error: SceneError) {
	return `[scene] line ${error.line}: ${error.message}${
		error.hint ? ` ${error.hint}` : ''
	}`;
}

/**
 * Renders a declarative scene: a stage of backdrops, characters, props and
 * dialogue beats, written as YAML.
 *
 * ```
 * [scene]
 * id: tavern-night
 * bg: tavern/night
 * cast:
 *   mira: {at: -0.4, frame: arms-crossed}
 * beats:
 *   - mira: "You shouldn't have come back."
 * links:
 *   stay: {to: Tavern Fight}
 * ```
 *
 * This uses `processRaw` so that it sees the author's YAML exactly as written,
 * before inserts, links and Markdown have been applied to it -- indentation and
 * quoting in a YAML block would not survive that pass.
 *
 * Parse problems never throw. They go to `console.warn` through Chapbook's
 * logger, which means they appear in `<warning-list>` and backstage when
 * `config.testing` is on, and are invisible to players otherwise. A scene with
 * errors still renders whatever could be understood -- the parser always
 * returns a scene.
 */
export const sceneModifier: Modifier = {
	match: /^scene$/i,
	processRaw(output, {state}) {
		const {scene, errors} = parseScene(output.text);
		const messages = errors.map(describe);

		for (const message of messages) {
			warn(message);
		}

		// Number scenes within a passage so that a passage with several blocks
		// produces distinguishable elements.
		const index = typeof state.count === 'number' ? state.count : 0;

		state.count = index + 1;

		// Links are shipped into the element so that a `[[stay]]` inside bubble
		// text can navigate, and are ALSO emitted below as ordinary Chapbook wiki
		// links so that a player who never clicks the stage can still move on --
		// and so keyboard focus and screen readers work with no extra code.
		//
		// TODO(sliders): `if:` currently only understands a bare variable name.
		// Full expression support needs Chapbook's expression evaluator.
		const links = Object.values(scene.links ?? {}).filter(
			link => !link.if || Boolean(get(link.if))
		);

		const payload = encodePayload({
			scene,
			// Only ship error text into the page when the author is testing.
			errors: get('config.testing') ? messages : undefined,
			links: Object.fromEntries(links.map(link => [link.name, link.to]))
		});

		// The raw YAML is replaced entirely -- authors never see their scene
		// source in the output.
		let text = `<sliders-stage data-index="${index}" scene="${payload}"></sliders-stage>`;

		if (links.length > 0) {
			// A fork list, so this gets Chapbook's existing link styling.
			text +=
				'\n\n' +
				links.map(link => `> [[${link.name}->${link.to}]]`).join('\n') +
				'\n';
		}

		output.text = text;
		output.startsNewParagraph = true;
	}
};
