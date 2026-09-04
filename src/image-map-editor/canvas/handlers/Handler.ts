import * as fabric from 'fabric';
import { union } from 'lodash-es';
import { v4 as uuid } from 'uuid';
import warning from 'warning';
import CanvasObject from '../CanvasObject';
import { defaults } from '../constants';
import {
	CanvasActions,
	CanvasOption,
	FabricCanvas,
	FabricElement,
	FabricGroup,
	FabricImage,
	FabricObject,
	FabricObjectOption,
	FabricObjects,
	GridOption,
	GuidelineOption,
	InteractionMode,
	RulerOption,
	WorkareaSafeDistance,
	WorkareaObject,
	WorkareaOption,
} from '../models';
import { SvgObject } from '../objects/Svg';
import { installTextWordSpacingSupport } from '../utils/textSpacing';
import AlignmentHandler from './AlignmentHandler';
import AnimationHandler from './AnimationHandler';
import ChartHandler from './ChartHandler';
import ContextMenuHandler from './ContextmenuHandler';
import CropHandler from './CropHandler';
import CustomHandler from './CustomHandler';
import DrawingHandler from './DrawingHandler';
import ElementHandler from './ElementHandler';
import EventHandler from './EventHandler';
import GridHandler from './GridHandler';
import GuidelineHandler from './GuidelineHandler';
import ImageHandler from './ImageHandler';
import InteractionHandler from './InteractionHandler';
import RulerHandler from './RulerHandler';
import ShortcutHandler from './ShortcutHandler';
import SpacingGuidelineHandler from './SpacingGuidelineHandler';
import TooltipHandler from './TooltipHandler';
import TransactionHandler, { TransactionEvent } from './TransactionHandler';
import WorkareaHandler from './WorkareaHandler';
import ZoomHandler from './ZoomHandler';
import { exportCorelCompatibleSvg } from '../utils/exportCorelCompatibleSvg';
import { exportTextToSvg } from '../utils/exportTextToSvg';
import { getImageSource } from '../utils/imageSource';
import { resolveFabricObjectType } from './resolveFabricObjectType';

installTextWordSpacingSupport();

export interface HandlerCallback {
	/**
	 * When has been added object in Canvas, Called function
	 *
	 */
	onAdd?: (object: FabricObject) => void;
	/**
	 * Return contextmenu element
	 *
	 */
	onContext?: (e: MouseEvent, target?: FabricObject) => Promise<any> | any;
	/**
	 * Return tooltip element
	 *
	 */
	onTooltip?: (target?: FabricObject) => Promise<any> | any;
	/**
	 * When zoom, Called function
	 */
	onZoom?: (zoomRatio: number) => void;
	/**
	 * When clicked object, Called function
	 *
	 */
	onClick?: (canvas: FabricCanvas, target: FabricObject, subTarget?: FabricObject) => void;
	/**
	 * When moving object, called function
	 *
	 */
	onMoving?: (target: FabricObject) => void;
	/**
	 * When double clicked object, Called function
	 *
	 */
	onDblClick?: (canvas: FabricCanvas, target: FabricObject) => void;
	/**
	 * When modified object, Called function
	 */
	onModified?: (target: Partial<FabricObject>) => void;
	/**
	 * When select object, Called function
	 *
	 */
	onSelect?: (target: FabricObject | null) => void;
	/**
	 * When has been removed object in Canvas, Called function
	 *
	 */
	onRemove?: (target: FabricObject) => void;
	/**
	 * When has been undo or redo, Called function
	 *
	 */
	onTransaction?: (transaction: TransactionEvent) => void;
	/**
	 * When has been changed interaction mode, Called function
	 *
	 */
	onInteraction?: (interactionMode: InteractionMode) => void;
	/**
	 * When canvas has been loaded
	 *
	 */
	onLoad?: (handler: Handler, canvas?: fabric.Canvas) => void;
	onExportError?: (format: 'svg', error: Error) => void;
	onExportWarning?: (warnings: string[]) => void;
}

export interface HandlerOption {
	/**
	 * Canvas id
	 * @type {string}
	 */
	id?: string;
	/**
	 * Canvas object
	 * @type {FabricCanvas}
	 */
	canvas?: FabricCanvas;
	/**
	 * Canvas parent element
	 * @type {HTMLDivElement}
	 */
	container?: HTMLDivElement;
	/**
	 * Canvas editable
	 * @type {boolean}
	 */
	editable?: boolean;
	/**
	 * Canvas interaction mode
	 * @type {InteractionMode}
	 */
	interactionMode?: InteractionMode;
	/**
	 * Persist properties for object
	 * @type {string[]}
	 */
	propertiesToInclude?: string[];
	/**
	 * Minimum zoom ratio
	 * @type {number}
	 */
	minZoom?: number;
	/**
	 * Maximum zoom ratio
	 * @type {number}
	 */
	maxZoom?: number;
	/**
	 * Zoom ratio step
	 * @type {number}
	 */
	zoomStep?: number;
	/**
	 * Workarea option
	 * @type {WorkareaOption}
	 */
	workareaOption?: WorkareaOption;
	/**
	 * Canvas option
	 * @type {CanvasOption}
	 */
	canvasOption?: CanvasOption;
	/**
	 * Grid option
	 * @type {GridOption}
	 */
	gridOption?: GridOption;
	/**
	 * Canvas ruler option
	 * @type {RulerOption}
	 */
	rulerOption?: RulerOption;
	/**
	 * Default option for Fabric Object
	 * @type {FabricObjectOption}
	 */
	objectOption?: FabricObjectOption;
	/**
	 * Guideline option
	 * @type {GuidelineOption}
	 */
	guidelineOption?: GuidelineOption;
	/**
	 * ActiveSelection option
	 * @type {Partial<FabricObjectOption<fabric.ActiveSelection>>}
	 */
	activeSelectionOption?: Partial<FabricObjectOption<fabric.ActiveSelection>>;
	/**
	 * Canvas width
	 * @type {number}
	 */
	width?: number;
	/**
	 * Canvas height
	 * @type {number}
	 */
	height?: number;
	/**
	 * Configuration for enabling/disabling specific user actions in the canvas.
	 * @type {CanvasActions}
	 */
	canvasActions?: CanvasActions;
	/**
	 * Append custom objects
	 * @type {{ [key: string]: any }}
	 */
	fabricObjects?: FabricObjects;
	/**
	 * Determines if path highlighting should be triggered by mouse events.
	 *
	 * @type {boolean}
	 */
	shouldHighlightPathOnSelect?: boolean;
	handlers?: { [key: string]: CustomHandler };
	[key: string]: any;
}

export type HandlerOptions = HandlerOption & HandlerCallback;

/**
 * Main handler for Canvas
 * @class Handler
 * @implements {HandlerOptions}
 */
class Handler implements HandlerOptions {
	public id: string;
	public canvas: FabricCanvas;
	public workarea: WorkareaObject;
	public container: HTMLDivElement;
	public editable: boolean;
	public interactionMode: InteractionMode;
	public minZoom: number;
	public maxZoom: number;
	public zoomStep: number = 0.05;
	public propertiesToInclude?: string[] = defaults.propertiesToInclude;
	public workareaOption?: WorkareaOption = defaults.workareaOption;
	public canvasOption?: CanvasOption = defaults.canvasOption;
	public gridOption?: GridOption = defaults.gridOption;
	public rulerOption?: RulerOption = defaults.rulerOption;
	public objectOption?: FabricObjectOption = defaults.objectOption;
	public guidelineOption?: GuidelineOption = defaults.guidelineOption;
	public canvasActions?: CanvasActions = defaults.canvasActions;
	public activeSelectionOption?: Partial<FabricObjectOption<fabric.ActiveSelection>> = defaults.activeSelectionOption;
	public fabricObjects?: FabricObjects = CanvasObject;

	public width?: number;
	public height?: number;

	public onAdd?: (object: FabricObject) => void;
	public onContext?: (e: MouseEvent, target?: FabricObject) => Promise<any>;
	public onTooltip?: (target?: FabricObject) => Promise<any>;
	public onZoom?: (zoomRatio: number) => void;
	public onClick?: (canvas: FabricCanvas, target: FabricObject, actionTarget?: FabricObject) => void;
	public onDblClick?: (canvas: FabricCanvas, target: FabricObject) => void;
	public onModified?: (target: Partial<FabricObject>) => void;
	public onMoving?: (target: FabricObject) => void;
	public onSelect?: (target: FabricObject | null) => void;
	public onRemove?: (target: FabricObject) => void;
	public onTransaction?: (transaction: TransactionEvent) => void;
	public onInteraction?: (interactionMode: InteractionMode) => void;
	public onLoad?: (handler: Handler, canvas?: fabric.Canvas) => void;
	public onExportError?: (format: 'svg', error: Error) => void;
	public onExportWarning?: (warnings: string[]) => void;

	public imageHandler: ImageHandler;
	public chartHandler: ChartHandler;
	public elementHandler: ElementHandler;
	public cropHandler: CropHandler;
	public animationHandler: AnimationHandler;
	public contextmenuHandler: ContextMenuHandler;
	public tooltipHandler: TooltipHandler;
	public zoomHandler: ZoomHandler;
	public workareaHandler: WorkareaHandler;
	public interactionHandler: InteractionHandler;
	public transactionHandler: TransactionHandler;
	public gridHandler: GridHandler;
	public rulerHandler: RulerHandler;
	public alignmentHandler: AlignmentHandler;
	public guidelineHandler: GuidelineHandler;
	public spacingGuidelineHandler: SpacingGuidelineHandler;
	public eventHandler: EventHandler;
	public drawingHandler: DrawingHandler;
	public shortcutHandler: ShortcutHandler;
	public handlers: { [key: string]: CustomHandler } = {};

	public objectMap: Record<string, FabricObject> = {};
	public objects: FabricObject[];
	public activeLine?: any;
	public activeShape?: any;
	public zoom = 1;
	public prevTarget?: FabricObject;
	public target?: FabricObject;
	public pointArray?: any[];
	public lineArray?: any[];
	public isCut = false;
	public shouldHighlightPathOnSelect = false;

	private batchDepth = 0;
	private batchRenderOnAddRemove = true;
	private isRequsetAnimFrame = false;
	private requestFrame: any;
	/**
	 * Copied object
	 *
	 * @private
	 * @type {*}
	 */
	private clipboard: any;

	constructor(options: HandlerOptions) {
		this.initialize(options);
	}

	/**
	 * Initialize handler
	 *
	 * @author salgum1114
	 * @param {HandlerOptions} options
	 */
	public initialize(options: HandlerOptions) {
		this.initOption(options);
		this.initCallback(options);
		this.initHandler();
	}

	/**
	 * Init class fields
	 * @param {HandlerOptions} options
	 */
	public initOption = (options: HandlerOptions) => {
		this.id = options.id;
		this.canvas = options.canvas;
		this.container = options.container;
		this.editable = options.editable;
		this.interactionMode = options.interactionMode;
		this.minZoom = options.minZoom;
		this.maxZoom = options.maxZoom;
		this.zoomStep = options.zoomStep || 0.05;
		this.width = options.width;
		this.height = options.height;
		this.objects = [];
		this.shouldHighlightPathOnSelect = options.shouldHighlightPathOnSelect;
		this.setPropertiesToInclude(options.propertiesToInclude);
		this.setWorkareaOption(options.workareaOption);
		this.setCanvasOption(options.canvasOption);
		this.setCanvasActions(options.canvasActions);
		this.setGridOption(options.gridOption);
		this.setRulerOption(options.rulerOption);
		this.setObjectOption(options.objectOption);
		this.setFabricObjects(options.fabricObjects);
		this.setGuidelineOption(options.guidelineOption);
		this.setActiveSelectionOption(options.activeSelectionOption);
	};

	/**
	 * Initialize callback
	 * @param {HandlerOptions} options
	 */
	public initCallback = (options: HandlerOptions) => {
		this.onAdd = options.onAdd;
		this.onTooltip = options.onTooltip;
		this.onZoom = options.onZoom;
		this.onContext = options.onContext;
		this.onClick = options.onClick;
		this.onModified = options.onModified;
		this.onMoving = options.onMoving;
		this.onDblClick = options.onDblClick;
		this.onSelect = options.onSelect;
		this.onRemove = options.onRemove;
		this.onTransaction = options.onTransaction;
		this.onInteraction = options.onInteraction;
		this.onLoad = options.onLoad;
		this.onExportError = options.onExportError;
		this.onExportWarning = options.onExportWarning;
	};

	/**
	 * Initialize handlers
	 *
	 */
	public initHandler = () => {
		this.workareaHandler = new WorkareaHandler(this);
		this.imageHandler = new ImageHandler(this);
		this.chartHandler = new ChartHandler(this);
		this.elementHandler = new ElementHandler(this);
		this.cropHandler = new CropHandler(this);
		this.animationHandler = new AnimationHandler(this);
		this.contextmenuHandler = new ContextMenuHandler(this);
		this.tooltipHandler = new TooltipHandler(this);
		this.zoomHandler = new ZoomHandler(this, this.zoomStep);
		this.interactionHandler = new InteractionHandler(this);
		this.transactionHandler = new TransactionHandler(this);
		this.gridHandler = new GridHandler(this);
		this.rulerHandler = new RulerHandler(this);
		this.alignmentHandler = new AlignmentHandler(this);
		this.guidelineHandler = new GuidelineHandler(this);
		this.spacingGuidelineHandler = new SpacingGuidelineHandler(this);
		this.eventHandler = new EventHandler(this);
		this.drawingHandler = new DrawingHandler(this);
		this.shortcutHandler = new ShortcutHandler(this);
		this.rulerHandler.layoutViewport();
	};

	/**
	 * Get primary object
	 * @returns {FabricObject[]}
	 */
	public getObjects = (): FabricObject[] => {
		const objects = this.canvas.getObjects().filter((obj: FabricObject) => {
			if (obj.id === 'workarea') {
				return false;
			} else if (!obj.id) {
				return false;
			}
			return true;
		}) as FabricObject[];
		if (objects.length) {
			this.objectMap = objects.reduce((p, c) => Object.assign(p, { [c.id]: c }), {});
		} else {
			this.objectMap = {};
		}
		return objects;
	};

	/**
	 * Run multiple canvas mutations with one object-index refresh and render.
	 */
	public runBatch<T>(operation: () => T): T {
		const rootBatch = this.batchDepth === 0;
		if (rootBatch) {
			this.batchRenderOnAddRemove = this.canvas.renderOnAddRemove;
			this.canvas.renderOnAddRemove = false;
		}
		this.batchDepth += 1;

		try {
			return operation();
		} finally {
			this.batchDepth -= 1;
			if (rootBatch) {
				this.canvas.renderOnAddRemove = this.batchRenderOnAddRemove;
				this.objects = this.getObjects();
				this.syncRequestAnimFrame();
				this.canvas.requestRenderAll();
			}
		}
	}

	public isBatching() {
		return this.batchDepth > 0;
	}

	private refreshAfterMutation() {
		if (!this.isBatching()) {
			this.objects = this.getObjects();
		}
	}

	private syncRequestAnimFrame() {
		if (this.objects.some(object => object.type === 'gif')) {
			this.startRequestAnimFrame();
		} else {
			this.stopRequestAnimFrame();
		}
	}

	public bindObjectEvents(object: FabricObject) {
		if (!this.editable && object.superType !== 'element') {
			object.on('mousedown', this.eventHandler.object.mousedown);
		}
		if (object.dblclick) {
			object.on('mousedblclick', this.eventHandler.object.mousedblclick);
		}
	}

	/**
	 * Set key pair
	 * @param {keyof FabricObject} key
	 * @param {*} value
	 * @returns
	 */
	public set = (key: keyof FabricObject, value: any) => {
		const activeObject = this.canvas.getActiveObject() as FabricObject;
		if (!activeObject) {
			return;
		}
		if (activeObject.type === 'svg' && (key === 'fill' || key === 'stroke')) {
			(activeObject as FabricGroup).getObjects().forEach(obj => obj.set(key, value));
		}
		activeObject.set(key as any, value);
		if (
			key === 'fontFamily'
			|| key === 'lineHeight'
			|| key === 'charSpacing'
			|| key === 'wordSpacing'
		) {
			(activeObject as FabricObject & { initDimensions?: () => void }).initDimensions?.();
			activeObject.set('dirty', true);
		}
		activeObject.setCoords();
		this.canvas.requestRenderAll();
		const { id, superType, type, player, width, height } = activeObject as any;
		if (superType === 'element') {
			if (key === 'visible') {
				if (value) {
					activeObject.element.style.display = 'block';
				} else {
					activeObject.element.style.display = 'none';
				}
			}
			const el = this.elementHandler.findById(id);
			// update the element
			this.elementHandler.setScaleOrAngle(el, activeObject);
			this.elementHandler.setSize(el, activeObject);
			this.elementHandler.setPosition(el, activeObject);
			if (type === 'video' && player) {
				player.setPlayerSize(width, height);
			}
		}
		const { onModified } = this;
		if (onModified) {
			onModified(activeObject);
		}
	};

	/**
	 * Set option
	 * @param {Partial<FabricObject>} option
	 * @returns
	 */
	public setObject = (option: Partial<FabricObject>) => {
		const activeObject = this.canvas.getActiveObject() as any;
		if (!activeObject) {
			return;
		}
		Object.keys(option).forEach(key => {
			if (option[key] !== activeObject[key]) {
				activeObject.set(key, option[key]);
				activeObject.setCoords();
			}
		});
		this.canvas.requestRenderAll();
		const { id, superType, type, player, width, height } = activeObject;
		if (superType === 'element') {
			if ('visible' in option) {
				if (option.visible) {
					activeObject.element.style.display = 'block';
				} else {
					activeObject.element.style.display = 'none';
				}
			}
			const el = this.elementHandler.findById(id);
			// update the element
			this.elementHandler.setScaleOrAngle(el, activeObject);
			this.elementHandler.setSize(el, activeObject);
			this.elementHandler.setPosition(el, activeObject);
			if (type === 'video' && player) {
				player.setPlayerSize(width, height);
			}
		}
		const { onModified } = this;
		if (onModified) {
			onModified(activeObject);
		}
	};

	/**
	 * Set key pair by object
	 * @param {FabricObject} obj
	 * @param {string} key
	 * @param {*} value
	 * @returns
	 */
	public setByObject = (obj: any, key: string, value: any) => {
		if (!obj) {
			return;
		}
		if (obj.type === 'svg') {
			if (key === 'fill') {
				obj.setFill(value);
			} else if (key === 'stroke') {
				obj.setStroke(value);
			}
		}
		obj.set(key, value);
		if (key === 'fontFamily' || key === 'lineHeight' || key === 'charSpacing' || key === 'wordSpacing') {
			(obj as FabricObject & { initDimensions?: () => void }).initDimensions?.();
			obj.set('dirty', true);
		}
		obj.setCoords();
		this.canvas.renderAll();
		const { id, superType, type, player, width, height } = obj as any;
		if (superType === 'element') {
			if (key === 'visible') {
				if (value) {
					obj.element.style.display = 'block';
				} else {
					obj.element.style.display = 'none';
				}
			}
			const el = this.elementHandler.findById(id);
			// update the element
			this.elementHandler.setScaleOrAngle(el, obj);
			this.elementHandler.setSize(el, obj);
			this.elementHandler.setPosition(el, obj);
			if (type === 'video' && player) {
				player.setPlayerSize(width, height);
			}
		}
		const { onModified } = this;
		if (onModified) {
			onModified(obj);
		}
	};

	/**
	 * Set key pair by id
	 * @param {string} id
	 * @param {string} key
	 * @param {*} value
	 */
	public setById = (id: string, key: string, value: any) => {
		const findObject = this.findById(id);
		this.setByObject(findObject, key, value);
	};

	/**
	 * Set partial by object
	 * @param {FabricObject} obj
	 * @param {FabricObjectOption} option
	 * @returns
	 */
	public setByPartial = (obj: FabricObject, option: FabricObjectOption) => {
		if (!obj) {
			return;
		}
		if (obj.type === 'svg') {
			if (option.fill) {
				obj.setFill(option.fill);
			} else if (option.stroke) {
				obj.setStroke(option.stroke);
			}
		}
		obj.set(option);
		obj.setCoords();
		this.canvas.renderAll();
		const { id, superType, type, player, width, height } = obj as any;
		if (superType === 'element') {
			if ('visible' in option) {
				if (option.visible) {
					obj.element.style.display = 'block';
				} else {
					obj.element.style.display = 'none';
				}
			}
			const el = this.elementHandler.findById(id);
			// update the element
			this.elementHandler.setScaleOrAngle(el, obj);
			this.elementHandler.setSize(el, obj);
			this.elementHandler.setPosition(el, obj);
			if (type === 'video' && player) {
				player.setPlayerSize(width, height);
			}
		}
	};

	/**
	 * Set shadow
	 * @param {fabric.Shadow} option
	 * @returns
	 */
	public setShadow = (option: fabric.SerializedShadowOptions) => {
		const activeObject = this.canvas.getActiveObject() as FabricObject;
		if (!activeObject) {
			return;
		}
		activeObject.set('shadow', new fabric.Shadow(option));
		this.canvas.requestRenderAll();
		this.onModified?.(activeObject);
	};

	/**
	 * Set the image
	 * @param {FabricImage} obj
	 * @param {unknown} [source]
	 * @param {boolean} [keepSize] Keep size of previous Image
	 * @param {Partial<fabric.ImageProps>} [options]
	 * @returns
	 */
	public setImage = (
		obj: FabricImage,
		source?: unknown,
		keepSize?: boolean,
		options?: Partial<fabric.ImageProps>,
	): Promise<FabricImage> => {
		const resolvedSource = getImageSource(source);
		const { height, scaleY } = obj;
		const renderCallbaack = (imgObj: FabricImage, src: string) => {
			if (keepSize) {
				const scale = (height * scaleY) / imgObj.height;
				imgObj.set({ scaleY: scale, scaleX: scale, src });
			}
			this.canvas.requestRenderAll();
		};
		return new Promise(resolve => {
			const applySource = (src: string, nextOptions?: Record<string, any>) => {
				obj.setSrc(src, nextOptions as any)
					.then(() => {
						renderCallbaack(obj, src);
						resolve(obj);
					})
					.catch(() => resolve(obj));
			};
			if (!resolvedSource) {
				obj.set('file', null);
				obj.set('src', './images/sample/transparentBg.png');
				applySource('./images/sample/transparentBg.png', {
					dirty: true,
					...options,
				});
				return;
			}
			if (typeof resolvedSource !== 'string') {
				const reader = new FileReader();
				reader.onload = () => {
					obj.set('file', resolvedSource);
					obj.set('src', reader.result as string);
					applySource(reader.result as string, {
						dirty: true,
						...options,
					});
				};
				reader.readAsDataURL(resolvedSource);
			} else {
				obj.set('file', null);
				obj.set('src', resolvedSource);
				applySource(resolvedSource, {
					dirty: true,
					crossOrigin: 'anonymous',
					...options,
				});
			}
		});
	};

	/**
	 * Set image by id
	 * @param {string} id
	 * @param {*} source
	 * @param {boolean} [keepSize] Keep size of previous Image
	 * @returns
	 */
	public setImageById = (id: string, source: any, keepSize?: boolean) => {
		const findObject = this.findById(id) as FabricImage;
		return Promise.resolve(this.setImage(findObject, source, keepSize));
	};

	/**
	 * Set Svg
	 *
	 * @param {SvgObject} obj
	 * @param {(File | string)} [source]
	 * @param {boolean} [keepSize] Keep size of previous SVG
	 * @param {boolean} [xmlString] XML string
	 */
	public setSvg = (
		obj: SvgObject,
		source?: File | string,
		keepSize?: boolean,
		xmlString?: boolean,
	): Promise<SvgObject> => {
		return new Promise(resolve => {
			if (!source) {
				resolve(obj.loadSvg({ src: './images/sample/chiller.svg', loadType: 'file', keepSize }));
			}
			if (source instanceof File) {
				const reader = new FileReader();
				reader.readAsDataURL(source);
				reader.onload = () =>
					resolve(obj.loadSvg({ src: reader.result as string, loadType: 'file', keepSize }));
			} else {
				resolve(obj.loadSvg({ src: source, loadType: xmlString ? 'svg' : 'file', keepSize }));
			}
		});
	};

	/**
	 * Set visible
	 * @param {boolean} [visible]
	 * @returns
	 */
	public setVisible = (visible?: boolean) => {
		const activeObject = this.canvas.getActiveObject() as FabricElement;
		if (!activeObject) {
			return;
		}
		if (activeObject.superType === 'element') {
			if (visible) {
				activeObject.element.style.display = 'block';
			} else {
				activeObject.element.style.display = 'none';
			}
		}
		activeObject.set({
			visible,
		});
		this.canvas.renderAll();
	};

	/**
	 * Set the position on Object
	 *
	 * @param {FabricObject} obj
	 * @param {boolean} [centered]
	 */
	public centerObject = (obj: FabricObject, centered?: boolean) => {
		if (centered) {
			this.canvas.centerObject(obj);
			obj.setCoords();
		} else {
			this.setByPartial(obj, {
				left:
					obj.left / this.canvas.getZoom() -
					obj.width / 2 -
					this.canvas.viewportTransform[4] / this.canvas.getZoom(),
				top:
					obj.top / this.canvas.getZoom() -
					obj.height / 2 -
					this.canvas.viewportTransform[5] / this.canvas.getZoom(),
			});
		}
	};

	/**
	 * Add object
	 * @param {FabricObjectOption} obj
	 * @param {boolean} [centered=true]
	 * @param {boolean} [loaded=false]
	 * @param {boolean} [group=false]
	 * @returns
	 */
	public add = (obj: FabricObjectOption, centered = true, loaded = false, group = false, transaction = true) => {
		const { editable, gridOption, objectOption, onAdd } = this;
		const option: any = {
			hasControls: editable,
			hasBorders: editable,
			selectable: editable,
			lockMovementX: !editable,
			lockMovementY: !editable,
			hoverCursor: !editable ? 'pointer' : 'move',
		};
		const objectType = resolveFabricObjectType(this.fabricObjects, obj);
		const isTextObject = obj.superType === 'text' || objectType === 'textbox';
		if (isTextObject) {
			// Text is edited from the property panel; prevent mouse scaling controls.
			option.hasControls = false;
			option.lockScalingX = true;
			option.lockScalingY = true;
		}
		if (objectType === 'i-text' && obj.superType !== 'text') {
			option.editable = false;
		} else {
			option.editable = editable;
		}
		if (editable && this.workarea.layout === 'fullscreen') {
			option.scaleX = this.workarea.scaleX;
			option.scaleY = this.workarea.scaleY;
		}
		const newOption = Object.assign(
			{},
			objectOption,
			obj,
			{
				container: this.container.id,
				editable,
			},
			option,
		);
		const { type: _type, ...fabricOption } = newOption;
		let createdObj;
		// Create canvas object
		if (objectType === 'image') {
			createdObj = this.addImage(fabricOption, centered && !loaded);
		} else if (objectType === 'group') {
			createdObj = this.addGroup(fabricOption);
		} else {
			const factory = objectType ? this.fabricObjects?.[objectType] : undefined;
			if (!factory) {
				throw new Error(`Unsupported canvas object type: ${String(obj.type)}`);
			}
			createdObj = factory.create(fabricOption);
		}
		if (group) {
			return createdObj;
		}
		this.canvas.add(createdObj);
		this.refreshAfterMutation();
		this.bindObjectEvents(createdObj);
		if (!this.isBatching()) {
			this.syncRequestAnimFrame();
		}
		if (obj.superType !== 'drawing' && editable && !loaded) {
			this.centerObject(createdObj, centered);
		}
		if (!editable && createdObj.animation && createdObj.animation.autoplay) {
			this.animationHandler.play(createdObj.id);
		}
		if (gridOption.enabled) {
			this.gridHandler.setCoords(createdObj);
		}
		if (!this.transactionHandler.active && !loaded && transaction) {
			const loadPromise = (createdObj as FabricObject & { loadPromise?: Promise<unknown> }).loadPromise;
			if (loadPromise && obj.file instanceof File) {
				void loadPromise.then(() => {
					if (!this.transactionHandler.active) {
						this.transactionHandler.save('add');
					}
				});
			} else {
				this.transactionHandler.save('add');
			}
		}
		if (onAdd && editable && !loaded) {
			onAdd(createdObj);
			this.interactionHandler.selection();
		}
		return createdObj;
	};

	/**
	 * Add group object
	 *
	 * @param {FabricGroup} obj
	 * @param {boolean} [centered=true]
	 * @param {boolean} [loaded=false]
	 * @returns
	 */
	public addGroup = (obj: FabricGroup) => {
		const { objects = [], type: _type, layoutManager: _layoutManager, ...groupOptions } = obj;
		const _objects = objects.map(child => this.add(child, false, true, true)) as FabricObject[];
		return new fabric.Group(_objects, groupOptions) as FabricGroup;
	};

	/**
	 * Add iamge object
	 * @param {FabricImage} obj
	 * @returns
	 */
	public addImage = (obj: FabricImage, centerAfterLoad = false) => {
		const { objectOption } = this;
		const { filters = [], src, file, ...otherOption } = obj;
		const image = new Image();
		const createdObj = new fabric.FabricImage(image, {
			...objectOption,
			...otherOption,
		}) as FabricImage;
		const nativeToObject = createdObj.toObject.bind(createdObj);
		createdObj.toObject = ((propertiesToInclude: any[] = []) => {
			const serialized = nativeToObject(propertiesToInclude);
			const pendingSource = createdObj.get('src');
			if (typeof pendingSource === 'string' && pendingSource.trim()) {
				serialized.src = pendingSource;
			} else {
				delete (serialized as Partial<typeof serialized>).src;
			}
			const element = createdObj.getElement();
			if (!element.width && !element.height) {
				delete (serialized as Partial<typeof serialized>).width;
				delete (serialized as Partial<typeof serialized>).height;
				if (centerAfterLoad) {
					serialized.originX = 'center';
					serialized.originY = 'center';
				}
			}
			return serialized;
		}) as typeof createdObj.toObject;
		createdObj.set({
			filters: this.imageHandler.createFilters(filters),
		});
		const loadPromise = this.setImage(createdObj, getImageSource(src) ?? getImageSource(file)).then(() => {
			if (centerAfterLoad && createdObj.canvas) {
				this.centerObject(createdObj, true);
				createdObj.canvas.requestRenderAll();
			}
			return createdObj;
		});
		(createdObj as FabricImage & { loadPromise: Promise<FabricImage> }).loadPromise = loadPromise;
		return createdObj;
	};

	/**
	 * Remove object
	 * @param {FabricObject} target
	 * @returns {any}
	 */
	public remove = (target?: FabricObject) => {
		const removeObject = (object: any) => {
			if (object.superType === 'element') {
				this.elementHandler.removeById(object.id);
			}

			this.canvas.remove(object);
		};

		const activeObject = target || (this.canvas.getActiveObject() as any);

		if (!activeObject) {
			return;
		}

		if (typeof activeObject.deletable !== 'undefined' && !activeObject.deletable) {
			return;
		}
		if (this.isActiveSelection(activeObject)) {
			const activeObjects = activeObject.getObjects();
			const hasNotDeletableObject = activeObjects.some(
				(object: any) => typeof object.deletable !== 'undefined' && !object.deletable,
			);

			if (hasNotDeletableObject) {
				return;
			}

			this.canvas.discardActiveObject();

			activeObjects.forEach((object: any) => {
				removeObject(object);
			});
		} else {
			this.canvas.discardActiveObject();
			removeObject(activeObject);
		}

		if (!this.transactionHandler.active) {
			this.transactionHandler.save('remove');
		}

		this.objects = this.getObjects();
		this.onRemove?.(activeObject);
		this.canvas.requestRenderAll();
	};

	/**
	 * Remove object by id
	 * @param {string} id
	 */
	public removeById = (id: string) => {
		const findObject = this.findById(id);
		if (findObject) {
			this.remove(findObject);
		}
	};

	/**
	 * Delete at origin object list
	 * @param {string} id
	 */
	public removeOriginById = (id: string) => {
		const object = this.findOriginByIdWithIndex(id);
		if (object.index > 0) {
			this.objects.splice(object.index, 1);
		}
	};

	/**
	 * Duplicate object
	 * @returns
	 */
	public duplicate = () => {
		const {
			onAdd,
			propertiesToInclude,
			gridOption: { grid = 10 },
		} = this;
		const activeObject = this.canvas.getActiveObject() as FabricObject;
		if (!activeObject) {
			return;
		}
		if (typeof activeObject.cloneable !== 'undefined' && !activeObject.cloneable) {
			return;
		}
		void (activeObject as any).clone(propertiesToInclude).then((clonedObj: FabricObject) => {
			this.canvas.discardActiveObject();
			clonedObj.set({
				left: clonedObj.left + grid,
				top: clonedObj.top + grid,
				evented: true,
			});
			if (this.isActiveSelection(clonedObj)) {
				const activeSelection = clonedObj as fabric.ActiveSelection;
				activeSelection.canvas = this.canvas;
				activeSelection.forEachObject((obj: any) => {
					obj.set('id', uuid());
					this.canvas.add(obj);
					this.objects = this.getObjects();
					if (obj.dblclick) {
						obj.on('mousedblclick', this.eventHandler.object.mousedblclick);
					}
				});
				if (onAdd) {
					onAdd(activeSelection);
				}
				activeSelection.setCoords();
			} else {
				if (activeObject.id === clonedObj.id) {
					clonedObj.set('id', uuid());
				}
				this.canvas.add(clonedObj);
				this.objects = this.getObjects();
				if (clonedObj.dblclick) {
					clonedObj.on('mousedblclick', this.eventHandler.object.mousedblclick);
				}
				if (onAdd) {
					onAdd(clonedObj);
				}
			}
			this.canvas.setActiveObject(clonedObj);
			this.canvas.requestRenderAll();
		});
	};

	/**
	 * Duplicate object by id
	 * @param {string} id
	 * @returns
	 */
	public duplicateById = (id: string) => {
		const {
			onAdd,
			propertiesToInclude,
			gridOption: { grid = 10 },
		} = this;
		const findObject = this.findById(id);
		if (findObject) {
			if (typeof findObject.cloneable !== 'undefined' && !findObject.cloneable) {
				return false;
			}
			void (findObject as any).clone(propertiesToInclude).then((cloned: FabricObject) => {
				cloned.set({
					left: cloned.left + grid,
					top: cloned.top + grid,
					id: uuid(),
					evented: true,
				});
				this.canvas.add(cloned);
				this.objects = this.getObjects();
				if (onAdd) {
					onAdd(cloned);
				}
				if (cloned.dblclick) {
					cloned.on('mousedblclick', this.eventHandler.object.mousedblclick);
				}
				this.canvas.setActiveObject(cloned);
				this.canvas.requestRenderAll();
			});
		}
		return true;
	};

	/**
	 * Cut object
	 *
	 */
	public cut = () => {
		this.copy();
		this.remove();
		this.isCut = true;
	};

	/**
	 * Copy to clipboard
	 *
	 * @param {*} value
	 */
	public copyToClipboard = (value: any) => {
		const textarea = document.createElement('textarea');
		document.body.appendChild(textarea);
		textarea.value = value;
		textarea.select();
		document.execCommand('copy');
		document.body.removeChild(textarea);
		this.canvas.wrapperEl.focus();
	};

	/**
	 * Copy object
	 *
	 * @returns
	 */
	public copy = () => {
		const { propertiesToInclude } = this;
		const activeObject = this.canvas.getActiveObject() as FabricObject;
		if (activeObject) {
			if (typeof activeObject.cloneable !== 'undefined' && !activeObject.cloneable) {
				return false;
			}
			void (activeObject as any).clone(propertiesToInclude).then((cloned: FabricObject) => {
				if (this.canvasActions.clipboard) {
					this.copyToClipboard(JSON.stringify(cloned.toObject(propertiesToInclude), null, '\t'));
				} else {
					this.clipboard = cloned;
				}
			});
		}
		return true;
	};

	/**
	 * Paste object
	 *
	 * @returns
	 */
	public paste = () => {
		const {
			onAdd,
			propertiesToInclude,
			gridOption: { grid = 10 },
			clipboard,
			isCut,
		} = this;
		const padding = isCut ? 0 : grid;
		if (!clipboard) {
			return false;
		}
		if (typeof clipboard.cloneable !== 'undefined' && !clipboard.cloneable) {
			return false;
		}
		this.isCut = false;
		void clipboard.clone(propertiesToInclude).then((clonedObj: any) => {
			this.canvas.discardActiveObject();
			clonedObj.set({
				left: clonedObj.left + padding,
				top: clonedObj.top + padding,
				id: isCut ? clipboard.id : uuid(),
				evented: true,
			});
			if (this.isActiveSelection(clonedObj)) {
				clonedObj.canvas = this.canvas;
				clonedObj.forEachObject((obj: any) => {
					obj.set('id', isCut ? obj.id : uuid());
					this.canvas.add(obj);
					if (obj.dblclick) {
						obj.on('mousedblclick', this.eventHandler.object.mousedblclick);
					}
				});
			} else {
				this.canvas.add(clonedObj);
				if (clonedObj.dblclick) {
					clonedObj.on('mousedblclick', this.eventHandler.object.mousedblclick);
				}
			}
			const newClipboard = clipboard.set({
				top: clonedObj.top,
				left: clonedObj.left,
			});
			if (isCut) {
				this.clipboard = null;
			} else {
				this.clipboard = newClipboard;
			}
			if (!this.transactionHandler.active) {
				this.transactionHandler.save('paste');
			}
			// TODO...
			// After toGroup svg elements not rendered.
			this.objects = this.getObjects();
			if (onAdd) {
				onAdd(clonedObj);
			}
			clonedObj.setCoords();
			this.canvas.setActiveObject(clonedObj);
			this.canvas.requestRenderAll();
		});
		return true;
	};

	/**
	 * Find object by object
	 * @param {FabricObject} obj
	 */
	public find = (obj: FabricObject) => this.findById(obj.id);

	/**
	 * Find object by id
	 * @param {string} id
	 * @returns {(FabricObject | null)}
	 */
	public findById = (id: string): FabricObject | null => {
		let findObject;
		const exist = this.objects.some(obj => {
			if (obj.id === id) {
				findObject = obj;
				return true;
			}
			return false;
		});
		if (!exist) {
			warning(true, 'Not found object by id.');
			return null;
		}
		return findObject;
	};

	/**
	 * Find object in origin list
	 * @param {string} id
	 * @returns
	 */
	public findOriginById = (id: string) => {
		let findObject: FabricObject;
		const exist = this.objects.some(obj => {
			if (obj.id === id) {
				findObject = obj;
				return true;
			}
			return false;
		});
		if (!exist) {
			console.warn('Not found object by id.');
			return null;
		}
		return findObject;
	};

	/**
	 * Return origin object list
	 * @param {string} id
	 * @returns
	 */
	public findOriginByIdWithIndex = (id: string) => {
		let findObject;
		let index = -1;
		const exist = this.objects.some((obj, i) => {
			if (obj.id === id) {
				findObject = obj;
				index = i;
				return true;
			}
			return false;
		});
		if (!exist) {
			console.warn('Not found object by id.');
			return {};
		}
		return {
			object: findObject,
			index,
		};
	};

	/**
	 * Select object
	 * @param {FabricObject} obj
	 * @param {boolean} [find]
	 */
	public select = (obj: FabricObject, find?: boolean) => {
		let findObject = obj;
		if (find) {
			findObject = this.find(obj);
		}
		if (findObject) {
			this.canvas.discardActiveObject();
			this.canvas.setActiveObject(findObject);
			this.canvas.requestRenderAll();
		}
	};

	/**
	 * Select by id
	 * @param {string} id
	 */
	public selectById = (id: string) => {
		const findObject = this.findById(id);
		if (findObject) {
			this.canvas.discardActiveObject();
			this.canvas.setActiveObject(findObject);
			this.canvas.requestRenderAll();
		}
	};

	/**
	 * Select all
	 * @returns
	 */
	public selectAll = () => {
		this.canvas.discardActiveObject();
		const filteredObjects = this.canvas.getObjects().filter((obj: any) => {
			if (obj.id === 'workarea') {
				return false;
			} else if (!obj.evented) {
				return false;
			} else if (obj.superType === 'element') {
				return false;
			} else if (obj.locked) {
				return false;
			}
			return true;
		});
		if (!filteredObjects.length) {
			return;
		}
		if (filteredObjects.length === 1) {
			this.canvas.setActiveObject(filteredObjects[0]);
			this.canvas.renderAll();
			return;
		}
		const activeSelection = new fabric.ActiveSelection(filteredObjects, {
			canvas: this.canvas,
			...this.activeSelectionOption,
		});
		this.canvas.setActiveObject(activeSelection);
		this.canvas.renderAll();
	};

	/**
	 * Save origin width, height
	 * @param {FabricObject} obj
	 * @param {number} width
	 * @param {number} height
	 */
	public originScaleToResize = (obj: FabricObject, width: number, height: number) => {
		if (obj.id === 'workarea') {
			this.setByPartial(obj, {
				workareaWidth: obj.width,
				workareaHeight: obj.height,
			});
		}
		this.setByPartial(obj, {
			scaleX: width / obj.width,
			scaleY: height / obj.height,
		});
	};

	/**
	 * When set the width, height, Adjust the size
	 * @param {number} width
	 * @param {number} height
	 */
	public scaleToResize = (width: number, height: number) => {
		const activeObject = this.canvas.getActiveObject() as FabricObject;
		const { id } = activeObject;
		const obj = {
			id,
			scaleX: width / activeObject.width,
			scaleY: height / activeObject.height,
		};
		this.setObject(obj);
		activeObject.setCoords();
		this.canvas.requestRenderAll();
	};

	/**
	 * Import json
	 * @param {*} json
	 * @param {(canvas: FabricCanvas) => void} [callback]
	 */
	public importJSON = async (json: any, callback?: (canvas: FabricCanvas) => void) => {
		if (typeof json === 'string') {
			json = JSON.parse(json);
		}
		let prevLeft = 0;
		let prevTop = 0;
		this.canvas.backgroundColor = this.canvasOption.backgroundColor;
		this.canvas.renderAll();
		const workarea = json.find((obj: FabricObjectOption) => obj.id === 'workarea');
		if (!this.workarea) {
			this.workareaHandler.initialize();
		}
		if (workarea) {
			prevLeft = workarea.left;
			prevTop = workarea.top;
			const { type: _type, ...workareaOptions } = workarea;
			this.workarea.set(workareaOptions);
			const serializedFile = (workarea as FabricObjectOption & { file?: unknown }).file;
			const fileSource = typeof File !== 'undefined' && serializedFile instanceof File
				? serializedFile
				: typeof serializedFile === 'string'
					? serializedFile
					: undefined;
			const imageSource = typeof workarea.src === 'string' && workarea.src
				? workarea.src
				: fileSource;
			await this.workareaHandler.setImage(imageSource || '', true);
			if (workarea.backgroundColor !== undefined) {
				this.workarea.set('backgroundColor', workarea.backgroundColor);
			}
			this.workarea.setCoords();
			if (!Array.isArray((workarea as any).printGuides)) {
				this.workareaHandler.refreshPrintGuides();
			}
		} else {
			this.canvas.centerObject(this.workarea);
			this.workarea.setCoords();
			prevLeft = this.workarea.left;
			prevTop = this.workarea.top;
		}
		const loadPromises: Promise<unknown>[] = [];
		json.forEach((obj: FabricObjectOption) => {
			if (obj.id === 'workarea') {
				return;
			}
			const canvasWidth = this.canvas.getWidth();
			const canvasHeight = this.canvas.getHeight();
			const { width, height, scaleX, scaleY, layout, left, top } = this.workarea;
			if (layout === 'fullscreen') {
				const leftRatio = canvasWidth / (width * scaleX);
				const topRatio = canvasHeight / (height * scaleY);
				obj.left *= leftRatio;
				obj.top *= topRatio;
				obj.scaleX *= leftRatio;
				obj.scaleY *= topRatio;
			} else {
				const diffLeft = left - prevLeft;
				const diffTop = top - prevTop;
				obj.left += diffLeft;
				obj.top += diffTop;
			}
			if (obj.superType === 'element') {
				obj.id = uuid();
			}
			const createdObj = this.add(obj, false, true);
			const loadPromise = (createdObj as FabricObject & { loadPromise?: Promise<unknown> }).loadPromise;
			if (loadPromise) {
				loadPromises.push(loadPromise);
			}
			this.canvas.renderAll();
		});
		await Promise.all(loadPromises);
		this.canvas.renderAll();
		this.objects = this.getObjects();
		if (this.canvasActions.transaction) {
			this.transactionHandler.setDefaultObjects();
		}
		if (callback) {
			callback(this.canvas);
		}
		return Promise.resolve(this.canvas);
	};

	/**
	 * Export json
	 */
	public exportJSON = () => this.canvas.toObject(this.propertiesToInclude).objects as FabricObject[];

	/**
	 * Ensure text stays inside the safe area of the face/row it belongs to
	 * before an export is generated. The editor stores scene coordinates, so
	 * the check is performed against the current workarea transform.
	 */
	public prepareTextLayersForExport = (): { warnings: string[]; blocked: boolean; objects: FabricObject[] } => {
		const workarea = this.workarea;
		if (!workarea) return { warnings: [], blocked: false, objects: this.exportJSON() };
		const origin = workarea.getPointByOrigin('left', 'top');
		const renderedWidth = Math.abs(Number(workarea.width || 0) * Number(workarea.scaleX || 1));
		const renderedHeight = Math.abs(Number(workarea.height || 0) * Number(workarea.scaleY || 1));
		const logicalWidth = Number(workarea.workareaWidth || workarea.width || 0);
		const logicalHeight = Number(workarea.workareaHeight || workarea.height || 0);
		if (!(renderedWidth > 0) || !(renderedHeight > 0) || !(logicalWidth > 0) || !(logicalHeight > 0)) {
			return { warnings: [], blocked: false, objects: this.exportJSON() };
		}
		const unit = workarea.unit === 'cm' || workarea.unit === 'mm' ? workarea.unit : 'in';
		const factor = ({ in: 96, cm: 96 / 2.54, mm: 96 / 25.4 } as const)[unit];
		const scaleX = renderedWidth / logicalWidth;
		const scaleY = renderedHeight / logicalHeight;
		const bleed = Math.max(0, Number(workarea.bleed || 0));
		const horizontalBleed = Math.max(0, Number(workarea.separateBleed ? workarea.horizontalBleed ?? bleed : bleed));
		const verticalBleed = Math.max(0, Number(workarea.separateBleed ? workarea.verticalBleed ?? bleed : bleed));
		const sideWidth = Math.max(0, Number(workarea.sideWidth || 0));
		const sideHeight = Math.max(0, Number(workarea.sideHeight || 0));
		const spineWidth = Math.max(0, Number(workarea.spineWidth || 0));
		const spineBleed = Math.max(0, Number(workarea.spineBleed || 0));
		// Product safe distances are stored in millimetres. Keep them separate
		// from the serialized workarea and convert them to CSS pixels only for
		// this export-time bounds check.
		const normalizeSafeDistance = (value: unknown): WorkareaSafeDistance => {
			const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
			const numberValue = (item: unknown) => {
				const parsed = Number(item);
				return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
			};
			return {
				top: numberValue(source.top),
				right: numberValue(source.right),
				bottom: numberValue(source.bottom),
				left: numberValue(source.left),
			};
		};
		const safeDistancePixels = (value: number) => value / 25.4 * 96;
		const coverSafeDistance = normalizeSafeDistance(workarea.coverSafeDistance);
		const spineSafeDistance = normalizeSafeDistance(workarea.spineSafeDistance);
		const backCoverSafeDistance = normalizeSafeDistance(workarea.backCoverSafeDistance);
		const horizontalFaces = (workarea.canvasRows === 2
			? [
				{ name: '封面', start: horizontalBleed * factor, end: (horizontalBleed + sideWidth) * factor, safe: coverSafeDistance },
				{ name: '封底', start: (logicalWidth / factor - horizontalBleed - sideWidth) * factor, end: (logicalWidth / factor - horizontalBleed) * factor, safe: backCoverSafeDistance },
			]
			: [
				{ name: '封面', start: horizontalBleed * factor, end: (horizontalBleed + sideWidth) * factor, safe: coverSafeDistance },
				{ name: '背脊', start: (horizontalBleed + sideWidth + spineBleed) * factor, end: (horizontalBleed + sideWidth + spineBleed + spineWidth) * factor, safe: spineSafeDistance },
				// workareaWidth is stored in CSS pixels while bleed is stored in the
				// selected physical unit. Convert the total width back to that unit
				// before subtracting the right-side bleed.
				{ name: '封底', start: (horizontalBleed + sideWidth + spineBleed + spineWidth + spineBleed) * factor, end: (logicalWidth / factor - horizontalBleed) * factor, safe: backCoverSafeDistance },
			]).map(face => ({
			...face,
			start: face.start * scaleX,
			end: face.end * scaleX,
		}));
		const rows = workarea.canvasRows === 2 ? 2 : 1;
		const rowGap = rows === 2 ? Math.max(0, Number(workarea.canvasRowGap || 0)) : 0;
		const rowHeight = Math.max(1, (renderedHeight - rowGap * (rows - 1)) / rows);
		const horizontalRows = Array.from({ length: rows }, (_, row) => {
			const rowStart = row * (rowHeight + rowGap) + verticalBleed * factor * scaleY;
			const rowEnd = row * (rowHeight + rowGap) + rowHeight - verticalBleed * factor * scaleY;
			return { name: rows === 2 ? `第${row + 1}排` : '画布', start: rowStart, end: rowEnd };
		});
		const safeBounds = (start: number, end: number, leadingMargin: number, trailingMargin: number) => {
			const maxInset = Math.max(0, (end - start) / 2 - 0.5);
			const leading = Math.min(Math.max(0, leadingMargin), maxInset);
			const trailing = Math.min(Math.max(0, trailingMargin), maxInset);
			return [start + leading, Math.max(start + 1, end - trailing)] as const;
		};
		const nearestRegion = <T extends { start: number; end: number }>(value: number, regions: T[]): T => {
			const inside = regions.find(region => value >= region.start && value <= region.end);
			if (inside) return inside;
			return regions.reduce((nearest, region) => {
				const distance = value < region.start ? region.start - value : value - region.end;
				const nearestDistance = value < nearest.start ? nearest.start - value : value - nearest.end;
				return distance < nearestDistance ? region : nearest;
			});
		};
		const warnings: string[] = [];
		let blocked = false;
		const visit = (object: any) => {
			if (!object || object === workarea || object.id === 'workarea') return;
			if (typeof object.getObjects === 'function') {
				object.getObjects().forEach(visit);
				return;
			}
			const type = String(object.type || '').toLowerCase();
			if (!(type === 'text' || type === 'i-text' || type === 'textbox' || object.superType === 'text')) return;
			if (!object.getCenterPoint?.()) return;
			// Apply persisted center markers before measuring the text bounds.
			if (object.get('horizontalCentered') === true) this.alignmentHandler.centerObjectInPrintRegion(object, 'horizontal');
			if (object.get('verticalCentered') === true) this.alignmentHandler.centerObjectInPrintRegion(object, 'vertical');
			const center = object.getCenterPoint();
			const face = nearestRegion(center.x - origin.x, horizontalFaces);
			const row = nearestRegion(center.y - origin.y, horizontalRows);
			const safe = face.safe;
			const [safeLeft, safeRight] = safeBounds(
				face.start,
				face.end,
				safeDistancePixels(safe.left) * scaleX,
				safeDistancePixels(safe.right) * scaleX,
			);
			const [safeTop, safeBottom] = safeBounds(
				row.start,
				row.end,
				safeDistancePixels(safe.top) * scaleY,
				safeDistancePixels(safe.bottom) * scaleY,
			);
			const originalSize = Number(object.fontSize || 0);
			if (!(originalSize > 0)) return;
			let rect = object.getBoundingRect?.();
			const isOverflowing = (value: any) => Boolean(value && (
				value.left < origin.x + safeLeft - 0.01
				|| value.left + value.width > origin.x + safeRight + 0.01
				|| value.top < origin.y + safeTop - 0.01
				|| value.top + value.height > origin.y + safeBottom + 0.01
			));
			// Font metrics can change non-linearly after a size adjustment. Reduce by
			// 0.5 CSS pixels per attempt and re-measure, avoiding a large proportional
			// jump that can make the text unnecessarily small.
			while (isOverflowing(rect)) {
				const current = Number(object.fontSize || 1);
				if (current <= 1) break;
				const next = Math.max(1, current - 0.5);
				if (!(next < current)) break;
				object.set('fontSize', next);
				object.initDimensions?.();
				object.setCoords?.();
				rect = object.getBoundingRect?.();
			}
			// Recenter after fitting because the measured text bounds changed.
			if (object.get('horizontalCentered') === true) this.alignmentHandler.centerObjectInPrintRegion(object, 'horizontal');
			if (object.get('verticalCentered') === true) this.alignmentHandler.centerObjectInPrintRegion(object, 'vertical');
			rect = object.getBoundingRect?.();
			const finalSize = Number(object.fontSize || originalSize);
			const remainsOutside = isOverflowing(rect);
			if (remainsOutside) blocked = true;
			if (finalSize < originalSize - 0.01 || remainsOutside) {
				const label = String(object.name || object.id || '未命名图层');
				warnings.push(`图层“${label}”超出${row.name}${face.name}安全区域${finalSize < originalSize - 0.01 ? `，字号已从 ${originalSize.toFixed(2)} 缩小至 ${finalSize.toFixed(2)}` : ''}${remainsOutside ? '，缩小至最小可用字号后仍有超出，已阻止导出' : ''}`);
			}
		};
		this.canvas.getObjects().forEach(visit);
		this.canvas.requestRenderAll();
		// Serialize only after every text object has reached its final size. This
		// makes the adjusted fontSize part of exported/saved layer JSON instead of
		// limiting the change to the pixels generated during this export.
		return { warnings, blocked, objects: this.exportJSON() };
	};

	/**
	 * Active selection to group
	 * @returns
	 */
	public toGroup = (target?: FabricObject) => {
		const activeObject = target || (this.canvas.getActiveObject() as fabric.ActiveSelection | null);

		if (!activeObject) {
			return null;
		}

		if (!activeObject.isType?.('ActiveSelection')) {
			return null;
		}

		const activeSelection = activeObject as fabric.ActiveSelection;
		const objects = activeSelection.getObjects();

		if (!objects.length) {
			return null;
		}
		this.canvas.discardActiveObject();

		objects.forEach(object => {
			this.canvas.remove(object);
		});

		const group = new fabric.Group(objects, {
			id: uuid(),
			name: '新建组合',
			...this.objectOption,
		}) as FabricObject<fabric.Group>;

		this.canvas.add(group);
		this.canvas.setActiveObject(group);

		group.setCoords();

		this.objects = this.getObjects();

		if (!this.transactionHandler.active) {
			this.transactionHandler.save('group');
		}

		if (this.onSelect) {
			this.onSelect(group);
		}

		this.canvas.requestRenderAll();

		return group;
	};

	/**
	 * Group to active selection
	 * @returns
	 */
	public toActiveSelection = (target?: FabricObject) => {
		const activeObject = target || (this.canvas.getActiveObject() as fabric.Group | null);

		if (!activeObject) {
			return null;
		}

		if (!activeObject.isType?.('Group', 'group')) {
			return null;
		}

		const group = activeObject as fabric.Group;

		this.canvas.discardActiveObject();

		const objects = group.removeAll() as FabricObject[];

		if (!objects.length) {
			this.canvas.remove(group);
			this.canvas.requestRenderAll();
			return null;
		}

		this.canvas.remove(group);

		objects.forEach(object => {
			this.canvas.add(object);
			object.setCoords();
		});

		const activeSelection = new fabric.ActiveSelection(objects, {
			canvas: this.canvas,
			...this.activeSelectionOption,
		}) as FabricObject<fabric.ActiveSelection>;

		this.canvas.setActiveObject(activeSelection);

		activeSelection.setCoords();

		this.objects = this.getObjects();

		if (!this.transactionHandler.active) {
			this.transactionHandler.save('ungroup');
		}

		if (this.onSelect) {
			this.onSelect(activeSelection);
		}

		this.canvas.requestRenderAll();

		return activeSelection;
	};

	public isActiveSelection = (target?: FabricObject) => {
		const object = target as fabric.FabricObject | undefined;
		return !!object?.isType?.('ActiveSelection', 'activeSelection');
	};

	/**
	 * Bring forward
	 */
	public bringForward = () => {
		const activeObject = this.canvas.getActiveObject() as FabricObject;
		if (activeObject) {
			this.canvas.bringObjectForward(activeObject);
			if (!this.transactionHandler.active) {
				this.transactionHandler.save('bringForward');
			}
			const { onModified } = this;
			if (onModified) {
				onModified(activeObject);
			}
		}
	};

	/**
	 * Bring to front
	 */
	public bringToFront = () => {
		const activeObject = this.canvas.getActiveObject() as FabricObject;
		if (activeObject) {
			this.canvas.bringObjectToFront(activeObject);
			if (!this.transactionHandler.active) {
				this.transactionHandler.save('bringToFront');
			}
			const { onModified } = this;
			if (onModified) {
				onModified(activeObject);
			}
		}
	};

	/**
	 * Send backwards
	 * @returns
	 */
	public sendBackwards = () => {
		const activeObject = this.canvas.getActiveObject() as FabricObject;
		if (activeObject) {
			const firstObject = this.canvas.getObjects()[1] as FabricObject;
			if (firstObject.id === activeObject.id) {
				return;
			}
			this.canvas.sendObjectBackwards(activeObject);
			if (!this.transactionHandler.active) {
				this.transactionHandler.save('sendBackwards');
			}
			const { onModified } = this;
			if (onModified) {
				onModified(activeObject);
			}
		}
	};

	/**
	 * Send to back
	 */
	public sendToBack = () => {
		const activeObject = this.canvas.getActiveObject() as FabricObject;
		if (activeObject) {
			this.canvas.sendObjectToBack(activeObject);
			this.canvas.sendObjectToBack(this.canvas.getObjects()[1]);
			if (!this.transactionHandler.active) {
				this.transactionHandler.save('sendToBack');
			}
			const { onModified } = this;
			if (onModified) {
				onModified(activeObject);
			}
		}
	};

	/**
	 * Clear canvas
	 * @param {boolean} [includeWorkarea=false]
	 */
	public clear = (includeWorkarea = false) => {
		const canvasObjects = this.canvas.getObjects();
		const ids = canvasObjects.reduce((prev, curr: any) => {
			if (curr.superType === 'element') {
				prev.push(curr.id);
				return prev;
			}
			return prev;
		}, []);
		this.elementHandler.removeByIds(ids);
		if (includeWorkarea) {
			this.canvas.clear();
			this.workarea = null;
		} else {
			this.canvas.discardActiveObject();
			const removableObjects = canvasObjects.filter((object: any) => object.id !== 'workarea');
			if (removableObjects.length) {
				this.canvas.remove(...removableObjects);
			}
		}
		this.refreshAfterMutation();
		if (!this.isBatching()) {
			this.canvas.renderAll();
		}
	};

	/**
	 * Start request animation frame
	 */
	public startRequestAnimFrame = () => {
		if (!this.isRequsetAnimFrame) {
			this.isRequsetAnimFrame = true;
			const render = () => {
				this.canvas.renderAll();
				this.requestFrame = fabric.util.requestAnimFrame(render);
			};
			fabric.util.requestAnimFrame(render);
		}
	};

	/**
	 * Stop request animation frame
	 */
	public stopRequestAnimFrame = () => {
		this.isRequsetAnimFrame = false;
		const cancelRequestAnimFrame = (() =>
			window.cancelAnimationFrame ||
			// || window.webkitCancelRequestAnimationFrame
			// || window.mozCancelRequestAnimationFrame
			// || window.oCancelRequestAnimationFrame
			// || window.msCancelRequestAnimationFrame
			clearTimeout)();
		cancelRequestAnimFrame(this.requestFrame);
	};

	/**
	 * Save target object as image
	 * @param {FabricObject} targetObject
	 * @param {string} [option={ name: 'New Image', format: 'png', quality: 1 }]
	 */
	public saveImage = (targetObject: FabricObject, option = { name: 'New Image', format: 'png', quality: 1 }) => {
		let dataUrl;
		let target = targetObject;
		const { name, ...exportOptions } = option;
		if (target) {
			dataUrl = target.toDataURL(exportOptions as any);
		} else {
			target = this.canvas.getActiveObject() as FabricObject;
			if (target) {
				dataUrl = target.toDataURL(exportOptions as any);
			}
		}
		if (dataUrl) {
			const anchorEl = document.createElement('a');
			anchorEl.href = dataUrl;
			anchorEl.download = `${name}.png`;
			document.body.appendChild(anchorEl);
			anchorEl.click();
			anchorEl.remove();
		}
	};

	/**
	 * Save canvas as image
	 * @param {string} [option={ name: 'New Image', format: 'png', quality: 1 }]
	 */
	public saveCanvasImage = (option = { name: 'New Image', format: 'png', quality: 1 }) => {
		const exportCheck = this.prepareTextLayersForExport();
		if (exportCheck.warnings.length) this.onExportWarning?.(exportCheck.warnings);
		if (exportCheck.blocked) return;
		// The editor uses 96 px/in for its on-screen coordinate system. Render
		// the cropped workarea at the production resolution without adding the
		// browser device-pixel ratio a second time.
		const exportMultiplier = 300 / 96;
		const bounds = this.workarea.getBoundingRect();
		const left = bounds.left;
		const top = bounds.top;
		const width = Math.ceil(bounds.width);
		const height = Math.ceil(bounds.height);
		// cachedVT is used to reset the viewportTransform after the image is saved.
		const cachedVT = this.canvas.viewportTransform;
		// reset the viewportTransform to default (no zoom)
		this.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
		const { name, ...exportOptions } = option;
		const exportCanvas = this.canvas.toCanvasElement(exportMultiplier, {
			left,
			top,
			width,
			height,
		});
		const dataUrl = exportCanvas.toDataURL(
			`image/${String(exportOptions.format || 'png')}`,
			Number(exportOptions.quality ?? 1),
		);
		this.canvas.renderAll();

		if (dataUrl) {
			const anchorEl = document.createElement('a');
			anchorEl.href = dataUrl;
			anchorEl.download = `${name}.png`;
			document.body.appendChild(anchorEl);
			anchorEl.click();
			anchorEl.remove();
		}
		// reset the viewportTransform to previous value.
		this.canvas.viewportTransform = cachedVT;
		this.canvas.requestRenderAll();
	};

	/** Save the workarea as a CorelDRAW-compatible SVG with editable text. */
	public saveCanvasSVG(option = { name: 'New Image' }) {
		if (!this.workarea) return;
		const exportCheck = this.prepareTextLayersForExport();
		if (exportCheck.warnings.length) this.onExportWarning?.(exportCheck.warnings);
		if (exportCheck.blocked) return;
		const bounds = this.workarea.getBoundingRect();
		const width = bounds.width;
		const height = bounds.height;
		const rawSvg = this.canvas.toSVG({
			viewBox: {
				x: bounds.left,
				y: bounds.top,
				width,
				height,
			},
			width: String(width),
			height: String(height),
		});
		let svg: string;
		try {
			const fontSources = new Map<string, {
				family: string;
				url: string;
				weight: string | number;
				style: string;
			}>();
			const collectFontSources = (object: any) => {
				if (!object || typeof object !== 'object') return;
				const family = String(object.fontFamily || '').trim();
				const url = String(object.fontUrl || object.font_url || '').trim();
				if (family && url && !/^(data:|blob:)/i.test(url)) {
					const weight = object.fontWeight || 'normal';
					const style = object.fontStyle || 'normal';
					fontSources.set(`${family}\u0000${url}\u0000${weight}\u0000${style}`, {
						family,
						url,
						weight,
						style,
					});
				}
				if (typeof object.getObjects === 'function') object.getObjects().forEach(collectFontSources);
			};
			this.canvas.getObjects().forEach(collectFontSources);
			svg = exportCorelCompatibleSvg({
				rawSvg,
				bounds,
				backgroundColor: String((this.workarea as any).backgroundColor || '#ffffff'),
				fontSources: Array.from(fontSources.values()),
				printGuides: this.workareaHandler.getRenderedPrintGuides(),
				layerNames: new Map(this.canvas.getObjects().map((object: any) => [String(object.id || ''), String(object.name || (object.id === 'workarea' ? '画布' : object.id) || object.type || '图层')])) ,
			});
		} catch (error) {
			const exportError = error instanceof Error ? error : new Error(String(error));
			console.error('[SVG] 导出失败，未下载损坏文件', exportError);
			this.onExportError?.('svg', exportError);
			return;
		}
		const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
		const anchorEl = document.createElement('a');
		anchorEl.href = objectUrl;
		anchorEl.download = `${option.name}.svg`;
		document.body.appendChild(anchorEl);
		anchorEl.click();
		anchorEl.remove();
		window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
	}

	/** Save the workarea with text converted to paths by text-to-svg. */
	public async saveCanvasTextToSVG(option = { name: 'New Image' }) {
		if (!this.workarea) return;
		const exportCheck = this.prepareTextLayersForExport();
		if (exportCheck.warnings.length) this.onExportWarning?.(exportCheck.warnings);
		if (exportCheck.blocked) return;
		const bounds = this.workarea.getBoundingRect();
		const width = bounds.width;
		const height = bounds.height;
		const rawSvg = this.canvas.toSVG({
			viewBox: { x: bounds.left, y: bounds.top, width, height },
			width: String(width),
			height: String(height),
		});
		const fontSources = new Map<string, { family: string; url: string }>();
		const collectFontSources = (object: any) => {
			if (!object || typeof object !== 'object') return;
			const family = String(object.fontFamily || '').trim();
			const url = String(object.fontUrl || object.font_url || '').trim();
			if (family && url && !/^(data:|blob:)/i.test(url)) fontSources.set(`${family}\u0000${url}`, { family, url });
			if (typeof object.getObjects === 'function') object.getObjects().forEach(collectFontSources);
		};
		this.canvas.getObjects().forEach(collectFontSources);

		let svg: string;
		try {
			svg = await exportTextToSvg({
				rawSvg,
				bounds,
				backgroundColor: String((this.workarea as any).backgroundColor || '#ffffff'),
				fontSources: Array.from(fontSources.values()),
				printGuides: this.workareaHandler.getRenderedPrintGuides(),
				layerNames: new Map(this.canvas.getObjects().map((object: any) => [String(object.id || ''), String(object.name || (object.id === 'workarea' ? '画布' : object.id) || object.type || '图层')])) ,
			});
		} catch (error) {
			const exportError = error instanceof Error ? error : new Error(String(error));
			console.error('[text-to-svg] 导出失败，未下载损坏文件', exportError);
			this.onExportError?.('svg', exportError);
			return;
		}
		const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
		const anchorEl = document.createElement('a');
		anchorEl.href = objectUrl;
		anchorEl.download = `${option.name}-text-to-svg路径.svg`;
		document.body.appendChild(anchorEl);
		anchorEl.click();
		anchorEl.remove();
		window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
	}

	/**
	 * Sets "angle" of an instance with centered rotation
	 *
	 * @param {number} angle
	 */
	public rotate = (angle: number) => {
		const activeObject = this.canvas.getActiveObject();
		if (activeObject) {
			this.set('rotation', angle);
			activeObject.rotate(angle);
			this.canvas.requestRenderAll();
		}
	};

	/**
	 * Destroy canvas
	 *
	 */
	public destroy = () => {
		this.rulerHandler.destroy();
		this.workareaHandler.destroy();
		this.eventHandler.destroy();
		this.guidelineHandler.destroy();
		this.spacingGuidelineHandler.destroy();
		this.contextmenuHandler.destroy();
		this.tooltipHandler.destroy();
		this.clear(true);
	};

	/**
	 * Set canvas option
	 *
	 * @param {CanvasOption} canvasOption
	 */
	public setCanvasOption = (canvasOption: CanvasOption) => {
		this.canvasOption = Object.assign({}, this.canvasOption, canvasOption);
		this.canvas.backgroundColor = canvasOption.backgroundColor;
		this.canvas.renderAll();
		if (typeof canvasOption.width !== 'undefined' && typeof canvasOption.height !== 'undefined') {
			if (this.eventHandler) {
				this.eventHandler.resize(canvasOption.width, canvasOption.height);
			} else {
				this.canvas.setDimensions({ width: canvasOption.width, height: canvasOption.height });
			}
		}
		if (typeof canvasOption.selection !== 'undefined') {
			this.canvas.selection = canvasOption.selection;
		}
		if (typeof canvasOption.hoverCursor !== 'undefined') {
			this.canvas.hoverCursor = canvasOption.hoverCursor;
		}
		if (typeof canvasOption.defaultCursor !== 'undefined') {
			this.canvas.defaultCursor = canvasOption.defaultCursor;
		}
		if (typeof canvasOption.preserveObjectStacking !== 'undefined') {
			this.canvas.preserveObjectStacking = canvasOption.preserveObjectStacking;
		}
	};

	/**
	 * Set canvas acitons
	 *
	 * @param {CanvasActions} canvasActions
	 */
	public setCanvasActions = (canvasActions: CanvasActions) => {
		this.canvasActions = Object.assign({}, this.canvasActions, canvasActions);
	};

	/**
	 * Set fabric objects
	 *
	 * @param {FabricObjects} fabricObjects
	 */
	public setFabricObjects = (fabricObjects: FabricObjects) => {
		this.fabricObjects = Object.assign({}, this.fabricObjects, fabricObjects);
	};

	/**
	 * Set workarea option
	 *
	 * @param {WorkareaOption} workareaOption
	 */
	public setWorkareaOption = (workareaOption: WorkareaOption) => {
		this.workareaOption = Object.assign({}, this.workareaOption, workareaOption);
		if (this.workarea) {
			this.workarea.set({
				...workareaOption,
			});
		}
	};

	/**
	 * Set guideline option
	 *
	 * @param {GuidelineOption} guidelineOption
	 */
	public setGuidelineOption = (guidelineOption: GuidelineOption) => {
		this.guidelineOption = Object.assign({}, this.guidelineOption, guidelineOption, {
			spacing: Object.assign({}, this.guidelineOption?.spacing, guidelineOption?.spacing),
		});
		if (this.guidelineHandler) {
			this.guidelineHandler.initialize();
		}
		if (this.spacingGuidelineHandler) {
			this.spacingGuidelineHandler.initialize();
		}
	};

	/**
	 * Set grid option
	 *
	 * @param {GridOption} gridOption
	 */
	public setGridOption = (gridOption: GridOption) => {
		this.gridOption = Object.assign({}, this.gridOption, gridOption);
	};

	/**
	 * Set ruler option
	 *
	 * @param {RulerOption} rulerOption
	 */
	public setRulerOption = (rulerOption: RulerOption) => {
		this.rulerOption = Object.assign({}, this.rulerOption, rulerOption);
		this.rulerHandler?.setOptions(this.rulerOption);
	};

	/**
	 * Set object option
	 *
	 * @param {FabricObjectOption} objectOption
	 */
	public setObjectOption = (objectOption: FabricObjectOption) => {
		this.objectOption = Object.assign({}, this.objectOption, objectOption);
	};

	/**
	 * Set activeSelection option
	 *
	 * @param {Partial<FabricObjectOption<fabric.ActiveSelection>>} activeSelectionOption
	 */
	public setActiveSelectionOption = (activeSelectionOption: Partial<FabricObjectOption<fabric.ActiveSelection>>) => {
		this.activeSelectionOption = Object.assign({}, this.activeSelectionOption, activeSelectionOption);
	};

	/**
	 * Set propertiesToInclude
	 *
	 * @param {string[]} propertiesToInclude
	 */
	public setPropertiesToInclude = (propertiesToInclude: string[]) => {
		this.propertiesToInclude = union(propertiesToInclude, this.propertiesToInclude);
	};

	/**
	 * Register custom handler
	 *
	 * @param {string} name
	 * @param {typeof CustomHandler} handler
	 */
	public registerHandler = (name: string, handler: typeof CustomHandler) => {
		this.handlers[name] = new handler(this);
		return this.handlers[name];
	};
}

export default Handler;
