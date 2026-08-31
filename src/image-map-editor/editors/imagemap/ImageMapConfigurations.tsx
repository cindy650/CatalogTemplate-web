import React from 'react';

import { CanvasInstance, FabricObject } from '../../canvas';
import { EditorPanelHeader } from '../../components/editor';
import NodeProperties from './properties/NodeProperties';
import ImageMapList from './ImageMapList';

interface ImageMapConfigurationsProps {
	canvasRef?: CanvasInstance;
	fontOptions?: Array<{ key: string; value: string; label: string; family: string; filePath: string; aliases?: string[] }>;
	fontFamiliesError?: string;
	fontFamiliesLoading?: boolean;
	onFontSearch?: (search: string) => void;
	onFontSelect?: (font: { family: string; filePath: string; aliases?: string[] }) => void | Promise<void | boolean>;
	selectedItem?: FabricObject;
	onChange?: (selectedItem: FabricObject | undefined, changedValues: any, allValues: any) => void;
	onChangeAnimations?: (animations: any[]) => void;
	onChangeStyles?: (styles: any[]) => void;
	onChangeDataSources?: (dataSources: any[]) => void;
	animations?: any[];
	styles?: any[];
	dataSources?: any[];
}


class ImageMapConfigurations extends React.Component<ImageMapConfigurationsProps> {
	render() {
		const { onChange, selectedItem, canvasRef, fontOptions, fontFamiliesError, fontFamiliesLoading, onFontSearch, onFontSelect } = this.props;

		return (
			<div className="rde-editor-configurations rde-imagemap-configurations">
				<EditorPanelHeader
					eyebrow="当前选择"
					title={selectedItem?.name || selectedItem?.type || '对象属性'}
					description="对象属性与交互设置"
				/>
				<div className="rde-imagemap-object-properties">
					<NodeProperties
						canvasRef={canvasRef}
						fontOptions={fontOptions}
						fontFamiliesError={fontFamiliesError}
						fontFamiliesLoading={fontFamiliesLoading}
						onFontSearch={onFontSearch}
						onFontSelect={onFontSelect}
						onChange={onChange}
						selectedItem={selectedItem}
					/>
				</div>
				<section className="rde-imagemap-layer-panel rde-imagemap-items">
					<EditorPanelHeader eyebrow="画布" title="图层" />
					<div className="rde-imagemap-layer-list">
						<ImageMapList canvasRef={canvasRef} selectedItem={selectedItem} />
					</div>
				</section>
			</div>
		);
	}
}

export default ImageMapConfigurations;
