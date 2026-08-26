export interface EditorObjectLike {
	id?: string;
	type?: string;
	superType?: string;
}

export interface ImageMapSummary {
	objectCount: number;
	selectedType: string;
	hasSelection: boolean;
}

export const summarizeImageMap = (
	objects: EditorObjectLike[] = [],
	selectedItem?: EditorObjectLike | null,
): ImageMapSummary => {
	const objectCount = objects.filter(object => object.id !== 'workarea' && object.superType !== 'port').length;

	return {
		objectCount,
		selectedType: selectedItem?.superType === 'text'
			? 'textbox'
			: selectedItem?.type || selectedItem?.superType || 'map',
		hasSelection: Boolean(selectedItem?.id && selectedItem.id !== 'workarea'),
	};
};
