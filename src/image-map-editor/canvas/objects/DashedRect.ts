import * as fabric from 'fabric';

import { FabricObject } from '../models';
import { registerFabricClass, resolveFromObject, toObject } from '../utils';

export type DashedRectObject = FabricObject & {
	lineColor: string;
	dashed: boolean;
	cornerRadius: number;
	lineThickness: number;
	dashDensity: number;
};

class DashedRect extends fabric.Rect {
	static type = 'dashedRect';
	superType = 'shape';
	lineColor: string;
	dashed: boolean;
	cornerRadius: number;
	lineThickness: number;
	dashDensity: number;

	constructor(options: any = {}) {
		const { type: _type, ...objectOptions } = options;
		// The dash rhythm depends on the current rendered bounds. Disable Fabric's
		// bitmap cache so scaling invokes _render with the latest dimensions.
		super({ ...objectOptions, objectCaching: false });
		this.lineColor = String(options.lineColor || '#7f7f7f');
		this.dashed = options.dashed !== false;
		this.cornerRadius = Math.max(0, Number(options.cornerRadius) || 0);
		this.lineThickness = Math.max(0.1, Number(options.lineThickness) || 1);
		this.dashDensity = Math.max(1, Math.round(Number(options.dashDensity) || 8));
	}

	private getPathPoints(width: number, height: number, radius: number) {
		const left = -width / 2;
		const top = -height / 2;
		const right = width / 2;
		const bottom = height / 2;
		const points: Array<{ x: number; y: number }> = [];
		const addPoint = (x: number, y: number) => points.push({ x, y });
		const addLine = (x: number, y: number) => addPoint(x, y);
		const addArc = (centerX: number, centerY: number, startAngle: number, endAngle: number) => {
			const steps = 16;
			for (let index = 1; index <= steps; index += 1) {
				const angle = startAngle + ((endAngle - startAngle) * index) / steps;
				addPoint(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
			}
		};
		if (radius <= 0) {
			return [
				{ x: left, y: top },
				{ x: right, y: top },
				{ x: right, y: bottom },
				{ x: left, y: bottom },
				{ x: left, y: top },
			];
		}
		addPoint(left + radius, top);
		addLine(right - radius, top);
		addArc(right - radius, top + radius, -Math.PI / 2, 0);
		addLine(right, bottom - radius);
		addArc(right - radius, bottom - radius, 0, Math.PI / 2);
		addLine(left + radius, bottom);
		addArc(left + radius, bottom - radius, Math.PI / 2, Math.PI);
		addLine(left, top + radius);
		addArc(left + radius, top + radius, Math.PI, Math.PI * 1.5);
		addPoint(left + radius, top);
		return points;
	}

	private drawDashedPath(
		ctx: CanvasRenderingContext2D,
		points: Array<{ x: number; y: number }>,
		scaleX: number,
		scaleY: number,
		dashLength: number,
		gapLength: number,
		lineThickness: number,
	) {
		const drawThickSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
			const screenFrom = { x: from.x * scaleX, y: from.y * scaleY };
			const screenTo = { x: to.x * scaleX, y: to.y * scaleY };
			const deltaX = screenTo.x - screenFrom.x;
			const deltaY = screenTo.y - screenFrom.y;
			const length = Math.hypot(deltaX, deltaY);
			if (length <= 0) return;
			const halfThickness = lineThickness / 2;
			const normalX = (-deltaY / length) * halfThickness;
			const normalY = (deltaX / length) * halfThickness;
			const polygon = [
				{ x: (screenFrom.x + normalX) / scaleX, y: (screenFrom.y + normalY) / scaleY },
				{ x: (screenTo.x + normalX) / scaleX, y: (screenTo.y + normalY) / scaleY },
				{ x: (screenTo.x - normalX) / scaleX, y: (screenTo.y - normalY) / scaleY },
				{ x: (screenFrom.x - normalX) / scaleX, y: (screenFrom.y - normalY) / scaleY },
			];
			ctx.beginPath();
			ctx.moveTo(polygon[0].x, polygon[0].y);
			polygon.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
			ctx.closePath();
			ctx.fill();
		};

		if (!this.dashed) {
			for (let index = 1; index < points.length; index += 1) {
				drawThickSegment(points[index - 1], points[index]);
			}
			return;
		}

		let drawing = true;
		let remaining = dashLength;
		for (let index = 1; index < points.length; index += 1) {
			const start = points[index - 1];
			const end = points[index];
			const localDeltaX = end.x - start.x;
			const localDeltaY = end.y - start.y;
			const screenLength = Math.hypot(localDeltaX * scaleX, localDeltaY * scaleY);
			if (screenLength <= 0) continue;
			let consumed = 0;
			while (consumed < screenLength - 0.0001) {
				const step = Math.min(remaining, screenLength - consumed);
				const from = {
					x: start.x + (localDeltaX * consumed) / screenLength,
					y: start.y + (localDeltaY * consumed) / screenLength,
				};
				const to = {
					x: start.x + (localDeltaX * (consumed + step)) / screenLength,
					y: start.y + (localDeltaY * (consumed + step)) / screenLength,
				};
				if (drawing) {
					drawThickSegment(from, to);
				}
				consumed += step;
				remaining -= step;
				if (remaining <= 0.0001) {
					drawing = !drawing;
					remaining = drawing ? dashLength : gapLength;
				}
			}
		}
	}

	_render(ctx: CanvasRenderingContext2D) {
		const width = Math.max(0, this.width || 0);
		const height = Math.max(0, this.height || 0);
		const lineThickness = Math.max(0.1, Number(this.lineThickness) || 1);
		const radius = Math.min(Math.max(0, Number(this.cornerRadius) || 0), width / 2, height / 2);
		// Use the rendered size so resizing with Fabric handles recalculates the
		// dash rhythm instead of stretching a fixed pattern.
		const scaleX = Math.max(Math.abs(Number(this.scaleX || 1)), 0.0001);
		const scaleY = Math.max(Math.abs(Number(this.scaleY || 1)), 0.0001);
		const points = this.getPathPoints(width, height, radius);
		// Measure the complete closed perimeter once so all four edges share one
		// continuous dash phase, including across the corners.
		const perimeter = points.slice(1).reduce(
			(total, point, index) => total + Math.hypot(
				(point.x - points[index].x) * scaleX,
				(point.y - points[index].y) * scaleY,
			),
			0,
		);
		// Density is expressed as dash/gap pairs per 100 rendered pixels. The
		// pattern is consumed in rendered (screen) distance so both axes stay even.
		const density = Math.max(1, Number(this.dashDensity) || 8);
		const patternLength = Math.max(2, 100 / density);
		const dashLength = patternLength * 0.58;
		const gapLength = patternLength - dashLength;

		ctx.save();
		ctx.fillStyle = this.lineColor || '#7f7f7f';
		this.drawDashedPath(ctx, points, scaleX, scaleY, dashLength, gapLength, lineThickness);
		ctx.restore();
	}

	toObject(propertiesToInclude: any[] = []) {
		return toObject(super.toObject(propertiesToInclude), this, propertiesToInclude, {
			lineColor: this.lineColor,
			dashed: this.dashed,
			cornerRadius: this.cornerRadius,
			lineThickness: this.lineThickness,
			dashDensity: this.dashDensity,
		});
	}

	static fromObject(options: any, _abortable?: { signal?: AbortSignal }) {
		return resolveFromObject(new DashedRect(options));
	}
}

registerFabricClass('DashedRect', DashedRect, DashedRect.type);

export default DashedRect;
