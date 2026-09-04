export type ImageUploadValue = {
	originFileObj?: unknown;
	uid?: string;
	[key: string]: unknown;
};

const isFile = (value: unknown): value is File =>
	typeof File !== 'undefined' && value instanceof File;

/** Resolve Ant Upload values and persisted image values to a Fabric source. */
export function getImageSource(source: unknown): File | string | undefined {
	if (typeof source === 'string') {
		const value = source.trim();
		return value || undefined;
	}
	if (isFile(source)) return source;
	if (source && typeof source === 'object') {
		const originFileObj = (source as ImageUploadValue).originFileObj;
		if (isFile(originFileObj)) return originFileObj;
	}
	return undefined;
}

function isImageLayer(object: Record<string, any>) {
	return String(object.type || '').toLowerCase() === 'image';
}

/** Keep only reloadable image data in the persisted layer document. */
export function serializeImageLayer<T extends Record<string, any>>(
	object: T,
	options: { preserveWorkareaSource?: boolean } = {},
): T {
	const serialized: Record<string, any> = { ...object };
	if (Array.isArray(serialized.objects)) {
		serialized.objects = serialized.objects.map((child: Record<string, any>) => serializeImageLayer(child, options));
	}

	if (serialized.id === 'workarea') {
		delete serialized.file;
		if (!options.preserveWorkareaSource || typeof serialized.src !== 'string' || !serialized.src.trim()) {
			delete serialized.src;
		}
	} else if (isImageLayer(serialized)) {
		delete serialized.file;
		if (typeof serialized.src !== 'string' || !serialized.src.trim()) {
			delete serialized.src;
		}
	}
	return serialized as T;
}
