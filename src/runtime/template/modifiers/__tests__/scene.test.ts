// New in the Sliders fork.

import {describe, expect, it, vi} from 'vitest';
import {decodePayload} from '../../../sliders/stage-element';
import {ModifierOutput} from '../types';
import {sceneModifier} from '../scene';

const source = `id: tavern-night
bg: tavern/night
cast:
  mira: {at: -0.4, frame: arms-crossed}
beats:
  - mira: "You shouldn't have come back."
links:
  stay: {to: Tavern Fight}
  go: {to: Street}`;

function run(text: string) {
	const output: ModifierOutput = {startsNewParagraph: true, text};

	sceneModifier.processRaw?.(output, {invocation: 'scene', state: {}});
	return output;
}

function payloadOf(html: string) {
	const encoded = /scene="([^"]*)"/.exec(html)?.[1];

	return encoded === undefined ? undefined : decodePayload(encoded);
}

describe('Scene modifier', () => {
	describe('its invocation', () => {
		it('matches "scene"', () =>
			expect(sceneModifier.match.test('scene')).toBe(true));
		it('matches "Scene"', () =>
			expect(sceneModifier.match.test('Scene')).toBe(true));
		it('does not match "scenery"', () =>
			expect(sceneModifier.match.test('scenery')).toBe(false));
	});

	it('runs before inserts, links and Markdown', () =>
		// Anything else would destroy the YAML's indentation and quoting.
		expect(sceneModifier.processRaw).toBeDefined());

	it('replaces the raw YAML with a stage element', () => {
		const output = run(source);

		expect(output.text).toMatch(/^<sliders-stage /);

		// The YAML is gone as YAML: no indentation, no unescaped keys. It
		// survives only inside the percent-encoded attribute.
		expect(output.text).not.toContain('\n  mira');
		expect(output.text).not.toContain('beats:');
		expect(output.text).not.toContain('bg: tavern/night');
	});

	it('carries the parsed scene in the element', () => {
		const payload = payloadOf(run(source).text);

		expect(payload?.scene.id).toBe('tavern-night');
		expect(payload?.scene.bg).toBe('tavern/night');
		expect(payload?.scene.beats).toHaveLength(1);
		expect(payload?.links).toEqual({
			stay: 'Tavern Fight',
			go: 'Street'
		});
	});

	it('encodes the payload so Markdown can not mangle it', () => {
		const html = run(source).text;

		// Curly quotes from smartypants, or a stray `"`, would break the
		// attribute. Percent-encoding leaves neither in the output.
		expect(html).not.toContain('&quot;');
		expect(/scene="[^"]*"/.test(html)).toBe(true);
	});

	it('emits scene links as Chapbook wiki links', () => {
		const output = run(source);

		expect(output.text).toContain('> [[stay->Tavern Fight]]');
		expect(output.text).toContain('> [[go->Street]]');
	});

	it('warns rather than throwing when the scene is broken', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		expect(() => run('cast:\n  mira: {layer: sideways}')).not.toThrow();
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('still renders a stage when the scene is broken', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const output = run('id: broken\nbgg: typo');

		expect(output.text).toMatch(/^<sliders-stage /);
		expect(payloadOf(output.text)?.scene.id).toBe('broken');
		warn.mockRestore();
	});

	it('numbers scenes within a passage', () => {
		const state = {};
		const first: ModifierOutput = {startsNewParagraph: true, text: 'id: a'};
		const second: ModifierOutput = {startsNewParagraph: true, text: 'id: b'};

		sceneModifier.processRaw?.(first, {invocation: 'scene', state});
		sceneModifier.processRaw?.(second, {invocation: 'scene', state});
		expect(first.text).toContain('data-index="0"');
		expect(second.text).toContain('data-index="1"');
	});
});
