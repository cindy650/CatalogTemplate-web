import * as fabric from 'fabric';

import { Handler } from '.';
import { FabricImage, PrintGuide, PrintGuideKind, PrintUnit, WorkareaLayout, WorkareaObject, WorkareaSafeDistance } from '../models';
import { VideoObject } from '../objects/Video';
import { getImageSource } from '../utils/imageSource';

class WorkareaHandler {
	/** Visual separation between two canvas rows, measured in editor pixels. */
	private static readonly canvasRowGap = 0;

	handler: Handler;
	private printGuideContext: CanvasRenderingContext2D;

	private readonly pixelsPerUnit: Record<PrintUnit, number> = {
		in: 96,
		cm: 96 / 2.54,
		mm: 96 / 25.4,
	};

	constructor(handler: Handler) {
		this.handler = handler;
		this.printGuideContext = this.handler.canvas.getSelectionContext();
		this.handler.canvas.on({
			'before:render': this.beforePrintGuideRender,
			'after:render': this.afterPrintGuideRender,
		} as any);
		this.initialize();
	}

	/**
	 * Initialize workarea
	 *
	 * @author salgum1114
	 */
	public initialize() {
		const { workareaOption } = this.handler;
		const fabricOptions = { ...workareaOption };
		delete (fabricOptions as Record<string, any>).type;
		const image = new Image(workareaOption.width, workareaOption.height);
		image.width = workareaOption.width;
		image.height = workareaOption.height;
		this.handler.workarea = new fabric.FabricImage(image, fabricOptions) as WorkareaObject;
		this.handler.canvas.add(this.handler.workarea);
		this.handler.workarea.set(
			'printGuides',
			this.buildPrintGuides(
				(workareaOption as any).workareaWidth || workareaOption.width || 0,
				(workareaOption as any).workareaHeight || workareaOption.height || 0,
				workareaOption,
			),
		);
		this.handler.objects = this.handler.getObjects();
		this.handler.canvas.centerObject(this.handler.workarea);
		this.handler.canvas.renderAll();
	}

	private toPositiveNumber = (value: unknown, fallback: number) => {
		const parsed = Number(value);
		return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
	};

	private getPrintValues = (values: Partial<WorkareaObject | Record<string, any>> = {}) => ({
		unit: (values.unit || this.handler.workarea?.unit || 'in') as PrintUnit,
		sideWidth: this.toPositiveNumber(values.sideWidth ?? this.handler.workarea?.sideWidth, 9),
		sideHeight: this.toPositiveNumber(values.sideHeight ?? this.handler.workarea?.sideHeight, 6),
		bleed: this.toPositiveNumber(values.bleed ?? this.handler.workarea?.bleed, 0.79),
		separateBleed: (values.separateBleed ?? this.handler.workarea?.separateBleed) === true,
		horizontalBleed: this.toPositiveNumber(
			values.horizontalBleed ?? this.handler.workarea?.horizontalBleed ?? values.bleed ?? this.handler.workarea?.bleed,
			0.79,
		),
		verticalBleed: this.toPositiveNumber(
			values.verticalBleed ?? this.handler.workarea?.verticalBleed ?? values.bleed ?? this.handler.workarea?.bleed,
			0.79,
		),
		spineWidthMode: (values.spineWidthMode ?? this.handler.workarea?.spineWidthMode) === 'by_page_count'
			? 'by_page_count'
			: 'fixed',
		spineWidthFormula: values.spineWidthFormula ?? this.handler.workarea?.spineWidthFormula,
		canvasRowGap: this.toPositiveNumber(
			values.canvasRowGap ?? this.handler.workarea?.canvasRowGap,
			WorkareaHandler.canvasRowGap,
		),
		// Two-row layouts are front/back rows without a spine. Keep the spine
		// fields in the JSON for single-row templates, but never reserve that
		// width in a two-row canvas.
		spineWidth: (values.canvasRows ?? this.handler.workarea?.canvasRows) === 2
			? 0
			: this.toPositiveNumber(values.spineWidth ?? this.handler.workarea?.spineWidth, 0.55),
		spineBleed: (values.canvasRows ?? this.handler.workarea?.canvasRows) === 2
			|| (values.spineWidthMode ?? this.handler.workarea?.spineWidthMode) === 'by_page_count'
			? 0
			: this.toPositiveNumber(values.spineBleed ?? this.handler.workarea?.spineBleed, 0.55),
		canvasRows: (values.canvasRows ?? this.handler.workarea?.canvasRows) === 2 ? 2 : 1,
		backCoverSafeDistance: this.getSafeDistance(values.backCoverSafeDistance ?? this.handler.workarea?.backCoverSafeDistance),
		coverSafeDistance: this.getSafeDistance(values.coverSafeDistance ?? this.handler.workarea?.coverSafeDistance),
		spineSafeDistance: this.getSafeDistance(values.spineSafeDistance ?? this.handler.workarea?.spineSafeDistance),
	});

	private getSafeDistance = (value: unknown): WorkareaSafeDistance => {
		const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
		return {
			top: this.toPositiveNumber(source.top, 0),
			right: this.toPositiveNumber(source.right, 0),
			bottom: this.toPositiveNumber(source.bottom, 0),
			left: this.toPositiveNumber(source.left, 0),
		};
	};

	private safeDistancePixels = (value: number) => Math.max(0, Number(value) || 0) / 25.4 * 96;

	private getCanvasRowGap = (canvasRows: number, configuredGap?: number) => (
		canvasRows === 2 ? Math.max(0, Number(configuredGap ?? WorkareaHandler.canvasRowGap)) : 0
	);

	private getCanvasRowHeight = (height: number, canvasRows: number, configuredGap?: number) => {
		const gap = this.getCanvasRowGap(canvasRows, configuredGap);
		return Math.max(1, (height - gap * (canvasRows - 1)) / canvasRows);
	};

	private buildPrintGuides = (
		width: number,
		height: number,
		values: Partial<WorkareaObject | Record<string, any>> = {},
	): PrintGuide[] => {
		const printValues = this.getPrintValues(values);
		const factor = this.pixelsPerUnit[printValues.unit] || this.pixelsPerUnit.mm;
		const sideWidth = printValues.sideWidth * factor;
		const horizontalBleed = (printValues.separateBleed ? printValues.horizontalBleed : printValues.bleed) * factor;
		const verticalBleed = (printValues.separateBleed ? printValues.verticalBleed : printValues.bleed) * factor;
		const spineWidth = printValues.spineWidth * factor;
		const spineBleed = printValues.spineBleed * factor;
		const verticalPositions = printValues.canvasRows === 2
			? [
				0,
				horizontalBleed,
				horizontalBleed + sideWidth,
				width - horizontalBleed - sideWidth,
				width - horizontalBleed,
				width,
			]
			: [
				0,
				horizontalBleed,
				horizontalBleed + sideWidth,
				horizontalBleed + sideWidth + spineBleed,
				horizontalBleed + sideWidth + spineBleed + spineWidth,
				horizontalBleed + sideWidth + spineBleed + spineWidth + spineBleed,
				width - horizontalBleed,
				width,
			];
		const canvasRowGap = this.getCanvasRowGap(printValues.canvasRows, printValues.canvasRowGap);
		const rowHeight = this.getCanvasRowHeight(height, printValues.canvasRows, printValues.canvasRowGap);
		const guides: PrintGuide[] = [];
		const add = (orientation: PrintGuide['orientation'], position: number, kind: PrintGuideKind) => {
			if (position < 0 || position > (orientation === 'vertical' ? width : height)) return;
			if (
				!guides.some(guide => guide.orientation === orientation && Math.abs(guide.position - position) < 0.01)
			) {
				guides.push({ orientation, position, kind });
			}
		};
		// Content boundaries are solid; bleed boundaries are blue dashed lines.
		if (printValues.canvasRows === 2) {
			add('vertical', verticalPositions[0], 'bleed');
			add('vertical', verticalPositions[1], 'content');
			add('vertical', verticalPositions[2], 'content');
			add('vertical', verticalPositions[3], 'content');
			add('vertical', verticalPositions[4], 'content');
			add('vertical', verticalPositions[5], 'bleed');
		} else {
			add('vertical', verticalPositions[0], 'bleed');
			add('vertical', verticalPositions[1], 'content');
			add('vertical', verticalPositions[2], 'bleed');
			add('vertical', verticalPositions[3], 'content');
			add('vertical', verticalPositions[4], 'content');
			add('vertical', verticalPositions[5], 'bleed');
			add('vertical', verticalPositions[6], 'content');
			add('vertical', verticalPositions[7], 'bleed');
		}
		for (let row = 0; row < printValues.canvasRows; row += 1) {
			const rowTop = row * (rowHeight + canvasRowGap);
			const rowBottom = rowTop + rowHeight;
			add('horizontal', rowTop, 'bleed');
			add('horizontal', rowTop + verticalBleed, 'content');
			add('horizontal', rowBottom - verticalBleed, 'content');
			add('horizontal', rowBottom, 'bleed');
		}
		return guides;
	};

	public getPrintDimensionData = (values: Record<string, any>) => {
		const printValues = this.getPrintValues(values);
		const factor = this.pixelsPerUnit[printValues.unit] || this.pixelsPerUnit.mm;
		const horizontalBleed = printValues.separateBleed ? printValues.horizontalBleed : printValues.bleed;
		const verticalBleed = printValues.separateBleed ? printValues.verticalBleed : printValues.bleed;
		const physicalWidth = printValues.canvasRows === 2
			? printValues.sideWidth * 2 + horizontalBleed * 2
			: printValues.sideWidth * 2 + horizontalBleed * 2 + printValues.spineBleed * 2 + printValues.spineWidth;
		const width = Math.max(1, physicalWidth * factor);
		const rowHeight = Math.max(1, (printValues.sideHeight + verticalBleed * 2) * factor);
		const height = rowHeight * printValues.canvasRows + this.getCanvasRowGap(printValues.canvasRows, printValues.canvasRowGap);
		return {
			...printValues,
			workareaWidth: width,
			workareaHeight: height,
			printGuides: this.buildPrintGuides(width, height, printValues),
		};
	};

	/** Return guide positions in the rendered workarea coordinate system. */
	public getRenderedPrintGuides = (): PrintGuide[] => {
		const workarea = this.handler.workarea;
		if (!workarea?.printGuides?.length) return [];
		const logicalWidth = workarea.workareaWidth || workarea.width || 1;
		const logicalHeight = workarea.workareaHeight || workarea.height || 1;
		const renderedWidth = workarea.width * workarea.scaleX;
		const renderedHeight = workarea.height * workarea.scaleY;
		const scaleX = renderedWidth / logicalWidth;
		const scaleY = renderedHeight / logicalHeight;
		return workarea.printGuides.map(guide => ({
			...guide,
			position: guide.position * (guide.orientation === 'vertical' ? scaleX : scaleY),
		}));
	};

	private beforePrintGuideRender = () => {
		this.handler.canvas.clearContext(this.printGuideContext);
	};

	private afterPrintGuideRender = () => {
		const workarea = this.handler.workarea;
		if (!workarea) return;
		const origin = workarea.getPointByOrigin('left', 'top');
		const { viewportTransform } = this.handler.canvas;
		const zoom = this.handler.canvas.getZoom() || 1;
		const width = workarea.width * workarea.scaleX;
		const height = workarea.height * workarea.scaleY;
		const ctx = this.printGuideContext;
		ctx.save();
		ctx.transform(...viewportTransform);
		ctx.lineWidth = 1 / zoom;
		ctx.strokeStyle = '#1677ff';
		ctx.setLineDash([6 / zoom, 4 / zoom]);
		workarea.printGuides?.forEach(guide => {
			ctx.beginPath();
			ctx.setLineDash(guide.kind === 'content' ? [] : [6 / zoom, 4 / zoom]);
			if (guide.orientation === 'vertical') {
				const logicalWidth = workarea.workareaWidth || workarea.width || 1;
				const renderedWidth = workarea.width * workarea.scaleX;
				const position = guide.position * renderedWidth / logicalWidth;
				ctx.moveTo(origin.x + position, origin.y);
				ctx.lineTo(origin.x + position, origin.y + height);
			} else {
				const logicalHeight = workarea.workareaHeight || workarea.height || 1;
				const renderedHeight = workarea.height * workarea.scaleY;
				const position = guide.position * renderedHeight / logicalHeight;
				ctx.moveTo(origin.x, origin.y + position);
				ctx.lineTo(origin.x + width, origin.y + position);
			}
			ctx.stroke();
		});
		ctx.setLineDash([]);
		if (workarea.printGuides?.length) this.drawPrintDimensionLabels(ctx, origin, height, workarea, zoom);
		// Inner-page canvases use the full canvas as their safe area. Keep that
		// rule implicit and avoid drawing the template-library safe-area overlay.
		if (!workarea.innerPage && !this.handler.skipTextSafeAreaCheck) {
			this.drawSafeDistanceGuides(ctx, origin, width, height, workarea, zoom);
		}
		ctx.restore();
	};

	/** Draw product safe distances as an editor-only red dashed overlay. */
	private drawSafeDistanceGuides = (
		ctx: CanvasRenderingContext2D,
		origin: fabric.Point,
		width: number,
		height: number,
		workarea: WorkareaObject,
		zoom: number,
	) => {
		const values = this.getPrintValues(workarea);
		const logicalWidth = Number(workarea.workareaWidth || workarea.width || width) || width;
		const logicalHeight = Number(workarea.workareaHeight || workarea.height || height) || height;
		const scaleX = width / logicalWidth;
		const scaleY = height / logicalHeight;
		const unitFactor = this.pixelsPerUnit[values.unit] || this.pixelsPerUnit.mm;
		const horizontalBleed = (values.separateBleed ? values.horizontalBleed : values.bleed) * unitFactor;
		const verticalBleed = (values.separateBleed ? values.verticalBleed : values.bleed) * unitFactor;
		const sideWidth = values.sideWidth * unitFactor;
		const spineWidth = values.spineWidth * unitFactor;
		const spineBleed = values.spineBleed * unitFactor;
		const rows = values.canvasRows;
		const rowGap = this.getCanvasRowGap(rows, values.canvasRowGap);
		const rowHeight = this.getCanvasRowHeight(logicalHeight, rows, values.canvasRowGap);
		const faces = rows === 2
			? [
				{ start: horizontalBleed, end: horizontalBleed + sideWidth, safe: values.coverSafeDistance },
				{ start: logicalWidth - horizontalBleed - sideWidth, end: logicalWidth - horizontalBleed, safe: values.backCoverSafeDistance },
			]
			: [
				{ start: horizontalBleed, end: horizontalBleed + sideWidth, safe: values.coverSafeDistance },
				{ start: horizontalBleed + sideWidth + spineBleed, end: horizontalBleed + sideWidth + spineBleed + spineWidth, safe: values.spineSafeDistance },
				{ start: horizontalBleed + sideWidth + spineBleed + spineWidth + spineBleed, end: logicalWidth - horizontalBleed, safe: values.backCoverSafeDistance },
			];
		const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
			ctx.moveTo(origin.x + x1, origin.y + y1);
			ctx.lineTo(origin.x + x2, origin.y + y2);
		};
		ctx.save();
		ctx.strokeStyle = '#ff4d4f';
		ctx.lineWidth = 1.5 / zoom;
		ctx.setLineDash([5 / zoom, 4 / zoom]);
		ctx.beginPath();
		for (let row = 0; row < rows; row += 1) {
			const rowTop = row * (rowHeight + rowGap);
			const rowBottom = rowTop + rowHeight;
			faces.forEach(face => {
				const safe = face.safe;
				// Product safe distances are stored in millimetres. Convert once to
				// CSS pixels; the face geometry above is already expressed in CSS
				// pixels through the selected unit's factor.
				const left = Math.min(face.end, face.start + this.safeDistancePixels(safe.left)) * scaleX;
				const right = Math.max(face.start, face.end - this.safeDistancePixels(safe.right)) * scaleX;
				const top = Math.min(rowBottom, rowTop + verticalBleed + this.safeDistancePixels(safe.top)) * scaleY;
				const bottom = Math.max(rowTop, rowBottom - verticalBleed - this.safeDistancePixels(safe.bottom)) * scaleY;
				drawLine(left, top, right, top);
				drawLine(left, bottom, right, bottom);
				drawLine(left, top, left, bottom);
				drawLine(right, top, right, bottom);
			});
		}
		ctx.stroke();
		ctx.restore();
	};

	private formatPrintValue = (value: number) => value.toFixed(3);

	private drawPrintDimensionLabels = (
		ctx: CanvasRenderingContext2D,
		origin: fabric.Point,
		height: number,
		workarea: WorkareaObject,
		zoom: number,
	) => {
		const values = this.getPrintValues(workarea);
		const factor = this.pixelsPerUnit[values.unit] || this.pixelsPerUnit.mm;
		const horizontalBleed = (values.separateBleed ? values.horizontalBleed : values.bleed) * factor;
		const sideWidth = values.sideWidth * factor;
		const spineBleed = values.spineBleed * factor;
		const spineWidth = values.spineWidth * factor;
		const sideStart = horizontalBleed;
		const sideEnd = sideStart + sideWidth;
		const spineStart = sideEnd + spineBleed;
		const spineEnd = spineStart + spineWidth;
		const renderedWidth = workarea.width * workarea.scaleX;
		const labelUnit = values.unit;
		const fontSize = 12 / zoom;
		const rowGap = 18 / zoom;
		const hasTopMargin = origin.y > 72 / zoom;
		const labelDirection = hasTopMargin ? -1 : 1;
		const labelBaseY = hasTopMargin ? origin.y - 12 / zoom : origin.y + height + 16 / zoom;
		const labelColor = '#1677ff';
		const text = (label: string, value: number) => `${label} ${this.formatPrintValue(value)} ${labelUnit}`;

		ctx.save();
		ctx.setLineDash([]);
		ctx.font = `${fontSize}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.lineWidth = 3 / zoom;
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
		ctx.fillStyle = labelColor;

		const horizontalDimension = (label: string, value: number, start: number, end: number, row: number) => {
			const y = labelBaseY + labelDirection * row * rowGap;
			ctx.beginPath();
			ctx.moveTo(origin.x + start, y);
			ctx.lineTo(origin.x + end, y);
			ctx.moveTo(origin.x + start, y - (labelDirection * 4) / zoom);
			ctx.lineTo(origin.x + start, y + (labelDirection * 4) / zoom);
			ctx.moveTo(origin.x + end, y - (labelDirection * 4) / zoom);
			ctx.lineTo(origin.x + end, y + (labelDirection * 4) / zoom);
			ctx.strokeStyle = labelColor;
			ctx.lineWidth = 1 / zoom;
			ctx.stroke();
			const labelX = origin.x + (start + end) / 2;
			const labelY = y + (labelDirection * 8) / zoom;
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
			ctx.lineWidth = 3 / zoom;
			ctx.strokeText(text(label, value), labelX, labelY);
			ctx.fillStyle = labelColor;
			ctx.fillText(text(label, value), labelX, labelY);
		};

		if (values.canvasRows === 2) {
			horizontalDimension('单面宽', values.sideWidth, sideStart, sideEnd, 0);
			horizontalDimension('单面宽', values.sideWidth, renderedWidth - horizontalBleed - sideWidth, renderedWidth - horizontalBleed, 0);
			horizontalDimension(values.separateBleed ? '左右出血' : '出血', values.separateBleed ? values.horizontalBleed : values.bleed, 0, horizontalBleed, 1);
		} else {
			// The usable single-side span includes the adjacent spine bleed.
			horizontalDimension('单面宽', values.sideWidth + values.spineBleed, sideStart, spineStart, 0);
			horizontalDimension(values.separateBleed ? '左右出血' : '出血', values.separateBleed ? values.horizontalBleed : values.bleed, 0, horizontalBleed, 1);
			horizontalDimension('背脊宽', values.spineWidth, spineStart, spineEnd, 0);
			horizontalDimension('背脊出血', values.spineBleed, sideEnd, spineStart, 1);
			horizontalDimension('背脊出血', values.spineBleed, spineEnd, spineEnd + spineBleed, 1);
		}

		const canvasRowGap = this.getCanvasRowGap(values.canvasRows, values.canvasRowGap);
		const rowHeight = this.getCanvasRowHeight(height, values.canvasRows, values.canvasRowGap);
		for (let row = 0; row < values.canvasRows; row += 1) {
			const heightLabelX = origin.x - 20 / zoom;
			const heightLabelY = origin.y + row * (rowHeight + canvasRowGap) + rowHeight / 2;
			ctx.save();
			ctx.translate(heightLabelX, heightLabelY);
			ctx.rotate(-Math.PI / 2);
			const heightLabel = text('单面高', values.sideHeight);
			ctx.strokeText(heightLabel, 0, 0);
			ctx.fillText(heightLabel, 0, 0);
			ctx.restore();
		}
		ctx.restore();
	};

	public setPrintDimensions = (values: Record<string, any>) => {
		const workarea = this.handler.workarea;
		const dimensionData = this.getPrintDimensionData(values);
		const width = dimensionData.workareaWidth;
		const height = dimensionData.workareaHeight;
		const element = workarea.getElement();
		workarea.set({
			...dimensionData,
		});
		if (workarea.isElement && element?.width && element?.height) {
			workarea.set({
				width: element.width,
				height: element.height,
				scaleX: width / element.width,
				scaleY: height / element.height,
			});
		} else {
			workarea.set({ width, height, scaleX: 1, scaleY: 1 });
		}
		workarea.setCoords();
		this.handler.canvas.centerObject(workarea);
		// Render synchronously so each unit value edit is reflected immediately.
		this.handler.canvas.renderAll();
	};

	/** Set a single-page canvas without applying cover/spine print geometry. */
	public setInnerPageDimensions = (width: number, height: number) => {
		const workarea = this.handler.workarea;
		const nextWidth = Math.max(1, Number(width) || 1);
		const nextHeight = Math.max(1, Number(height) || 1);
		workarea.set({
			width: nextWidth,
			height: nextHeight,
			workareaWidth: nextWidth,
			workareaHeight: nextHeight,
			scaleX: 1,
			scaleY: 1,
			canvasRows: 1,
			printGuides: [],
			innerPage: true,
		});
		workarea.setCoords();
		this.handler.canvas.centerObject(workarea);
		this.handler.canvas.renderAll();
	};

	/** Convert an inner-page physical size to the editor's 96 DPI canvas. */
	public setInnerPageSize = (values: Record<string, any>) => {
		const unit: PrintUnit = values.unit === 'cm' || values.unit === 'mm' ? values.unit : 'in';
		const sideWidth = Math.max(1 / this.pixelsPerUnit[unit], Number(values.sideWidth) || 0);
		const sideHeight = Math.max(1 / this.pixelsPerUnit[unit], Number(values.sideHeight) || 0);
		const width = sideWidth * this.pixelsPerUnit[unit];
		const height = sideHeight * this.pixelsPerUnit[unit];
		const workarea = this.handler.workarea;
		const element = workarea.getElement();
		workarea.set({
			workareaWidth: width,
			workareaHeight: height,
			unit,
			sideWidth,
			sideHeight,
			bleed: 0,
			separateBleed: false,
			horizontalBleed: 0,
			verticalBleed: 0,
			backCoverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
			coverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
			spineSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
			spineWidth: 0,
			spineBleed: 0,
			canvasRows: 1,
			printGuides: [],
			innerPage: true,
		});
		if (workarea.isElement && element?.width && element?.height) {
			workarea.set({
				width: element.width,
				height: element.height,
				scaleX: width / element.width,
				scaleY: height / element.height,
			});
		} else {
			workarea.set({ width, height, scaleX: 1, scaleY: 1 });
		}
		workarea.setCoords();
		this.handler.canvas.centerObject(workarea);
		this.handler.canvas.renderAll();
	};

	public refreshPrintGuides = () => {
		const workarea = this.handler.workarea;
		const width = workarea.workareaWidth || workarea.width * workarea.scaleX;
		const height = workarea.workareaHeight || workarea.height * workarea.scaleY;
		workarea.set('printGuides', this.buildPrintGuides(width, height, workarea));
		this.handler.canvas.requestRenderAll();
	};

	public destroy = () => {
		this.handler.canvas.off({
			'before:render': this.beforePrintGuideRender,
			'after:render': this.afterPrintGuideRender,
		} as any);
	};

	/**
	 * Set the layout on workarea
	 * @param {WorkareaLayout} layout
	 * @returns
	 */
	public setLayout = (layout: WorkareaLayout) => {
		this.handler.workarea.set('layout', layout);
		const { isElement, workareaWidth, workareaHeight } = this.handler.workarea;
		const element = this.handler.workarea.getElement();
		const { canvas } = this.handler;
		let scaleX = 1;
		let scaleY = 1;
		const isFixed = layout === 'fixed';
		const isResponsive = layout === 'responsive';
		const isFullscreen = layout === 'fullscreen';
		if (isElement) {
			if (isFixed) {
				scaleX = workareaWidth / element.width;
				scaleY = workareaHeight / element.height;
			} else if (isResponsive) {
				const scales = this.calculateScale();
				scaleX = scales.scaleX;
				scaleY = scales.scaleY;
			} else {
				scaleX = canvas.getWidth() / element.width;
				scaleY = canvas.getHeight() / element.height;
			}
		}
		this.handler.getObjects().forEach(obj => {
			const { id, player } = obj as unknown as VideoObject;
			if (id !== 'workarea') {
				const objScaleX = !isFullscreen ? 1 : scaleX;
				const objScaleY = !isFullscreen ? 1 : scaleY;
				const objWidth = obj.width * objScaleX * canvas.getZoom();
				const objHeight = obj.height * objScaleY * canvas.getZoom();
				const el = this.handler.elementHandler.findById(obj.id);
				this.handler.elementHandler.setSize(el, obj);
				if (player) {
					player.setPlayerSize(objWidth, objHeight);
				}
				obj.set({
					scaleX: !isFullscreen ? 1 : objScaleX,
					scaleY: !isFullscreen ? 1 : objScaleY,
				});
			}
		});
		if (isResponsive) {
			const center = canvas.getCenterPoint();
			if (isElement) {
				this.handler.workarea.set({
					scaleX: 1,
					scaleY: 1,
				});
				this.handler.zoomHandler.zoomToPoint(center, scaleX);
			} else {
				this.handler.workarea.set({
					width: workareaWidth,
					height: workareaHeight,
				});
				scaleX = canvas.getWidth() / workareaWidth;
				scaleY = canvas.getHeight() / workareaHeight;
				if (workareaHeight >= workareaWidth) {
					scaleX = scaleY;
				} else {
					scaleY = scaleX;
				}
				this.handler.zoomHandler.zoomToPoint(center, scaleX);
			}
			canvas.centerObject(this.handler.workarea);
			canvas.renderAll();
			return;
		}
		if (isElement) {
			this.handler.workarea.set({
				width: element.width,
				height: element.height,
				scaleX,
				scaleY,
			});
		} else {
			const width = isFixed ? workareaWidth : this.handler.canvas.getWidth();
			const height = isFixed ? workareaHeight : this.handler.canvas.getHeight();
			this.handler.workarea.set({
				width,
				height,
				backgroundColor: 'rgba(255, 255, 255, 1)',
			});
			this.handler.canvas.renderAll();
			if (isFixed) {
				canvas.centerObject(this.handler.workarea);
			} else {
				this.handler.workarea.set({
					left: 0,
					top: 0,
				});
			}
		}
		canvas.centerObject(this.handler.workarea);
		const center = canvas.getCenterPoint();
		canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
		this.handler.zoomHandler.zoomToPoint(center, 1);
		canvas.renderAll();
	};

	/**
	 * Set the responsive image on Workarea
	 * @param {string | File} [source]
	 * @param {boolean} [loaded]
	 * @returns
	 */
	public setResponsiveImage = async (source: string | File, loaded?: boolean) => {
		const imageFromUrl = async (src: string = '') => {
			const img = await fabric.FabricImage.fromURL(src);
			const { canvas, workarea, editable } = this.handler;
			const { workareaWidth, workareaHeight } = workarea;
			const { scaleX, scaleY } = this.calculateScale(img);
			const element = img.getElement();
			if (element) {
				workarea.setElement(element);
				workarea.set({ isElement: true, selectable: false });
			} else {
				const image = new Image(workareaWidth, workareaHeight);
				workarea.setElement(image);
				workarea.set({
					isElement: false,
					selectable: false,
					width: workareaWidth,
					height: workareaHeight,
				});
			}
			if (editable && !loaded) {
				canvas.getObjects().forEach(obj => {
					const { id, player } = obj as VideoObject;
					if (id !== 'workarea') {
						const objWidth = obj.width * scaleX;
						const objHeight = obj.height * scaleY;
						const el = this.handler.elementHandler.findById(id);
						this.handler.elementHandler.setScaleOrAngle(el, obj);
						this.handler.elementHandler.setSize(el, obj);
						if (player) {
							player.setPlayerSize(objWidth, objHeight);
						}
						obj.set({ scaleX: 1, scaleY: 1 });
						obj.setCoords();
					}
				});
			}
			this.handler.zoomHandler.zoomToFit();
			canvas.centerObject(workarea);
			return workarea;
		};
		const { workarea } = this.handler;
		if (!source) {
			workarea.set({
				src: null,
				file: null,
			});
			return imageFromUrl(source as string);
		}
		if (source instanceof File) {
			return new Promise<WorkareaObject>(resolve => {
				const reader = new FileReader();
				reader.onload = () => {
					workarea.set({
						file: source,
						src: reader.result as string,
					});
					imageFromUrl(reader.result as string).then(resolve);
				};
				reader.readAsDataURL(source);
			});
		} else {
			workarea.set({
				src: source,
			});
			return imageFromUrl(source);
		}
	};

	/**
	 * Set the image on Workarea
	 * @param {unknown} source
	 * @param {boolean} [loaded=false]
	 * @returns
	 */
	setImage = async (source: unknown, loaded = false) => {
		const { canvas, workarea, editable } = this.handler;
		const resolvedSource = getImageSource(source);
		if (workarea.layout === 'responsive') {
			return this.setResponsiveImage(resolvedSource || '', loaded);
		}
		const imageFromUrl = async (src: string) => {
			const img = await fabric.FabricImage.fromURL(src, { crossOrigin: 'anonymous' });
			let width = canvas.getWidth();
			let height = canvas.getHeight();
			if (workarea.layout === 'fixed') {
				width = workarea.width * workarea.scaleX;
				height = workarea.height * workarea.scaleY;
			}
			let scaleX = 1;
			let scaleY = 1;
			const element = img.getElement();
			if (element) {
				scaleX = width / img.width;
				scaleY = height / img.height;
				workarea.setElement(element);
				workarea.set({
					originX: 'left',
					originY: 'top',
					scaleX,
					scaleY,
					isElement: true,
					selectable: false,
				});
			} else {
				workarea.setElement(new Image());
				workarea.set({
					width,
					height,
					scaleX,
					scaleY,
					isElement: false,
					selectable: false,
				});
			}
			canvas.centerObject(workarea);
			if (editable && !loaded) {
				const { layout } = workarea;
				canvas.getObjects().forEach(obj => {
					const { id, player } = obj as VideoObject;
					if (id !== 'workarea') {
						scaleX = layout === 'fullscreen' ? scaleX : obj.scaleX;
						scaleY = layout === 'fullscreen' ? scaleY : obj.scaleY;
						const el = this.handler.elementHandler.findById(id);
						this.handler.elementHandler.setSize(el, obj);
						if (player) {
							const objWidth = obj.width * scaleX;
							const objHeight = obj.height * scaleY;
							player.setPlayerSize(objWidth, objHeight);
						}
						obj.set({ scaleX, scaleY });
						obj.setCoords();
					}
				});
			}
			const center = canvas.getCenterPoint();
			const zoom = loaded || workarea.layout === 'fullscreen' ? 1 : this.handler.canvas.getZoom();
			canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
			this.handler.zoomHandler.zoomToPoint(center, zoom);
			canvas.renderAll();
			return workarea;
		};
		if (!resolvedSource) {
			const image = new Image(workarea.width, workarea.height);
			image.width = workarea.width;
			image.height = workarea.height;
			workarea.setElement(image);
			workarea.set({
				src: null,
				file: null,
				isElement: false,
			});
			canvas.centerObject(workarea);
			const center = canvas.getCenterPoint();
			const zoom = loaded ? 1 : canvas.getZoom();
			canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
			this.handler.zoomHandler.zoomToPoint(center, zoom);
			canvas.renderAll();
			return workarea;
		}
		if (resolvedSource instanceof File) {
			return new Promise<WorkareaObject>(resolve => {
				const reader = new FileReader();
				reader.onload = () => {
					workarea.set({
						file: resolvedSource,
						src: reader.result as string,
					});
					imageFromUrl(reader.result as string).then(resolve);
				};
				reader.readAsDataURL(resolvedSource);
			});
		} else {
			workarea.set({
				src: resolvedSource,
			});
			return imageFromUrl(resolvedSource);
		}
	};

	/**
	 * Calculate scale to the image
	 *
	 * @param {FabricImage} [image]
	 * @returns
	 */
	public calculateScale = (image?: FabricImage | fabric.FabricImage) => {
		const { canvas, workarea } = this.handler;
		const { workareaWidth, workareaHeight } = workarea;
		const element = (image || workarea).getElement();
		const width = element?.width || workareaWidth;
		const height = element?.height || workareaHeight;
		let scaleX = canvas.getWidth() / width;
		let scaleY = canvas.getHeight() / height;
		if (height >= width) {
			scaleX = scaleY;
			if (canvas.getWidth() < width * scaleX) {
				scaleX = scaleX * (canvas.getWidth() / (width * scaleX));
			}
		} else {
			scaleY = scaleX;
			if (canvas.getHeight() < height * scaleX) {
				scaleX = scaleX * (canvas.getHeight() / (height * scaleX));
			}
		}
		return { scaleX, scaleY };
	};
}

export default WorkareaHandler;
