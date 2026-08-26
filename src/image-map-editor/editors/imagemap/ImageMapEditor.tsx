import { CheckCircleOutlined, FileImageOutlined, PictureOutlined, SaveOutlined, SelectOutlined } from '@ant-design/icons';
import { Badge, Button, Menu, Popconfirm, message } from 'antd';
import { debounce } from 'lodash-es';
import React, { Component } from 'react';

import i18next from 'i18next';
import type { CanvasInstance } from '../../canvas';
import Canvas from '../../canvas/Canvas';
import CommonButton from '../../components/common/CommonButton';
import { EditorActivityRail, EditorStatusBar, summarizeImageMap } from '../../components/editor';
import { Content } from '../../components/layout';
import SandBox from '../../components/sandbox/SandBox';
import { EditorThemeContext, getEditorCanvasTheme, type EditorTheme } from '../../theme';
import ImageMapBasicInfo, {
	type ImageMapBasicInfoValue,
	type ImageMapShopOption,
	type ImageMapShopValue,
} from './ImageMapBasicInfo';
import ImageMapConfigurations from './ImageMapConfigurations';
import ImageMapCanvasSettings from './ImageMapCanvasSettings';
import ImageMapFontLayouts, {
	type ImageMapFontLayoutCreator,
	type ImageMapFontLayoutCategoryLoader,
	type ImageMapFontLayoutDeleter,
	type ImageMapFontLayoutLayerData,
	type ImageMapFontLayoutLoader,
	type ImageMapFontLayoutOption,
	type ImageMapFontLayoutSizeOption,
	type ImageMapFontLayoutSizeOptionLoader,
	type ImageMapFontLayoutSizeOptionSyncer,
	type ImageMapFontLayoutSizeLoader,
	type ImageMapFontLayoutSaver,
	type ImageMapFontLayoutUpdater,
} from './ImageMapFontLayouts';
import ImageMapFooterToolbar from './ImageMapFooterToolbar';
import ImageMapHeaderToolbar from './ImageMapHeaderToolbar';
import ImageMapItems, { type ImageMapItemsHandle } from './ImageMapItems';
import ImageMapPreview from './ImageMapPreview';
import {
	createImageMapSizeScheme,
	createImageMapSizeSchemes,
	resolveImageMapSpineWidth,
	type ImageMapSizeSchemeValue,
} from './ImageMapSizeScheme';
import ImageMapTitle from './ImageMapTitle';

const propertiesToInclude = [
	'id',
	'name',
	'rules',
	'wordSpacing',
	'fontUrl',
	'locked',
	'file',
	'src',
	'backgroundColor',
	'link',
	'tooltip',
	'animation',
	'layout',
	'workareaWidth',
	'workareaHeight',
	'unit',
	'sideWidth',
	'sideHeight',
	'bleed',
	'spineWidth',
	'spineBleed',
	'printGuides',
	'videoLoadType',
	'autoplay',
	'shadow',
	'muted',
	'loop',
	'code',
	'icon',
	'userProperty',
	'trigger',
	'superType',
	'points',
	'svg',
	'loadType',
];

const defaultOption: any = {
	stroke: 'rgba(255, 255, 255, 0)',
	strokeUniform: true,
	resource: {},
	link: {
		enabled: false,
		type: 'resource',
		state: 'new',
		dashboard: {},
	},
	tooltip: {
		enabled: true,
		type: 'resource',
		template: '<div>{{message.name}}</div>',
	},
	animation: {
		type: 'none',
		loop: true,
		autoplay: true,
		duration: 1000,
	},
	userProperty: {},
	trigger: {
		enabled: false,
		type: 'alarm',
		script: 'return message.value > 0;',
		effect: 'style',
	},
};

type DescriptorMap = Record<string, any[]>;
type ImageMapEditorActivity = 'basicInfo' | 'canvas' | 'fontLayouts' | 'assets';

const assetDescriptorTypes: Record<string, ReadonlySet<string>> = {
	TEXT: new Set(['textbox']),
	IMAGE: new Set(['image']),
	SHAPE: new Set(['triangle', 'rect', 'circle']),
	SVG: new Set(['svg']),
};

const filterAssetDescriptors = (descriptors: DescriptorMap): DescriptorMap =>
	Object.entries(assetDescriptorTypes).reduce<DescriptorMap>((result, [category, allowedTypes]) => {
		result[category] = (descriptors[category] ?? []).filter(descriptor =>
			allowedTypes.has(String(descriptor.option?.type)),
		);
		return result;
	}, {});

const editorActivities: Array<{ key: ImageMapEditorActivity; label: string; icon: string }> = [
	{ key: 'basicInfo', label: '基本信息', icon: 'info' },
	{ key: 'canvas', label: '尺寸方案', icon: 'map' },
	{ key: 'fontLayouts', label: '字体布局', icon: 'fontLayouts' },
	{ key: 'assets', label: '素材', icon: 'shapes' },
];

interface ImageMapEditorState {
	basicInfo: ImageMapBasicInfoValue;
	selectedItem: any;
	zoomRatio: number;
	preview: boolean;
	loading: boolean;
	progress: number;
	animations: any[];
	styles: any[];
	dataSources: any[];
	fontOptions: Array<{ key: string; value: string; label: string; family: string; filePath: string }>;
	fontFamiliesError: string;
	fontFamiliesLoading: boolean;
	editing: boolean;
	descriptors: DescriptorMap;
	objects?: any[];
	activeActivity: string;
	sizeSchemes: ImageMapSizeSchemeValue[];
	activeSizeSchemeId: string;
	savingDocument: boolean;
}

export interface ImageMapEditorDocumentValue {
	basicInfo: ImageMapBasicInfoValue;
	sizeSchemes: ImageMapSizeSchemeValue[];
	activeSizeSchemeId: string;
	layers: ImageMapFontLayoutLayerData;
}

export interface ImageMapEditorProps {
	shops?: ImageMapShopOption[];
	initialBasicInfo?: Partial<ImageMapBasicInfoValue>;
	templatePreviewImage?: string;
	/** Initial Fabric document supplied by the embedding page. */
	initialLayers?: ImageMapFontLayoutLayerData;
	onBasicInfoChange?: (value: ImageMapBasicInfoValue) => void;
	initialSizeSchemes?: Partial<ImageMapSizeSchemeValue>[];
	initialActiveSizeSchemeId?: string;
	selectedFontLayoutId?: number;
	onSizeSchemesChange?: (value: ImageMapSizeSchemeValue[]) => void;
	onSaveSizeSchemes?: (value: ImageMapSizeSchemeValue[], activeSizeSchemeId: string, layers?: ImageMapFontLayoutLayerData, fontLayoutId?: number) => void | Promise<void>;
	createFontLayout?: ImageMapFontLayoutCreator;
	deleteFontLayout?: ImageMapFontLayoutDeleter;
	loadFontLayoutCategories?: ImageMapFontLayoutCategoryLoader;
	loadFontLayouts?: ImageMapFontLayoutLoader;
	loadFontLayoutSizeOptions?: ImageMapFontLayoutSizeOptionLoader;
	loadFontLayoutSize?: ImageMapFontLayoutSizeLoader;
	loadTextFonts?: (search: string) => Promise<Array<{ id: string; family: string; label: string; filePath: string }>>;
	applyTextFont?: (family: string, filePath: string) => Promise<void>;
	saveFontLayout?: ImageMapFontLayoutSaver;
	sizeOptions?: ImageMapFontLayoutSizeOption[];
	sizeTemplateId?: number;
	syncFontLayoutSizeOptions?: ImageMapFontLayoutSizeOptionSyncer;
	updateFontLayout?: ImageMapFontLayoutUpdater;
	onSaveDocument?: (document: ImageMapEditorDocumentValue, previewFile?: File) => void | Promise<void>;
	saveSuccessMessage?: string;
	saveLocation?: 'header' | 'basicInfo';
	saveConfirmTitle?: string;
	alwaysEnableSave?: boolean;
	hiddenActivities?: ImageMapEditorActivity[];
	onExit?: () => void;
	exitLabel?: string;
}

const createBasicInfo = (
	initialValue: Partial<ImageMapBasicInfoValue> | undefined,
	shops: ImageMapShopOption[] = [],
): ImageMapBasicInfoValue => ({
	shopId: initialValue?.shopId ?? shops[0]?.value,
	templateName: initialValue?.templateName ?? '',
});

class ImageMapEditor extends Component<ImageMapEditorProps, ImageMapEditorState> {
	static contextType = EditorThemeContext;
	declare context: React.ContextType<typeof EditorThemeContext>;

	private appliedTheme: EditorTheme | null = null;
	private canvasRef: CanvasInstance | null = null;
	private itemsRef: ImageMapItemsHandle | null = null;
	private initialSizeSchemes = createImageMapSizeSchemes(this.props.initialSizeSchemes);
	private initialActiveSizeSchemeId = this.initialSizeSchemes.some(
		item => item.id === this.props.initialActiveSizeSchemeId,
	) ? this.props.initialActiveSizeSchemeId! : this.initialSizeSchemes[0].id;
	private initialSizeSchemeApplied = false;
	private fitCanvasFrame?: number;
	private textFontRequestId = 0;
	private fontAssets = new Map<string, string>();
	private selectedFontLayoutId: ImageMapFontLayoutOption['id'] | undefined = this.props.selectedFontLayoutId;
	private sizeLayoutRequestId = 0;
	private visibleActivities = editorActivities.filter(
		activity => !this.props.hiddenActivities?.includes(activity.key),
	);
	private initialActivity = this.visibleActivities.some(activity => activity.key === 'canvas')
		? 'canvas'
		: this.visibleActivities[0]?.key ?? 'assets';

	state: ImageMapEditorState = {
		basicInfo: createBasicInfo(this.props.initialBasicInfo, this.props.shops),
		selectedItem: null,
		zoomRatio: 1,
		preview: false,
		loading: false,
		progress: 0,
		animations: [],
		styles: [],
		dataSources: [],
		fontOptions: [],
		fontFamiliesError: '',
		fontFamiliesLoading: false,
		editing: false,
		descriptors: {},
		objects: undefined,
		activeActivity: this.initialActivity,
		sizeSchemes: this.initialSizeSchemes,
		activeSizeSchemeId: this.initialActiveSizeSchemeId,
		savingDocument: false,
	};

	setCanvasRef = (ref: CanvasInstance | null) => {
		this.canvasRef = ref;
	};

	handleCanvasLoad = (handler: CanvasInstance['handler']) => {
		if (this.initialSizeSchemeApplied) return;
		this.initialSizeSchemeApplied = true;
		const activeSizeScheme = this.state.sizeSchemes.find(
			item => item.id === this.state.activeSizeSchemeId,
		);
		if (activeSizeScheme) {
			handler.workareaHandler.setPrintDimensions({
				...activeSizeScheme,
				spineWidth: resolveImageMapSpineWidth(activeSizeScheme),
			});
			const initialLoad = this.props.initialLayers
				? this.importFontLayoutLayers(this.props.initialLayers, true, handler)
				: this.loadActiveSizeSchemeFontLayout();
			void initialLoad.catch(error => {
				void message.error(error instanceof Error ? error.message : String(error));
			}).finally(() => {
				this.scheduleInitialFitCanvas(handler);
			});
		} else {
			this.scheduleInitialFitCanvas(handler);
		}
	};

	loadActiveSizeSchemeFontLayout = async () => {
		const layoutId = this.selectedFontLayoutId;
		const sizeTemplateId = this.props.sizeTemplateId;
		const sizeScheme = this.state.sizeSchemes.find(item => item.id === this.state.activeSizeSchemeId);
		const loadFontLayoutSize = this.props.loadFontLayoutSize;
		if (layoutId === undefined || sizeTemplateId === undefined || !sizeScheme || !loadFontLayoutSize) return;
		const requestId = ++this.sizeLayoutRequestId;
		const result = await loadFontLayoutSize(layoutId, sizeTemplateId, sizeScheme.id);
		if (requestId !== this.sizeLayoutRequestId || !this.canvasRef) return;
		await this.importFontLayoutLayers(result.layers);
	};

	scheduleInitialFitCanvas = (handler: CanvasInstance['handler']) => {
		if (this.fitCanvasFrame !== undefined) {
			window.cancelAnimationFrame(this.fitCanvasFrame);
		}
		this.fitCanvasFrame = window.requestAnimationFrame(() => {
			this.fitCanvasFrame = window.requestAnimationFrame(() => {
				this.fitCanvasFrame = undefined;
				handler.zoomHandler.zoomToFit();
				const center = handler.canvas.getCenterPoint();
				handler.zoomHandler.zoomToPoint(center, handler.canvas.getZoom() * 0.96);
			});
		});
	};

	componentDidMount() {
		this.appliedTheme = this.context.theme;
		this.showLoading(true);
		import('./Descriptors.json').then(descriptors => {
			this.setState(
				{ descriptors: filterAssetDescriptors(descriptors.default) },
				() => this.showLoading(false),
			);
		});
		this.setState({
			selectedItem: null,
		});
	}

	componentWillUnmount() {
		this.textFontRequestId += 1;
		this.sizeLayoutRequestId += 1;
		if (this.fitCanvasFrame !== undefined) {
			window.cancelAnimationFrame(this.fitCanvasFrame);
		}
	}

	componentDidUpdate(prevProps: ImageMapEditorProps, prevState: ImageMapEditorState) {
		if (prevProps.shops !== this.props.shops) {
			const shops = this.props.shops ?? [];
			const current = this.state.basicInfo;
			const selectedShop = shops.find(shop => shop.value === current.shopId) ?? shops[0];
			const nextBasicInfo = {
				...current,
				shopId: selectedShop?.value,
			};
			if (nextBasicInfo.shopId !== current.shopId) {
				this.setState({ basicInfo: nextBasicInfo });
				this.props.onBasicInfoChange?.(nextBasicInfo);
			}
		}
		if (this.appliedTheme !== this.context.theme && this.canvasRef) {
			this.appliedTheme = this.context.theme;
			this.canvasRef.canvas.selectionColor = getEditorCanvasTheme(this.context.theme).selectionColor;
			this.canvasRef.canvas.requestRenderAll();
		}
		if (prevProps.loadTextFonts !== this.props.loadTextFonts) {
			this.textFontRequestId += 1;
			this.setState({ fontOptions: [], fontFamiliesError: '', fontFamiliesLoading: false });
		}
	}

	loadTextFonts = async (search: string) => {
		const requestId = ++this.textFontRequestId;
		const loader = this.props.loadTextFonts;
		if (!loader) {
			this.setState({ fontOptions: [], fontFamiliesError: '', fontFamiliesLoading: false });
			return;
		}

		this.setState({ fontFamiliesError: '', fontFamiliesLoading: true });
		try {
			const assets = await loader(search.trim());
			assets.forEach(asset => {
				if (asset.family.trim() && asset.filePath.trim()) this.fontAssets.set(asset.family.trim(), asset.filePath.trim());
			});
			const fontOptions = assets
				.filter(asset => asset.family.trim())
				.map(asset => {
					const label = asset.label.trim() || asset.family.trim();
					return {
						key: asset.id,
						value: asset.id,
						label,
						family: asset.family.trim(),
						filePath: asset.filePath.trim(),
					};
				});
			if (requestId === this.textFontRequestId) {
				this.setState({ fontOptions, fontFamiliesLoading: false });
			}
		} catch (error) {
			if (requestId === this.textFontRequestId) {
				this.setState({
					fontOptions: [],
					fontFamiliesError: error instanceof Error ? error.message : String(error),
					fontFamiliesLoading: false,
				});
			}
		}
	};

	onTextFontSearch = (search: string) => {
		const normalizedSearch = search.trim();
		if (!normalizedSearch) {
			this.textFontRequestId += 1;
			this.setState({ fontOptions: [], fontFamiliesError: '', fontFamiliesLoading: false });
			return;
		}
		void this.loadTextFonts(normalizedSearch);
	};

	onTextFontSelect = async (font: { family: string; filePath: string }) => {
		const family = font.family.trim();
		const filePath = font.filePath.trim();
		if (!family) return;
		await this.props.applyTextFont?.(family, filePath);
		this.fontAssets.set(family, filePath);
		this.canvasRef?.handler.set('fontFamily', family);
		this.canvasRef?.handler.set('fontUrl' as any, filePath);
	};

	canvasHandlers = {
		onAdd: (target: any) => {
			const { editing } = this.state;
			this.forceUpdate();
			if (!editing) {
				this.changeEditing(true);
			}
			if (this.canvasRef?.handler.isActiveSelection(target)) {
				this.canvasHandlers.onSelect(null);
				return;
			}
			this.canvasRef?.handler.select(target);
		},
		onSelect: (target: any) => {
			const { selectedItem } = this.state;
			if (target && target.id && target.id !== 'workarea' && !this.canvasRef?.handler.isActiveSelection(target)) {
				if (selectedItem && target.id === selectedItem.id) {
					return;
				}
				this.canvasRef?.handler.getObjects().forEach(obj => {
					if (obj) {
						this.canvasRef?.handler.animationHandler.resetAnimation(obj, true);
					}
				});
				this.setState({ selectedItem: target });
				if ((target.superType === 'text' || target.type === 'textbox') && typeof target.fontFamily === 'string' && target.fontFamily.trim()) {
					void this.loadTextFonts(target.fontFamily);
				}
				return;
			}
			this.canvasRef?.handler.getObjects().forEach(obj => {
				if (obj) {
					this.canvasRef?.handler.animationHandler.resetAnimation(obj, true);
				}
			});
			this.setState({ selectedItem: null });
		},
		onRemove: () => {
			const { editing } = this.state;
			if (!editing) {
				this.changeEditing(true);
			}
			this.canvasHandlers.onSelect(null);
		},
		onModified: debounce(() => {
			const { editing } = this.state;
			this.forceUpdate();
			if (!editing) {
				this.changeEditing(true);
			}
		}, 300),
		onZoom: (zoom: number) => {
			this.setState({ zoomRatio: zoom });
		},
		onChange: (selectedItem: any, changedValues: Record<string, any>, allValues: Record<string, any>) => {
			const { editing } = this.state;
			if (!editing) {
				this.changeEditing(true);
			}
			const changedKey = Object.keys(changedValues)[0];
			const changedValue = changedValues[changedKey];
			if (allValues.workarea) {
				this.canvasHandlers.onChangeWokarea(changedKey, changedValue, allValues.workarea);
				return;
			}
			if (changedKey === 'width' || changedKey === 'height') {
				this.canvasRef?.handler.scaleToResize(allValues.width, allValues.height);
				return;
			}
			if (changedKey === 'angle') {
				this.canvasRef?.handler.rotate(allValues.angle);
				return;
			}
			if (changedKey === 'locked') {
				const isTextObject = selectedItem?.superType === 'text' || selectedItem?.type === 'textbox';
				this.canvasRef?.handler.setObject({
					lockMovementX: changedValue,
					lockMovementY: changedValue,
					hasControls: !changedValue && !isTextObject,
					lockScalingX: isTextObject,
					lockScalingY: isTextObject,
					hoverCursor: changedValue ? 'pointer' : 'move',
					editable: !changedValue,
					locked: changedValue,
				});
				return;
			}
			if (changedKey === 'file' || changedKey === 'src' || changedKey === 'code' || changedKey === 'svg') {
				if (selectedItem.type === 'image') {
					this.canvasRef?.handler.setImageById(selectedItem.id, changedValue, true);
				} else if (selectedItem.superType === 'element') {
					this.canvasRef?.handler.elementHandler.setById(selectedItem.id, changedValue);
				} else if (selectedItem.superType === 'svg') {
					this.canvasRef?.handler.setSvg(selectedItem, changedValue);
				}
				return;
			}
			if (changedKey === 'link') {
				const link = Object.assign({}, defaultOption.link, allValues.link);
				this.canvasRef?.handler.set(changedKey, link);
				return;
			}
			if (changedKey === 'tooltip') {
				const tooltip = Object.assign({}, defaultOption.tooltip, allValues.tooltip);
				this.canvasRef?.handler.set(changedKey, tooltip);
				return;
			}
			if (changedKey === 'animation') {
				const animation = Object.assign({}, defaultOption.animation, allValues.animation);
				this.canvasRef?.handler.set(changedKey, animation);
				return;
			}
			if (changedKey === 'icon') {
				const { unicode, styles } = changedValue[Object.keys(changedValue)[0]];
				const uni = parseInt(unicode, 16);
				if (styles[0] === 'brands') {
					this.canvasRef?.handler.set('fontFamily', 'Font Awesome 5 Brands');
				} else if (styles[0] === 'regular') {
					this.canvasRef?.handler.set('fontFamily', 'Font Awesome 5 Regular');
				} else {
					this.canvasRef?.handler.set('fontFamily', 'Font Awesome 5 Free');
				}
				this.canvasRef?.handler.set('text', String.fromCodePoint(uni));
				this.canvasRef?.handler.set('icon', changedValue);
				return;
			}
			if (changedKey === 'shadow') {
				if (allValues.shadow.enabled) {
					if ('blur' in allValues.shadow) {
						this.canvasRef?.handler.setShadow(allValues.shadow as any);
					} else {
						this.canvasRef?.handler.setShadow({
							enabled: true,
							color: '#000000',
							affectStroke: false,
							nonScaling: false,
							type: 'shadow',
							blur: 15,
							offsetX: 10,
							offsetY: 10,
						} as any);
					}
				} else {
					this.canvasRef?.handler.setShadow(null);
				}
				return;
			}
			if (changedKey === 'fontWeight') {
				this.canvasRef?.handler.set(changedKey, changedValue ? 'bold' : 'normal');
				return;
			}
			if (changedKey === 'fontFamily') {
				const fontUrl = this.fontAssets.get(String(changedValue).trim());
				this.canvasRef?.handler.set('fontUrl' as any, fontUrl || '');
				this.canvasRef?.handler.set(changedKey, changedValue);
				return;
			}
			if (changedKey === 'fontStyle') {
				this.canvasRef?.handler.set(changedKey, changedValue ? 'italic' : 'normal');
				return;
			}
			if (changedKey === 'textAlign') {
				this.canvasRef?.handler.set(changedKey, Object.keys(changedValue)[0]);
				return;
			}
			if (changedKey === 'trigger') {
				const trigger = Object.assign({}, defaultOption.trigger, allValues.trigger);
				this.canvasRef?.handler.set(changedKey, trigger);
				return;
			}
			if (changedKey === 'filters') {
				const filterKey = Object.keys(changedValue)[0];
				const filterValue = allValues.filters[filterKey];
				const enabled = typeof filterValue === 'object' ? filterValue.enabled : filterValue;
				if (filterKey === 'gamma') {
					const rgb = [filterValue.r, filterValue.g, filterValue.b];
					this.canvasRef?.handler.imageHandler.applyFilterByType(filterKey, enabled, { gamma: rgb });
					return;
				}
				if (filterKey === 'brightness') {
					this.canvasRef?.handler.imageHandler.applyFilterByType(filterKey, enabled, {
						brightness: filterValue.brightness,
					});
					return;
				}
				if (filterKey === 'contrast') {
					this.canvasRef?.handler.imageHandler.applyFilterByType(filterKey, enabled, {
						contrast: filterValue.contrast,
					});
					return;
				}
				if (filterKey === 'saturation') {
					this.canvasRef?.handler.imageHandler.applyFilterByType(filterKey, enabled, {
						saturation: filterValue.saturation,
					});
					return;
				}
				if (filterKey === 'hue') {
					this.canvasRef?.handler.imageHandler.applyFilterByType(filterKey, enabled, {
						rotation: filterValue.rotation,
					});
					return;
				}
				if (filterKey === 'noise') {
					this.canvasRef?.handler.imageHandler.applyFilterByType(filterKey, enabled, {
						noise: filterValue.noise,
					});
					return;
				}
				if (filterKey === 'pixelate') {
					this.canvasRef?.handler.imageHandler.applyFilterByType(filterKey, enabled, {
						blocksize: filterValue.blocksize,
					});
					return;
				}
				if (filterKey === 'blur') {
					this.canvasRef?.handler.imageHandler.applyFilterByType(filterKey, enabled, {
						value: filterValue.value,
					});
					return;
				}
				this.canvasRef?.handler.imageHandler.applyFilterByType(filterKey, enabled);
				return;
			}
			if (changedKey === 'chartOption') {
				try {
					const sandbox = new SandBox();
					const compiled = sandbox.compile(changedValue);
					const { animations, styles } = this.state;
					const chartOption = compiled(3, animations, styles, selectedItem.userProperty);
					selectedItem.setChartOptionStr(changedValue);
					this.canvasRef?.handler.elementHandler.setById(selectedItem.id, chartOption);
				} catch (error) {
					console.error(error);
				}
				return;
			}
			if (selectedItem.type === 'svg' && changedKey === 'fill') {
				selectedItem.setFill(changedValue);
			} else {
				this.canvasRef?.handler.set(changedKey, changedValue);
			}
		},
		onChangeWokarea: (changedKey: string, changedValue: any, allValues: Record<string, any>) => {
			if (changedKey === 'layout') {
				this.canvasRef?.handler.workareaHandler.setLayout(changedValue);
				return;
			}
			if (changedKey === 'file' || changedKey === 'src') {
				this.canvasRef?.handler.workareaHandler.setImage(changedValue);
				return;
			}
			if (['unit', 'sideWidth', 'sideHeight', 'bleed', 'spineWidth', 'spineBleed', 'paperThickness'].includes(changedKey)) {
				this.canvasRef?.handler.workareaHandler.setPrintDimensions(allValues);
				return;
			}
			if (changedKey === 'width' || changedKey === 'height') {
				this.canvasRef?.handler.originScaleToResize(
					this.canvasRef.handler.workarea,
					allValues.width,
					allValues.height,
				);
				this.canvasRef?.canvas.centerObject(this.canvasRef.handler.workarea);
				return;
			}
			this.canvasRef?.handler.workarea.set(changedKey, changedValue);
			this.canvasRef?.canvas.requestRenderAll();
		},
		onTooltip: (target: any) => {
			const value = Math.random() * 10 + 1;
			return (
				<div>
					<div>
						<div>
							<Button>{target.id}</Button>
						</div>
						<Badge count={value} />
					</div>
				</div>
			);
		},
		onClick: (_canvas: any, target: any) => {
			const { link } = target;
			if (link.state === 'current') {
				document.location.href = link.url;
				return;
			}
			window.open(link.url);
		},
		onContext: (event: any, target: any) => {
			if ((target && target.id === 'workarea') || !target) {
				const { layerX: left, layerY: top } = event;
				return (
					<Menu>
						<Menu.SubMenu key="add" style={{ width: 120 }} title={i18next.t('action.add')}>
							{this.transformList().map(item => {
								const option = Object.assign({}, item.option, { left, top });
								const newItem = Object.assign({}, item, { option });
								return (
									<Menu.Item style={{ padding: 0 }} key={item.name}>
										{this.itemsRef?.renderItem(newItem, false)}
									</Menu.Item>
								);
							})}
						</Menu.SubMenu>
					</Menu>
				);
			}
			if (this.canvasRef?.handler.isActiveSelection(target)) {
				return (
					<Menu
						items={[
							{
								key: 'objec-group',
								label: i18next.t('action.object-group'),
								onClick: () => this.canvasRef?.handler.toGroup(),
							},
						]}
					>
						<Menu.Item onClick={() => this.canvasRef?.handler.duplicate()}>
							{i18next.t('action.clone')}
						</Menu.Item>
						<Menu.Item onClick={() => this.canvasRef?.handler.remove()}>
							{i18next.t('action.delete')}
						</Menu.Item>
					</Menu>
				);
			}
			if (target.isType('Group')) {
				return (
					<Menu>
						<Menu.Item onClick={() => this.canvasRef?.handler.toActiveSelection()}>
							{i18next.t('action.object-ungroup')}
						</Menu.Item>
						<Menu.Item onClick={() => this.canvasRef?.handler.duplicate()}>
							{i18next.t('action.clone')}
						</Menu.Item>
						<Menu.Item onClick={() => this.canvasRef?.handler.remove()}>
							{i18next.t('action.delete')}
						</Menu.Item>
					</Menu>
				);
			}
			return (
				<Menu>
					<Menu.Item onClick={() => this.canvasRef?.handler.duplicateById(target.id)}>
						{i18next.t('action.clone')}
					</Menu.Item>
					<Menu.Item onClick={() => this.canvasRef?.handler.removeById(target.id)}>
						{i18next.t('action.delete')}
					</Menu.Item>
				</Menu>
			);
		},
		onTransaction: (_transaction: any) => {
			this.forceUpdate();
		},
	};

	handlers = {
		onChangePreview: (checked: boolean | object) => {
			let data: any[] | undefined;
			if (this.canvasRef) {
				data = this.canvasRef.handler.exportJSON().filter(obj => !!obj.id);
			}
			this.setState({
				preview: typeof checked === 'object' ? false : checked,
				objects: data,
			});
		},
		onProgress: (progress: number) => {
			this.setState({ progress });
		},
		onImport: (files?: FileList | null) => {
			if (!files) {
				return;
			}
			this.showLoading(true);
			setTimeout(() => {
				const reader = new FileReader();
				reader.onprogress = event => {
					if (event.lengthComputable) {
						const progress = parseInt(String((event.loaded / event.total) * 100), 10);
						this.handlers.onProgress(progress);
					}
				};
				reader.onload = event => {
					const result = event.target?.result;
					if (!result) {
						return;
					}
					const {
						basicInfo,
						objects,
						animations,
						styles,
						dataSources,
						sizeSchemes,
						activeSizeSchemeId,
					} = JSON.parse(String(result));
					const nextBasicInfo = basicInfo
						? createBasicInfo(basicInfo, this.props.shops)
						: this.state.basicInfo;
					const nextSizeSchemes = Array.isArray(sizeSchemes) && sizeSchemes.length
						? createImageMapSizeSchemes(sizeSchemes)
						: this.state.sizeSchemes;
					const nextActiveSizeSchemeId = nextSizeSchemes.some(item => item.id === activeSizeSchemeId)
						? activeSizeSchemeId
						: nextSizeSchemes[0].id;
					this.setState({
						basicInfo: nextBasicInfo,
						animations,
						styles,
						dataSources,
						sizeSchemes: nextSizeSchemes,
						activeSizeSchemeId: nextActiveSizeSchemeId,
					});
					this.props.onBasicInfoChange?.(nextBasicInfo);
					this.props.onSizeSchemesChange?.(nextSizeSchemes);
					if (objects) {
						this.canvasRef?.handler.clear(true);
						const data = objects.filter((obj: any) => !!obj.id);
						this.canvasRef?.handler.importJSON(data);
					}
				};
				reader.onloadend = () => {
					this.showLoading(false);
				};
				reader.onerror = () => {
					this.showLoading(false);
				};
				reader.readAsText(files[0]);
			}, 500);
		},
		onUpload: () => {
			const inputEl = document.createElement('input');
			inputEl.accept = '.json';
			inputEl.type = 'file';
			inputEl.hidden = true;
			inputEl.onchange = event => {
				this.handlers.onImport((event.target as HTMLInputElement | null)?.files);
			};
			document.body.appendChild(inputEl);
			inputEl.click();
			inputEl.remove();
		},
		onDownload: () => {
			this.showLoading(true);
			const objects = this.canvasRef?.handler.exportJSON().filter(obj => !!obj.id) || [];
			const { basicInfo, animations, styles, dataSources } = this.state;
			const exportDatas = {
				objects,
				animations,
				styles,
				dataSources,
			};
			const anchorEl = document.createElement('a');
			anchorEl.href = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportDatas, null, '\t'))}`;
			anchorEl.download = `${basicInfo.templateName || 'sample'}.json`;
			document.body.appendChild(anchorEl);
			anchorEl.click();
			anchorEl.remove();
			this.changeEditing(false);
			this.showLoading(false);
		},
		onChangeAnimations: (animations: any[]) => {
			if (!this.state.editing) {
				this.changeEditing(true);
			}
			this.setState({ animations });
		},
		onChangeStyles: (styles: any[]) => {
			if (!this.state.editing) {
				this.changeEditing(true);
			}
			this.setState({ styles });
		},
		onChangeDataSources: (dataSources: any[]) => {
			if (!this.state.editing) {
				this.changeEditing(true);
			}
			this.setState({ dataSources });
		},
		onSaveImage: () => {
			this.canvasRef?.handler.saveCanvasImage({
				name: this.state.basicInfo.templateName || '画布',
				format: 'png',
				quality: 1,
			});
		},
		onSaveSVG: () => {
			this.canvasRef?.handler.saveCanvasSVG({
				name: this.state.basicInfo.templateName || '画布',
			});
		},
		onActivityChange: (activeActivity: string) => {
			this.setState({ activeActivity });
		},
		onBasicInfoChange: (basicInfo: ImageMapBasicInfoValue) => {
			if (!this.state.editing) {
				this.changeEditing(true);
			}
			this.setState({ basicInfo });
			this.props.onBasicInfoChange?.(basicInfo);
		},
		onAddSizeScheme: () => {
			const workarea = this.canvasRef?.handler.workarea;
			const activeSizeScheme = this.state.sizeSchemes.find(
				item => item.id === this.state.activeSizeSchemeId,
			);
			let nextSizeSchemeNumber = this.state.sizeSchemes.length + 1;
			let nextSizeSchemeLabel = `新规格 ${nextSizeSchemeNumber}`;
			while (this.state.sizeSchemes.some(item => (
				item.id === nextSizeSchemeLabel || item.label.trim() === nextSizeSchemeLabel
			))) {
				nextSizeSchemeNumber += 1;
				nextSizeSchemeLabel = `新规格 ${nextSizeSchemeNumber}`;
			}
			const nextSizeScheme = createImageMapSizeScheme({
				...activeSizeScheme,
				id: undefined,
				idIsPersisted: false,
				label: nextSizeSchemeLabel,
				unit: workarea?.unit ?? activeSizeScheme?.unit,
				sideWidth: workarea?.sideWidth ?? activeSizeScheme?.sideWidth,
				sideHeight: workarea?.sideHeight ?? activeSizeScheme?.sideHeight,
				bleed: workarea?.bleed ?? activeSizeScheme?.bleed,
				spineWidth: activeSizeScheme?.spineWidth ?? workarea?.spineWidth,
				spineBleed: workarea?.spineBleed ?? activeSizeScheme?.spineBleed,
				paperThickness: activeSizeScheme?.paperThickness,
			});
			const sizeSchemes = [...this.state.sizeSchemes, nextSizeScheme];
			this.changeEditing(true);
			this.setState({
				sizeSchemes,
				activeSizeSchemeId: nextSizeScheme.id,
			});
			this.props.onSizeSchemesChange?.(sizeSchemes);
		},
		onSaveSizeScheme: (values: Omit<ImageMapSizeSchemeValue, 'id'>) => {
			const previousSizeSchemeId = this.state.activeSizeSchemeId;
			const previousSizeScheme = this.state.sizeSchemes.find(item => item.id === previousSizeSchemeId);
			const nextSizeSchemeId = previousSizeScheme?.idIsPersisted
				? previousSizeScheme.id
				: values.label.trim();
			const duplicateSizeScheme = this.state.sizeSchemes.some(item => (
				item.id !== previousSizeSchemeId
				&& (item.id === nextSizeSchemeId || item.label.trim() === nextSizeSchemeId)
			));
			if (duplicateSizeScheme) {
				void message.error('尺寸显示名称不能重复');
				return;
			}
			const savedSizeScheme = createImageMapSizeScheme({
				...values,
				id: nextSizeSchemeId,
				idIsPersisted: true,
			});
			const sizeSchemes = this.state.sizeSchemes.map(item => item.id === previousSizeSchemeId
				? savedSizeScheme
				: {
					...item,
					pageCount: savedSizeScheme.pageCount,
					pageCountOptions: savedSizeScheme.pageCountOptions,
					spineWidthMode: savedSizeScheme.spineWidthMode,
					minSpineWidth: savedSizeScheme.minSpineWidth,
					maxSpineWidth: savedSizeScheme.maxSpineWidth,
					paperThickness: savedSizeScheme.paperThickness,
				});
			this.changeEditing(true);
			this.setState({
				sizeSchemes,
				activeSizeSchemeId: savedSizeScheme.id,
			}, () => {
				this.props.onSizeSchemesChange?.(sizeSchemes);
				void Promise.resolve(this.props.onSaveSizeSchemes?.(
					sizeSchemes,
					savedSizeScheme.id,
					this.getCanvasFontLayoutLayers(),
					typeof this.selectedFontLayoutId === 'number' ? this.selectedFontLayoutId : undefined,
				)).then(() => {
					this.changeEditing(false);
					void message.success('尺寸方案已保存');
				}).catch(error => {
					void message.error(error instanceof Error ? error.message : String(error));
				});
			});
		},
		onDeleteSizeScheme: (id: string) => {
			if (this.state.sizeSchemes.length <= 1) {
				void message.warning('至少保留一个尺寸方案');
				return;
			}
			const deletedIndex = this.state.sizeSchemes.findIndex(item => item.id === id);
			if (deletedIndex < 0) {
				return;
			}
			const sizeSchemes = this.state.sizeSchemes.filter(item => item.id !== id);
			const deletingActive = id === this.state.activeSizeSchemeId;
			const nextActiveSizeScheme = deletingActive
				? sizeSchemes[Math.min(deletedIndex, sizeSchemes.length - 1)]
				: sizeSchemes.find(item => item.id === this.state.activeSizeSchemeId);
			this.changeEditing(true);
			this.setState({
				sizeSchemes,
				activeSizeSchemeId: nextActiveSizeScheme?.id ?? sizeSchemes[0].id,
			}, () => {
				if (deletingActive && nextActiveSizeScheme) {
					this.canvasRef?.handler.workareaHandler.setPrintDimensions({
						...nextActiveSizeScheme,
						spineWidth: resolveImageMapSpineWidth(nextActiveSizeScheme),
					});
				}
			});
			this.props.onSizeSchemesChange?.(sizeSchemes);
			const nextActiveSizeSchemeId = nextActiveSizeScheme?.id ?? sizeSchemes[0].id;
			void Promise.resolve(this.props.onSaveSizeSchemes?.(
				sizeSchemes,
				nextActiveSizeSchemeId,
			)).then(() => {
				void message.success('尺寸方案已删除');
			}).catch(error => {
				void message.error(error instanceof Error ? error.message : String(error));
			});
		},
		onSelectSizeScheme: (activeSizeSchemeId: string) => {
			const sizeScheme = this.state.sizeSchemes.find(item => item.id === activeSizeSchemeId);
			if (!sizeScheme) {
				return;
			}
			this.changeEditing(true);
			this.setState({ activeSizeSchemeId });
			this.canvasRef?.handler.workareaHandler.setPrintDimensions({
				...sizeScheme,
				spineWidth: resolveImageMapSpineWidth(sizeScheme),
			});
			const layoutId = this.selectedFontLayoutId;
			const sizeTemplateId = this.props.sizeTemplateId;
			const loadFontLayoutSize = this.props.loadFontLayoutSize;
			if (layoutId === undefined || sizeTemplateId === undefined || !loadFontLayoutSize) return;
			const requestId = ++this.sizeLayoutRequestId;
			void loadFontLayoutSize(layoutId, sizeTemplateId, sizeScheme.id).then(result => {
				if (requestId !== this.sizeLayoutRequestId || !this.canvasRef) return;
				return this.importFontLayoutLayers(result.layers).then(() => {
					if (result.message) {
						message.info(result.message);
					} else if (result.usingBaseLayers || result.layersSource === 'base') {
						message.info('当前规格暂无独立图层数据，已使用基础字体布局模板');
					}
				});
			}).catch(error => {
				if (requestId === this.sizeLayoutRequestId) {
					void message.error(error instanceof Error ? error.message : String(error));
				}
			});
		},
	};

	transformList = () => Object.values(this.state.descriptors).reduce<any[]>((prev, curr) => prev.concat(curr), []);

	showLoading = (loading: boolean) => {
		this.setState({ loading });
	};

	changeEditing = (editing: boolean) => {
		this.setState({ editing });
	};

	getCanvasFontLayoutLayers = (): ImageMapFontLayoutLayerData => {
		const canvasRef = this.canvasRef;
		const serializedObjects = canvasRef?.handler.exportJSON().filter(obj => !!obj.id) || [];
		return {
			// Persist Fabric's original scene coordinates. The workarea remains
			// part of the document for preview cropping, but is not API canvas
			// configuration and must not be used to overwrite the active editor.
			objects: serializedObjects,
			animations: this.state.animations,
			styles: this.state.styles,
			dataSources: this.state.dataSources,
		};
	};

	getEditorDocument = (): ImageMapEditorDocumentValue => ({
		basicInfo: this.state.basicInfo,
		sizeSchemes: this.state.sizeSchemes,
		activeSizeSchemeId: this.state.activeSizeSchemeId,
		layers: this.getCanvasFontLayoutLayers(),
	});

	saveEditorDocument = async (previewFile?: File): Promise<boolean> => {
		const saveDocument = this.props.onSaveDocument;
		if (!saveDocument || this.state.savingDocument) return false;
		this.setState({ savingDocument: true });
		try {
			await saveDocument(this.getEditorDocument(), previewFile);
			this.changeEditing(false);
			void message.success(this.props.saveSuccessMessage || '订单模板已保存');
			return true;
		} catch (error) {
			void message.error(error instanceof Error ? error.message : String(error));
			return false;
		} finally {
			this.setState({ savingDocument: false });
		}
	};

	/** Import layout objects without letting a serialized workarea overwrite the selected size. */
	importFontLayoutLayers = async (
		layers: ImageMapFontLayoutLayerData,
		applyWorkareaAppearance = false,
		handlerOverride?: CanvasInstance['handler'],
	) => {
		const handler = handlerOverride ?? this.canvasRef?.handler;
		if (!handler) return;
		const viewportTransform = [...handler.canvas.viewportTransform] as typeof handler.canvas.viewportTransform;
		// Layout APIs contain content in the original Fabric scene coordinate
		// system. Ignore any returned workarea object or canvas metadata so the
		// currently selected size remains the editor's source of truth.
		const layerObjects = Array.isArray(layers.objects) ? layers.objects : [];
		const serializedWorkarea = layerObjects.find(object => object.id === 'workarea');
		if (applyWorkareaAppearance && serializedWorkarea) {
			const source = typeof serializedWorkarea.src === 'string' ? serializedWorkarea.src : '';
			if (source) {
				await handler.workareaHandler.setImage(source, true);
			}
			if (serializedWorkarea.backgroundColor !== undefined) {
				handler.workarea.set('backgroundColor', serializedWorkarea.backgroundColor);
			}
		}
		const serializedObjects = layerObjects.filter(object => object.id !== 'workarea');
		const objects = typeof structuredClone === 'function'
			? structuredClone(serializedObjects)
			: JSON.parse(JSON.stringify(serializedObjects));
		handler.clear(false);
		await handler.importJSON(objects);
		handler.canvas.setViewportTransform(viewportTransform);
		handler.onZoom?.(handler.canvas.getZoom());
		handler.canvas.requestRenderAll();
		this.setState({
			selectedItem: null,
			animations: Array.isArray(layers.animations) ? layers.animations : [],
			styles: Array.isArray(layers.styles) ? layers.styles : [],
			dataSources: Array.isArray(layers.dataSources) ? layers.dataSources : [],
		});
	};

	applyFontLayout = async (layout: ImageMapFontLayoutOption) => {
		if (!this.canvasRef) return;
		this.selectedFontLayoutId = layout.id;
		await this.importFontLayoutLayers(layout.layers);
		this.setState({ editing: true });
	};

	render() {
		const canvasTheme = getEditorCanvasTheme(this.context.theme);
		const {
			basicInfo,
			preview,
			selectedItem,
			zoomRatio,
			loading,
			animations,
			styles,
			dataSources,
			editing,
			descriptors,
			fontOptions,
			fontFamiliesError,
			fontFamiliesLoading,
			objects,
			activeActivity,
			sizeSchemes,
			activeSizeSchemeId,
			savingDocument,
		} = this.state;
		const {
			onAdd,
			onRemove,
			onSelect,
			onModified,
			onChange,
			onZoom,
			onTooltip,
			onClick,
			onContext,
			onTransaction,
		} = this.canvasHandlers;
		const {
			onChangePreview,
			onDownload,
			onUpload,
			onChangeAnimations,
			onChangeStyles,
			onChangeDataSources,
			onSaveImage,
			onSaveSVG,
			onAddSizeScheme,
			onDeleteSizeScheme,
			onSaveSizeScheme,
			onSelectSizeScheme,
		} = this.handlers;
		const canvasObjects = this.canvasRef?.handler.getObjects() || [];
		const summary = summarizeImageMap(canvasObjects, selectedItem);
		const saveDocumentButton = (
			<Button
				className="rde-action-btn"
				type="text"
				size="small"
				icon={<SaveOutlined />}
				disabled={savingDocument || (!editing && !this.props.alwaysEnableSave)}
				onClick={this.props.saveConfirmTitle ? undefined : () => void this.saveEditorDocument()}
			>
				保存
			</Button>
		);

		const action = (
			<React.Fragment>
				{this.props.onSaveDocument && this.props.saveLocation !== 'basicInfo' ? (
					this.props.saveConfirmTitle ? (
						<Popconfirm
							title={this.props.saveConfirmTitle}
							description="保存后将覆盖该订单当前模板。"
							okText="确认修改"
							cancelText="取消"
							onConfirm={() => void this.saveEditorDocument()}
					>
							{saveDocumentButton}
						</Popconfirm>
					) : saveDocumentButton
				) : null}
				<CommonButton
					className="rde-action-btn"
					variant="text"
					icon="file-download"
					disabled={!editing}
					tooltipTitle={i18next.t('action.download')}
					onClick={onDownload}
					tooltipPlacement="bottomRight"
				>
					导出
				</CommonButton>
				{editing ? (
					<Popconfirm
						title={i18next.t('imagemap.imagemap-editing-confirm')}
						okText={i18next.t('action.ok')}
						cancelText={i18next.t('action.cancel')}
						onConfirm={onUpload}
						placement="bottomRight"
					>
						<CommonButton
							className="rde-action-btn"
							shape="circle"
							icon="file-upload"
							tooltipTitle={i18next.t('action.upload')}
							tooltipPlacement="bottomRight"
						/>
					</Popconfirm>
				) : (
					<CommonButton
						className="rde-action-btn"
						shape="circle"
						icon="file-upload"
						tooltipTitle={i18next.t('action.upload')}
						tooltipPlacement="bottomRight"
						onClick={onUpload}
					/>
				)}
				<Button
					className="rde-action-btn"
					type="text"
					size="small"
					icon={<PictureOutlined />}
					onClick={onSaveImage}
				>
					导出图片
				</Button>
				<Button
					className="rde-action-btn"
					type="text"
					size="small"
					icon={<FileImageOutlined />}
					onClick={onSaveSVG}
				>
					导出 SVG
				</Button>
			</React.Fragment>
		);

		const title = (
			<ImageMapTitle
				title={
					<React.Fragment>
						{this.props.onExit ? (
							<CommonButton
								className="rde-editor-back-btn"
								variant="text"
								icon="arrow-left"
								aria-label={this.props.exitLabel ?? '返回模板库'}
								tooltipTitle={this.props.exitLabel ?? '返回模板库'}
								onClick={this.props.onExit}
							/>
						) : null}
						<span className="rde-editor-breadcrumb-section">图片地图</span>
						<span className="rde-editor-breadcrumb-divider">/</span>
						<strong>
							{basicInfo.templateName || i18next.t('imagemap.imagemap-editor')}
						</strong>
						<span className={`rde-editor-save-state ${editing ? 'editing' : 'saved'}`}>
							{editing ? '未保存的修改' : '已保存'}
						</span>
					</React.Fragment>
				}
				action={action}
			/>
		);

		const content = (
			<div className="rde-editor rde-operator-editor rde-imagemap-editor">
				<EditorActivityRail
					label="图片地图工作区"
					activeKey={activeActivity}
					onChange={this.handlers.onActivityChange}
					items={this.visibleActivities}
				/>
				<div className="rde-imagemap-activity-panel">
					{activeActivity === 'basicInfo' ? (
						<ImageMapBasicInfo
							shops={this.props.shops ?? []}
							value={basicInfo}
							onChange={this.handlers.onBasicInfoChange}
							previewImage={this.props.templatePreviewImage}
							saving={savingDocument}
							onSave={this.props.onSaveDocument && this.props.saveLocation === 'basicInfo'
								? (previewFile) => this.saveEditorDocument(previewFile)
								: undefined}
						/>
					) : activeActivity === 'canvas' ? (
						<ImageMapCanvasSettings
							canvasRef={this.canvasRef}
							onChange={onChange}
							sizeSchemes={sizeSchemes}
							activeSizeSchemeId={activeSizeSchemeId}
							onAddSizeScheme={onAddSizeScheme}
							onDeleteSizeScheme={onDeleteSizeScheme}
							onSaveSizeScheme={onSaveSizeScheme}
							onSelectSizeScheme={onSelectSizeScheme}
						/>
					) : activeActivity === 'assets' ? (
						<ImageMapItems
							ref={(ref: ImageMapItemsHandle | null) => {
								this.itemsRef = ref;
							}}
							canvasRef={this.canvasRef}
							descriptors={descriptors}
							mode="assets"
							selectedItem={selectedItem}
						/>
					) : null}
					{this.visibleActivities.some(activity => activity.key === 'fontLayouts') ? (
						<div className={`rde-imagemap-font-layouts-keepalive${activeActivity === 'fontLayouts' ? ' is-active' : ''}`}>
							<ImageMapFontLayouts
							shops={this.props.shops ?? []}
							defaultShopId={basicInfo.shopId}
							createFontLayout={this.props.createFontLayout}
							deleteFontLayout={this.props.deleteFontLayout}
							getCanvasLayers={this.getCanvasFontLayoutLayers}
							loadFontLayoutCategories={this.props.loadFontLayoutCategories}
							loadFontLayouts={this.props.loadFontLayouts}
							loadFontLayoutSizeOptions={this.props.loadFontLayoutSizeOptions}
							onSelectFontLayout={this.applyFontLayout}
							saveFontLayout={this.props.saveFontLayout}
							sizeOptions={sizeSchemes.map(scheme => ({ id: scheme.id, label: scheme.label }))}
							sizeTemplateId={this.props.sizeTemplateId}
							syncFontLayoutSizeOptions={this.props.syncFontLayoutSizeOptions}
							updateFontLayout={this.props.updateFontLayout}
							/>
						</div>
					) : null}
				</div>
				<section className="rde-editor-workspace rde-imagemap-workspace">
					<div className="rde-editor-header-toolbar">
						<ImageMapHeaderToolbar canvasRef={this.canvasRef} selectedItem={selectedItem} />
					</div>
					<div className="rde-editor-canvas">
						<Canvas
							ref={this.setCanvasRef}
							className="rde-canvas"
							minZoom={1}
							maxZoom={500}
							objectOption={defaultOption}
							propertiesToInclude={propertiesToInclude}
							onLoad={this.handleCanvasLoad}
							onModified={onModified}
							onAdd={onAdd}
							onRemove={onRemove}
							onSelect={onSelect}
							onZoom={onZoom}
							onTooltip={onTooltip}
							onContext={onContext}
							onTransaction={onTransaction}
							canvasOption={{
								backgroundColor: canvasTheme.backgroundColor,
								selectionColor: canvasTheme.selectionColor,
							}}
							rulerOption={{
								enabled: true,
								backgroundColor: canvasTheme.rulerBackgroundColor,
								lineColor: canvasTheme.rulerLineColor,
								textColor: canvasTheme.rulerTextColor,
							}}
						/>
					</div>
					<EditorStatusBar
						left={
							<ImageMapFooterToolbar
								canvasRef={this.canvasRef}
								preview={preview}
								onChangePreview={onChangePreview}
								zoomRatio={zoomRatio}
							/>
						}
						center={<span>{summary.objectCount} 个对象</span>}
						right={
							<span className={summary.hasSelection ? 'rde-status-selected' : 'rde-status-ok'}>
								{summary.hasSelection ? <SelectOutlined /> : <CheckCircleOutlined />}
								{summary.hasSelection
									? `已选择${
											(
												{
													'i-text': '标记',
													textbox: '文本',
													image: '图片',
													gif: 'GIF',
													triangle: '三角形',
													rect: '矩形',
													circle: '圆形',
													cube: '立方体',
													polygon: '多边形',
													line: '直线',
													arrow: '箭头',
													chart: '图表',
													element: '元素',
													iframe: '内嵌页面',
													video: '视频',
													svg: 'SVG',
													map: '图片地图',
												} as Record<string, string>
											)[summary.selectedType] || summary.selectedType
										}`
									: '图片地图已就绪'}
							</span>
						}
					/>
				</section>
				<aside className="rde-editor-inspector">
					<ImageMapConfigurations
						canvasRef={this.canvasRef}
						fontOptions={fontOptions}
						fontFamiliesError={fontFamiliesError}
						fontFamiliesLoading={fontFamiliesLoading}
						onFontSearch={this.onTextFontSearch}
						onFontSelect={this.onTextFontSelect}
						onChange={onChange}
						selectedItem={selectedItem}
						onChangeAnimations={onChangeAnimations}
						onChangeStyles={onChangeStyles}
						onChangeDataSources={onChangeDataSources}
						animations={animations}
						styles={styles}
						dataSources={dataSources}
					/>
				</aside>
				<ImageMapPreview
					preview={preview}
					onChangePreview={() => onChangePreview(false)}
					onTooltip={onTooltip}
					onClick={onClick}
					objects={objects}
				/>
			</div>
		);

		return <Content title={title} content={content} loading={loading} className="" />;
	}
}

export default ImageMapEditor;
