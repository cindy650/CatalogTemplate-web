const IMAGE_MAP_PALETTE_ACCENTS: Record<string, string> = {
	MARKER: '#5ee0bd',
	TEXT: '#8ca9ff',
	IMAGE: '#69b6ff',
	SHAPE: '#ffbd66',
	DRAWING: '#f18fba',
	ELEMENT: '#c292ff',
	SVG: '#7fd6cd',
};

const DEFAULT_PALETTE_ACCENT = '#93a39f';

const IMAGE_MAP_PALETTE_LABELS: Record<string, string> = {
	MARKER: '标记',
	TEXT: '文本',
	IMAGE: '图片',
	SHAPE: '形状',
	DRAWING: '绘图',
	ELEMENT: '元素',
	SVG: 'SVG',
};

export function getImageMapPaletteAccent(category: string) {
	return IMAGE_MAP_PALETTE_ACCENTS[category] || DEFAULT_PALETTE_ACCENT;
}

export function getImageMapPaletteLabel(category: string) {
	return IMAGE_MAP_PALETTE_LABELS[category] || category;
}
