import { ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd';
import React from 'react';
import {
	editorThemePalettes,
	persistEditorTheme,
	readStoredEditorTheme,
	type EditorTheme,
} from './editorTheme';

export interface EditorThemeContextValue {
	setTheme: (theme: EditorTheme) => void;
	theme: EditorTheme;
}

interface EditorThemeProviderProps {
	children: React.ReactNode;
	initialTheme?: EditorTheme;
}

export const EditorThemeContext = React.createContext<EditorThemeContextValue>({
	setTheme: () => undefined,
	theme: 'light',
});

export const getEditorAntTheme = (editorTheme: EditorTheme): ThemeConfig => {
	const palette = editorThemePalettes[editorTheme];

	return {
		algorithm: editorTheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
		token: {
			borderRadius: 6,
			colorBgBase: palette.appBackground,
			colorBgContainer: palette.panel,
			colorBgElevated: palette.panel,
			colorBgLayout: palette.appBackground,
			colorBorder: palette.border,
			colorBorderSecondary: palette.border,
			colorInfo: palette.info,
			colorPrimary: palette.primary,
			colorSuccess: palette.primary,
			colorText: palette.primaryText,
			colorTextSecondary: palette.mutedText,
			colorTextTertiary: palette.subtleText,
			colorWarning: palette.warning,
			controlHeight: 32,
			fontFamily: 'Inter, "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif',
		},
		components: {
			Button: {
				defaultBg: palette.secondaryPanel,
				defaultBorderColor: palette.border,
				defaultColor: palette.primaryText,
			},
			Menu: {
				itemBg: 'transparent',
				itemColor: palette.mutedText,
				itemHoverBg: 'transparent',
				itemHoverColor: palette.primaryText,
				itemSelectedBg: 'transparent',
				itemSelectedColor: palette.primaryText,
			},
			Modal: {
				contentBg: palette.panel,
				headerBg: palette.panel,
			},
			Segmented: {
				itemColor: palette.mutedText,
				itemHoverBg: palette.secondaryPanel,
				itemHoverColor: palette.primaryText,
				itemSelectedBg: palette.panel,
				itemSelectedColor: palette.primaryText,
				trackBg: palette.secondaryPanel,
			},
			Select: {
				optionActiveBg: palette.secondaryPanel,
				optionSelectedBg: palette.softAccent,
				optionSelectedColor: palette.primaryText,
				selectorBg: palette.panel,
			},
		},
	};
};

export const EditorThemeProvider = ({ children, initialTheme }: EditorThemeProviderProps) => {
	const [theme, setTheme] = React.useState<EditorTheme>(() => initialTheme || readStoredEditorTheme());
	const popupContainerRef = React.useRef<HTMLDivElement>(null);

	React.useEffect(() => {
		persistEditorTheme(theme);
	}, [theme]);

	return (
		<EditorThemeContext.Provider value={{ setTheme, theme }}>
			<ConfigProvider
				theme={getEditorAntTheme(theme)}
				getPopupContainer={() => popupContainerRef.current || document.body}
			>
				<div ref={popupContainerRef} className="rde-editor-theme-root" data-rde-theme={theme}>
					{children}
				</div>
			</ConfigProvider>
		</EditorThemeContext.Provider>
	);
};

export const useEditorTheme = () => React.useContext(EditorThemeContext);
