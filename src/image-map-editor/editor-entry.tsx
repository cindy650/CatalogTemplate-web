import React from 'react';

import { i18nClient } from './i18n';
import ImageMapEditor from './editors/imagemap';
import type { ImageMapEditorProps as CoreImageMapEditorProps } from './editors/imagemap/ImageMapEditor';
import type { ImageMapEditorDocumentValue } from './editors/imagemap/ImageMapEditor';
import type { ImageMapBasicInfoValue, ImageMapShopOption } from './editors/imagemap/ImageMapBasicInfo';
import type { ImageMapSizeSchemeValue } from './editors/imagemap/ImageMapSizeScheme';
import type {
	ImageMapFontLayoutCreator,
	ImageMapFontLayoutCategoryLoader,
	ImageMapFontLayoutCategoryOption,
	ImageMapFontLayoutDeleter,
	ImageMapFontLayoutLayerData,
	ImageMapFontLayoutLoader,
	ImageMapFontLayoutOption,
	ImageMapFontLayoutSizeOption,
	ImageMapFontLayoutSizeOptionLoader,
	ImageMapFontLayoutSizeOptionStatus,
	ImageMapFontLayoutSizeOptionSyncer,
	ImageMapFontLayoutSizeLoader,
	ImageMapFontLayoutSaver,
	ImageMapFontLayoutUpdater,
} from './editors/imagemap/ImageMapFontLayouts';
import { EditorThemeProvider, type EditorTheme } from './theme';

import './styles/app.css';

export interface ImageMapEditorProps extends CoreImageMapEditorProps {
	/** Initial theme for the embedded editor. */
	initialTheme?: EditorTheme;
}

// Initialize the shared i18n instance once when the package is imported.
i18nClient();

/**
 * Self-contained image map editor for embedding in another React application.
 * The host only needs to provide a React tree and the package stylesheet.
 */
const EmbeddedImageMapEditor = ({ initialTheme, ...editorProps }: ImageMapEditorProps = {}) => (
	<EditorThemeProvider initialTheme={initialTheme}>
		<ImageMapEditor {...editorProps} />
	</EditorThemeProvider>
);

export { EmbeddedImageMapEditor as ImageMapEditor };
export type { ImageMapBasicInfoValue, ImageMapShopOption, ImageMapSizeSchemeValue };
export type { ImageMapEditorDocumentValue };
export type ImageMapFontAsset = { family: string; filePath: string };
export type {
	ImageMapFontLayoutCreator,
	ImageMapFontLayoutCategoryLoader,
	ImageMapFontLayoutCategoryOption,
	ImageMapFontLayoutDeleter,
	ImageMapFontLayoutLayerData,
	ImageMapFontLayoutLoader,
	ImageMapFontLayoutOption,
	ImageMapFontLayoutSizeOption,
	ImageMapFontLayoutSizeOptionLoader,
	ImageMapFontLayoutSizeOptionStatus,
	ImageMapFontLayoutSizeOptionSyncer,
	ImageMapFontLayoutSizeLoader,
	ImageMapFontLayoutSaver,
	ImageMapFontLayoutUpdater,
};
export type { EditorTheme } from './theme';
