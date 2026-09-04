import { ActiveSelection, Point, util } from 'fabric';
import Handler from './Handler';

type Alignment = 'center' | 'left' | 'middle' | 'right';
const ALIGNMENT_EPSILON = 0.0001;

class AlignmentHandler {
	handler: Handler;
	private readonly pixelsPerUnit = { in: 96, cm: 96 / 2.54, mm: 96 / 25.4 } as const;
	constructor(handler: Handler) {
		this.handler = handler;
	}

	private align = (alignment: Alignment) => {
		const activeObject = this.handler.canvas.getActiveObject();
		if (!activeObject || !this.handler.isActiveSelection(activeObject)) {
			return;
		}

		const activeSelection = activeObject as ActiveSelection;
		const selectionBounds = activeSelection.getBoundingRect();
		const objects = activeSelection.getObjects();
		const objectBounds = objects.map(object => object.getBoundingRect());
		const target =
			alignment === 'left'
				? Math.min(...objectBounds.map(bounds => bounds.left))
				: alignment === 'right'
					? Math.max(...objectBounds.map(bounds => bounds.left + bounds.width))
					: alignment === 'center'
						? selectionBounds.left + selectionBounds.width / 2
						: selectionBounds.top + selectionBounds.height / 2;
		const selectionTransform = activeSelection.calcTransformMatrix();
		let changed = false;

		objects.forEach((object, index) => {
			const bounds = objectBounds[index];
			const current =
				alignment === 'left'
					? bounds.left
					: alignment === 'right'
						? bounds.left + bounds.width
						: alignment === 'center'
							? bounds.left + bounds.width / 2
							: bounds.top + bounds.height / 2;
			const delta = target - current;
			if (Math.abs(delta) < ALIGNMENT_EPSILON) {
				return;
			}

			const canvasDelta = new Point(
				alignment === 'middle' ? 0 : delta,
				alignment === 'middle' ? delta : 0,
			);
			const localDelta = util.sendVectorToPlane(canvasDelta, undefined, selectionTransform);
			object.set({
				left: object.left + localDelta.x,
				top: object.top + localDelta.y,
			});
			object.setCoords();
			changed = true;
		});

		if (!changed) {
			return;
		}

		activeSelection.triggerLayout();
		activeSelection.setCoords();
		activeSelection.getObjects().forEach(object => object.setCoords());
		this.handler.canvas.renderAll();
		this.handler.transactionHandler.save('modified');
	};

	/**
	 * Align left at selection
	 */
	public left = () => {
		this.align('left');
	};

	/**
	 * Align center at selection
	 */
	public center = () => {
		this.align('center');
	};

	/**
	 * Align middle at selection
	 */
	public middle = () => {
		this.align('middle');
	};

	/**
	 * Align right at selection
	 */
	public right = () => {
		this.align('right');
	};

	/**
	 * Move the active object to the centre of the print region containing its
	 * current centre. Regions are derived from the solid content guides rather
	 * than from the editor viewport, so bleed and spine areas are respected.
	 */
	private centerInPrintRegion = (
		axis: 'horizontal' | 'vertical',
		targetObject = this.handler.canvas.getActiveObject(),
		allowToggle = true,
	) => {
		const activeObject = targetObject;
		const workarea = this.handler.workarea;
		if (!activeObject || !workarea || activeObject === workarea) return;

		const marker = axis === 'horizontal' ? 'horizontalCentered' : 'verticalCentered';
		if (allowToggle && activeObject.get(marker) === true) {
			activeObject.set(marker, false);
			activeObject.setCoords();
			if (activeObject instanceof ActiveSelection) {
				activeObject.triggerLayout();
				activeObject.setCoords();
				activeObject.getObjects().forEach(object => object.setCoords());
			}
			this.handler.canvas.renderAll();
			this.handler.transactionHandler.save('modified');
			this.handler.onModified?.(activeObject);
			return;
		}

		const origin = workarea.getPointByOrigin('left', 'top');
		const workareaWidth = Math.abs(workarea.width * (workarea.scaleX || 1));
		const workareaHeight = Math.abs(workarea.height * (workarea.scaleY || 1));
		const isHorizontal = axis === 'horizontal';
		const size = isHorizontal ? workareaWidth : workareaHeight;
		const offset = isHorizontal ? origin.x : origin.y;
		const unit = workarea.unit === 'cm' || workarea.unit === 'mm' ? workarea.unit : 'in';
		const factor = this.pixelsPerUnit[unit];
		const logicalWidth = Number(workarea.workareaWidth || workarea.width || 1);
		const logicalHeight = Number(workarea.workareaHeight || workarea.height || 1);
		const scaleX = workareaWidth / logicalWidth;
		const scaleY = workareaHeight / logicalHeight;
		const bleed = Math.max(0, Number(workarea.bleed || 0));
		const horizontalBleed = (workarea.separateBleed === true ? Number(workarea.horizontalBleed ?? bleed) : bleed) * factor;
		const verticalBleed = (workarea.separateBleed === true ? Number(workarea.verticalBleed ?? bleed) : bleed) * factor;
		const sideWidth = Math.max(0, Number(workarea.sideWidth || 0)) * factor;
		const spineBleed = Math.max(0, Number(workarea.spineBleed || 0)) * factor;
		const spineWidth = Math.max(0, Number(workarea.spineWidth || 0)) * factor;
		const boundaries = isHorizontal
			? (workarea.canvasRows === 2
				? [
					horizontalBleed * scaleX,
					(horizontalBleed + sideWidth) * scaleX,
					(logicalWidth - horizontalBleed - sideWidth) * scaleX,
					(logicalWidth - horizontalBleed) * scaleX,
				]
				: [
					horizontalBleed * scaleX,
					(horizontalBleed + sideWidth + spineBleed) * scaleX,
					(horizontalBleed + sideWidth + spineBleed + spineWidth) * scaleX,
					(logicalWidth - horizontalBleed) * scaleX,
				])
			: (() => {
				const rows = workarea.canvasRows === 2 ? 2 : 1;
				const gap = rows === 2 ? Math.max(0, Number(workarea.canvasRowGap ?? 0)) : 0;
				const rowHeight = Math.max(1, (logicalHeight - gap * (rows - 1)) / rows);
				const values: number[] = [];
				for (let row = 0; row < rows; row += 1) {
					const rowTop = row * (rowHeight + gap);
					values.push((rowTop + verticalBleed * factor) * scaleY);
					values.push((rowTop + rowHeight - verticalBleed * factor) * scaleY);
				}
				return values;
			})();
		const center = activeObject.getCenterPoint();
		const current = (isHorizontal ? center.x : center.y) - offset;
		let start = boundaries[0];
		let end = boundaries[boundaries.length - 1];
		let foundRegion = false;
		if (isHorizontal) {
			for (let index = 0; index < boundaries.length - 1; index += 1) {
				if (current >= boundaries[index] && current <= boundaries[index + 1]) {
					start = boundaries[index];
					end = boundaries[index + 1];
					foundRegion = true;
					break;
				}
			}
		} else {
			// Do not treat a gap between rows as a centring region. Pick the row
			// whose content bounds contain the object's centre.
			for (let index = 0; index + 1 < boundaries.length; index += 2) {
				if (current >= boundaries[index] && current <= boundaries[index + 1]) {
					start = boundaries[index];
					end = boundaries[index + 1];
					foundRegion = true;
					break;
				}
			}
		}
		if (!foundRegion && !isHorizontal) {
			let nearestIndex = 0;
			let nearestDistance = Number.POSITIVE_INFINITY;
			for (let index = 0; index + 1 < boundaries.length; index += 2) {
				const distance = current < boundaries[index]
					? boundaries[index] - current
					: current - boundaries[index + 1];
				if (distance < nearestDistance) {
					nearestDistance = distance;
					nearestIndex = index;
				}
			}
			start = boundaries[nearestIndex];
			end = boundaries[nearestIndex + 1] ?? size;
		} else if (current < start) {
			start = boundaries[0];
			end = boundaries[1] ?? size;
		} else if (current > end) {
			start = boundaries.at(-2) ?? 0;
			end = boundaries.at(-1) ?? size;
		}

		const target = offset + (start + end) / 2;
		const nextPoint = isHorizontal ? new Point(target, center.y) : new Point(center.x, target);
		activeObject.setPositionByOrigin(nextPoint, 'center', 'center');
		activeObject.set(marker, true);
		activeObject.setCoords();
		if (activeObject instanceof ActiveSelection) {
			activeObject.triggerLayout();
			activeObject.setCoords();
			activeObject.getObjects().forEach(object => object.setCoords());
		}
		if (allowToggle) {
			this.handler.canvas.renderAll();
			this.handler.transactionHandler.save('modified');
			this.handler.onModified?.(activeObject);
		}
	};

	public centerHorizontallyInRegion = () => this.centerInPrintRegion('horizontal');

	public centerVerticallyInRegion = () => this.centerInPrintRegion('vertical');

	/** Apply a persisted center marker during export without changing selection or history. */
	public centerObjectInPrintRegion = (object: any, axis: 'horizontal' | 'vertical') => {
		this.centerInPrintRegion(axis, object, false);
	};
}

export default AlignmentHandler;
