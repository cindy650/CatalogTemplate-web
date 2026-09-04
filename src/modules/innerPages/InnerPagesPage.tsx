import { useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Card, Empty, Image, Input, InputNumber, Modal, Select, Spin, Tag, Upload } from 'antd';
import { AppstoreOutlined, EditOutlined, PictureOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import type { InnerPageTemplate, InnerPageSizeOption, Shop } from '@shared/domain';
import { browserAlbumApi } from '../../api';
import { ImageMapEditor } from '../../image-map-editor/editor-entry';
import type { ImageMapEditorDocumentValue } from '../../image-map-editor/editor-entry';
import type { ImageMapSizeSchemeValue } from '../../image-map-editor/editors/imagemap/ImageMapSizeScheme';
import { applyTextFont, loadTextFonts } from '../fontRuntime';
import { loadTextGenerationRules } from '../imageMapEditorTest/imageMapEditorHost';
import type { InnerPagesPageProps } from '../types';

function shopName(shop?: Shop): string { return shop?.shopName || shop?.shop || '未命名店铺'; }
function workareaFromLayers(option?: InnerPageSizeOption) { return option?.layers.objects.find((object) => object.id === 'workarea'); }
function toSchemes(template?: InnerPageTemplate, fallbackLabel = '默认规格'): ImageMapSizeSchemeValue[] {
  const options = template?.sizeOptions ?? [];
  if (!options.length) return [{ id: fallbackLabel, idIsPersisted: false, label: fallbackLabel, unit: 'in', pageCount: 1, pageCountOptions: [1], sideWidth: 9, sideHeight: 6, bleed: 0, spineWidthMode: 'fixed', spineWidth: 0, minSpineWidth: 0, maxSpineWidth: 0, spineBleed: 0, backCoverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 }, coverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 }, spineSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 }, paperThickness: 0 }];
  return options.map((option) => {
    const workarea = workareaFromLayers(option) as Record<string, unknown> | undefined;
    const unit = option.sizeUnit || (workarea?.unit === 'cm' || workarea?.unit === 'mm' ? workarea.unit : 'in');
    const pixelsPerUnit = unit === 'in' ? 96 : unit === 'cm' ? 96 / 2.54 : 96 / 25.4;
    const storedWidth = Number(workarea?.sideWidth);
    const storedHeight = Number(workarea?.sideHeight);
    const canvasWidth = Number(workarea?.width ?? workarea?.workareaWidth);
    const canvasHeight = Number(workarea?.height ?? workarea?.workareaHeight);
    const sideWidth = Number.isFinite(storedWidth) && storedWidth > 0 ? storedWidth : canvasWidth / pixelsPerUnit;
    const sideHeight = Number.isFinite(storedHeight) && storedHeight > 0 ? storedHeight : canvasHeight / pixelsPerUnit;
    return { id: option.id, idIsPersisted: true, label: option.label || option.id, unit, pageCount: 1, pageCountOptions: [1], sideWidth: Number.isFinite(sideWidth) && sideWidth > 0 ? sideWidth : 9, sideHeight: Number.isFinite(sideHeight) && sideHeight > 0 ? sideHeight : 6, bleed: 0, spineWidthMode: 'fixed', spineWidth: 0, minSpineWidth: 0, maxSpineWidth: 0, spineBleed: 0, backCoverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 }, coverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 }, spineSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 }, paperThickness: 0 };
  });
}
function ensureInnerPageWorkarea(layers: ImageMapEditorDocumentValue['layers']) {
  return { ...layers, objects: layers.objects.map((object) => object.id === 'workarea' ? { ...object, innerPage: true } : object) };
}

type DraftSpec = { key: string; id: string; label: string; unit: 'in' | 'cm' | 'mm'; width: number; height: number };
const unitToMm = (unit: DraftSpec['unit']) => unit === 'in' ? 25.4 : unit === 'cm' ? 10 : 1;
const convertUnit = (value: number, from: DraftSpec['unit'], to: DraftSpec['unit']) => Number((value * unitToMm(from) / unitToMm(to)).toFixed(4));
let draftSpecSequence = 0;
const newDraftSpec = (): DraftSpec => ({ key: `draft-spec-${++draftSpecSequence}`, id: '9*6', label: '9*6', unit: 'in', width: 9, height: 6 });
function emptyLayersForSpec(spec: DraftSpec): InnerPageSizeOption['layers'] {
  const pxPerMm = 96 / 25.4;
  const width = Math.max(1, spec.width * unitToMm(spec.unit) * pxPerMm);
  const height = Math.max(1, spec.height * unitToMm(spec.unit) * pxPerMm);
  return {
    objects: [{ id: 'workarea', width, height, workareaWidth: width, workareaHeight: height, unit: spec.unit, sideWidth: spec.width, sideHeight: spec.height, innerPage: true }],
    animations: [],
    styles: [],
    dataSources: [],
  };
}

export default function InnerPagesPage({ shops, products, selectedShopId, selectedProductId, onEditorModeChange }: InnerPagesPageProps) {
  const { message } = App.useApp();
  const shop = shops.find((item) => item.id === selectedShopId);
  const product = products.find((item) => item.id === selectedProductId);
  const [templates, setTemplates] = useState<InnerPageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [editingId, setEditingId] = useState<number | 'new'>();
  const [keyword, setKeyword] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftPreviewPath, setDraftPreviewPath] = useState('');
  const [draftPreviewFile, setDraftPreviewFile] = useState<File>();
  const [draftSpecs, setDraftSpecs] = useState<DraftSpec[]>([newDraftSpec()]);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const editingTemplate = typeof editingId === 'number' ? templates.find((item) => item.id === editingId) : undefined;
  const layersRef = useRef<Map<string, InnerPageSizeOption['layers']>>(new Map());

  useEffect(() => { onEditorModeChange?.(editingId !== undefined); return () => onEditorModeChange?.(false); }, [editingId, onEditorModeChange]);
  useEffect(() => {
    if (!selectedProductId) { setTemplates([]); return; }
    let cancelled = false;
    setLoading(true);
    void browserAlbumApi.innerPageTemplates.list({ shopId: selectedShopId, productId: selectedProductId }).then((items) => { if (!cancelled) setTemplates(items); }).catch((error) => { if (!cancelled) message.error(error instanceof Error ? error.message : String(error)); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [message, reloadVersion, selectedProductId, selectedShopId]);
  const visibleTemplates = useMemo(() => { const q = keyword.trim().toLocaleLowerCase(); return q ? templates.filter((item) => `${item.name} ${item.description}`.toLocaleLowerCase().includes(q)) : templates; }, [keyword, templates]);

  function openCreateDialog() {
    setDraftName(`${product?.name ?? ''} 内页模板`);
    setDraftDescription('');
    setDraftPreviewPath('');
    setDraftPreviewFile(undefined);
    setDraftSpecs([newDraftSpec()]);
    setCreateOpen(true);
  }

  async function createInnerPageTemplate() {
    if (!shop || !product || !draftName.trim()) { message.warning('请填写模板名称'); return; }
    if (draftSpecs.some((spec) => !spec.label.trim() || spec.width <= 0 || spec.height <= 0)) { message.warning('请完善规格名称、宽度和高度'); return; }
    setCreating(true);
    try {
      const saved = await browserAlbumApi.innerPageTemplates.create({
        shopId: shop.id,
        productId: product.id,
        name: draftName.trim(),
        description: draftDescription.trim(),
        ...(draftPreviewPath ? { previewImagePath: draftPreviewPath } : {}),
        sizeOptions: draftSpecs.map((spec) => ({ id: spec.id.trim() || spec.label.trim(), label: spec.label.trim(), sizeUnit: spec.unit, layers: emptyLayersForSpec(spec) })),
      });
      setTemplates((current) => [saved, ...current]);
      setCreateOpen(false);
      setEditingId(saved.id);
      message.success('内页模板已创建，进入编辑器');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally { setCreating(false); }
  }

  if (!shop || !product) return <section className="panel inner-pages-page inner-pages-empty"><Empty image={<AppstoreOutlined />} description="请从左侧选择店铺和产品" /></section>;
  if (editingId !== undefined) {
    const initialOptions = editingTemplate?.sizeOptions ?? [];
    if (layersRef.current.size === 0) initialOptions.forEach((option) => layersRef.current.set(option.id, option.layers));
    const save = async (document: ImageMapEditorDocumentValue) => {
      layersRef.current.set(document.activeSizeSchemeId, ensureInnerPageWorkarea(document.layers));
      const sizeOptions = document.sizeSchemes.map((scheme) => ({ id: scheme.id, label: scheme.label, sizeUnit: scheme.unit, layers: ensureInnerPageWorkarea(layersRef.current.get(scheme.id) ?? document.layers) }));
      const payload = { productId: product.id, ...(editingTemplate ? {} : { shopId: shop.id }), name: document.basicInfo.templateName.trim() || '未命名内页模板', description: editingTemplate?.description ?? '', sizeOptions };
      const saved = editingTemplate ? await browserAlbumApi.innerPageTemplates.update(editingTemplate.id, payload) : await browserAlbumApi.innerPageTemplates.create(payload);
      setTemplates((current) => editingTemplate ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setEditingId(saved.id);
      message.success('内页模板已保存');
    };
    const saveSizeSchemes = async (schemes: ImageMapSizeSchemeValue[], activeId: string, layers?: ImageMapEditorDocumentValue['layers']) => {
      if (layers) layersRef.current.set(activeId, ensureInnerPageWorkarea(layers));
      if (!editingTemplate) return;
      const currentIds = new Set(schemes.map((scheme) => scheme.id));
      const deletedOption = editingTemplate.sizeOptions.find((option) => !currentIds.has(option.id));
      if (deletedOption) {
        await browserAlbumApi.innerPageTemplates.sizeOptions.delete(editingTemplate.id, deletedOption.id);
        layersRef.current.delete(deletedOption.id);
      } else {
        if (!layers) return;
        const activeScheme = schemes.find((scheme) => scheme.id === activeId);
        if (!activeScheme) return;
        const option = {
          id: activeScheme.id,
          label: activeScheme.label,
          sizeUnit: activeScheme.unit,
          layers: ensureInnerPageWorkarea(layersRef.current.get(activeScheme.id) ?? { objects: [], animations: [], styles: [], dataSources: [] }),
        };
        if (editingTemplate.sizeOptions.some((item) => item.id === activeScheme.id)) {
          await browserAlbumApi.innerPageTemplates.sizeOptions.update(editingTemplate.id, activeScheme.id, {
            label: option.label,
            sizeUnit: option.sizeUnit,
            layers: option.layers,
          });
        } else {
          await browserAlbumApi.innerPageTemplates.sizeOptions.create(editingTemplate.id, option);
        }
      }
      const saved = await browserAlbumApi.innerPageTemplates.get(editingTemplate.id);
      setTemplates((current) => current.map((item) => item.id === saved.id ? saved : item));
    };
    return <div className="image-map-editor-test-page"><ImageMapEditor innerPageMode hiddenActivities={['fontLayouts']} shops={[{ value: shop.id, label: shopName(shop) }]} initialBasicInfo={{ shopId: shop.id, templateName: editingTemplate?.name ?? `${product.name} 内页` }} initialSizeSchemes={toSchemes(editingTemplate, `${product.name} 内页规格`)} initialLayers={initialOptions[0]?.layers} loadSizeSchemeLayers={async (sizeOptionId) => layersRef.current.get(sizeOptionId) ?? editingTemplate?.sizeOptions.find((item) => item.id === sizeOptionId)?.layers} onSizeSchemeLayersChange={(sizeOptionId, layers) => layersRef.current.set(sizeOptionId, ensureInnerPageWorkarea(layers))} applyTextFont={applyTextFont} loadTextFonts={loadTextFonts} loadTextGenerationRules={loadTextGenerationRules} onSaveDocument={save} onSaveSizeSchemes={saveSizeSchemes} onExit={() => { layersRef.current.clear(); setEditingId(undefined); }} saveSuccessMessage="内页模板已保存" saveLocation="basicInfo" /></div>;
  }
  return <section className="panel inner-pages-page"><header className="inner-pages-header"><div><span>内页模块</span><h1>{shopName(shop)} / {product.name || '未命名产品'}</h1></div><div className="inner-pages-header-actions"><Button icon={<ReloadOutlined />} loading={loading} onClick={() => setReloadVersion((value) => value + 1)}>刷新</Button><Button className="inner-pages-create-button" type="primary" icon={<PlusOutlined />} onClick={openCreateDialog}>新增内页模板</Button></div></header><div className="inner-pages-toolbar"><Input allowClear placeholder="搜索内页模板" value={keyword} onChange={(event) => setKeyword(event.target.value)} /></div>{loading ? <div className="template-library-loading"><Spin size="large" /></div> : visibleTemplates.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前产品暂无内页模板" /> : <div className="inner-pages-grid">{visibleTemplates.map((item) => <Card className="inner-page-card" key={item.id}><div className="inner-page-card-preview">{item.previewImagePath ? <Image src={item.previewImagePath} alt={`${item.name || '内页模板'}预览图`} preview={{ src: item.previewImagePath }} /> : <div className="inner-page-card-preview-empty"><PictureOutlined /><span>暂无预览图</span></div>}</div><div className="inner-page-card-title"><div><strong>{item.name || '未命名内页模板'}</strong><span>{item.description || '通用内页'}</span></div><Tag>{item.sizeOptions.length} 个规格</Tag></div><div className="inner-page-card-specs"><span>已有规格</span><div>{item.sizeOptions.length ? item.sizeOptions.map((option) => <Tag key={option.id}>{option.label || option.id}</Tag>) : <span className="inner-page-card-specs-empty">暂无规格</span>}</div></div><div className="inner-page-card-meta"><span>{shopName(shop)}</span><span>{product.name}</span><Button type="link" icon={<EditOutlined />} onClick={() => setEditingId(item.id)}>打开编辑</Button></div></Card>)}</div>}
    <Modal title="新增内页模板" open={createOpen} width={780} destroyOnHidden confirmLoading={creating} okButtonProps={{ disabled: uploadingPreview }} okText="保存并进入编辑器" cancelText="取消" onCancel={() => setCreateOpen(false)} onOk={() => void createInnerPageTemplate()}>
      <div className="inner-page-create-form">
        <div className="inner-page-create-grid">
          <label>店铺<Select value={shop.id} options={[{ value: shop.id, label: shopName(shop) }]} disabled /></label>
          <label>产品<Select value={product.id} options={[{ value: product.id, label: product.name }]} disabled /></label>
          <label>模板名称<Input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="例如：婚礼签到册内页" /></label>
          <label>描述（可选）<Input value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} placeholder="通用内页" /></label>
        </div>
        <div className="inner-page-preview-upload"><span>预览图（可选）</span><Upload.Dragger accept=".png,.jpg,.jpeg,.webp" maxCount={1} showUploadList={false} beforeUpload={async (file) => { setDraftPreviewFile(file); setDraftPreviewPath(''); setUploadingPreview(true); try { const path = await browserAlbumApi.oss.uploadImage(file); setDraftPreviewPath(path); message.success('预览图上传成功'); } catch (error) { message.error(error instanceof Error ? error.message : String(error)); } finally { setUploadingPreview(false); } return false; }}>{uploadingPreview ? <div className="inner-page-preview-upload-state"><Spin /><span>正在上传...</span></div> : draftPreviewPath ? <div className="inner-page-preview-result"><div onClick={(event) => event.stopPropagation()}><Image src={draftPreviewPath} alt="内页模板预览图" preview={{ src: draftPreviewPath }} /></div><span>{draftPreviewFile?.name || '预览图已上传'}</span><small>点击图片查看大图，点击文字区域可重新选择</small></div> : <div className="inner-page-preview-upload-state"><UploadOutlined /><span>{draftPreviewFile ? draftPreviewFile.name : '点击或拖拽上传图片'}</span></div>}</Upload.Dragger></div>
        <div className="inner-page-specs-heading"><strong>规格</strong><Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => setDraftSpecs((current) => [...current, { ...newDraftSpec(), id: `规格${current.length + 1}`, label: `规格${current.length + 1}` }])}>新增规格</Button></div>
        {draftSpecs.map((spec, index) => <div className="inner-page-spec-row" key={spec.key}><Input value={spec.label} onChange={(event) => setDraftSpecs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value, id: event.target.value } : item))} placeholder="规格名称，如 9*6" /><Select value={spec.unit} options={[{ value: 'in', label: 'in' }, { value: 'cm', label: 'cm' }, { value: 'mm', label: 'mm' }]} onChange={(unit: DraftSpec['unit']) => setDraftSpecs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, unit, width: convertUnit(item.width, item.unit, unit), height: convertUnit(item.height, item.unit, unit) } : item))} /><InputNumber min={0.01} value={spec.width} addonBefore="宽" onChange={(value) => setDraftSpecs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, width: Number(value) || 0 } : item))} /><InputNumber min={0.01} value={spec.height} addonBefore="高" onChange={(value) => setDraftSpecs((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, height: Number(value) || 0 } : item))} /><Button danger type="text" disabled={draftSpecs.length <= 1} onClick={() => setDraftSpecs((current) => current.filter((_item, itemIndex) => itemIndex !== index))}>删除</Button></div>)}
      </div>
    </Modal>
  </section>;
}
