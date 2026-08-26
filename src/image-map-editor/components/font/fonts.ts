type FontFamilyType = 'sans-serif' | 'serif' | 'monospace' | 'cursive' | 'fantasy' | 'display' | 'handwriting';

export interface FontDescriptor {
	name: string;
	type: FontFamilyType;
	ref?: 'default' | 'google';
}

const fonts: Record<'default' | 'google', FontDescriptor[]> = {
	default: [
		{ name: 'Arial', type: 'sans-serif', ref: 'default' },
		{ name: 'Arial Black', type: 'sans-serif', ref: 'default' },
		{ name: 'Helvetica', type: 'sans-serif', ref: 'default' },
		{ name: 'Verdana', type: 'sans-serif', ref: 'default' },
		{ name: 'Trebuchet MS', type: 'sans-serif', ref: 'default' },
		{ name: 'Tahoma', type: 'sans-serif', ref: 'default' },
		{ name: 'MS Sans Serif', type: 'sans-serif', ref: 'default' },
		{ name: 'Symbol', type: 'sans-serif', ref: 'default' },
		{ name: 'Times', type: 'serif', ref: 'default' },
		{ name: 'Times New Roman', type: 'serif', ref: 'default' },
		{ name: 'MS Serif', type: 'serif', ref: 'default' },
		{ name: 'New York', type: 'serif', ref: 'default' },
		{ name: 'Palatino Linotype', type: 'serif', ref: 'default' },
		{ name: 'Book Antiqua', type: 'serif', ref: 'default' },
		{ name: 'Georgia', type: 'serif', ref: 'default' },
		{ name: 'Courier New', type: 'monospace', ref: 'default' },
		{ name: 'Courier', type: 'monospace' },
		{ name: 'Comic Sans MS', type: 'cursive', ref: 'default' },
		{ name: 'Lucida Console', type: 'cursive', ref: 'default' },
		{ name: 'Impact', type: 'fantasy', ref: 'default' },
	],
	google: [],
};

export default {
	getFonts() {
		return fonts;
	},
};
