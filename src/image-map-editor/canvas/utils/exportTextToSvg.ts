import TextToSVG from 'text-to-svg';

import {
	exportCorelCompatibleSvg,
	type CorelCompatibleSvgExportOptions,
} from './exportCorelCompatibleSvg';
import { buildWhitespaceSafePathRuns } from './pathTextUtils';

export interface TextToSvgFontSource {
	family: string;
	url: string;
	/** Optional embedded URL used only for local path conversion. */
	loadUrl?: string;
}

export interface TextToSvgExportOptions extends CorelCompatibleSvgExportOptions {
	fontSources: TextToSvgFontSource[];
	/** Fonts used only for characters missing from the selected layer font. */
	fallbackFontSources?: TextToSvgFontSource[];
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const fontCache = new Map<string, Promise<TextToSVG>>();

const normalizeFamily = (value: string) => value
	.split(',')[0]
	.trim()
	.replace(/^['"]|['"]$/g, '')
	.toLowerCase();

const styleValue = (element: Element, property: string) => {
	const value = element.getAttribute(property);
	if (value) return value;
	const declaration = (element.getAttribute('style') || '')
		.split(';')
		.find(item => item.split(':')[0]?.trim().toLowerCase() === property.toLowerCase());
	return declaration?.slice(declaration.indexOf(':') + 1).trim() || '';
};

const numberValue = (element: Element, attribute: string) => {
	const value = Number.parseFloat(element.getAttribute(attribute) || '');
	return Number.isFinite(value) ? value : 0;
};

const getFontGlyph = (textToSvg: TextToSVG, character: string) => {
	const font = (textToSvg as TextToSVG & {
		font?: { charToGlyph?: (value: string) => { index?: number } };
	}).font;
	return font?.charToGlyph?.(character);
};

const hasUsableGlyph = (textToSvg: TextToSVG, character: string) => {
	const glyph = getFontGlyph(textToSvg, character);
	if (!glyph) return true;
	if (/^\s$/u.test(character)) return true;
	if (glyph.index === 0) return false;
	const commands = (glyph as { path?: { commands?: unknown[] } }).path?.commands;
	return !commands || commands.length > 0;
};

const loadFont = (url: string) => {
	const cached = fontCache.get(url);
	if (cached) return cached;
	const promise = new Promise<TextToSVG>((resolve, reject) => {
		TextToSVG.load(url, (error, textToSvg) => {
			if (error || !textToSvg) {
				reject(error || new Error('字体解析失败'));
				return;
			}
			resolve(textToSvg);
		});
	});
	fontCache.set(url, promise);
	promise.catch(() => fontCache.delete(url));
	return promise;
};

const copyPathAttributes = (text: Element, path: Element) => {
	Array.from(text.attributes).forEach(attribute => {
		if (!['x', 'y', 'dx', 'dy', 'font-family', 'font-size', 'font-style', 'font-weight', 'letter-spacing', 'xml:space'].includes(attribute.name)) {
			path.setAttribute(attribute.name, attribute.value);
		}
	});
};

const copyFallbackTextAttributes = (source: Element, target: Element, includeIdentity: boolean) => {
	Array.from(source.attributes).forEach(attribute => {
		if (['x', 'y', 'dx', 'dy'].includes(attribute.name)) return;
		if (!includeIdentity && ['id', 'data-name', 'data-layer-name'].includes(attribute.name)) return;
		target.setAttribute(attribute.name, attribute.value);
	});
	target.setAttribute('xml:space', 'preserve');
};

const replaceTextWithPaths = async (
	document: XMLDocument,
	root: Element,
	fontSources: TextToSvgFontSource[],
	fallbackFontSources: TextToSvgFontSource[],
) => {
	const sourceByFamily = new Map(
		fontSources
			.filter(source => source?.family && String(source.url || '').trim())
			.map(source => [normalizeFamily(source.family), source]),
	);
	const fallbackFonts = new Map<string, TextToSVG>();
	const fallbackFontPromises = new Map<string, Promise<TextToSVG>>();
	const fallbackSources = fallbackFontSources.filter(source => source?.family && String(source.url || '').trim());

	const getFallbackFont = async (character: string) => {
		const cached = fallbackFonts.get(character);
		if (cached) return cached;
		for (const source of fallbackSources) {
			const url = source.loadUrl || source.url;
			let promise = fallbackFontPromises.get(url);
			if (!promise) {
				promise = loadFont(url);
				fallbackFontPromises.set(url, promise);
			}
			try {
				const candidate = await promise;
				if (!hasUsableGlyph(candidate, character)) continue;
				fallbackFonts.set(character, candidate);
				return candidate;
			} catch {
				// A missing optional fallback asset should not prevent other fonts
				// or the normal editable SVG export from working.
			}
		}
		return undefined;
	};

	for (const text of Array.from(root.querySelectorAll('text'))) {
		const source = sourceByFamily.get(normalizeFamily(styleValue(text, 'font-family')));
		const fontSize = Number.parseFloat(styleValue(text, 'font-size'));
		if (!source || !Number.isFinite(fontSize) || fontSize <= 0 || !text.parentElement) continue;

		let textToSvg: TextToSVG;
		try {
			textToSvg = await loadFont(source.loadUrl || source.url);
		} catch (error) {
			console.warn(`[text-to-svg] 字体无法转换为路径：${source.family}`, error);
			continue;
		}

		const spans = Array.from(text.children).filter(child => child.localName === 'tspan');
		const textRuns = spans.length ? spans : [text];
		const paths: Element[] = [];
		let fallbackTextCount = 0;
		for (const run of textRuns) {
			const content = run.textContent || '';
			if (!content) continue;
			const x = numberValue(run, 'x');
			const y = numberValue(run, 'y');
			const contentCharacters = Array.from(content).filter(character => character !== '\uFE0E' && character !== '\uFE0F' && !/\s/u.test(character));
			for (const character of contentCharacters) {
				if (!hasUsableGlyph(textToSvg, character)) await getFallbackFont(character);
			}
			const textPaths = buildWhitespaceSafePathRuns(content, x, y, {
				getAdvanceWidth: value => {
					const characterFont = Array.from(value).length === 1 ? fallbackFonts.get(value) : undefined;
					return (characterFont || textToSvg).getWidth(value, { fontSize, kerning: true });
				},
				getPathData: (value, pathX, pathY) => (Array.from(value).length === 1 ? fallbackFonts.get(value) || textToSvg : textToSvg).getD(value, {
					x: pathX,
					y: pathY,
					fontSize,
					kerning: true,
				}),
				normalizeCharacter: character => {
					return character;
				},
				isolateCharacter: character => fallbackFonts.has(character),
				keepCharacterAsText: character => !hasUsableGlyph(textToSvg, character) && !fallbackFonts.has(character),
			});
			textPaths.forEach(runPath => {
				if (runPath.text !== undefined) {
					const fallbackText = document.createElementNS(SVG_NAMESPACE, 'text');
					copyFallbackTextAttributes(text, fallbackText, fallbackTextCount === 0);
					fallbackText.setAttribute('x', String(runPath.x ?? x));
					fallbackText.setAttribute('y', String(runPath.y ?? y));
					fallbackText.setAttribute('data-symbol-fallback', 'true');
					fallbackText.textContent = runPath.text;
					text.parentElement?.insertBefore(fallbackText, text);
					fallbackTextCount += 1;
					return;
				}
				if (!runPath.d) return;
				const path = document.createElementNS(SVG_NAMESPACE, 'path');
				copyPathAttributes(text, path);
				path.setAttribute('d', runPath.d);
				paths.push(path);
			});
		}
		if (!paths.length && fallbackTextCount === 0) continue;
		paths.forEach(path => text.parentElement?.insertBefore(path, text));
		text.remove();
	}
};

const formatSvg = (svg: string) => {
	const tokens = svg.replace(/>\s*</g, '><').replace(/></g, '>\n<').split('\n');
	let depth = 0;
	return tokens
		.map(token => token.trim())
		.filter(Boolean)
		.map(token => {
			if (/^<\/(?!svg)/.test(token)) depth = Math.max(0, depth - 1);
			const line = `${'  '.repeat(depth)}${token}`;
			if (/^<[^!?/][^>]*>$/.test(token) && !/<\/?[A-Za-z][^>]*>.*<\//.test(token) && !/\/\s*>$/.test(token)) depth += 1;
			return line;
		})
		.join('\n');
};

export const exportTextToSvg = async ({ fontSources, fallbackFontSources = [], ...options }: TextToSvgExportOptions): Promise<string> => {
	const editableSvg = exportCorelCompatibleSvg(options);
	const document = new DOMParser().parseFromString(editableSvg, 'image/svg+xml');
	const root = document.documentElement;
	if (document.querySelector('parsererror') || root.localName !== 'svg') throw new Error('可编辑 SVG XML 无效');

	await replaceTextWithPaths(document, root, fontSources, fallbackFontSources);
	const serialized = new XMLSerializer().serializeToString(root);
	const output = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
		'<!-- Creator: CorelDRAW -->',
		formatSvg(serialized),
	].join('\n');
	const validation = new DOMParser().parseFromString(output, 'image/svg+xml');
	if (validation.querySelector('parsererror') || validation.documentElement.localName !== 'svg') throw new Error('text-to-svg 导出结果 XML 结构无效');
	return output;
};
