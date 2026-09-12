import { RightOutlined } from '@ant-design/icons';
import React from 'react';

import { CanvasInstance, FabricObject } from '../../canvas';
import { EditorPanelHeader } from '../../components/editor';
import NodeProperties from './properties/NodeProperties';
import ImageMapList from './ImageMapList';
import type { ImageMapTextGenerationRule } from './properties/GeneralProperty';

interface ImageMapConfigurationsProps {
	canvasRef?: CanvasInstance;
	fontOptions?: Array<{ key: string; value: string; label: string; family: string; filePath: string; aliases?: string[] }>;
	fontFamiliesError?: string;
	fontFamiliesLoading?: boolean;
	onFontSearch?: (search: string) => void;
	onFontSelect?: (font: { family: string; filePath: string; aliases?: string[] }) => void | Promise<void | boolean>;
	onCenterHorizontally?: () => void;
	onCenterVertically?: () => void;
	onTextTransform?: (mode: 'capitalize' | 'uppercase') => void;
	textGenerationRules?: ImageMapTextGenerationRule[];
	textGenerationRulesLoading?: boolean;
	selectedItem?: FabricObject;
	objectMeasurementRevision?: number;
	onChange?: (selectedItem: FabricObject | undefined, changedValues: any, allValues: any) => void;
	onChangeAnimations?: (animations: any[]) => void;
	onChangeStyles?: (styles: any[]) => void;
	onChangeDataSources?: (dataSources: any[]) => void;
	animations?: any[];
	styles?: any[];
	dataSources?: any[];
}


class ImageMapConfigurations extends React.Component<ImageMapConfigurationsProps> {
	state = {
		layersCollapsed: true,
	};

	render() {
		const { onChange, selectedItem, canvasRef, fontOptions, fontFamiliesError, fontFamiliesLoading, onFontSearch, onFontSelect } = this.props;
		const { layersCollapsed } = this.state;
		const layerCount = canvasRef?.canvas
			? canvasRef.canvas.getObjects().filter((object: any) => object.id && object.id !== 'workarea').length
			: 0;

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
						objectMeasurementRevision={this.props.objectMeasurementRevision}
						fontOptions={fontOptions}
						fontFamiliesError={fontFamiliesError}
						fontFamiliesLoading={fontFamiliesLoading}
						onFontSearch={onFontSearch}
						onFontSelect={onFontSelect}
						onCenterHorizontally={this.props.onCenterHorizontally}
						onCenterVertically={this.props.onCenterVertically}
						onTextTransform={this.props.onTextTransform}
						textGenerationRules={this.props.textGenerationRules}
						textGenerationRulesLoading={this.props.textGenerationRulesLoading}
						onChange={onChange}
						selectedItem={selectedItem}
					/>
				</div>
				<section className={`rde-imagemap-layer-panel rde-imagemap-items${layersCollapsed ? ' is-collapsed' : ''}`}>
					<button
						type="button"
						className="rde-imagemap-layer-toggle"
						aria-label={layersCollapsed ? '展开图层' : '收回图层'}
						aria-expanded={!layersCollapsed}
						aria-controls="rde-imagemap-layer-list"
						onClick={() => this.setState({ layersCollapsed: !layersCollapsed })}
					>
						<span className="rde-imagemap-layer-toggle-icon" aria-hidden="true">
							<RightOutlined className={layersCollapsed ? '' : 'is-open'} />
						</span>
						<span className="rde-imagemap-layer-toggle-copy">
							<span className="rde-imagemap-layer-toggle-title">图层</span>
							<span className="rde-imagemap-layer-toggle-meta">{layerCount} 个对象</span>
						</span>
						<span className="rde-imagemap-layer-toggle-hint">{layersCollapsed ? '点击展开' : '点击收回'}</span>
					</button>
					<div
						id="rde-imagemap-layer-list"
						className={`rde-imagemap-layer-list${layersCollapsed ? ' is-hidden' : ''}`}
						aria-hidden={layersCollapsed}
					>
						<ImageMapList canvasRef={canvasRef} selectedItem={selectedItem} />
					</div>
				</section>
			</div>
		);
	}
}

export default ImageMapConfigurations;
