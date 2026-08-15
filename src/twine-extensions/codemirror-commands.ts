import {Editor} from 'codemirror';
// New in the Sliders fork.
import {
  lastSceneCopy,
  lastSceneOverlay,
  readLastNamedScene,
  readLastScene
} from './last-scene';

function makeInsertTextCommands(commands: Record<string, string>) {
	return Object.keys(commands).reduce(
		(result, commandName) => ({
			...result,
			[commandName]: (editor: Editor) => {
				editor.replaceSelection(commands[commandName]);
				editor.focus();
			}
		}),
		{}
	);
}

function makeWrapTextCommands(
	commands: Record<string, {matcher: RegExp; wrapper: (text: string) => string}>
) {
	return Object.keys(commands).reduce(
		(result, commandName) => ({
			...result,
			[commandName]: (editor: Editor) => {
				const {matcher, wrapper} = commands[commandName];

				editor.replaceSelections(
					editor
						.getSelections()
						.map(selection =>
							matcher.test(selection)
								? selection.replace(matcher, '$1')
								: wrapper(selection)
						),
					'around'
				);
				editor.focus();
			}
		}),
		{}
	);
}

// ---------------------------------------------------------------------------
// New in the Sliders fork: `[scene]` skeletons.
//
// The main skeleton is deliberately exhaustive — every top-level key, every
// entity key, every beat form, every link prop — because the fastest way to
// learn the format is to insert it once and delete what you do not need. YAML
// is indentation-sensitive, so these are written out literally rather than
// assembled, and every line uses two-space indents.
//
// Two rules this skeleton obeys and must keep obeying:
//   - it parses with zero errors (asserted in __tests__/codemirror-commands)
//   - it contains no literal `[[...]]`, because Twine's own link parser reads
//     the passage source and would silently create a passage for each one —
//     even from inside a YAML comment.
// ---------------------------------------------------------------------------

export const SCENE_SKELETON = `
[scene]
# Every key Sliders understands. Delete the ones you do not need.
id: scene-id                    # globally unique; needed only if something points here
from: ~                         # inherit: other-scene, other-scene@enter, other-scene@mark-name
bg: backdrop-id                 # asset id, never a path
camera: {at: [0, 0], zoom: 1}   # origin is screen centre, +y is UP

cast:
  mira:  {at: -0.4, frame: idle}
  joren: {at: 0.35, frame: idle, flip: true, layer: back, z: 2, opacity: 1}

props:
  candle: {at: [0.1, -0.2], layer: front}
  table:  {at: 0, ref: table-asset}   # ref: when the id is not the asset id

fx: [rain@0.6]                  # name@amount, or {id: rain, amount: 0.6}

beats:
  - mira: "Dialogue. The bubble hangs off her anchor."
  - joren: {at: 0.3, frame: idle, say: "Move and speak in one beat."}
  - mira: {at: -0.25}           # stage change, nobody speaks
  - box: "Narration, with no speaker."
  - wait: 0.5                   # seconds
  - fx: thunder
  - mark: tense                 # names this state so from: can target it
  # A choice is a wiki link in dialogue: the link name, an arrow, and the target
  # passage, wrapped in doubled square brackets. Props for it go under links:.

links:
  onward: {to: Next Passage, if: has_weapon, icon: sword, transition: fade}
  back:   Other Passage         # shorthand when the target is all you need

[continued]
`;

const SCENE_BEATS = `
beats:
  - mira: "Dialogue."
  - mira: {frame: angry, at: -0.25, say: "Dialogue and a stage change."}
  - box: "Narration, with no speaker."
  - wait: 0.5
  - mark: name-this-state
`;

const SCENE_CAST = `
cast:
  mira: {at: -0.4, frame: idle}
props:
  candle: {at: [0.1, -0.2], layer: front}
`;

const SCENE_LINKS = `
links:
  stay: {to: Passage Name}
  go:   {to: Other Passage, if: some_variable}
`;

// New in the Sliders fork: the two scene commands whose text is not known until
// the moment they run, because it comes from whatever the author last edited.

const lastSceneCommands = {
  insertLastScene: (editor: Editor) => {
    const last = readLastScene();

    // The toolbar disables this when there is nothing stored; the fallback is
    // only here so a keyboard-bound command can never insert nothing.
    editor.replaceSelection(last ? lastSceneCopy(last) : SCENE_SKELETON);
    editor.focus();
  },
  insertLastSceneOverlay: (editor: Editor) => {
    const last = readLastNamedScene();

    editor.replaceSelection(last ? lastSceneOverlay(last) : SCENE_SKELETON);
    editor.focus();
  }
};

export const commands = {
  ...lastSceneCommands,
  ...makeWrapTextCommands({
    boldText: {
      matcher: /^(?:__|\*\*)(.+)(?:__|\*\*)$/,
      wrapper: (text: string) => `**${text}**`
    },
    italicText: {
      matcher: /^(?:_|\*)(.+)(?:_|\*)$/,
      wrapper: (text: string) => `*${text}*`
    },
    monospacedText: {
      matcher: /^`(.+)`$/,
      wrapper: (text: string) => '`' + text + '`'
    },
    smallCapsText: {
      matcher: /^~~(.+)~~$/,
      wrapper: (text: string) => `~~${text}~~`
    }
  }),
  ...makeInsertTextCommands({
    // New in the Sliders fork.
    insertScene: SCENE_SKELETON,
    insertSceneBeats: SCENE_BEATS,
    insertSceneCast: SCENE_CAST,
    insertSceneLinks: SCENE_LINKS,
    insertAfter: '\n[after 1 second]\nText\n\n[continued]',
    insertAppend: '\n[append]\n',
    insertBlockquote: '\n<blockquote>Text</blockquote>\n',
    insertContinue: '\n[continue]\n',
    insertBulletedList: '\n- Item\n- Item\n',
    insertCss: '\n[CSS]\n.page article {\n  color: green;\n}\n\n[continued]\n',
    insertCyclingLink:
      "{cycling link for: 'variable name', choices: ['choice', 'choice']}",
    insertDropdownMenu:
      "{dropdown menu for: 'variable name', choices: ['choice', 'choice']}",
    insertEmbedAmbientSound: "{ambient sound: 'sound name'}",
    insertEmbedSoundEffect: "{sound effect: 'sound name'}",
    insertEmbedPassage: "{embed passage: 'Passage name'}",
    insertEmbedYouTubeVideo: "{embed YouTube video: 'URL'}",
    insertImageFlickr: "{embed Flickr image: 'Flickr embed code'}",
    insertImageUrl: "{embed image: 'URL to image'}",
    insertImageUnsplash: '{embed Unsplash image: }',
    insertForkList: '\n> Link\n> Link\n',
    insertIf: '\n[if condition]\nText\n\n[continue]\n',
    insertIfElse: '\n[if condition]\nText\n\n[else]Text\n\n[continued]\n',
    insertJs:
      "\n[JavaScript]\nwrite('Hello from JavaScript');\n\n[continued]\n",
    insertNote: '\n[note]\nNote to self\n\n[continued]\n',
    insertNumberedList: '\n1. Item\n2. Item\n',
    insertPassageLink: "{link to: 'Passage name', label: 'Label text'}",
    insertRestartLink: "{restart link, label: 'Label text'}",
    insertRevealPassageLink:
      "{reveal link: 'Label text', passage: 'Passage name'}",
    insertRevealTextLink: "{reveal link: 'Label text', text: 'Displayed text'}",
    insertSectionBreak: '\n***\n',
    insertTextInput: "{text input for: 'variable name'}",
    insertUnless: '\n[unless condition]\nText\n\n[continued]\n'
  })
};
