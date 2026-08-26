import React from 'react';

import type { CanvasInstance } from '../../canvas';
import { EditorPanelHeader } from '../../components/editor';
import type { ImageMapSizeSchemeValue } from './ImageMapSizeScheme';
import MapProperties from './properties/MapProperties';

interface ImageMapCanvasSettingsProps {
	canvasRef?: CanvasInstance | null;
	onChange?: (selectedItem: any, changedValues: Record<string, any>, allValues: Record<string, any>) => void;
	sizeSchemes: ImageMapSizeSchemeValue[];
	activeSizeSchemeId: string;
	onAddSizeScheme: () => void;
	onDeleteSizeScheme: (id: string) => void;
	onSaveSizeScheme: (values: Omit<ImageMapSizeSchemeValue, 'id'>) => void;
	onSelectSizeScheme: (id: string) => void;
}

const ImageMapCanvasSettings = ({
	canvasRef,
	onChange,
	sizeSchemes,
	activeSizeSchemeId,
	onAddSizeScheme,
	onDeleteSizeScheme,
	onSaveSizeScheme,
	onSelectSizeScheme,
}: ImageMapCanvasSettingsProps) => (
	<section className="rde-imagemap-canvas-settings">
		<EditorPanelHeader eyebrow="规格" title="尺寸方案" />
		<div className="rde-imagemap-canvas-settings-content">
			<MapProperties
				canvasRef={canvasRef ?? undefined}
				onChange={onChange}
				sizeSchemes={sizeSchemes}
				activeSizeSchemeId={activeSizeSchemeId}
				onAddSizeScheme={onAddSizeScheme}
				onDeleteSizeScheme={onDeleteSizeScheme}
				onSaveSizeScheme={onSaveSizeScheme}
				onSelectSizeScheme={onSelectSizeScheme}
			/>
		</div>
	</section>
);

export default ImageMapCanvasSettings;
