export interface SvgExportBounds {
	left: number;
	top: number;
	width: number;
	height: number;
}

export interface CorelCompatibleSvgExportOptions {
	rawSvg: string;
	bounds: SvgExportBounds;
	backgroundColor: string;
	layerNames: Map<string, string>;
	fontSources?: Array<{
		family: string;
		url: string;
		weight?: string | number;
		style?: string;
	}>;
	printGuides?: Array<{
		orientation: 'vertical' | 'horizontal';
		position: number;
		kind?: 'bleed' | 'content';
	}>;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const XLinkNamespace = 'http://www.w3.org/1999/xlink';

const compactStyleProperties = new Set([
	'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity',
	'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray',
	'stroke-dashoffset', 'opacity', 'paint-order',
]);

const styleValue = (element: Element, property: string) => {
	const value = element.getAttribute(property);
	if (value) return value;
	const style = element.getAttribute('style') || '';
	const declaration = style
		.split(';')
		.find(item => item.split(':')[0]?.trim().toLowerCase() === property.toLowerCase());
	return declaration?.slice(declaration.indexOf(':') + 1).trim() || '';
};

const removeFabricNoise = (root: Element) => {
	// The workarea image and any previously generated background are editor
	// placeholders. A single physical-size background is added after cleanup.
	Array.from(root.querySelectorAll('[id="workarea"]')).forEach(element => element.remove());
	Array.from(root.querySelectorAll('[id="workarea-background"]')).forEach(element => element.remove());

	Array.from(root.querySelectorAll('image')).forEach(image => {
		const href = image.getAttribute('href') || image.getAttributeNS(XLinkNamespace, 'href') || '';
		if (!href.trim()) image.remove();
	});

	// Fabric's canvas background is emitted as a root-level 100% rectangle.
	// It belongs to the editor viewport, not the workarea, and translating it
	// with the artwork causes a visible background block outside the crop.
	Array.from(root.children)
		.filter(element => element.localName === 'rect')
		.forEach(rect => {
			const width = rect.getAttribute('width')?.trim();
			const height = rect.getAttribute('height')?.trim();
			if (width === '100%' && height === '100%') rect.remove();
		});

	Array.from(root.querySelectorAll('metadata, desc')).forEach(element => element.remove());
	Array.from(root.querySelectorAll('style')).forEach(element => {
		// Fabric's fontPaths serializes complete font files as data URLs. They
		// make CorelDRAW imports very large and are deliberately not exported.
		if (String(element.textContent || '').includes('@font-face')) element.remove();
	});
	Array.from(root.querySelectorAll('defs')).forEach(defs => {
		if (!defs.textContent?.trim() && !defs.children.length) defs.remove();
	});

	Array.from(root.querySelectorAll('*')).forEach(element => {
		['vector-effect', 'rx', 'ry'].forEach(attribute => {
			if (element.getAttribute(attribute) === '0') element.removeAttribute(attribute);
		});
		if (element.getAttribute('style')) {
			const declarations = new Map(
				(element.getAttribute('style') || '')
					.split(';')
					.map(rule => rule.trim())
					.filter(Boolean)
					.map(rule => {
						const separator = rule.indexOf(':');
						return [rule.slice(0, separator).trim(), rule.slice(separator + 1).trim()];
					}),
			);
			if (declarations.get('stroke-opacity') === '0' || declarations.get('stroke') === 'none') {
				['stroke', 'stroke-opacity', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
					'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset'].forEach(property => declarations.delete(property));
			}
			const compactStyle = Array.from(declarations.entries())
				.filter(([property]) => compactStyleProperties.has(property))
				.map(([property, value]) => `${property}:${value}`)
				.join(';');
			if (compactStyle) element.setAttribute('style', compactStyle);
			else element.removeAttribute('style');
		}
		if (!['text', 'tspan'].includes(element.localName)) element.removeAttribute('xml:space');
	});
};

const addBackground = (document: XMLDocument, root: Element, bounds: SvgExportBounds, color: string) => {
	const background = document.createElementNS(SVG_NAMESPACE, 'rect');
	background.setAttribute('id', 'workarea-background');
	background.setAttribute('data-name', '背景填充');
	background.setAttribute('x', '0');
	background.setAttribute('y', '0');
	background.setAttribute('width', String(bounds.width));
	background.setAttribute('height', String(bounds.height));
	background.setAttribute('fill', color || '#ffffff');
	background.setAttribute('stroke', 'none');
	const firstLayer = Array.from(root.children).find(element =>
		element.localName !== 'defs' && element.localName !== 'style' && element.localName !== 'title',
	);
	root.insertBefore(background, firstLayer || null);
};

const addExternalFonts = (
	document: XMLDocument,
	root: Element,
	fontSources: CorelCompatibleSvgExportOptions['fontSources'],
) => {
	const fonts = (fontSources || []).filter(font =>
		font && font.family && font.url && !/^(data:|blob:)/i.test(font.url),
	);
	if (!fonts.length) return;
	const style = document.createElementNS(SVG_NAMESPACE, 'style');
	style.setAttribute('id', 'external-font-resources');
	const cssString = (value: string) => `"${String(value)
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/[\r\n]/g, '')}"`;
	style.textContent = fonts.map(font => {
		const family = cssString(font.family);
		const weight = String(font.weight || 'normal').replace(/[^\w -]/g, '');
		const fontStyle = String(font.style || 'normal').replace(/[^\w -]/g, '');
		return [
			'@font-face {',
			`  font-family: ${family};`,
			`  font-style: ${fontStyle};`,
			`  font-weight: ${weight};`,
			'  font-display: block;',
			`  src: url(${cssString(font.url)});`,
			'}',
		].join('\n');
	}).join('\n');
	const defs = Array.from(root.children).find(element => element.localName === 'defs');
	if (defs) defs.appendChild(style);
	else root.insertBefore(style, root.firstChild);
};

const addLayerNames = (root: Element, layerNames: Map<string, string>) => {
	Array.from(root.querySelectorAll('[id]')).forEach(element => {
		const name = layerNames.get(element.getAttribute('id') || '');
		if (name) {
			element.setAttribute('data-name', name);
			element.removeAttribute('data-layer-name');
		}
	});
};

const translateContentToWorkarea = (root: Element, bounds: SvgExportBounds) => {
	const offset = `translate(${-bounds.left} ${-bounds.top})`;
	Array.from(root.children).forEach(element => {
		if (['defs', 'style', 'title'].includes(element.localName) || element.getAttribute('id') === 'workarea-background') return;
		const transform = element.getAttribute('transform');
		element.setAttribute('transform', `${offset}${transform ? ` ${transform}` : ''}`);
	});
};

const flattenGroups = (root: Element) => {
	const flatten = (group: Element) => {
		Array.from(group.children).forEach(child => {
			if (child.localName === 'g') flatten(child);
		});
		const children = Array.from(group.children);
		if (group.localName !== 'g' || children.length !== 1) return;
		if (Array.from(group.attributes).some(attribute => !['transform', 'id', 'data-name'].includes(attribute.name))) return;
		const child = children[0];
		const groupTransform = group.getAttribute('transform');
		const childTransform = child.getAttribute('transform');
		if (groupTransform) child.setAttribute('transform', `${groupTransform}${childTransform ? ` ${childTransform}` : ''}`);
		['id', 'data-name'].forEach(attribute => {
			if (!child.hasAttribute(attribute) && group.hasAttribute(attribute)) child.setAttribute(attribute, group.getAttribute(attribute) || '');
		});
		group.parentElement?.insertBefore(child, group);
		group.remove();
	};
	Array.from(root.children).forEach(element => { if (element.localName === 'g') flatten(element); });
};

const splitFabricTextLines = (document: XMLDocument, root: Element) => {
	// Fabric groups text lines into tspans. Independent text nodes are easier for
	// CorelDRAW to edit while retaining the original font and positioning attributes.
	Array.from(root.querySelectorAll('text')).forEach(textElement => {
		const tspans = Array.from(textElement.children).filter(child => child.localName === 'tspan');
		if (tspans.length < 2 || !textElement.parentElement) return;

		tspans.forEach(tspan => {
			const glyph = document.createElementNS(SVG_NAMESPACE, 'text');
			Array.from(textElement.attributes).forEach(attribute => {
				if (!['id', 'data-name', 'transform'].includes(attribute.name)) glyph.setAttribute(attribute.name, attribute.value);
			});
			['x', 'y', 'dx', 'dy'].forEach(attribute => {
				const value = tspan.getAttribute(attribute);
				if (value !== null) glyph.setAttribute(attribute, value);
			});
			glyph.textContent = tspan.textContent || '';
			textElement.parentElement?.insertBefore(glyph, textElement);
		});
		textElement.remove();
	});
};

const addPrintGuides = (
	document: XMLDocument,
	root: Element,
	bounds: SvgExportBounds,
	printGuides: CorelCompatibleSvgExportOptions['printGuides'],
) => {
	(printGuides || []).forEach((guide, index) => {
		const line = document.createElementNS(SVG_NAMESPACE, 'line');
		const position = Number.isFinite(guide.position) ? guide.position : 0;
		line.setAttribute('id', `print-guide-${index + 1}`);
		line.setAttribute('data-name', guide.kind === 'content' ? '内容线' : '出血线');
		line.setAttribute('stroke', '#1677ff');
		line.setAttribute('stroke-width', '1');
		line.setAttribute('fill', 'none');
		if (guide.kind !== 'content') line.setAttribute('stroke-dasharray', '6 4');

		if (guide.orientation === 'vertical') {
			line.setAttribute('x1', String(position));
			line.setAttribute('x2', String(position));
			line.setAttribute('y1', '0');
			line.setAttribute('y2', String(bounds.height));
		} else {
			line.setAttribute('x1', '0');
			line.setAttribute('x2', String(bounds.width));
			line.setAttribute('y1', String(position));
			line.setAttribute('y2', String(position));
		}
		root.appendChild(line);
	});
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

export const exportCorelCompatibleSvg = ({
	rawSvg,
	bounds,
	backgroundColor,
	layerNames,
	fontSources = [],
	printGuides = [],
}: CorelCompatibleSvgExportOptions): string => {
	const document = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
	const root = document.documentElement;
	if (document.querySelector('parsererror') || root.localName !== 'svg') throw new Error('Fabric 导出的 SVG XML 无效');

	removeFabricNoise(root);
	addBackground(document, root, bounds, backgroundColor);
	addLayerNames(root, layerNames);
	translateContentToWorkarea(root, bounds);
	splitFabricTextLines(document, root);
	flattenGroups(root);
	addExternalFonts(document, root, fontSources);
	addPrintGuides(document, root, bounds, printGuides);

	root.setAttribute('xmlns', SVG_NAMESPACE);
	root.setAttribute('xmlns:xlink', XLinkNamespace);
	root.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
	root.setAttribute('width', String(bounds.width));
	root.setAttribute('height', String(bounds.height));
	const serialized = new XMLSerializer().serializeToString(root);
	const formatted = formatSvg(serialized);
	const output = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">',
		'<!-- Creator: CorelDRAW -->',
		formatted,
	].join('\n');

	const validation = new DOMParser().parseFromString(output, 'image/svg+xml');
	if (validation.querySelector('parsererror') || validation.documentElement.localName !== 'svg') throw new Error('SVG 导出结果 XML 结构无效');
	return output;
};
