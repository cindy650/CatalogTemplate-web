import { CheckCircleOutlined, FileImageOutlined, PictureOutlined, SaveOutlined, SelectOutlined } from '@ant-design/icons';
import { Badge, Button, Menu, Popconfirm, Spin, Tooltip, message } from 'antd';
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
	type ImageMapFontLayoutProductLoader,
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
import { serializeImageLayer } from '../../canvas/utils/imageSource';
import type { ImageMapTextGenerationRule } from './properties/GeneralProperty';

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
	'separateBleed',
	'horizontalBleed',
	'verticalBleed',
	'spineWidth',
	'spineBleed',
	'canvasRows',
	'canvasRowGap',
	'printGuides',
	'horizontalCentered',
	'verticalCentered',
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
	'imageLoadType',
	'innerPage',
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
	DRAWING: new Set(['polygon']),
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
	fontOptions: Array<{ key: string; value: string; label: string; family: string; filePath: string; aliases?: string[] }>;
	fontFamiliesError: string;
	fontFamiliesLoading: boolean;
	fontLayoutFontsLoading: boolean;
	fontLayoutLayersLoading: boolean;
	objectMeasurementRevision: number;
	editing: boolean;
	descriptors: DescriptorMap;
	objects?: any[];
	activeActivity: string;
	sizeSchemes: ImageMapSizeSchemeValue[];
	activeSizeSchemeId: string;
	savingDocument: boolean;
	textGenerationRules: ImageMapTextGenerationRule[];
	textGenerationRulesLoading: boolean;
}

export interface ImageMapEditorDocumentValue {
	basicInfo: ImageMapBasicInfoValue;
	sizeSchemes: ImageMapSizeSchemeValue[];
	activeSizeSchemeId: string;
	layers: ImageMapFontLayoutLayerData;
}

export interface ImageMapEditorProps {
	shops?: ImageMapShopOption[];
	/** Product used as the default font-layout filter when the editor is opened. */
	initialProductId?: ImageMapShopValue;
	initialBasicInfo?: Partial<ImageMapBasicInfoValue>;
	templatePreviewImage?: string;
	/** Initial Fabric document supplied by the embedding page. */
	initialLayers?: ImageMapFontLayoutLayerData;
	onBasicInfoChange?: (value: ImageMapBasicInfoValue) => void;
	initialSizeSchemes?: Partial<ImageMapSizeSchemeValue>[];
	initialActiveSizeSchemeId?: string;
	selectedFontLayoutId?: number;
	onSizeSchemesChange?: (value: ImageMapSizeSchemeValue[]) => void;
	onSizeSchemeLayersChange?: (sizeOptionId: string, layers: ImageMapFontLayoutLayerData) => void;
	onSaveSizeSchemes?: (value: ImageMapSizeSchemeValue[], activeSizeSchemeId: string, layers?: ImageMapFontLayoutLayerData, fontLayoutId?: number) => void | Promise<void>;
	createFontLayout?: ImageMapFontLayoutCreator;
	deleteFontLayout?: ImageMapFontLayoutDeleter;
	loadFontLayoutCategories?: ImageMapFontLayoutCategoryLoader;
	loadFontLayoutProducts?: ImageMapFontLayoutProductLoader;
	loadFontLayouts?: ImageMapFontLayoutLoader;
	loadFontLayoutSizeOptions?: ImageMapFontLayoutSizeOptionLoader;
	loadFontLayoutSize?: ImageMapFontLayoutSizeLoader;
	loadSizeSchemeLayers?: (sizeOptionId: string) => Promise<ImageMapFontLayoutLayerData | undefined>;
	loadTextFonts?: (search: string) => Promise<Array<{
		id: string;
		family: string;
		label: string;
		filePath: string;
		aliases?: string[];
	}>>;
	loadTextGenerationRules?: () => Promise<ImageMapTextGenerationRule[]>;
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
	/** Use a plain single-page workarea instead of cover/spine geometry. */
	innerPageMode?: boolean;
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

function getSerializedObjectCenter(object: Record<string, any>) {
	const rawWidth = Number(object.width ?? object.workareaWidth);
	const rawHeight = Number(object.height ?? object.workareaHeight);
	const width = (Number.isFinite(rawWidth) ? rawWidth : 0) * (Number.isFinite(Number(object.scaleX)) ? Number(object.scaleX) : 1);
	const height = (Number.isFinite(rawHeight) ? rawHeight : 0) * (Number.isFinite(Number(object.scaleY)) ? Number(object.scaleY) : 1);
	const left = Number(object.left) || 0;
	const top = Number(object.top) || 0;
	const originX = String(object.originX || 'left').toLowerCase();
	const originY = String(object.originY || 'top').toLowerCase();
	return {
		x: originX === 'center' ? left : originX === 'right' ? left - width / 2 : left + width / 2,
		y: originY === 'center' ? top : originY === 'bottom' ? top - height / 2 : top + height / 2,
	};
}

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
	private fitCanvasTimer?: number;
	private textFontRequestId = 0;
	/** The unique font_name is the primary key; duplicate aliases never replace it. */
	private fontAssets = new Map<string, string>();
	private fontSearchCache = new Map<string, ImageMapEditorState['fontOptions']>();
	private textFontSelectionRequestIds = new Map<string, number>();
	private textGenerationRulesRequest?: Promise<void>;
	private textGenerationRulesRequestId = 0;
	private fontLayoutLoadCount = 0;
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
		fontLayoutFontsLoading: false,
		fontLayoutLayersLoading: false,
		objectMeasurementRevision: 0,
		editing: false,
		descriptors: {},
		objects: undefined,
		activeActivity: this.initialActivity,
		sizeSchemes: this.initialSizeSchemes,
		activeSizeSchemeId: this.initialActiveSizeSchemeId,
		savingDocument: false,
		textGenerationRules: [],
		textGenerationRulesLoading: false,
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
			let initialLoad: Promise<void>;
			if (this.props.initialLayers) {
				this.setState({ fontLayoutLayersLoading: true });
				initialLoad = this.importFontLayoutLayers(this.props.initialLayers, true, handler, activeSizeScheme);
			} else if (this.props.loadSizeSchemeLayers) {
				this.setState({ fontLayoutLayersLoading: true });
				initialLoad = this.loadActiveSizeSchemeLayers(handler);
			} else if (
				this.selectedFontLayoutId !== undefined
				&& this.props.sizeTemplateId !== undefined
				&& this.props.loadFontLayoutSize
			) {
				initialLoad = this.loadActiveSizeSchemeFontLayout();
			} else {
				if (this.props.innerPageMode) {
					handler.workareaHandler.setInnerPageSize(activeSizeScheme);
				} else {
					handler.workareaHandler.setPrintDimensions({
						...activeSizeScheme,
						spineWidth: resolveImageMapSpineWidth(activeSizeScheme),
						canvasRows: 1,
					});
				}
				initialLoad = Promise.resolve();
			}
			void initialLoad.catch(error => {
				void message.error(error instanceof Error ? error.message : String(error));
			}).finally(() => {
				this.scheduleInitialFitCanvas(handler, () => {
					this.setState({ fontLayoutLayersLoading: false });
				});
			});
		} else {
			this.scheduleInitialFitCanvas(handler, () => {
				this.setState({ fontLayoutLayersLoading: false });
			});
		}
	};

	loadActiveSizeSchemeLayers = async (handlerOverride?: CanvasInstance['handler']) => {
		const sizeScheme = this.state.sizeSchemes.find(item => item.id === this.state.activeSizeSchemeId);
		if (!sizeScheme) return;
		if (sizeScheme.idIsPersisted === false) {
			const handler = handlerOverride ?? this.canvasRef?.handler;
			handler?.clear(false);
			if (handler && this.props.innerPageMode) handler.workareaHandler.setInnerPageSize(sizeScheme);
			else handler?.workareaHandler.setPrintDimensions({ ...sizeScheme, spineWidth: resolveImageMapSpineWidth(sizeScheme), canvasRows: 1 });
			return;
		}
		const directLayers = await this.props.loadSizeSchemeLayers?.(sizeScheme.id);
		if (directLayers !== undefined) {
			await this.importFontLayoutLayers(directLayers, true, handlerOverride, sizeScheme);
			return;
		}
		if (
			this.selectedFontLayoutId !== undefined
			&& this.props.sizeTemplateId !== undefined
			&& this.props.loadFontLayoutSize
		) {
			await this.loadActiveSizeSchemeFontLayout();
			return;
		}
		const handler = handlerOverride ?? this.canvasRef?.handler;
		if (handler && this.props.innerPageMode) handler.workareaHandler.setInnerPageSize(sizeScheme);
		else handler?.workareaHandler.setPrintDimensions({ ...sizeScheme, spineWidth: resolveImageMapSpineWidth(sizeScheme), canvasRows: 1 });
	};

	loadActiveSizeSchemeFontLayout = async () => {
		const layoutId = this.selectedFontLayoutId;
		const sizeTemplateId = this.props.sizeTemplateId;
		const sizeScheme = this.state.sizeSchemes.find(item => item.id === this.state.activeSizeSchemeId);
		const loadFontLayoutSize = this.props.loadFontLayoutSize;
		if (layoutId === undefined || sizeTemplateId === undefined || !sizeScheme || !loadFontLayoutSize) return;
		const requestId = ++this.sizeLayoutRequestId;
		this.setState({ fontLayoutLayersLoading: true });
		const result = await loadFontLayoutSize(layoutId, sizeTemplateId, sizeScheme.id);
		if (requestId !== this.sizeLayoutRequestId || !this.canvasRef) return;
		await this.importFontLayoutLayers(result.layers);
		if (result.message) {
			message.info(result.message);
		} else if (result.usingBaseLayers || result.layersSource === 'base') {
			message.info('当前规格暂无独立图层数据，已使用基础字体布局模板');
		}
	};

	scheduleInitialFitCanvas = (handler: CanvasInstance['handler'], onComplete?: () => void) => {
		if (this.fitCanvasTimer !== undefined) {
			window.clearTimeout(this.fitCanvasTimer);
		}
		this.fitCanvasTimer = window.setTimeout(() => {
			this.fitCanvasTimer = undefined;
			handler.zoomHandler.zoomToFit();
			const center = handler.canvas.getCenterPoint();
			handler.zoomHandler.zoomToPoint(center, handler.canvas.getZoom() * 0.96);
			handler.canvas.requestRenderAll();
			onComplete?.();
		}, 500);
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
		this.textGenerationRulesRequestId += 1;
		this.textFontSelectionRequestIds.clear();
		this.sizeLayoutRequestId += 1;
		if (this.fitCanvasTimer !== undefined) {
			window.clearTimeout(this.fitCanvasTimer);
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
			this.fontSearchCache.clear();
			this.fontAssets.clear();
			this.setState({ fontOptions: [], fontFamiliesError: '', fontFamiliesLoading: false });
		}
		if (prevProps.loadTextGenerationRules !== this.props.loadTextGenerationRules) {
			this.textGenerationRulesRequestId += 1;
			this.textGenerationRulesRequest = undefined;
			this.setState({ textGenerationRules: [], textGenerationRulesLoading: false });
		}
	}

	loadTextGenerationRules = async () => {
		const loader = this.props.loadTextGenerationRules;
		if (!loader || this.state.textGenerationRules.length || this.textGenerationRulesRequest) return this.textGenerationRulesRequest;
		const requestId = ++this.textGenerationRulesRequestId;
		this.setState({ textGenerationRulesLoading: true });
		const request = loader()
			.then(rules => {
				if (requestId === this.textGenerationRulesRequestId) this.setState({ textGenerationRules: rules, textGenerationRulesLoading: false });
			})
			.catch(() => {
				if (requestId === this.textGenerationRulesRequestId) this.setState({ textGenerationRules: [], textGenerationRulesLoading: false });
			})
			.finally(() => {
				if (requestId === this.textGenerationRulesRequestId) this.textGenerationRulesRequest = undefined;
			});
		this.textGenerationRulesRequest = request;
		return request;
	};

	loadTextFonts = async (search: string) => {
		const requestId = ++this.textFontRequestId;
		const loader = this.props.loadTextFonts;
		if (!loader) {
			this.setState({ fontOptions: [], fontFamiliesError: '', fontFamiliesLoading: false });
			return;
		}

		const query = search.trim();
		const cached = this.fontSearchCache.get(query.toLocaleLowerCase());
		if (cached) {
			cached.forEach(asset => this.cacheFontAsset(asset));
			this.setState({ fontOptions: cached, fontFamiliesError: '', fontFamiliesLoading: false });
			return;
		}
		this.setState({ fontFamiliesError: '', fontFamiliesLoading: true });
		try {
			const assets = await loader(query);
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
						aliases: asset.aliases,
					};
				});
			if (requestId === this.textFontRequestId) {
				fontOptions.forEach(asset => this.cacheFontAsset(asset));
				this.fontSearchCache.set(query.toLocaleLowerCase(), fontOptions);
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

	private cacheFontAsset = (asset: { family?: string; filePath?: string; aliases?: string[] }) => {
		const filePath = String(asset.filePath || '').trim();
		if (!filePath) return;
		const names = [asset.family, ...(asset.aliases || [])]
			.map(value => String(value || '').trim())
			.filter(Boolean);
		names.forEach(name => {
			const key = name.toLocaleLowerCase();
			if (!this.fontAssets.has(key) || key === String(asset.family || '').trim().toLocaleLowerCase()) {
				this.fontAssets.set(key, filePath);
			}
		});
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

	onTextFontSelect = async (font: { family: string; filePath: string; aliases?: string[] }) => {
		const family = font.family.trim();
		const filePath = font.filePath.trim();
		const target = this.canvasRef?.canvas.getActiveObject() as any;
		const targetId = target?.id ? String(target.id) : '';
		if (!family || !filePath || !target || !targetId || targetId === 'workarea') return false;
		const requestId = (this.textFontSelectionRequestIds.get(targetId) ?? 0) + 1;
		this.textFontSelectionRequestIds.set(targetId, requestId);
		try {
			await this.props.applyTextFont?.(family, filePath);
		} catch (error) {
			void message.error(error instanceof Error ? error.message : String(error));
			return false;
		}
		if (this.textFontSelectionRequestIds.get(targetId) !== requestId) return false;
		const currentTarget = this.canvasRef?.handler.getObjects().find(object => String(object.id) === targetId);
		if (!currentTarget) return false;
		this.cacheFontAsset(font);
		this.canvasRef?.handler.setByObject(currentTarget, 'fontUrl', filePath);
		this.canvasRef?.handler.setByObject(currentTarget, 'fontFamily', family);
		return true;
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
				if (target.superType === 'text' || target.type === 'textbox') void this.loadTextGenerationRules();
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
			this.setState(state => ({ objectMeasurementRevision: state.objectMeasurementRevision + 1 }));
			if (!editing) {
				this.changeEditing(true);
			}
		}, 300),
		onZoom: (zoom: number) => {
			this.setState({ zoomRatio: zoom });
		},
		onExportError: (format: 'svg', error: Error) => {
			if (format === 'svg') void message.error(`SVG 导出失败：${error.message}`);
		},
		onExportWarning: (warnings: string[]) => {
			warnings.forEach(warning => void message.warning(warning, 5));
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
				const isShape = ['rect', 'triangle', 'circle'].includes(String(selectedItem?.type || '').toLowerCase());
				const unit = this.canvasRef?.handler.workarea?.unit;
				const factor = unit === 'cm' ? 96 / 2.54 : unit === 'mm' ? 96 / 25.4 : 96;
				this.canvasRef?.handler.scaleToResize(
					isShape ? Number(allValues.width) * factor : allValues.width,
					isShape ? Number(allValues.height) * factor : allValues.height,
				);
				return;
			}
			if (changedKey === 'angle') {
				this.canvasRef?.handler.rotate(allValues.angle);
				return;
			}
			if (changedKey === 'left') {
				selectedItem.set('horizontalCentered', false);
			}
			if (changedKey === 'top') {
				selectedItem.set('verticalCentered', false);
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
				const fontUrl = this.fontAssets.get(String(changedValue).trim().toLocaleLowerCase());
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
			if (this.props.innerPageMode && ['unit', 'sideWidth', 'sideHeight'].includes(changedKey)) {
				this.canvasRef?.handler.workareaHandler.setInnerPageSize(allValues);
				this.forceUpdate();
				return;
			}
			if (['unit', 'sideWidth', 'sideHeight', 'bleed', 'horizontalBleed', 'verticalBleed', 'spineWidth', 'spineBleed', 'paperThickness'].includes(changedKey)) {
				this.canvasRef?.handler.workareaHandler.setPrintDimensions(allValues);
				this.forceUpdate();
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
			const exportCheck = this.prepareTextLayersForExport();
			if (exportCheck.warnings.length) this.canvasHandlers.onExportWarning(exportCheck.warnings);
			if (exportCheck.blocked) {
				this.showLoading(false);
				return;
			}
			const objects = exportCheck.objects.filter(obj => !!obj.id);
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
			this.refreshInspectorAfterExport();
		},
		onSaveSVG: () => {
			this.canvasRef?.handler.saveCanvasSVG({
				name: this.state.basicInfo.templateName || '画布',
			});
			this.refreshInspectorAfterExport();
		},
		onSaveTextToSVG: () => {
			const exportPromise = this.canvasRef?.handler.saveCanvasTextToSVG({
				name: this.state.basicInfo.templateName || '画布',
			});
			void Promise.resolve(exportPromise).finally(() => this.refreshInspectorAfterExport());
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
			const activeSizeScheme = this.state.sizeSchemes.find(
				item => item.id === this.state.activeSizeSchemeId,
			);
			const workarea = this.canvasRef?.handler.workarea;
			let nextSizeSchemeNumber = this.state.sizeSchemes.length + 1;
			let nextSizeSchemeLabel = `新规格 ${nextSizeSchemeNumber}`;
			while (this.state.sizeSchemes.some(item => (
				item.id === nextSizeSchemeLabel || item.label.trim() === nextSizeSchemeLabel
			))) {
				nextSizeSchemeNumber += 1;
				nextSizeSchemeLabel = `新规格 ${nextSizeSchemeNumber}`;
			}
			const nextSizeScheme = createImageMapSizeScheme({
				...(this.props.innerPageMode ? {
					unit: 'in',
					sideWidth: 9,
					sideHeight: 6,
					bleed: 0,
					spineWidth: 0,
					spineBleed: 0,
					pageCount: 1,
					pageCountOptions: [1],
				} : activeSizeScheme),
				id: undefined,
				idIsPersisted: false,
				label: nextSizeSchemeLabel,
				...(this.props.innerPageMode ? {} : {
					unit: workarea?.unit ?? activeSizeScheme?.unit,
					sideWidth: workarea?.sideWidth ?? activeSizeScheme?.sideWidth,
					sideHeight: workarea?.sideHeight ?? activeSizeScheme?.sideHeight,
					bleed: workarea?.bleed ?? activeSizeScheme?.bleed,
					separateBleed: activeSizeScheme?.separateBleed ?? workarea?.separateBleed,
					horizontalBleed: activeSizeScheme?.horizontalBleed ?? workarea?.horizontalBleed ?? workarea?.bleed ?? activeSizeScheme?.bleed,
					verticalBleed: activeSizeScheme?.verticalBleed ?? workarea?.verticalBleed ?? workarea?.bleed ?? activeSizeScheme?.bleed,
					canvasRowGap: workarea?.canvasRowGap ?? activeSizeScheme?.canvasRowGap,
					spineWidth: activeSizeScheme?.spineWidth ?? workarea?.spineWidth,
					spineBleed: workarea?.spineBleed ?? activeSizeScheme?.spineBleed,
					paperThickness: activeSizeScheme?.paperThickness,
				}),
			});
			const sizeSchemes = [...this.state.sizeSchemes, nextSizeScheme];
			this.changeEditing(true);
			this.setState({
				sizeSchemes,
				activeSizeSchemeId: nextSizeScheme.id,
				selectedItem: null,
				animations: [],
				styles: [],
				dataSources: [],
			});
			// A new size starts with an empty variant. Keep the workarea, but remove
			// all content so the old size's layers cannot be saved accidentally.
			this.sizeLayoutRequestId += 1;
			this.canvasRef?.handler.clear(false);
			if (this.props.innerPageMode) {
				// Workarea is intentionally retained for the new canvas, but its
				// background image belongs to the previous size and must not leak.
				void this.canvasRef?.handler.workareaHandler.setImage('', true);
				this.canvasRef?.handler.workareaHandler.setInnerPageSize(nextSizeScheme);
			}
			else this.canvasRef?.handler.workareaHandler.setPrintDimensions({ ...nextSizeScheme, spineWidth: resolveImageMapSpineWidth(nextSizeScheme) });
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
				let layers: ImageMapFontLayoutLayerData;
				try {
					layers = this.getCanvasFontLayoutLayers(true);
				} catch (error) {
					void message.error(error instanceof Error ? error.message : String(error));
					return;
				}
				void Promise.resolve(this.props.onSaveSizeSchemes?.(
					sizeSchemes,
					savedSizeScheme.id,
					layers,
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
					if (this.props.innerPageMode) this.canvasRef?.handler.workareaHandler.setInnerPageSize(nextActiveSizeScheme);
					else this.canvasRef?.handler.workareaHandler.setPrintDimensions({ ...nextActiveSizeScheme, spineWidth: resolveImageMapSpineWidth(nextActiveSizeScheme) });
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
			if (this.state.activeSizeSchemeId !== activeSizeSchemeId) {
				this.props.onSizeSchemeLayersChange?.(this.state.activeSizeSchemeId, this.getCanvasFontLayoutLayers());
			}
			this.changeEditing(true);
			this.setState({ activeSizeSchemeId });
			const layoutId = this.selectedFontLayoutId;
			const sizeTemplateId = this.props.sizeTemplateId;
			const loadFontLayoutSize = this.props.loadFontLayoutSize;
			if (this.props.loadSizeSchemeLayers) {
				const requestId = ++this.sizeLayoutRequestId;
				this.setState({ fontLayoutLayersLoading: true });
				void this.props.loadSizeSchemeLayers(sizeScheme.id).then(async directLayers => {
					if (requestId !== this.sizeLayoutRequestId || !this.canvasRef) return;
					if (sizeScheme.idIsPersisted === false) {
						this.canvasRef.handler.clear(false);
						if (this.props.innerPageMode) this.canvasRef.handler.workareaHandler.setInnerPageSize(sizeScheme);
						else this.canvasRef.handler.workareaHandler.setPrintDimensions({
							...sizeScheme,
							spineWidth: resolveImageMapSpineWidth(sizeScheme),
							canvasRows: 1,
						});
						return;
					}
					if (directLayers !== undefined) {
						await this.importFontLayoutLayers(directLayers, false, undefined, sizeScheme);
						return;
					}
					if (layoutId !== undefined && sizeTemplateId !== undefined && loadFontLayoutSize) {
						const result = await loadFontLayoutSize(layoutId, sizeTemplateId, sizeScheme.id);
						if (requestId !== this.sizeLayoutRequestId || !this.canvasRef) return;
						await this.importFontLayoutLayers(result.layers, false, undefined, sizeScheme);
						if (result.message) message.info(result.message);
						else if (result.usingBaseLayers || result.layersSource === 'base') message.info('当前规格暂无独立图层数据，已使用基础字体布局模板');
						return;
					}
					if (this.props.innerPageMode) this.canvasRef.handler.workareaHandler.setInnerPageSize(sizeScheme);
					else this.canvasRef.handler.workareaHandler.setPrintDimensions({ ...sizeScheme, spineWidth: resolveImageMapSpineWidth(sizeScheme), canvasRows: 1 });
				}).catch(error => {
					if (requestId === this.sizeLayoutRequestId) message.error(error instanceof Error ? error.message : String(error));
				}).finally(() => {
					if (requestId === this.sizeLayoutRequestId) {
						this.canvasRef?.handler.canvas.requestRenderAll();
						this.setState({ fontLayoutLayersLoading: false });
					}
				});
				return;
			}
			if (layoutId === undefined || sizeTemplateId === undefined || !loadFontLayoutSize) {
				if (this.props.innerPageMode) this.canvasRef?.handler.workareaHandler.setInnerPageSize(sizeScheme);
				else this.canvasRef?.handler.workareaHandler.setPrintDimensions({ ...sizeScheme, spineWidth: resolveImageMapSpineWidth(sizeScheme), canvasRows: 1 });
				return;
			}
			const requestId = ++this.sizeLayoutRequestId;
			this.setState({ fontLayoutLayersLoading: true });
			void loadFontLayoutSize(layoutId, sizeTemplateId, sizeScheme.id).then(result => {
				if (requestId !== this.sizeLayoutRequestId || !this.canvasRef) return;
				return this.importFontLayoutLayers(result.layers, false, undefined, sizeScheme).then(() => {
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
			}).finally(() => {
				if (requestId === this.sizeLayoutRequestId) {
					this.canvasRef?.handler.canvas.requestRenderAll();
					const finishLoading = () => this.setState({ fontLayoutLayersLoading: false });
					if (typeof window.requestAnimationFrame === 'function') {
						window.requestAnimationFrame(finishLoading);
					} else {
						finishLoading();
					}
				}
			});
		},
	};

	transformList = () => Object.values(this.state.descriptors).reduce<any[]>((prev, curr) => prev.concat(curr), []);

	showLoading = (loading: boolean) => {
		this.setState({ loading });
	};

	/** Refresh inspector values after export-time text fitting mutates Fabric objects. */
	refreshInspectorAfterExport = () => {
		this.setState(state => ({ objectMeasurementRevision: state.objectMeasurementRevision + 1 }));
	};

	prepareTextLayersForExport = () => {
		const result = this.canvasRef?.handler.prepareTextLayersForExport()
			|| { warnings: [], blocked: false, objects: [] };
		this.refreshInspectorAfterExport();
		return result;
	};

	changeEditing = (editing: boolean) => {
		this.setState({ editing });
	};

	getCanvasFontLayoutLayers = (prepareText = false): ImageMapFontLayoutLayerData => {
		const canvasRef = this.canvasRef;
		const exportCheck = prepareText
			? canvasRef?.handler.prepareTextLayersForExport()
			: undefined;
		if (prepareText) this.refreshInspectorAfterExport();
		if (exportCheck?.warnings.length) this.canvasHandlers.onExportWarning(exportCheck.warnings);
		if (exportCheck?.blocked) throw new Error('存在文字图层超出安全区域，已阻止保存');
		const canvasObjects = exportCheck?.objects ?? canvasRef?.handler.exportJSON() ?? [];
		const serializedObjects = canvasObjects.filter(obj => !!obj.id)
			.map(object => serializeImageLayer(object, { preserveWorkareaSource: Boolean(this.props.innerPageMode) }));
		return {
			// Persist Fabric's original scene coordinates. The workarea remains
			// part of the document for preview cropping, but is not API canvas
			// configuration and must not be used to overwrite the active editor.
			objects: this.props.innerPageMode
				? serializedObjects.map(object => object.id === 'workarea' ? { ...object, innerPage: true } : object)
				: serializedObjects,
			animations: this.state.animations,
			styles: this.state.styles,
			dataSources: this.state.dataSources,
		};
	};

	createEmptyCanvasLayers = (canvasRows: 1 | 2): ImageMapFontLayoutLayerData => {
		const handler = this.canvasRef?.handler;
		const sizeScheme = this.state.sizeSchemes.find(item => item.id === this.state.activeSizeSchemeId);
		if (!handler || !sizeScheme) {
			return { objects: [], animations: [], styles: [], dataSources: [] };
		}
		const workarea = this.getCanvasFontLayoutLayers().objects.find(object => object.id === 'workarea');
		if (!workarea) {
			return { objects: [], animations: [], styles: [], dataSources: [] };
		}
		const dimensions = handler.workareaHandler.getPrintDimensionData({
			...sizeScheme,
			spineWidth: canvasRows === 2 ? 0 : resolveImageMapSpineWidth(sizeScheme),
			spineBleed: canvasRows === 2 ? 0 : sizeScheme.spineBleed,
			canvasRows,
		});
		return {
			objects: [{
				...workarea,
				...dimensions,
				width: dimensions.workareaWidth,
				height: dimensions.workareaHeight,
				scaleX: 1,
				scaleY: 1,
			}],
			animations: [],
			styles: [],
			dataSources: [],
		};
	};

	getEditorDocument = (): ImageMapEditorDocumentValue => ({
		basicInfo: this.state.basicInfo,
		sizeSchemes: this.state.sizeSchemes,
		activeSizeSchemeId: this.state.activeSizeSchemeId,
		layers: this.getCanvasFontLayoutLayers(true),
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
	preloadFontLayoutFonts = async (objects: any[]) => {
		const applyTextFont = this.props.applyTextFont;
		const fonts = new Map<string, { family: string; filePath: string }>();
		const collectFonts = (object: any) => {
			if (!object || typeof object !== 'object') return;
			const family = typeof object.fontFamily === 'string' ? object.fontFamily.trim() : '';
			const filePath = typeof object.fontUrl === 'string' ? object.fontUrl.trim() : '';
			if (family && filePath) {
				fonts.set(`${family}\u0000${filePath}`, { family, filePath });
			}
			if (Array.isArray(object.objects)) {
				object.objects.forEach(collectFonts);
			}
		};
		objects.forEach(collectFonts);
		if (fonts.size === 0) return;
		if (!applyTextFont) {
			throw new Error('编辑器未配置字体加载器，无法加载图层字体。');
		}
		this.fontLayoutLoadCount += 1;
		if (this.fontLayoutLoadCount === 1) {
			this.setState({ fontLayoutFontsLoading: true });
		}
		try {
			const results = await Promise.allSettled(Array.from(fonts.values(), async ({ family, filePath }) => {
				try {
					await applyTextFont(family, filePath);
					this.fontAssets.set(family, filePath);
				} catch (error) {
					const reason = error instanceof Error ? error.message : String(error);
					throw new Error(`字体“${family}”加载失败：${reason}`);
				}
			}));
			const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
			if (failure) throw failure.reason;
		} finally {
			this.fontLayoutLoadCount = Math.max(0, this.fontLayoutLoadCount - 1);
			if (this.fontLayoutLoadCount === 0) {
				this.setState({ fontLayoutFontsLoading: false });
			}
		}
	};

	importFontLayoutLayers = async (
		layers: ImageMapFontLayoutLayerData,
		applyWorkareaAppearance = false,
		handlerOverride?: CanvasInstance['handler'],
		sizeSchemeOverride?: ImageMapSizeSchemeValue,
	) => {
		const handler = handlerOverride ?? this.canvasRef?.handler;
		if (!handler) return;
		const viewportTransform = [...handler.canvas.viewportTransform] as typeof handler.canvas.viewportTransform;
		// The selected size remains authoritative for physical dimensions. The
		// layout workarea contributes only its visual row count and appearance.
		const layerObjects = Array.isArray(layers.objects) ? layers.objects : [];
		const serializedWorkarea = layerObjects.find(object => object.id === 'workarea');
		const activeSizeScheme = sizeSchemeOverride
			?? this.state.sizeSchemes.find(item => item.id === this.state.activeSizeSchemeId);
		if (this.props.innerPageMode && activeSizeScheme) {
			handler.workareaHandler.setInnerPageSize(activeSizeScheme);
		} else if (activeSizeScheme) {
			const usesSeparateBleed = serializedWorkarea?.separateBleed === true || activeSizeScheme.separateBleed === true;
			const restoredSizeScheme = usesSeparateBleed ? {
				...activeSizeScheme,
				separateBleed: true,
				// Physical bleed belongs to the selected size scheme. A font layout's
				// workarea may contain legacy single-row values and must not halve or
				// otherwise overwrite the scheme's per-row bleed settings.
				horizontalBleed: Number(activeSizeScheme.horizontalBleed ?? activeSizeScheme.bleed),
				verticalBleed: Number(activeSizeScheme.verticalBleed ?? activeSizeScheme.bleed),
			} : activeSizeScheme;
			handler.workareaHandler.setPrintDimensions({
				...restoredSizeScheme,
				spineWidth: resolveImageMapSpineWidth(restoredSizeScheme),
					canvasRows: serializedWorkarea?.canvasRows === 2 ? 2 : 1,
					canvasRowGap: Number(serializedWorkarea?.canvasRowGap ?? activeSizeScheme.canvasRowGap ?? 0),
			});
			if (usesSeparateBleed && (
				activeSizeScheme.separateBleed !== true
				|| activeSizeScheme.horizontalBleed !== restoredSizeScheme.horizontalBleed
				|| activeSizeScheme.verticalBleed !== restoredSizeScheme.verticalBleed
			)) {
				this.setState(state => ({
					sizeSchemes: state.sizeSchemes.map(item => item.id === restoredSizeScheme.id ? restoredSizeScheme : item),
				}));
			}
		}
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
		if (serializedWorkarea) {
			// The workarea is not imported, so align content from the saved scene
			// center to the current one before adding objects to the canvas.
			const savedCenter = getSerializedObjectCenter(serializedWorkarea);
			const currentCenter = handler.workarea.getCenterPoint();
			const deltaX = currentCenter.x - savedCenter.x;
			const deltaY = currentCenter.y - savedCenter.y;
			if (deltaX !== 0 || deltaY !== 0) {
				objects.forEach(object => {
					if (typeof object.left === 'number') object.left += deltaX;
					if (typeof object.top === 'number') object.top += deltaY;
				});
			}
		}
		await this.preloadFontLayoutFonts(objects);
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
		this.setState({ fontLayoutLayersLoading: true });
		try {
			await this.importFontLayoutLayers(layout.layers);
			this.setState({ editing: true });
			this.canvasRef.handler.canvas.requestRenderAll();
			if (typeof window.requestAnimationFrame === 'function') {
				await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
			}
		} finally {
			this.setState({ fontLayoutLayersLoading: false });
		}
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
			textGenerationRules,
			textGenerationRulesLoading,
			fontLayoutFontsLoading,
			fontLayoutLayersLoading,
			objectMeasurementRevision,
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
			onSaveTextToSVG,
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
				<Tooltip title="text-to-svg">
					<Button
						className="rde-action-btn"
						type="text"
						size="small"
						icon={<FileImageOutlined />}
						onClick={onSaveTextToSVG}
					>
						导出转曲svg
					</Button>
				</Tooltip>
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
						<span className="rde-editor-breadcrumb-section">模板编辑</span>
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
							innerPageMode={this.props.innerPageMode}
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
							createEmptyCanvasLayers={this.createEmptyCanvasLayers}
							deleteFontLayout={this.props.deleteFontLayout}
							getCanvasLayers={() => this.getCanvasFontLayoutLayers(true)}
							loadFontLayoutCategories={this.props.loadFontLayoutCategories}
							loadFontLayoutProducts={this.props.loadFontLayoutProducts}
							defaultProductId={this.props.initialProductId}
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
							onExportError={this.canvasHandlers.onExportError}
							onExportWarning={this.canvasHandlers.onExportWarning}
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
						{fontLayoutLayersLoading || fontLayoutFontsLoading ? (
							<div className="rde-font-loading-overlay" role="status" aria-live="polite">
								<Spin size="large" />
								<span>{fontLayoutLayersLoading ? '正在加载图层...' : '正在加载字体...'}</span>
							</div>
						) : null}
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
						objectMeasurementRevision={objectMeasurementRevision}
						fontOptions={fontOptions}
						fontFamiliesError={fontFamiliesError}
						fontFamiliesLoading={fontFamiliesLoading}
						onCenterHorizontally={() => this.canvasRef?.handler.alignmentHandler.centerHorizontallyInRegion()}
						onCenterVertically={() => this.canvasRef?.handler.alignmentHandler.centerVerticallyInRegion()}
						onFontSearch={this.onTextFontSearch}
						onFontSelect={this.onTextFontSelect}
						textGenerationRules={textGenerationRules}
						textGenerationRulesLoading={textGenerationRulesLoading}
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
