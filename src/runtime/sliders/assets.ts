// New in the Sliders fork.
//
// An AssetResolver backed by hidden passages, so that cast and asset manifests
// survive import/export and keep working in stock Twine (spec 02).
//
//   SlidersCast    JSON: {characters: Character[]} or Character[]
//   SlidersAssets  JSON: {assets: AssetMeta[], urls: {assetId: url}} or AssetMeta[]
//
// When a story carries no manifests at all -- which is every story until the
// twinejs fork's asset manager exists -- this falls back to render-dom's stub
// resolver, so a scene still draws labelled placeholders instead of nothing.
//
// TODO(sliders): once @sliders/asset-store publishes assets into a story, the
// `urls` map here becomes whatever that publish step emits. This reader is the
// runtime half of that contract.

import {AssetMeta, AssetResolver, Character} from '@sliders/scene-types';
import {createStubResolver} from '@sliders/render-dom';
import {createLoggers} from '../logger';
import {passageNamed} from '../story';

const {warn} = createLoggers('scene');

const CAST_PASSAGE = 'SlidersCast';
const ASSETS_PASSAGE = 'SlidersAssets';

interface Manifests {
	characters: Record<string, Character>;
	assets: Record<string, AssetMeta>;
	urls: Record<string, string>;
	/** True when the story carries no manifest passages at all. */
	empty: boolean;
}

let cached: Manifests | undefined;
let stub: AssetResolver | undefined;

function readJson(passageName: string): unknown {
	const passage = passageNamed(passageName);

	if (!passage || passage.source.trim() === '') {
		return undefined;
	}

	try {
		return JSON.parse(passage.source);
	} catch (error) {
		warn(
			`The ${passageName} passage isn't valid JSON, so its manifest was ignored. (${
				(error as Error).message
			})`
		);
		return undefined;
	}
}

function byId<T extends {id: string}>(
	value: unknown,
	key: string
): Record<string, T> {
	const list = Array.isArray(value)
		? value
		: (value as Record<string, unknown>)?.[key];
	const result: Record<string, T> = {};

	if (Array.isArray(list)) {
		for (const item of list) {
			if (item && typeof item.id === 'string') {
				result[item.id] = item as T;
			}
		}
	}

	return result;
}

function manifests(): Manifests {
	if (cached) {
		return cached;
	}

	const castData = readJson(CAST_PASSAGE);
	const assetData = readJson(ASSETS_PASSAGE);
	const urls = (assetData as {urls?: Record<string, string>})?.urls;

	cached = {
		assets: byId<AssetMeta>(assetData, 'assets'),
		characters: byId<Character>(castData, 'characters'),
		empty: castData === undefined && assetData === undefined,
		urls: urls && typeof urls === 'object' ? urls : {}
	};
	return cached;
}

function fallback(): AssetResolver {
	if (!stub) {
		stub = createStubResolver();
	}

	return stub;
}

/** Forgets parsed manifests. Called when the story is (re)loaded. */
export function resetAssets() {
	cached = undefined;
}

export const assetResolver: AssetResolver = {
	async url(id) {
		const found = manifests().urls[id];

		return found ?? (manifests().empty ? fallback().url(id) : undefined);
	},
	async meta(id) {
		const found = manifests().assets[id];

		return found ?? (manifests().empty ? fallback().meta(id) : undefined);
	},
	async character(id) {
		const found = manifests().characters[id];

		return found ?? (manifests().empty ? fallback().character(id) : undefined);
	}
};
