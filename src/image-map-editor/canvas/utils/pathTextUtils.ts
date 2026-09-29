export interface PathTextMetrics {
	getAdvanceWidth: (text: string) => number;
	getPathData: (text: string, x: number, y: number) => string;
	normalizeCharacter?: (character: string) => string;
	isolateCharacter?: (character: string) => boolean;
	keepCharacterAsText?: (character: string) => boolean;
}

export interface TextPathRun {
	d?: string;
	text?: string;
	x?: number;
	y?: number;
}

/**
 * Convert text runs without asking the font engine to draw whitespace. Some
 * fonts expose a zero-area space glyph; CorelDRAW imports that glyph as a box.
 */
export const buildWhitespaceSafePathRuns = (
	text: string,
	x: number,
	y: number,
	metrics: PathTextMetrics,
): TextPathRun[] => {
	const runs: TextPathRun[] = [];
	let cursorX = x;
	let segment = '';

	const flush = () => {
		if (!segment) return;
		runs.push({ d: metrics.getPathData(segment, cursorX, y) });
		const width = Number(metrics.getAdvanceWidth(segment));
		if (Number.isFinite(width)) cursorX += width;
		segment = '';
	};

	for (const character of Array.from(text)) {
		// Variation selectors are not printable glyphs. Passing them to
		// opentype.js can resolve .notdef and produce a missing symbol/box.
		if (character === '\uFE0E' || character === '\uFE0F') {
			const previous = runs[runs.length - 1];
			if (previous?.text) previous.text += character;
			continue;
		}
		const normalizedCharacter = metrics.normalizeCharacter?.(character) ?? character;
		if (/\s/u.test(normalizedCharacter)) {
			flush();
			const width = Number(metrics.getAdvanceWidth(normalizedCharacter));
			if (Number.isFinite(width)) cursorX += width;
		} else if (metrics.keepCharacterAsText?.(normalizedCharacter)) {
			// If the selected font has no outline for a symbol, preserve the
			// original text node so the SVG viewer can apply its normal fallback
			// font. Converting it with another font changes the visual design.
			flush();
			runs.push({ text: normalizedCharacter, x: cursorX, y });
			const width = Number(metrics.getAdvanceWidth(normalizedCharacter));
			if (Number.isFinite(width)) cursorX += width;
		} else if (metrics.isolateCharacter?.(normalizedCharacter)) {
			// Fallback fonts are selected per character. Flush the primary-font
			// segment before emitting the fallback outline so cursor advances and
			// glyph geometry remain identical to the browser's fallback run.
			flush();
			runs.push({ d: metrics.getPathData(normalizedCharacter, cursorX, y) });
			const width = Number(metrics.getAdvanceWidth(normalizedCharacter));
			if (Number.isFinite(width)) cursorX += width;
		} else {
			segment += normalizedCharacter;
		}
	}
	flush();
	return runs;
};
