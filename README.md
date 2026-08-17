# Sliders, a story format for Twine 2

**Sliders is a fork of [Chapbook] by [Chris Klimas], the creator of Twine.**
Everything good about the writing experience below is his work; Sliders adds one
thing on top of it. Chapbook is MIT-licensed, and so is this fork. Please go
read [the Chapbook guide] — it is still the documentation for ~all of Sliders.

## What Sliders adds

Exactly one thing: a `[scene]` modifier that turns a block of YAML into a
rendered visual-novel stage.

```
mood: tense
seen_mira: true
--
[scene]
id: tavern-night
bg: tavern/night
cast:
  mira:  {at: -0.4, frame: arms-crossed}
  joren: {at: 0.35, frame: idle, flip: true}
beats:
  - mira: "You shouldn't have come back."
  - joren: "And yet."
  - mira: {frame: angry, at: -0.25, say: "Get out."}
links:
  stay: {to: Tavern Fight}
  go:   {to: Street}

[note]
Director's note. Chapbook already hides this. Free.
```

The design rule is **declarative snapshot, not commands**: a scene block states
the complete stage, and the engine diffs it against the previous stage to derive
transitions. Paste a block anywhere and you get an identical stage.

## How a scene is played

A passage with a `[scene]` in it **is** the scene. Two things follow from that,
and both are the default:

- The stage fills the viewport. The page Chapbook draws around prose — the
  centred column, the header, the footer — gets out of the way, and the scene's
  `links:` ride along the bottom of the screen.
- Nothing written outside the YAML is drawn. Prose, `[note]`, `[continued]` and
  any other modifier around the scene are ignored, so a scene passage can carry
  director's notes without them reaching the player. The vars section still
  runs: it sets state, it doesn't write to the page.

Because of the second one, **every way out of a scene passage has to be in its
`links:`** — a `[[link]]` written under the block is not drawn.

Either half can be turned off, per passage or per story, in the vars section:

```
sliders.sceneOnly: false     # draw the text around the scene as well
sliders.fullScreen: false    # keep the stage in a 16:9 box inside the page
```

Everything else — the vars section, Markdown, inserts, `[if]`, `[after]`,
`[note]`, ambient sound, backstage, save/load — is Chapbook's, unchanged, and a
passage with no scene in it is an ordinary Chapbook passage. Sliders is Chapbook
**plus** scenes, never Chapbook minus anything.

See `docs/sliders/` in the twinejs-sliders repository for the full spec.

## Installing

Run `npm install` to install most dependencies.

## Development

`npm start` starts a dev server with the runtime engine and the demo Twee
source files under `demo`.

`npm run start:extensions` starts a dev server with a test harness for Twine
editor extensions, e.g. the CodeMirror syntax mode and reference parser.

`npm run start:website` starts a dev server version of the web site,
including compiled format and examples.

## Testing and Linting

`npm test` runs unit tests.

`npm run e2e` and `npm run e2e:extensions` runs end-to-end tests using
Playwright. The `e2e:extensions` task tests Twine editor extensions.

`npm run lint` lints source code for problems.

## Building

**`npm run build:format` builds just `format.js`** to `dist/use/<version>/`.
This is what you want almost all of the time — it takes seconds, and it is what
gets installed into Twine.

`npm run build` builds the whole web site (API docs, guide, examples) plus the
format. It needs typedoc and honkit, and is much slower.

`npm run verify` loads a built `format.js` the way Twine does — as JSONP against
a global `window.storyFormat` — and asserts that the metadata, the `{{STORY_DATA}}`
placeholder, and every hydrated editor extension are actually there, including
that the CodeMirror mode emits only built-in token names. Run it after every
build.

Both builds use the version set in `package.json`; files under `homepage/` need
manual updates.

To publish to GitHub, `./push-to-github.sh <repo-url>` adds the URL as `origin`
and pushes the `sliders` branch.

## Directory Structure

`demo/` contains Twee files used both for development work and for end-to-end
tests. Adding a `.twee` file here will cause it to be incorporated into the
story used for both.

`guide/` contains source files for the guide (inherited from Chapbook).

`homepage/` contains source files for the format home page.

`previous-versions/` contains all previous compiled versions of Chapbook.
These are updated manually.

`scripts/` contains Node scripts used for build processes.

`src/runtime/` contains all code related to the format when bound to a story.

- `backstage/` handles the backstage panel that authors see when
  testing a story.
- `display/` handles display of passage content onscreen. It mostly
  reacts to changes to the `trail` state variable.
- `logger/` is a logging system which allows certain types of logging to be
  enabled or disabled during play. The `log()` function here is available to
  stories as `engine.log()`.
- **`sliders/` is new in this fork.** It holds the bridge to the Sliders scene
  packages and the `<sliders-stage>` custom element that draws a scene.
- `sound/` handles ambient sound and sound effects.
- `state/` handles story state. Functions here are available to stories as the
  `engine.state` object.
- `style/` handles parsing user styles.
- `template/` handles parsing passage source and transforming it to HTML to be
  displayed. Functions here are available to stories as the `engine.template`
  object. **`template/modifiers/scene.ts` is new in this fork.**
- `util/` contains assorted utility functions.

`src/twine-extensions/` contains code related to Twine editor extensions. The
CodeMirror mode, the reference parser and the toolbar all gained scene-aware
behavior in this fork.

## Where the scene logic actually lives

The parser, the differ, the cross-passage index and the renderer are **not** in
this repository. They are workspace packages in the twinejs-sliders repo:

| Package | Job |
| --- | --- |
| `@sliders/scene-types` | the shared type contract. The seam. |
| `@sliders/scene-schema` | scene YAML -> `ParseResult`, plus reference scanning |
| `@sliders/scene-core` | `Scene` -> `Stage`, beats -> state sequence, `Stage` diffs |
| `@sliders/scene-index` | the cross-passage tier: `from:` DAG, duplicate ids, marks |
| `@sliders/render-dom` | draws a `Stage`, and the DOM dialogue layer |

They live there on purpose. The twinejs fork, the visual editor and this story
format must all use **one** parser, or an author gets three different opinions
about their scene.

`vite.sliders-alias.js` resolves `@sliders/*` to those package sources at build
time, and `tsconfig.json` mirrors it so tsc agrees with the bundler. Clone
twinejs-sliders next to this repo, or set `SLIDERS_PACKAGES` to wherever its
`packages/` directory is. If they're missing the build fails with a message
saying so, rather than silently producing a format that can't render a scene.

What this repo owns, and all it owns:

- `src/runtime/template/modifiers/scene.ts` -- the `[scene]` modifier
- `src/runtime/sliders/` -- the `<sliders-stage>` element, the hidden-passage
  asset resolver, boot-time scene index validation, and `cinema.ts`, which is
  how a scene passage becomes the whole screen
- `src/twine-extensions/` -- the CM5 mode, reference parser and toolbar

## Credit

Sliders exists because Chapbook got almost everything right: front matter plus
Markdown, JSON-only state, a real modifier/insert extension system, and the only
Twine format with all four editor extension hooks. Thank you, [Chris Klimas].

[chapbook]: https://github.com/klembot/chapbook
[the chapbook guide]: https://klembot.github.io/chapbook/guide/
[chris klimas]: https://github.com/klembot
