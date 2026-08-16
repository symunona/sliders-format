// New in the Sliders fork.
//
// <sliders-stage> is what the `[scene]` modifier leaves behind in passage
// output. It carries the parsed scene as a percent-encoded JSON attribute --
// percent-encoded rather than raw, because Markdown's smartypants pass would
// otherwise curl the quotes inside it.
//
// The element itself is deliberately thin. It owns playback -- which beat are
// we on, what does a click do -- and nothing else. The stage semantics belong
// to @sliders/scene-core and the drawing to @sliders/render-dom, so that the
// twinejs fork's live preview and this element behave identically.

import {DialogueLayer, DomRenderer} from '@sliders/render-dom';
import {applyScene, diffStages, runBeats} from '@sliders/scene-core';
import {Scene, Stage} from '@sliders/scene-types';
import {go} from '../actions';
import {createLoggers} from '../logger';
import {get, set} from '../state';
import {CustomElement} from '../util/custom-element';
import {assetResolver} from './assets';
import {resolveFrom} from './scene-index';
import './stage-element.css';

const {warn} = createLoggers('scene');

/** Percent-encoded JSON payload the modifier writes and this element reads. */
export interface StagePayload {
	scene: Scene;
	/** Link name -> passage name, so bubble links can navigate. */
	links: Record<string, string>;
	/** Error text, present only when config.testing is on. */
	errors?: string[];
}

/**
 * Seconds a spoken beat holds the screen before the next one runs by itself.
 *
 * A variable rather than a constant so a story can slow it down, speed it up, or set it to 0
 * for the old click-only pacing -- `sliders.autoAdvance: 0` in a vars section.
 */
export const AUTO_ADVANCE_VAR = 'sliders.autoAdvance';

/** What that variable defaults to, in seconds. */
export const DEFAULT_AUTO_ADVANCE = 3;

function autoAdvanceMs() {
	const seconds = get(AUTO_ADVANCE_VAR);

	return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0
		? seconds * 1000
		: 0;
}

export function encodePayload(payload: StagePayload) {
	return encodeURIComponent(JSON.stringify(payload));
}

export function decodePayload(source: string): StagePayload | undefined {
	try {
		return JSON.parse(decodeURIComponent(source));
	} catch (error) {
		warn(`Couldn't read a scene from the page: ${(error as Error).message}`);
		return undefined;
	}
}

export class SlidersStage extends CustomElement {
	#renderer?: DomRenderer;
	#dialogue?: DialogueLayer;
	#states: Stage[] = [];
	#scene?: Scene;
	#links: Record<string, string> = {};
	/** Index into #states. 0 is the stage before any beat has run. */
	#position = 0;
	#timer?: number;
	#advance = (event: Event) => {
		// A click on a link inside a bubble navigates; it must not also advance.
		if ((event.target as HTMLElement | null)?.closest('a')) {
			return;
		}

		void this.play();
	};

	async connectedCallback() {
		const payload = decodePayload(this.getAttribute('scene') ?? '');

		if (!payload) {
			return;
		}

		if (payload.errors?.length) {
			this.renderErrors(payload.errors);
		}

		this.#scene = payload.scene;
		this.#links = payload.links ?? {};

		// `from:` resolves by name against the scene index, never by "the passage
		// the player came from" (spec 02). That is what makes a passage render
		// identically no matter which path reached it.
		const base = resolveFrom(payload.scene.from);
		const enter = applyScene(base, payload.scene);

		this.#states = [enter, ...runBeats(enter, payload.scene.beats ?? [])];
		this.#position = 0;

		this.#renderer = new DomRenderer({guides: Boolean(get('config.testing'))});
		await this.#renderer.mount(this, assetResolver);

		this.#dialogue = new DialogueLayer({
			onLink: (name, target) => {
				const passage = target ?? this.#links[name];

				if (passage) {
					go(passage);
				} else {
					warn(`The link "${name}" has no \`to:\` in this scene's links.`);
				}
			}
		});
		this.#dialogue.mount(this, this.#renderer);

		await this.#renderer.apply(enter, diffStages(base, enter));
		saveStage(enter);

		this.addEventListener('click', this.#advance);
		void this.play();
	}

	disconnectedCallback() {
		this.removeEventListener('click', this.#advance);
		window.clearTimeout(this.#timer);
		this.#dialogue?.destroy();
		this.#renderer?.destroy();
		this.#dialogue = undefined;
		this.#renderer = undefined;
	}

	renderErrors(errors: string[]) {
		const pre = document.createElement('pre');

		pre.className = 'sliders-stage__error';
		pre.textContent = `This scene has problems:\n\n${errors.join('\n')}`;
		this.append(pre);
	}

	/**
	 * Runs the next beat. Beats that show nothing (`mark`, `set`, `fx`) fall
	 * through to the following one, so a click always produces something
	 * visible.
	 */
	async play() {
		window.clearTimeout(this.#timer);

		const beats = this.#scene?.beats ?? [];

		while (this.#position < beats.length) {
			const beat = beats[this.#position];
			const previous = this.#states[this.#position];
			const next = this.#states[this.#position + 1] ?? previous;

			this.#position++;

			if (next !== previous) {
				await this.#renderer?.apply(next, diffStages(previous, next));
				saveStage(next);
			}

			switch (beat.kind) {
				case 'say':
					this.#dialogue?.setBox(null);
					this.#dialogue?.say(beat.who, beat.text);
					this.#hold();
					return;

				case 'box':
					this.#dialogue?.clear();
					this.#dialogue?.setBox(beat.text);
					this.#hold();
					return;

				case 'wait':
					this.setAttribute('data-waiting', 'timer');
					this.#timer = window.setTimeout(
						() => void this.play(),
						beat.seconds * 1000
					);
					return;

				default:
					// mark, set and fx change the stage but say nothing. Keep going.
					break;
			}
		}

		// Out of beats. Whatever is on screen stays; the links under the stage
		// are how the player moves on.
		this.removeAttribute('data-waiting');
	}

	/**
	 * A line is on screen. It holds for `sliders.autoAdvance` seconds and then the next beat
	 * runs on its own; a click gets there sooner. The LAST line never times out -- the scene
	 * is over and the links under the stage are the player's move, so it stays put.
	 */
	#hold() {
		this.setAttribute('data-waiting', 'beat');

		const ms = autoAdvanceMs();

		if (ms > 0 && this.#position < (this.#scene?.beats?.length ?? 0)) {
			this.#timer = window.setTimeout(() => void this.play(), ms);
		}
	}
}

// ---------------------------------------------------------------------------
// Stage snapshots ride along in Chapbook's variable store, which is JSON-only
// by design, so save/load works for free (spec 02, D10). Save granularity is
// the passage: reloading replays the passage's beats from the top.
//
// It is stringified because Chapbook's `isSettable` check rejects arrays of
// objects and would warn about a raw Stage.
// ---------------------------------------------------------------------------

export const STAGE_VAR = 'sliders.stage';

function saveStage(stage: Stage) {
	set(STAGE_VAR, JSON.stringify(stage));
}
