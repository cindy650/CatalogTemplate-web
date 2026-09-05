import * as fabric from 'fabric';

import { FabricObject } from '../models';
import { registerFabricClass, resolveFromObject, toObject } from '../utils';

export type LinesObject = FabricObject & {
	lineThickness: number;
	lineSpacing: number;
	lineColor: string;
	lineCount: number;
};

class Lines extends fabric.Rect {
	static type = 'lines';
	superType = 'shape';
	lineThickness: number;
	lineSpacing: number;
	lineColor: string;
	lineCount: number;

	constructor(options: any = {}) {
		const { type: _type, ...objectOptions } = options;
		super(objectOptions);
		this.lineThickness = Math.max(0.1, Number(options.lineThickness) || 0.7);
		this.lineSpacing = Math.max(0, Number(options.lineSpacing) || 12);
		this.lineColor = String(options.lineColor || '#7f7f7f');
		this.lineCount = Math.max(1, Math.round(Number(options.lineCount) || 3));
		const scaleY = Number(this.scaleY || 1);
		const requiredHeight = this.getRequiredHeight();
		if (Number(this.height || 0) * scaleY < requiredHeight && scaleY > 0) {
			this.set('height', requiredHeight / scaleY);
		}
	}

	getRequiredHeight() {
		const thickness = Math.max(0.1, Number(this.lineThickness) || 0.7);
		const spacing = Math.max(0, Number(this.lineSpacing) || 0);
		const count = Math.max(1, Math.round(Number(this.lineCount) || 1));
		return thickness * count + spacing * (count - 1);
	}

	_render(ctx: CanvasRenderingContext2D) {
		const width = this.width || 0;
		const height = this.height || 0;
		const thickness = Math.max(0.1, Number(this.lineThickness) || 0.7);
		const renderThickness = thickness;
		const spacing = Math.max(0, Number(this.lineSpacing) || 0);
		const count = Math.max(1, Math.round(Number(this.lineCount) || 1));
		const totalHeight = renderThickness * count + spacing * (count - 1);
		const startY = -totalHeight / 2;

		ctx.save();
		ctx.beginPath();
		ctx.rect(-width / 2, -height / 2, width, height);
		ctx.clip();
		ctx.fillStyle = this.lineColor || '#7f7f7f';
		for (let index = 0; index < count; index += 1) {
			const y = startY + index * (renderThickness + spacing);
			ctx.fillRect(-width / 2, y, width, renderThickness);
		}
		ctx.restore();
	}

	toObject(propertiesToInclude: any[] = []) {
		return toObject(super.toObject(propertiesToInclude), this, propertiesToInclude, {
			lineThickness: this.lineThickness,
			lineSpacing: this.lineSpacing,
			lineColor: this.lineColor,
			lineCount: this.lineCount,
		});
	}

	static fromObject(options: any, _abortable?: { signal?: AbortSignal }) {
		return resolveFromObject(new Lines(options));
	}
}

registerFabricClass('Lines', Lines, Lines.type);

export default Lines;
