import { browserAlbumApi } from '../../api';
import type {
  ImageMapFontLayoutCategoryLoader,
  ImageMapFontLayoutCreator,
  ImageMapFontLayoutDeleter,
  ImageMapFontLayoutLayerData,
  ImageMapFontLayoutSizeOptionLoader,
  ImageMapFontLayoutSizeOptionSyncer,
  ImageMapFontLayoutSizeLoader,
  ImageMapFontLayoutSaver,
  ImageMapFontLayoutUpdater
} from '../../image-map-editor/editor-entry';

export const loadFontLayouts = async (shopId: string | number, productId?: number) => {
  const numericShopId = Number(shopId);
  if (!Number.isFinite(numericShopId)) return [];

  const layouts = [];
  const seenIds = new Set<number>();
  const pageSize = 100;
  let offset = 0;

  while (true) {
    const page = await browserAlbumApi.fontLayoutLibrary.list({
      shopId: numericShopId,
      productId,
      limit: pageSize,
      offset
    });
    const nextPage = page.filter((layout) => !seenIds.has(layout.id));
    nextPage.forEach((layout) => seenIds.add(layout.id));
    layouts.push(...nextPage);
    if (page.length < pageSize || nextPage.length === 0) break;
    offset += page.length;
  }

  return layouts.map((layout) => ({
    id: layout.id,
    name: layout.name,
    category: layout.productCategoryName,
    productId: layout.productId,
    previewImage: layout.previewImage,
    layerCount: layout.layers.objects.length,
    layers: layout.layers
  }));
};

export const loadFontLayoutCategories: ImageMapFontLayoutCategoryLoader = async (shopId) => (
  (await browserAlbumApi.products.list({ shopId: Number(shopId), limit: 100, offset: 0 }))
    .filter((product) => product.enabled)
    .map((product) => ({ value: product.id, label: product.name }))
);

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
    loading: face.load().then((loadedFace) => {
      document.fonts.add(loadedFace);
    })
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
    .filter((font) => font.enabled && Boolean((font.family || font.name).trim()));
  return fonts.map((font) => ({
    id: String(font.id),
    // font_name is the stable per-font identifier. Other name fields may be
    // shared by multiple records and are retained only as search aliases.
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
    ].map((value) => value.trim()).filter(Boolean),
  }));
};

export const createFontLayout: ImageMapFontLayoutCreator = async (shopId, name, previewFile, layers, productId) => {
  const created = await browserAlbumApi.fontLayoutLibrary.create({
    shopId: Number(shopId),
    ...(productId !== undefined ? { productId: Number(productId) } : {}),
    name,
    sortKey: '',
    layers: layers ?? { objects: [], animations: [], styles: [], dataSources: [] }
  });
  if (previewFile) await browserAlbumApi.fontLayoutLibrary.uploadPreview(created.id, previewFile);
};

export const deleteFontLayout: ImageMapFontLayoutDeleter = async (layoutId) => {
  await browserAlbumApi.fontLayoutLibrary.delete(Number(layoutId));
};

export const saveFontLayout: ImageMapFontLayoutSaver = async (layoutId, layers: ImageMapFontLayoutLayerData) => {
  await browserAlbumApi.fontLayoutLibrary.update(Number(layoutId), { layers });
};

export const loadFontLayoutSizeOptions: ImageMapFontLayoutSizeOptionLoader = async (layoutId, sizeTemplateId) => (
  browserAlbumApi.fontLayoutLibrary.sizeOptions(Number(layoutId), sizeTemplateId)
);

export const loadFontLayoutSize: ImageMapFontLayoutSizeLoader = async (layoutId, sizeTemplateId, sizeOptionId) => {
  const layout = await browserAlbumApi.fontLayoutLibrary.get(Number(layoutId), { sizeTemplateId, sizeOptionId });
  return {
    layers: layout.layers,
    layersSource: layout.layersSource,
    usingBaseLayers: layout.usingBaseLayers,
    message: layout.message
  };
};

export const syncFontLayoutSizeOptions: ImageMapFontLayoutSizeOptionSyncer = async (layoutId, sizeTemplateId, items) => (
  browserAlbumApi.fontLayoutLibrary.syncSizeOptions(Number(layoutId), sizeTemplateId, items)
);

export const updateFontLayout: ImageMapFontLayoutUpdater = async (layoutId, shopId, name, previewFile, productId) => {
  await browserAlbumApi.fontLayoutLibrary.update(Number(layoutId), {
    shopId: Number(shopId),
    ...(productId !== undefined ? { productId: Number(productId) } : {}),
    name
  });
  if (previewFile) await browserAlbumApi.fontLayoutLibrary.uploadPreview(Number(layoutId), previewFile);
};
