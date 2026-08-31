export interface PathTextMetrics {
	getAdvanceWidth: (text: string) => number;
	getPathData: (text: string, x: number, y: number) => string;
}

export interface TextPathRun {
	d: string;
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
		if (/\s/u.test(character)) {
			flush();
			const width = Number(metrics.getAdvanceWidth(character));
			if (Number.isFinite(width)) cursorX += width;
		} else {
			segment += character;
		}
	}
	flush();
	return runs;
};
