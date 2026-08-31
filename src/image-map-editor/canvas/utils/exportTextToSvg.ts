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

const replaceTextWithPaths = async (
	document: XMLDocument,
	root: Element,
	fontSources: TextToSvgFontSource[],
) => {
	const sourceByFamily = new Map(
		fontSources
			.filter(source => source?.family && String(source.url || '').trim())
			.map(source => [normalizeFamily(source.family), source]),
	);

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
		const paths = textRuns.flatMap(run => {
			const content = run.textContent || '';
			if (!content) return [];
			const x = numberValue(run, 'x');
			const y = numberValue(run, 'y');
			return buildWhitespaceSafePathRuns(content, x, y, {
				getAdvanceWidth: value => textToSvg.getWidth(value, { fontSize, kerning: true }),
				getPathData: (value, pathX, pathY) => textToSvg.getD(value, {
					x: pathX,
					y: pathY,
					fontSize,
					kerning: true,
				}),
			}).map(({ d }) => {
				const path = document.createElementNS(SVG_NAMESPACE, 'path');
				copyPathAttributes(text, path);
				path.setAttribute('d', d);
				return path;
			});
		});
		if (!paths.length) continue;
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

export const exportTextToSvg = async ({ fontSources, ...options }: TextToSvgExportOptions): Promise<string> => {
	const editableSvg = exportCorelCompatibleSvg(options);
	const document = new DOMParser().parseFromString(editableSvg, 'image/svg+xml');
	const root = document.documentElement;
	if (document.querySelector('parsererror') || root.localName !== 'svg') throw new Error('可编辑 SVG XML 无效');

	await replaceTextWithPaths(document, root, fontSources);
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
