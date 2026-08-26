import { FabricText } from 'fabric';

type WordSpacingText = FabricText & {
	wordSpacing?: number;
};

type TextPrototype = {
	wordSpacingPatchInstalled?: boolean;
	_getGraphemeBox(this: WordSpacingText, grapheme: string, ...args: unknown[]): {
		width: number;
		kernedWidth: number;
	};
	_renderChars(this: WordSpacingText, ...args: unknown[]): unknown;
};

export function installTextWordSpacingSupport() {
	const prototype = FabricText.prototype as unknown as TextPrototype;
	if (prototype.wordSpacingPatchInstalled) return;

	const getGraphemeBox = prototype._getGraphemeBox;
	prototype._getGraphemeBox = function (grapheme, ...args) {
		const box = getGraphemeBox.call(this, grapheme, ...args);
		const wordSpacing = Number(this.wordSpacing) || 0;
		if (wordSpacing !== 0 && /\s/u.test(grapheme)) {
			const spacingWidth = (this.fontSize * wordSpacing) / 1000;
			box.width += spacingWidth;
			box.kernedWidth += spacingWidth;
		}
		return box;
	};

	const renderChars = prototype._renderChars;
	prototype._renderChars = function (...args) {
		if ((Number(this.wordSpacing) || 0) === 0 || this.charSpacing !== 0) {
			return renderChars.apply(this, args);
		}

		this.charSpacing = Number.EPSILON;
		try {
			return renderChars.apply(this, args);
		} finally {
			this.charSpacing = 0;
		}
	};

	prototype.wordSpacingPatchInstalled = true;
}
