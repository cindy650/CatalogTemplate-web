import type { PrintUnit } from '../../canvas/models';

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
		spineWidthMode: value.spineWidthMode === 'by_page_count' ? 'by_page_count' : 'fixed',
		spineWidth: positiveNumber(value.spineWidth, 0.55),
		minSpineWidth: positiveNumber(value.minSpineWidth, 0.55),
		maxSpineWidth: positiveNumber(value.maxSpineWidth, 0.7),
		spineBleed: positiveNumber(value.spineBleed, 0.55),
		paperThickness: positiveNumber(value.paperThickness, 0),
	};
};

export const resolveImageMapSpineWidth = (
	value: Partial<ImageMapSizeSchemeValue>,
) => {
	const spineWidth = positiveNumber(value.spineWidth, 0);
	if (value.spineWidthMode !== 'by_page_count') {
		return spineWidth;
	}
	const pageCount = positiveInteger(value.pageCount, 1);
	const paperThickness = positiveNumber(value.paperThickness, 0);
	const unit = value.unit === 'cm' || value.unit === 'mm' ? value.unit : 'in';
	const thicknessPerPage = paperThickness > 0
		? paperThickness / (unit === 'in' ? 25.4 : unit === 'cm' ? 10 : 1)
		: spineWidth;
	const calculated = thicknessPerPage * pageCount;
	const minimum = positiveNumber(value.minSpineWidth, 0);
	const maximum = positiveNumber(value.maxSpineWidth, 0);
	const pageOptions = Array.isArray(value.pageCountOptions)
		? value.pageCountOptions.map(item => positiveInteger(item, 0)).filter(item => item > 0).sort((left, right) => left - right)
		: [];
	const minimumPageCount = pageOptions[0];
	const maximumPageCount = pageOptions.at(-1);
	// The configured endpoints are authoritative: the smallest and largest
	// selectable page counts must land on the configured spine bounds.
	if (paperThickness > 0 && minimumPageCount !== undefined && maximumPageCount !== undefined && maximumPageCount > minimumPageCount) {
		if (pageCount <= minimumPageCount) return minimum;
		if (maximum > 0 && pageCount >= maximumPageCount) return maximum;
	}
	return Math.max(minimum, maximum > 0 ? Math.min(calculated, maximum) : calculated);
};

const inchesPerUnit: Record<PrintUnit, number> = {
	in: 1,
	cm: 1 / 2.54,
	mm: 1 / 25.4,
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
		spineWidth: convertedNumber(value.spineWidth ?? 0, from, to),
		minSpineWidth: convertedNumber(value.minSpineWidth ?? 0, from, to),
		maxSpineWidth: convertedNumber(value.maxSpineWidth ?? 0, from, to),
		spineBleed: convertedNumber(value.spineBleed ?? 0, from, to),
	};
};

export const createImageMapSizeSchemes = (
	values?: Partial<ImageMapSizeSchemeValue>[],
): ImageMapSizeSchemeValue[] => values?.length
	? values.map(value => createImageMapSizeScheme(value))
	: [createImageMapSizeScheme()];
