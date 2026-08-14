import {scanLinkTargets} from '@sliders/scene-schema';

export function parsePassageText(text: string) {
	const matchers = [
    // {embed passage: 'passage name'}
    /\{embed\s+passage\s*:\s*['"](.+?)['"]\s*}/g,

    // {link to: 'passage name', [label: '']}
    /\{link\s+to\s*:\s*['"](.+?)['"][^}]*\}/g,

    // {reveal link: 'label', passage: 'passage name'}
    /\{reveal\s+link.+passage\s*:\s*['"](.+?)['"].*\}/g
  ];

	const results = [];

	for (const matcher of matchers) {
		let match;

		while ((match = matcher.exec(text))) {
			results.push(match[1]);
		}
	}

	// New in the Sliders fork: a scene's `links:` section names passages, and
	// those connections should show on the story map.
	//
	// They are references rather than links because the target is buried in
	// YAML: renaming a passage can't rewrite it, and a half-typed one shouldn't
	// offer to create a passage. Twine's own link parser already draws solid
	// lines for `[[stay -> Tavern Fight]]`; what it cannot see is `[[stay]]`
	// paired with `links: {stay: {to: Tavern Fight}}`, which is exactly the form
	// the spec recommends whenever a link needs props.
	//
	// scanLinkTargets is the same scanner @sliders/scene-schema uses everywhere
	// else, so the editor and the runtime can never disagree about a target.

	for (const target of scanLinkTargets(text).values()) {
		results.push(target);
	}

	// EXTENDING.md asks for no duplicates; Twine tolerates them but is slower.

	return [...new Set(results)].filter(target => target !== '');
}
