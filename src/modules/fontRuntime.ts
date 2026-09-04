import { browserAlbumApi } from '../api';

type RegisteredFontFace = {
	face: FontFace;
	filePath: string;
	loading: Promise<void>;
};

const registeredFontFaces = new Map<string, RegisteredFontFace>();

export const applyTextFont = async (familyValue: string, filePathValue: string): Promise<void> => {
	const family = familyValue.trim();
	const filePath = filePathValue.trim();
	if (!family || !filePath || typeof FontFace === 'undefined' || typeof document === 'undefined') return;

	const key = `${family}\u0000${filePath}`;
	const current = registeredFontFaces.get(key);
	if (current) {
		await current.loading;
		return;
	}

	const face = new FontFace(family, `url(${JSON.stringify(filePath)})`);
	const registered: RegisteredFontFace = {
		face,
		filePath,
		loading: face.load().then(loadedFace => {
			document.fonts.add(loadedFace);
		}),
	};
	registeredFontFaces.set(key, registered);
	try {
		await registered.loading;
	} catch (error) {
		if (registeredFontFaces.get(key) === registered) registeredFontFaces.delete(key);
		throw error;
	}
};

export const loadTextFonts = async (search: string) => {
	const fonts = (await browserAlbumApi.fonts.list({ search, limit: 100, offset: 0 }))
		.filter(font => font.enabled && Boolean((font.family || font.name).trim()));
	return fonts.map(font => ({
		id: String(font.id),
		family: (font.name || font.family || font.preferredName || font.englishName).trim(),
		label: (font.name || font.family || font.preferredName || font.englishName).trim(),
		filePath: font.filePath.trim(),
		aliases: [
			font.name,
			font.family,
			font.allName,
			font.englishName,
			font.preferredName,
			font.postscriptName,
		].map(value => value.trim()).filter(Boolean),
	}));
};
