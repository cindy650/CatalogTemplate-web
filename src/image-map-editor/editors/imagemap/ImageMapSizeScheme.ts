import type { PrintUnit } from '../../canvas/models';
import type { SpineWidthFormula } from '@shared/domain';

export interface ImageMapSafeDistance {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export interface ImageMapSizeSchemeValue {
	id: string;
	/** Internal flag used to preserve IDs assigned by the catalog API when labels change. */
	idIsPersisted?: boolean;
	label: string;
	unit: PrintUnit;
	pageCount: number;
	pageCountOptions: number[];
	sideWidth: number;
	sideHeight: number;
	bleed: number;
	spineWidthMode: 'fixed' | 'by_page_count';
	spineWidth: number;
	minSpineWidth: number;
	maxSpineWidth: number;
	spineBleed: number;
	spineWidthFormula?: SpineWidthFormula;
	backCoverSafeDistance: ImageMapSafeDistance;
	coverSafeDistance: ImageMapSafeDistance;
	spineSafeDistance: ImageMapSafeDistance;
	/** Use independent horizontal and vertical bleed controls for this size. */
	separateBleed?: boolean;
	horizontalBleed?: number;
	verticalBleed?: number;
	/** Gap between rows in the two-row canvas, in editor pixels. */
	canvasRowGap?: number;
	/** Paper thickness is always entered and stored in millimetres. */
	paperThickness: number;
}

const positiveNumber = (value: unknown, fallback: number) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const positiveInteger = (value: unknown, fallback: number) => {
	const parsed = Math.round(Number(value));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const createPageCountOptions = (values: unknown, selected: number) => {
	const options = Array.isArray(values)
		? values.map(value => positiveInteger(value, 0)).filter(value => value > 0)
		: [];
	return Array.from(new Set([...(options.length ? options : [50, 100]), selected])).sort((left, right) => left - right);
};

const createSafeDistance = (value?: Partial<ImageMapSafeDistance>): ImageMapSafeDistance => ({
	top: positiveNumber(value?.top, 0),
	right: positiveNumber(value?.right, 0),
	bottom: positiveNumber(value?.bottom, 0),
	left: positiveNumber(value?.left, 0),
});

export const createImageMapSizeScheme = (
	value: Partial<ImageMapSizeSchemeValue> = {},
): ImageMapSizeSchemeValue => {
	const pageCount = positiveInteger(value.pageCount, 50);
	const pageCountOptions = createPageCountOptions(value.pageCountOptions, pageCount);
	const label = value.label?.trim() || '9*6';
	return {
		id: value.id?.trim() || label,
		...(value.idIsPersisted !== undefined ? { idIsPersisted: value.idIsPersisted } : {}),
		label,
		unit: value.unit === 'cm' || value.unit === 'mm' ? value.unit : 'in',
		pageCount: pageCountOptions.includes(pageCount) ? pageCount : pageCountOptions[0],
		pageCountOptions,
		sideWidth: positiveNumber(value.sideWidth, 9),
		sideHeight: positiveNumber(value.sideHeight, 6),
		bleed: positiveNumber(value.bleed, 0.79),
		separateBleed: value.separateBleed === true,
		horizontalBleed: positiveNumber(value.horizontalBleed, positiveNumber(value.bleed, 0.79)),
		verticalBleed: positiveNumber(value.verticalBleed, positiveNumber(value.bleed, 0.79)),
		...(value.canvasRowGap !== undefined ? { canvasRowGap: positiveNumber(value.canvasRowGap, 0) } : {}),
		spineWidthMode: value.spineWidthMode === 'by_page_count' ? 'by_page_count' : 'fixed',
		spineWidth: positiveNumber(value.spineWidth, 0.55),
		minSpineWidth: positiveNumber(value.minSpineWidth, 0.55),
		maxSpineWidth: positiveNumber(value.maxSpineWidth, 0.7),
		spineBleed: positiveNumber(value.spineBleed, 0.55),
		...(value.spineWidthFormula ? { spineWidthFormula: {
			unit: value.spineWidthFormula.unit === 'in' || value.spineWidthFormula.unit === 'mm' ? value.spineWidthFormula.unit : 'cm',
			pageCountCoefficient: positiveNumber(value.spineWidthFormula.pageCountCoefficient, 0),
			pageCountThickness: positiveNumber(value.spineWidthFormula.pageCountThickness, 0),
			baseWidth: positiveNumber(value.spineWidthFormula.baseWidth, 0),
			additionalWidth: positiveNumber(value.spineWidthFormula.additionalWidth, 0),
			spineBleed: 0,
		} } : {}),
		backCoverSafeDistance: createSafeDistance(value.backCoverSafeDistance),
		coverSafeDistance: createSafeDistance(value.coverSafeDistance),
		spineSafeDistance: createSafeDistance(value.spineSafeDistance),
		paperThickness: positiveNumber(value.paperThickness, 0),
	};
};

export const resolveImageMapSpineWidth = (
	value: Partial<ImageMapSizeSchemeValue>,
) => {
	const spineWidth = positiveNumber(value.spineWidth, 0);
	const formula = value.spineWidthFormula;
	if (!formula) {
		// Changing the mode cannot resize a formula-less product. Its explicit
		// width remains authoritative, with the configured bounds only acting as
		// a fallback when no usable width has been stored.
		if (spineWidth > 0) return spineWidth;
		const minimum = positiveNumber(value.minSpineWidth, 0);
		return minimum > 0 ? minimum : positiveNumber(value.maxSpineWidth, 0);
	}
	if (value.spineWidthMode !== 'by_page_count') {
		return spineWidth;
	}
	const pageOptions = Array.isArray(value.pageCountOptions)
		? value.pageCountOptions.map(item => positiveInteger(item, 0)).filter(item => item > 0).sort((left, right) => left - right)
		: [];
	const pageCount = positiveInteger(value.pageCount, pageOptions[0] ?? 50);
	const formulaUnit = formula.unit === 'in' || formula.unit === 'mm' ? formula.unit : 'cm';
	const canvasUnit = value.unit === 'cm' || value.unit === 'mm' ? value.unit : 'in';
	const unitToInches: Record<PrintUnit, number> = { in: 1, cm: 1 / 2.54, mm: 1 / 25.4 };
	const formulaWidth = pageCount * positiveNumber(formula.pageCountCoefficient, 0) * positiveNumber(formula.pageCountThickness, 0)
		+ positiveNumber(formula.baseWidth, 0)
		+ positiveNumber(formula.additionalWidth, 0);
	return Number((formulaWidth * unitToInches[formulaUnit] / unitToInches[canvasUnit]).toFixed(4));
};

const inchesPerUnit: Record<PrintUnit, number> = {
	in: 1,
	cm: 1 / 2.54,
	mm: 1 / 25.4,
};

export const imageMapPixelsPerUnit: Record<PrintUnit, number> = {
	in: 96,
	cm: 96 / 2.54,
	mm: 96 / 25.4,
};

const convertedNumber = (value: number, from: PrintUnit, to: PrintUnit) => {
	const converted = positiveNumber(value, 0) * inchesPerUnit[from] / inchesPerUnit[to];
	return Number(converted.toFixed(4));
};

export const convertImageMapSizeSchemeUnit = (
	value: Partial<ImageMapSizeSchemeValue>,
	from: PrintUnit,
	to: PrintUnit,
) => {
	if (from === to) {
		return { ...value, unit: to };
	}
	return {
		...value,
		unit: to,
		sideWidth: convertedNumber(value.sideWidth ?? 0, from, to),
		sideHeight: convertedNumber(value.sideHeight ?? 0, from, to),
		bleed: convertedNumber(value.bleed ?? 0, from, to),
		horizontalBleed: convertedNumber(value.horizontalBleed ?? value.bleed ?? 0, from, to),
		verticalBleed: convertedNumber(value.verticalBleed ?? value.bleed ?? 0, from, to),
		spineWidth: convertedNumber(value.spineWidth ?? 0, from, to),
		minSpineWidth: convertedNumber(value.minSpineWidth ?? 0, from, to),
		maxSpineWidth: convertedNumber(value.maxSpineWidth ?? 0, from, to),
		spineBleed: convertedNumber(value.spineBleed ?? 0, from, to),
		// Safe distances are always stored in millimetres and do not follow the size unit.
		backCoverSafeDistance: createSafeDistance(value.backCoverSafeDistance),
		coverSafeDistance: createSafeDistance(value.coverSafeDistance),
		spineSafeDistance: createSafeDistance(value.spineSafeDistance),
	};
};

export const createImageMapSizeSchemes = (
	values?: Partial<ImageMapSizeSchemeValue>[],
): ImageMapSizeSchemeValue[] => values?.length
	? values.map(value => createImageMapSizeScheme(value))
	: [createImageMapSizeScheme()];
