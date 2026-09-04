import { browserAlbumApi } from '../../api';
export { applyTextFont, loadTextFonts } from '../fontRuntime';
import type { ImageMapTextGenerationRule } from '../../image-map-editor/editors/imagemap/properties/GeneralProperty';
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

export const loadFontLayoutProducts: ImageMapFontLayoutCategoryLoader = async (shopId) => (
  (await browserAlbumApi.products.list({ shopId: Number(shopId), limit: 100, offset: 0 }))
    .filter((product) => product.enabled)
    .map((product) => ({ value: product.id, label: product.name }))
);

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

export const loadTextGenerationRules = async (): Promise<ImageMapTextGenerationRule[]> => {
  const result = await browserAlbumApi.textGenerationRules.list({ limit: 100, offset: 0 });
  return result.items.map((rule) => ({
    id: rule.id,
    name: rule.name,
    description: rule.description,
  }));
};

export const loadFontLayoutCategories: ImageMapFontLayoutCategoryLoader = async (shopId) => (
  (await browserAlbumApi.products.list({ shopId: Number(shopId), limit: 100, offset: 0 }))
    .filter((product) => product.enabled)
    .map((product) => ({ value: product.id, label: product.name }))
);

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
