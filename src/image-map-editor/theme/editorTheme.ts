export type EditorTheme = 'light' | 'dark';

type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface EditorThemePalette {
	accent: string;
	appBackground: string;
	border: string;
	canvas: string;
	error: string;
	gridDot: string;
	info: string;
	mutedText: string;
	panel: string;
	primary: string;
	primaryText: string;
	secondaryPanel: string;
	selection: string;
	softAccent: string;
	subtleText: string;
	warning: string;
}

export interface EditorCanvasTheme {
	backgroundColor: string;
	dotColor: string;
	rulerBackgroundColor: string;
	rulerLineColor: string;
	rulerTextColor: string;
	selectionColor: string;
}

export const EDITOR_THEME_STORAGE_KEY = 'react-design-editor-theme';

export const editorThemePalettes: Record<EditorTheme, EditorThemePalette> = {
	light: {
		accent: '#2563EB',
		appBackground: '#EEF2F7',
		border: '#D9E0EA',
		canvas: '#EEF2F7',
		error: '#DC2626',
		gridDot: '#CBD5E1',
		info: '#2563EB',
		mutedText: '#64748B',
		panel: '#FFFFFF',
		primary: '#2563EB',
		primaryText: '#172033',
		secondaryPanel: '#F8FAFC',
		selection: 'rgba(37, 99, 235, 0.18)',
		softAccent: '#EAF2FF',
		subtleText: '#94A3B8',
		warning: '#D97706',
	},
	dark: {
		accent: '#5EE0BD',
		appBackground: '#0D1413',
		border: '#34413E',
		canvas: '#1C2128',
		error: '#EF6A5B',
		gridDot: '#5F646B',
		info: '#4E82F1',
		mutedText: '#91A09A',
		panel: '#111918',
		primary: '#32C9A3',
		primaryText: '#EDF4F1',
		secondaryPanel: '#151E1C',
		selection: 'rgba(94, 224, 189, 0.2)',
		softAccent: 'rgba(94, 224, 189, 0.14)',
		subtleText: '#64716C',
		warning: '#F0AC4C',
	},
};

export const getEditorCanvasTheme = (theme: EditorTheme): EditorCanvasTheme => {
	const palette = editorThemePalettes[theme];
	return {
		backgroundColor: palette.canvas,
		dotColor: palette.gridDot,
		rulerBackgroundColor: palette.panel,
		rulerLineColor: palette.border,
		rulerTextColor: palette.mutedText,
		selectionColor: palette.selection,
	};
};

const resolveBrowserStorage = (): ThemeStorage | undefined => {
	try {
		return typeof window === 'undefined' ? undefined : window.localStorage;
	} catch {
		return undefined;
	}
};

const isEditorTheme = (value: string | null): value is EditorTheme =>
	value === 'light' || value === 'dark';

export const readStoredEditorTheme = (storage?: ThemeStorage): EditorTheme => {
	try {
		const storedTheme = (storage || resolveBrowserStorage())?.getItem(EDITOR_THEME_STORAGE_KEY) || null;
		return isEditorTheme(storedTheme) ? storedTheme : 'light';
	} catch {
		return 'light';
	}
};

export const persistEditorTheme = (theme: EditorTheme, storage?: ThemeStorage): void => {
	try {
		(storage || resolveBrowserStorage())?.setItem(EDITOR_THEME_STORAGE_KEY, theme);
	} catch {
		// Theme switching remains available in memory when storage is blocked.
	}
};
