import { App as AntdApp, Button, Result, Spin } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageMapEditor } from '../../image-map-editor/editor-entry';
import type {
  ImageMapBasicInfoValue,
	ImageMapFontLayoutLayerData,
  ImageMapSizeSchemeValue
} from '../../image-map-editor/editor-entry';
import { browserAlbumApi } from '../../api';
import type { CatalogSizeTemplate, CatalogSizeTemplatePayload, ProductCategory, Shop } from '@shared/domain';
import {
  createFontLayout,
  deleteFontLayout,
  applyTextFont,
  loadFontLayoutCategories,
  loadFontLayouts,
  loadFontLayoutSize,
  loadFontLayoutSizeOptions,
  loadTextFonts,
  saveFontLayout,
  syncFontLayoutSizeOptions,
  updateFontLayout
} from './imageMapEditorHost';

interface ImageMapEditorTestPageProps {
  shops: Shop[];
  template?: CatalogSizeTemplate;
  /** Product-provided defaults are used only while creating a new template. */
  productDefaults?: ProductCategory['commonSpecValues'];
  initialShopId?: number;
  initialProductId?: number;
  onExit?(): void;
}

type PersistMode = 'auto' | 'fields' | 'size-schemes';

function templateSizeSchemes(template?: CatalogSizeTemplate): ImageMapSizeSchemeValue[] | undefined {
  if (!template) return undefined;
  return template.sizeOptions.map((option) => ({
    id: option.id,
    idIsPersisted: Boolean(option.id),
    label: option.label,
    unit: option.fields.size_unit,
    pageCount: template.pageCount,
    pageCountOptions: template.pageCountOptions.length ? template.pageCountOptions : [template.pageCount],
    sideWidth: option.fields.single_side_width > 0 ? option.fields.single_side_width : 9,
    sideHeight: option.fields.single_side_height > 0 ? option.fields.single_side_height : 6,
    bleed: option.fields.bleed,
    spineWidthMode: template.spineWidthBasis === 1 ? 'by_page_count' : 'fixed',
    spineWidth: option.fields.spine_width,
    minSpineWidth: template.minSpineWidth,
    maxSpineWidth: template.maxSpineWidth,
    spineBleed: option.fields.spine_bleed,
    paperThickness: template.paperThicknessMm ?? 0
  }));
}

function editorTemplatePayload(
  template: CatalogSizeTemplate | undefined,
  initialProductId: number | undefined,
  basicInfo: ImageMapBasicInfoValue,
  sizeSchemes: ImageMapSizeSchemeValue[],
  activeSizeSchemeId: string
): CatalogSizeTemplatePayload {
  const activeSizeScheme = sizeSchemes.find((item) => item.id === activeSizeSchemeId) ?? sizeSchemes[0];
  return {
    shopId: Number(basicInfo.shopId),
    productId: template?.productId ?? initialProductId,
    name: basicInfo.templateName.trim(),
    previewImage: template?.previewImage ?? '',
    applicableProducts: template?.applicableProducts ?? [],
    backgroundColor: template?.backgroundColor || '#ffffff',
    minSpineWidth: activeSizeScheme?.minSpineWidth ?? template?.minSpineWidth ?? 0.55,
    maxSpineWidth: activeSizeScheme?.maxSpineWidth ?? template?.maxSpineWidth ?? 0.7,
    paperThicknessMm: activeSizeScheme?.paperThickness ?? template?.paperThicknessMm ?? 0,
    spineWidthBasis: activeSizeScheme?.spineWidthMode === 'by_page_count' ? 1 : 0,
    coverSafeDistance: template?.coverSafeDistance ?? { top: 0, right: 0, bottom: 0, left: 0 },
    selectedSizeOptionId: activeSizeScheme?.id ?? template?.selectedSizeOptionId ?? '',
    displayUnit: activeSizeScheme?.unit ?? template?.displayUnit ?? 'in',
    pageCount: activeSizeScheme?.pageCount ?? template?.pageCount ?? 50,
    pageCountOptions: activeSizeScheme?.pageCountOptions ?? template?.pageCountOptions ?? [50, 100],
    sizeOptions: sizeSchemes.map((scheme) => ({
      id: scheme.id,
      label: scheme.label,
      fields: {
        size_unit: scheme.unit,
        single_side_width: scheme.sideWidth,
        single_side_height: scheme.sideHeight,
        bleed: scheme.bleed,
        spine_width: scheme.spineWidth,
        spine_bleed: scheme.spineBleed
      }
    })),
    sizeTemplateInfo: template?.sizeTemplateInfo ?? [],
    fontLayouts: template?.fontLayouts ?? []
  };
}

function templateFieldsChanged(
  current: CatalogSizeTemplate,
  basicInfo: ImageMapBasicInfoValue,
  sizeSchemes: ImageMapSizeSchemeValue[],
): boolean {
  const next = editorTemplatePayload(current, current.productId, basicInfo, sizeSchemes, sizeSchemes[0]?.id ?? '');
  const previousSizeSchemes = templateSizeSchemes(current) ?? [];
  const previous = editorTemplatePayload(
    current,
    current.productId,
    { shopId: current.shopId, templateName: current.name },
    previousSizeSchemes,
    previousSizeSchemes[0]?.id ?? '',
  );
  const comparable = (payload: CatalogSizeTemplatePayload) => {
    const { selectedSizeOptionId: _selectedSizeOptionId, fontLayouts: _fontLayouts, ...fields } = payload;
    return fields;
  };
  return JSON.stringify(comparable(next)) !== JSON.stringify(comparable(previous));
}

export default function ImageMapEditorTestPage({ shops, template, productDefaults, initialShopId, initialProductId, onExit }: ImageMapEditorTestPageProps) {
  const { message } = AntdApp.useApp();
  const [detail, setDetail] = useState<CatalogSizeTemplate | undefined>(template);
  const [loading, setLoading] = useState(Boolean(template));
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const detailRef = useRef<CatalogSizeTemplate | undefined>(template);
  const basicInfoRef = useRef<ImageMapBasicInfoValue>({
    shopId: template?.shopId ?? initialShopId,
    templateName: template?.name ?? ''
  });
  const sizeSchemesRef = useRef<ImageMapSizeSchemeValue[]>(templateSizeSchemes(template) ?? []);
  const activeSizeSchemeIdRef = useRef(template?.selectedSizeOptionId ?? sizeSchemesRef.current[0]?.id ?? '');
  const basicInfoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (!template) {
      setDetail(undefined);
      setLoading(false);
      setLoadError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    void browserAlbumApi.catalogSizeTemplates.get(template.id).then((nextDetail) => {
      if (cancelled) return;
      const nextSizeSchemes = templateSizeSchemes(nextDetail) ?? [];
      detailRef.current = nextDetail;
      basicInfoRef.current = { shopId: nextDetail.shopId, templateName: nextDetail.name };
      sizeSchemesRef.current = nextSizeSchemes;
      activeSizeSchemeIdRef.current = nextSizeSchemes.some((item) => item.id === nextDetail.selectedSizeOptionId)
        ? nextDetail.selectedSizeOptionId
        : nextSizeSchemes[0]?.id ?? '';
      setDetail(nextDetail);
    }).catch((error) => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadVersion, template]);

  useEffect(() => () => {
    if (basicInfoSaveTimerRef.current) clearTimeout(basicInfoSaveTimerRef.current);
  }, []);

  const persistEditorFields = useCallback((
    basicInfo: ImageMapBasicInfoValue,
    sizeSchemes: ImageMapSizeSchemeValue[],
    activeSizeSchemeId: string,
    currentLayers?: ImageMapFontLayoutLayerData,
    fontLayoutId?: number,
    createIfMissing = false,
    mode: PersistMode = 'auto'
  ) => {
    if (!detailRef.current && !createIfMissing) {
      return Promise.resolve();
    }
    if (!basicInfo.templateName.trim() || !Number.isFinite(Number(basicInfo.shopId))) {
      return Promise.reject(new Error('请先填写模板名称和所属店铺。'));
    }
    const saveTask = saveQueueRef.current.catch(() => undefined).then(async () => {
      const currentDetail = detailRef.current;
      const payload = editorTemplatePayload(
        currentDetail,
        initialProductId,
        basicInfo,
        sizeSchemes,
        activeSizeSchemeId
      );
      if (!currentDetail) {
        if (!Number.isFinite(Number(payload.productId)) || Number(payload.productId) <= 0) {
          throw new Error('新建模板需要选择产品分类。');
        }
        const created = await browserAlbumApi.catalogSizeTemplates.create(payload);
        detailRef.current = created;
        basicInfoRef.current = { shopId: created.shopId, templateName: created.name };
        sizeSchemesRef.current = templateSizeSchemes(created) ?? sizeSchemes;
        activeSizeSchemeIdRef.current = created.selectedSizeOptionId || activeSizeSchemeId;
        if (fontLayoutId !== undefined && currentLayers && activeSizeSchemeId) {
          await syncFontLayoutSizeOptions(fontLayoutId, created.id, [{
            sizeOptionId: activeSizeSchemeId,
            layers: currentLayers
          }]);
          detailRef.current = {
            ...created,
            selectedFontLayoutId: fontLayoutId
          };
        }
        setDetail(detailRef.current ?? created);
        return;
      }
      const shouldPatch = mode === 'size-schemes'
        || mode === 'fields'
        || templateFieldsChanged(currentDetail, basicInfo, sizeSchemes);
      if (shouldPatch) {
        await browserAlbumApi.catalogSizeTemplates.update(
          currentDetail.id,
          payload
        );
      }
      if (fontLayoutId !== undefined && currentLayers && activeSizeSchemeId) {
        await syncFontLayoutSizeOptions(fontLayoutId, currentDetail.id, [{
          sizeOptionId: activeSizeSchemeId,
          layers: currentLayers
        }]);
      }
      detailRef.current = {
        ...(detailRef.current ?? currentDetail),
        shopId: payload.shopId,
        name: payload.name,
        backgroundColor: payload.backgroundColor,
        minSpineWidth: payload.minSpineWidth,
        maxSpineWidth: payload.maxSpineWidth,
        paperThicknessMm: payload.paperThicknessMm,
        spineWidthBasis: payload.spineWidthBasis,
        selectedSizeOptionId: payload.selectedSizeOptionId,
        displayUnit: payload.displayUnit,
        pageCount: payload.pageCount,
        pageCountOptions: payload.pageCountOptions,
        sizeOptions: payload.sizeOptions,
        sizeTemplateInfo: payload.sizeTemplateInfo
      };
    });
    saveQueueRef.current = saveTask.then(() => undefined, () => undefined);
    return saveTask;
  }, [initialProductId]);

  const initialSizeSchemes = useMemo(() => templateSizeSchemes(detail), [detail]);
  const defaultSizeSchemes = useMemo(() => {
    if (template || !productDefaults?.length) return undefined;
    return productDefaults.map((specification) => ({
      id: specification.id.trim() || specification.label.trim(),
      idIsPersisted: Boolean(specification.id.trim()),
      label: specification.label.trim() || specification.id.trim(),
      unit: specification.unit,
      pageCount: specification.pageCount,
      pageCountOptions: specification.pageCountOptions,
      sideWidth: specification.sideWidth,
      sideHeight: specification.sideHeight,
      bleed: specification.bleed,
      spineWidthMode: specification.spineWidthMode,
      spineWidth: specification.spineWidth,
      minSpineWidth: specification.minSpineWidth,
      maxSpineWidth: specification.maxSpineWidth,
      spineBleed: specification.spineBleed,
      paperThickness: specification.paperThickness,
    }));
  }, [productDefaults, template]);

  if (loading) {
    return <div className="image-map-editor-test-page template-library-editor-loading"><Spin size="large" /></div>;
  }

  if (template && (loadError || !detail)) {
    return (
      <div className="image-map-editor-test-page template-library-editor-loading">
        <Result
          status="error"
          title="模板详情加载失败"
          subTitle={loadError || '未查询到模板详情'}
          extra={<Button type="primary" onClick={() => setReloadVersion((current) => current + 1)}>重新加载</Button>}
        />
      </div>
    );
  }

  return (
    <div className="image-map-editor-test-page">
      <ImageMapEditor
        key={template?.id ?? 'image-map-test'}
        initialTheme="light"
		templatePreviewImage={detail?.previewImage}
        initialBasicInfo={detail
          ? { shopId: detail.shopId, templateName: detail.name }
          : { shopId: initialShopId, templateName: '' }}
        initialSizeSchemes={initialSizeSchemes ?? defaultSizeSchemes}
        initialActiveSizeSchemeId={detail?.selectedSizeOptionId}
        selectedFontLayoutId={detail?.selectedFontLayoutId}
        onExit={onExit}
        shops={shops.map((shop) => ({
          value: shop.id,
          label: shop.shopName || shop.shop || '未命名店铺'
        }))}
        createFontLayout={createFontLayout}
        deleteFontLayout={deleteFontLayout}
        loadFontLayoutCategories={loadFontLayoutCategories}
        loadFontLayouts={(shopId) => loadFontLayouts(shopId, detail?.productId ?? initialProductId)}
        loadFontLayoutSizeOptions={loadFontLayoutSizeOptions}
        loadFontLayoutSize={loadFontLayoutSize}
        applyTextFont={applyTextFont}
        loadTextFonts={loadTextFonts}
        saveFontLayout={saveFontLayout}
        sizeTemplateId={detail?.id}
        syncFontLayoutSizeOptions={syncFontLayoutSizeOptions}
        updateFontLayout={updateFontLayout}
        onBasicInfoChange={(basicInfo) => {
          basicInfoRef.current = basicInfo;
          if (basicInfoSaveTimerRef.current) clearTimeout(basicInfoSaveTimerRef.current);
          basicInfoSaveTimerRef.current = setTimeout(() => {
            void persistEditorFields(
              basicInfoRef.current,
              sizeSchemesRef.current,
              activeSizeSchemeIdRef.current,
              undefined,
              undefined,
              false,
              'fields'
            ).catch((error) => message.error(error instanceof Error ? error.message : String(error)));
          }, 600);
        }}
        onSizeSchemesChange={(sizeSchemes) => {
          sizeSchemesRef.current = sizeSchemes;
        }}
        onSaveDocument={async (document, previewFile) => {
          if (basicInfoSaveTimerRef.current) clearTimeout(basicInfoSaveTimerRef.current);
          basicInfoRef.current = document.basicInfo;
          sizeSchemesRef.current = document.sizeSchemes;
          activeSizeSchemeIdRef.current = document.activeSizeSchemeId;
          await persistEditorFields(
            document.basicInfo,
            document.sizeSchemes,
            document.activeSizeSchemeId,
            document.layers,
            detailRef.current?.selectedFontLayoutId,
            true,
            'auto'
          );
		  if (previewFile && detailRef.current) {
			const previewImage = await browserAlbumApi.catalogSizeTemplates.uploadPreview(detailRef.current.id, previewFile);
			const updated = await browserAlbumApi.catalogSizeTemplates.update(
				detailRef.current.id,
				{
					...editorTemplatePayload(
						detailRef.current,
						initialProductId,
						document.basicInfo,
						document.sizeSchemes,
						document.activeSizeSchemeId
					),
					previewImage
				}
			);
			detailRef.current = updated;
			setDetail(updated);
		  }
        }}
        saveSuccessMessage="尺寸模板已保存"
		saveLocation="basicInfo"
        onSaveSizeSchemes={async (sizeSchemes, activeSizeSchemeId, currentLayers, fontLayoutId) => {
          if (basicInfoSaveTimerRef.current) clearTimeout(basicInfoSaveTimerRef.current);
          sizeSchemesRef.current = sizeSchemes;
          activeSizeSchemeIdRef.current = activeSizeSchemeId;
          await persistEditorFields(basicInfoRef.current, sizeSchemes, activeSizeSchemeId, currentLayers, fontLayoutId, true, 'size-schemes');
        }}
      />
    </div>
  );
}
