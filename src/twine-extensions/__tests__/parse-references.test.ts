import {describe, expect, it} from 'vitest';
import {parsePassageText} from '../parse-references';

describe('parsePassageText', () => {
	it('finds embedded passages', () =>
		expect(parsePassageText("{embed passage: 'Test'}")).toEqual(['Test']));

	it('finds passage links', () =>
		expect(parsePassageText("{link to: 'Test'}")).toEqual(['Test']));

	it('finds passage links with labels', () =>
		expect(parsePassageText("{link to: 'Test', label: 'Label'}")).toEqual([
			'Test'
		]));

	it('finds reveal links', () =>
		expect(
			parsePassageText("{reveal link: 'Label', passage: 'Test'}")
		).toEqual(['Test']));

	// New in the Sliders fork.

	it('finds targets in a scene links: section', () => {
		const refs = parsePassageText(
			[
				'[scene]',
				'id: tavern-night',
				'beats:',
				'  - mira: "Will you [[stay]] or [[go]]?"',
				'links:',
				'  stay: {to: Tavern Fight}',
				'  go: Street'
			].join('\n')
		);

		expect(refs).toContain('Tavern Fight');
		expect(refs).toContain('Street');
	});

	it('does not return duplicates', () =>
		expect(
			parsePassageText("{link to: 'Test'} {link to: 'Test'}")
		).toEqual(['Test']));

	it('returns an empty array for plain text', () =>
		expect(parsePassageText('Nothing to see here.')).toEqual([]));
});
