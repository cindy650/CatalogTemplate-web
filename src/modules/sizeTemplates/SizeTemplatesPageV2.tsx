import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  CopyOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  SyncOutlined,
  UploadOutlined
} from '@ant-design/icons';
import {
  App,
  Avatar,
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Segmented,
  Space,
  Spin,
  Tag,
  Tooltip
} from 'antd';
import type {
  CatalogSizeOption,
  CatalogSizeOptionFields,
  CatalogSizeTemplate,
  CatalogSizeTemplatePayload,
  FontLayoutCanvas,
  FontLayoutLayerData,
  FontLibraryItem,
  FontLayoutLibraryTemplate,
  MountedFontLayout,
  MountedSizeLayout,
  Shop,
  TemplateImportDraft,
  SizeTemplateUnit
} from '@shared/domain';
import { browserAlbumApi } from '../../api';
import type { SizeTemplatesPageProps } from '../types';
import TemplateElementEditor from './TemplateElementEditor';
import FabricTemplateCanvas from './FabricTemplateCanvas';

type TemplateView = 'list' | 'editor';
type SizeOptionFormValues = CatalogSizeOptionFields & { id: string; label: string };
type LibraryEditorState = { id?: number; name: string; shopId: number; previewFile?: File };
type SyncState = { open: boolean; mode: 'scale' | 'copy'; targets: string[] };

const units: Array<{ value: SizeTemplateUnit; label: string }> = [
  { value: 'in', label: '英寸 in' },
  { value: 'mm', label: '毫米 mm' },
  { value: 'cm', label: '厘米 cm' }
];

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function textValue(value: unknown): string {
  return value == null ? '' : String(value);
}

function isDraftSizeOption(optionId?: string): boolean {
  return Boolean(optionId?.startsWith('draft-size-'));
}

function emptyCanvas(): FontLayoutCanvas {
  return { width: 1000, height: 800, dpi: 300 };
}

function canvasForOption(option?: CatalogSizeOption): FontLayoutCanvas {
  if (!option) return emptyCanvas();
  const { single_side_width: width, single_side_height: height } = option.fields;
  return {
    width: Math.max(1, Math.round(width * 100)),
    height: Math.max(1, Math.round(height * 100)),
    dpi: 300
  };
}

function blankTemplate(shopId: number, productId?: number): CatalogSizeTemplate {
  return {
    id: 0,
    ...(productId !== undefined ? { productId } : {}),
    shopId,
    shopName: '',
    name: '',
    previewImage: '',
    applicableProducts: [],
    backgroundColor: '#ffffff',
    minSpineWidth: 0,
    maxSpineWidth: 0,
    paperThicknessMm: 0,
    spineWidthBasis: 0,
    backCoverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
    coverSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
    spineSafeDistance: { top: 0, right: 0, bottom: 0, left: 0 },
    selectedSizeOptionId: '',
    displayUnit: 'in',
    pageCount: 0,
    pageCountOptions: [],
    sizeOptions: [],
    sizeTemplateInfo: [{ dpi: 300 }],
    fontLayouts: [],
    createdAt: '',
    updatedAt: ''
  };
}

function templatePayload(template: CatalogSizeTemplate): CatalogSizeTemplatePayload {
  return {
    shopId: template.shopId,
    productId: template.productId,
    name: template.name.trim(),
    previewImage: template.previewImage,
    applicableProducts: template.applicableProducts,
    backgroundColor: template.backgroundColor,
    minSpineWidth: template.minSpineWidth,
    maxSpineWidth: template.maxSpineWidth,
    paperThicknessMm: template.paperThicknessMm,
    spineWidthBasis: template.spineWidthBasis,
    backCoverSafeDistance: template.backCoverSafeDistance,
    coverSafeDistance: template.coverSafeDistance,
    spineSafeDistance: template.spineSafeDistance,
    selectedSizeOptionId: template.selectedSizeOptionId,
    displayUnit: template.displayUnit,
    pageCount: template.pageCount,
    pageCountOptions: template.pageCountOptions,
    sizeOptions: template.sizeOptions,
    sizeTemplateInfo: template.sizeTemplateInfo,
    fontLayouts: template.fontLayouts
  };
}

function fieldsLabel(fields: CatalogSizeOptionFields): string {
  return `${fields.single_side_width} × ${fields.single_side_height} ${fields.size_unit}`;
}

function withScaledLayer(layer: Record<string, unknown>, ratioX: number, ratioY: number, uniform: number): Record<string, unknown> {
  const next = clone(layer);
  const frame = next.frame && typeof next.frame === 'object' && !Array.isArray(next.frame)
    ? clone(next.frame as Record<string, unknown>)
    : undefined;
  if (frame) {
    for (const key of ['x', 'width']) if (frame[key] != null) frame[key] = numberValue(frame[key]) * ratioX;
    for (const key of ['y', 'height']) if (frame[key] != null) frame[key] = numberValue(frame[key]) * ratioY;
    next.frame = frame;
  }
  for (const key of ['x', 'width']) if (next[key] != null) next[key] = numberValue(next[key]) * ratioX;
  for (const key of ['y', 'height']) if (next[key] != null) next[key] = numberValue(next[key]) * ratioY;
  const font = next.font && typeof next.font === 'object' && !Array.isArray(next.font)
    ? clone(next.font as Record<string, unknown>)
    : undefined;
  if (font) {
    for (const key of ['size_px', 'leading_px']) if (font[key] != null) font[key] = numberValue(font[key]) * uniform;
    next.font = font;
  }
  return next;
}

function syncLayers(
  source: MountedSizeLayout,
  targetOption: CatalogSizeOption | undefined,
  sourceOption: CatalogSizeOption | undefined,
  mode: 'scale' | 'copy'
): MountedSizeLayout {
  const targetCanvas = canvasForOption(targetOption);
  if (mode === 'copy' || !sourceOption || !targetOption) {
    return { sizeOptionId: targetOption?.id ?? '', layers: clone(source.layers), canvas: targetCanvas };
  }
  const ratioX = targetCanvas.width / Math.max(1, source.canvas.width);
  const ratioY = targetCanvas.height / Math.max(1, source.canvas.height);
  return {
    sizeOptionId: targetOption.id,
    canvas: targetCanvas,
    layers: source.layers.map((layer) => withScaledLayer(layer, ratioX, ratioY, Math.min(ratioX, ratioY)))
  };
}

function layoutDraft(layout: MountedSizeLayout): TemplateImportDraft {
  return {
    canvas: layout.canvas,
    elements: layout.layers,
    safe_distance: 0,
    options: { coordinate_system: 'top-left', scaling: { mode: 'uniform' } }
  };
}

function editorLayersPayload(layers: Record<string, unknown>[]): FontLayoutLayerData {
  return { objects: clone(layers), animations: [], styles: [], dataSources: [] };
}

function layoutApiId(layout?: MountedFontLayout): number | undefined {
  const id = numberValue(layout?.fontLayoutTemplateId);
  return id > 0 ? id : undefined;
}

function layoutFromDraft(draft: TemplateImportDraft, sizeOptionId: string, fallbackCanvas: FontLayoutCanvas): MountedSizeLayout {
  const canvas = draft.canvas && typeof draft.canvas === 'object' && !Array.isArray(draft.canvas)
    ? draft.canvas as FontLayoutCanvas
    : fallbackCanvas;
  return {
    sizeOptionId,
    canvas: {
      width: Math.max(1, numberValue(canvas.width, fallbackCanvas.width)),
      height: Math.max(1, numberValue(canvas.height, fallbackCanvas.height)),
      ...(numberValue(canvas.dpi) > 0 ? { dpi: numberValue(canvas.dpi) } : {})
    },
    layers: Array.isArray(draft.elements)
      ? draft.elements.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
      : []
  };
}

function previewPlaceholder(name: string): ReactNode {
  return <Avatar shape="square" size={48} icon={<AppstoreOutlined />} className="size-template-preview-avatar">{name.slice(0, 1)}</Avatar>;
}

function SizeTemplateCard({
  template,
  shop,
  onEdit,
  onDelete,
  onDuplicate
}: {
  template: CatalogSizeTemplate;
  shop?: Shop;
  onEdit(): void;
  onDelete(): void;
  onDuplicate(): void;
}) {
  const selected = template.sizeOptions.find((option) => option.id === template.selectedSizeOptionId) ?? template.sizeOptions[0];
  return (
    <Card className="size-template-catalog-card" variant="borderless">
      <div className="size-template-catalog-card-head">
        <div className="size-template-catalog-title-wrap">
          <Avatar shape="square" size={44} icon={<SettingOutlined />} className="size-template-card-icon" />
          <div className="size-template-catalog-title">
            <h3>{template.name || '未命名尺寸模板'}</h3>
            <span>{template.shopName || shop?.shopName || shop?.shop || '未命名店铺'}</span>
          </div>
        </div>
        <Tag color={template.fontLayouts.length ? 'blue' : 'default'}>{template.fontLayouts.length} 个布局</Tag>
      </div>
      <div className="size-template-catalog-products">
        {template.applicableProducts.length > 0 ? template.applicableProducts.slice(0, 4).map((product) => <Tag key={product}>{product}</Tag>) : <span>未关联商品</span>}
        {template.applicableProducts.length > 4 && <Tag>+{template.applicableProducts.length - 4}</Tag>}
      </div>
      <div className="size-template-catalog-stats">
        <div><span>尺寸方案</span><strong>{template.sizeOptions.length}</strong></div>
        <div><span>当前尺寸</span><strong>{selected?.label || '未选择'}</strong></div>
        <div><span>页数</span><strong>{template.pageCount} 页</strong></div>
      </div>
      <div className="size-template-catalog-options">
        {template.sizeOptions.slice(0, 4).map((option) => <Tag color={option.id === template.selectedSizeOptionId ? 'blue' : undefined} key={option.id}>{option.label || option.id}</Tag>)}
        {template.sizeOptions.length > 4 && <span>+{template.sizeOptions.length - 4}</span>}
      </div>
      <div className="size-template-catalog-footer">
        <span>{template.updatedAt ? new Date(template.updatedAt).toLocaleDateString() : '未保存'}</span>
        <Space size={2}>
          <Tooltip title="编辑尺寸模板"><Button type="text" icon={<EditOutlined />} aria-label={`编辑 ${template.name}`} onClick={onEdit} /></Tooltip>
          <Tooltip title="复制尺寸模板"><Button type="text" icon={<CopyOutlined />} aria-label={`复制 ${template.name}`} onClick={onDuplicate} /></Tooltip>
          <Popconfirm title="删除尺寸模板" description={`确定删除“${template.name}”吗？`} okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={onDelete}>
            <Tooltip title="删除尺寸模板"><Button type="text" danger icon={<DeleteOutlined />} aria-label={`删除 ${template.name}`} /></Tooltip>
          </Popconfirm>
        </Space>
      </div>
    </Card>
  );
}

function JsonInfoEditor({ value, onChange }: { value: string; onChange(value: string): void }) {
  return (
    <div className="size-template-json-editor">
      <div className="size-template-section-label"><strong>尺寸模板信息</strong><span>模板级扩展字段，支持 [&#123;&#125;, &#123;&#125;]，不包含字体布局图层</span></div>
      <Input.TextArea value={value} onChange={(event) => onChange(event.target.value)} autoSize={{ minRows: 3, maxRows: 8 }} placeholder={'[{"dpi":300}]'} />
    </div>
  );
}

function LayoutLayersInfo({ layers }: { layers: Record<string, unknown>[] }) {
  return (
    <div className="size-template-layout-data">
      <div className="size-template-section-label"><strong>当前尺寸图层信息</strong><span>{layers.length} 个图层，编辑器修改后会同步到这里</span></div>
      <Input.TextArea value={JSON.stringify(layers, null, 2)} readOnly autoSize={{ minRows: 4, maxRows: 12 }} />
    </div>
  );
}

function PageCountOptionsEditor({ value, selected, onChange, onSelect }: { value?: Array<string | number>; selected?: number; onChange?(value: string[]): void; onSelect?(value: number): void }) {
  const [nextValue, setNextValue] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const options = Array.from(new Set((value ?? []).map((item) => Math.round(numberValue(item))).filter((item) => item > 0)));
  const update = (next: number[]) => onChange?.(next.map(String));
  const add = () => {
    const count = Math.round(numberValue(nextValue));
    if (count > 0 && !options.includes(count)) update([...options, count]);
    setNextValue(null);
    setAdding(false);
  };
  return (
    <div className="size-template-page-count-options">
      <div className="size-template-page-count-menu" role="list" aria-label="页数选项">
        {options.map((count) => <div className={`size-template-page-count-option${count === selected ? ' selected' : ''}`} key={count} onClick={() => onSelect?.(count)}><strong>{count}</strong><button type="button" aria-label={`删除 ${count}`} onClick={(event) => { event.stopPropagation(); update(options.filter((item) => item !== count)); }}><CloseOutlined /></button></div>)}
        {adding ? <div className="size-template-page-count-add-card is-editing"><InputNumber autoFocus min={1} precision={0} value={nextValue} placeholder="页数" onChange={setNextValue} onPressEnter={add} onBlur={add} /></div> : <button className="size-template-page-count-add-card" type="button" onClick={() => setAdding(true)}><PlusOutlined /><span>添加页数</span></button>}
      </div>
    </div>
  );
}

export default function SizeTemplatesPageV2({
  shops,
  selectedShopId,
  selectedProductId,
  initialTemplateId,
  embedded = false,
  onEditorExit
}: SizeTemplatesPageProps) {
  const { message } = App.useApp();
  const [view, setView] = useState<TemplateView>('list');
  const [templates, setTemplates] = useState<CatalogSizeTemplate[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<CatalogSizeTemplate>();
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>();
  const [selectedSizeOptionId, setSelectedSizeOptionId] = useState('');
  const [selectedElementId, setSelectedElementId] = useState<string>();
  const [editorCollapsed, setEditorCollapsed] = useState(false);
  const [infoJson, setInfoJson] = useState('[]');
  const [editingSizeOption, setEditingSizeOption] = useState<string>();
  const [sizeOptionForm] = Form.useForm<SizeOptionFormValues>();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryShopId, setLibraryShopId] = useState<number>();
  const [libraryItems, setLibraryItems] = useState<FontLayoutLibraryTemplate[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryEditor, setLibraryEditor] = useState<LibraryEditorState>();
  const [librarySubmitting, setLibrarySubmitting] = useState(false);
  const [mountLibraryId, setMountLibraryId] = useState<number>();
  const [mountSourceSize, setMountSourceSize] = useState('');
  const [mountName, setMountName] = useState('');
  const [syncState, setSyncState] = useState<SyncState>({ open: false, mode: 'scale', targets: [] });
  const [renameLayoutId, setRenameLayoutId] = useState<string>();
  const [renameValue, setRenameValue] = useState('');
  const [fonts, setFonts] = useState<FontLibraryItem[]>([]);
  const importPreviewRef = useRef<HTMLInputElement>(null);
  const templatePreviewRef = useRef<HTMLInputElement>(null);
  const [templatePreviewFile, setTemplatePreviewFile] = useState<File>();
  const editorExitRef = useRef(onEditorExit);
  const loadedVariantRef = useRef('');
  const [form] = Form.useForm();

  useEffect(() => {
    editorExitRef.current = onEditorExit;
  }, [onEditorExit]);

  const activeShop = shops.find((shop) => shop.id === draft?.shopId || shop.id === selectedShopId);
  const availableProducts = activeShop?.products ?? [];
  const filteredTemplates = useMemo(() => {
    const normalized = keyword.trim().toLocaleLowerCase();
    if (!normalized) return templates;
    return templates.filter((template) => [template.name, template.shopName, ...template.applicableProducts, ...template.sizeOptions.map((option) => `${option.id} ${option.label}`), ...template.fontLayouts.map((layout) => layout.name)].some((value) => value.toLocaleLowerCase().includes(normalized)));
  }, [keyword, templates]);
  const activeLayout = draft?.fontLayouts.find((layout) => layout.id === selectedLayoutId);
  const activeSizeOption = draft?.sizeOptions.find((option) => option.id === selectedSizeOptionId);
  const activeSizeLayout = activeLayout?.sizeLayouts.find((layout) => layout.sizeOptionId === selectedSizeOptionId)
    ?? (activeLayout && activeSizeOption ? { sizeOptionId: activeSizeOption.id, layers: [], canvas: canvasForOption(activeSizeOption) } : undefined);
  const activeLayoutDraft = activeSizeLayout ? layoutDraft(activeSizeLayout) : undefined;
  const libraryFiltered = useMemo(() => {
    const normalized = librarySearch.trim().toLocaleLowerCase();
    return normalized ? libraryItems.filter((item) => item.name.toLocaleLowerCase().includes(normalized)) : libraryItems;
  }, [libraryItems, librarySearch]);

  useEffect(() => {
    void loadTemplates();
  }, [selectedShopId, selectedProductId]);

  useEffect(() => {
    if (initialTemplateId === undefined) return;
    let cancelled = false;

    setView('editor');
    setEditorLoading(true);
    void browserAlbumApi.catalogSizeTemplates.get(initialTemplateId).then((template) => {
      if (!cancelled) resetEditor(template);
    }).catch((error) => {
      if (cancelled) return;
      message.error(error instanceof Error ? error.message : String(error));
      setView('list');
      if (embedded) editorExitRef.current?.();
    }).finally(() => {
      if (!cancelled) setEditorLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [embedded, initialTemplateId, message]);

  useEffect(() => {
    void browserAlbumApi.fonts.list().then(setFonts).catch(() => setFonts([]));
  }, []);

  useEffect(() => {
    const shopId = libraryShopId ?? draft?.shopId;
    if (!shopId) return;
    void loadLibrary(shopId, librarySearch);
  }, [libraryShopId, librarySearch, draft?.shopId]);

  useEffect(() => {
    const layoutId = layoutApiId(activeLayout);
    if (!draft?.id || draft.id <= 0 || !layoutId || !selectedSizeOptionId) return;
    const key = `${draft.id}:${layoutId}:${selectedSizeOptionId}`;
    if (loadedVariantRef.current === key) return;
    loadedVariantRef.current = key;
    let cancelled = false;
    void browserAlbumApi.fontLayoutLibrary.get(layoutId, {
      sizeTemplateId: draft.id,
      sizeOptionId: selectedSizeOptionId
    }).then((layout) => {
      if (cancelled) return;
      const sizeOption = draft.sizeOptions.find((option) => option.id === selectedSizeOptionId);
      const canvas = canvasForOption(sizeOption);
      const sizeLayout: MountedSizeLayout = {
        sizeOptionId: selectedSizeOptionId,
        layers: clone(layout.layers.objects),
        canvas
      };
      updateDraft({
        fontLayouts: draft.fontLayouts.map((item) => item.id === activeLayout?.id
          ? {
            ...item,
            name: layout.name || item.name,
            previewImage: layout.previewImage || item.previewImage,
            sizeLayouts: [
              ...item.sizeLayouts.filter((candidate) => candidate.sizeOptionId !== selectedSizeOptionId),
              sizeLayout
            ]
          }
          : item)
      });
    }).catch(() => {
      // A missing variant is valid; the editor falls back to the local/base layers.
    });
    return () => {
      cancelled = true;
    };
  }, [activeLayout?.id, activeLayout?.fontLayoutTemplateId, draft?.id, selectedSizeOptionId]);

  useEffect(() => {
    const layoutId = numberValue(draft?.selectedFontLayoutId);
    if (!draft?.id || draft.id <= 0 || !layoutId || draft.fontLayouts.some((layout) => layoutApiId(layout) === layoutId)) return;
    let cancelled = false;
    void browserAlbumApi.fontLayoutLibrary.get(layoutId, {
      sizeTemplateId: draft.id,
      sizeOptionId: selectedSizeOptionId || undefined
    }).then((library) => {
      if (cancelled) return;
      const sizeOptionId = selectedSizeOptionId || draft.sizeOptions[0]?.id || '';
      const sizeOption = draft.sizeOptions.find((option) => option.id === sizeOptionId);
      const mounted: MountedFontLayout = {
        id: String(library.id),
        fontLayoutTemplateId: library.id,
        name: library.name,
        previewImage: library.previewImage,
        sizeLayouts: sizeOptionId
          ? [{ sizeOptionId, layers: clone(library.layers.objects), canvas: canvasForOption(sizeOption) }]
          : []
      };
      updateDraft({ fontLayouts: [...draft.fontLayouts, mounted] });
      setSelectedLayoutId(mounted.id);
    }).catch(() => {
      // A stale selected_font_layout_id should not prevent the template editor opening.
    });
    return () => {
      cancelled = true;
    };
  }, [draft?.id, draft?.selectedFontLayoutId, draft?.fontLayouts.length, selectedSizeOptionId]);

  async function loadTemplates() {
    setLoading(true);
    try {
      setTemplates(await browserAlbumApi.catalogSizeTemplates.list({ shopId: selectedShopId, productId: selectedProductId }));
    } catch (error) {
      setTemplates([]);
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadLibrary(shopId: number, search = librarySearch) {
    setLibraryLoading(true);
    try {
      setLibraryItems(await browserAlbumApi.fontLayoutLibrary.list({ shopId, search: search.trim() || undefined }));
    } catch (error) {
      setLibraryItems([]);
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLibraryLoading(false);
    }
  }

  function resetEditor(template: CatalogSizeTemplate) {
    loadedVariantRef.current = '';
    setTemplatePreviewFile(undefined);
    setDraft(template);
    setInfoJson(JSON.stringify(template.sizeTemplateInfo, null, 2));
    const firstSize = template.selectedSizeOptionId || template.sizeOptions[0]?.id || '';
    const firstLayout = template.fontLayouts[0];
    setSelectedSizeOptionId(firstSize);
    setSelectedLayoutId(firstLayout?.id);
    setLibraryShopId(template.shopId);
    setMountLibraryId(undefined);
    setLibrarySearch('');
    openSizeOption(template.sizeOptions.find((option) => option.id === firstSize));
    setSelectedElementId(undefined);
    form.setFieldsValue({
      shopId: template.shopId,
      name: template.name,
      products: template.applicableProducts,
      pageCountOptions: template.pageCountOptions.map(String)
    });
  }

  async function openEditor(template?: CatalogSizeTemplate, duplicate = false) {
    const shopId = template?.shopId ?? selectedShopId ?? shops[0]?.id ?? 0;
    if (!shopId) {
      message.warning('请先新增店铺');
      return;
    }
    setView('editor');
    setEditorCollapsed(false);
    if (!template) {
      const next = blankTemplate(shopId, selectedProductId);
      resetEditor(next);
      return;
    }
    setEditorLoading(true);
    try {
      const detail = await browserAlbumApi.catalogSizeTemplates.get(template.id);
      resetEditor(duplicate ? { ...clone(detail), id: 0, name: `${detail.name} - 副本`, createdAt: '', updatedAt: '' } : detail);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
      setView('list');
    } finally {
      setEditorLoading(false);
    }
  }

  function leaveEditor() {
    if (submitting) return;
    if (embedded) {
      editorExitRef.current?.();
      return;
    }
    setView('list');
    setDraft(undefined);
    setSelectedLayoutId(undefined);
    setSelectedSizeOptionId('');
  }

  function updateDraft(patch: Partial<CatalogSizeTemplate>) {
    setDraft((current) => current ? { ...current, ...patch } : current);
  }

  function updateFormValues(_: unknown, values: Record<string, unknown>) {
    const pageCountOptions = Array.isArray(values.pageCountOptions)
      ? values.pageCountOptions.map(numberValue).filter((item) => item > 0)
      : draft?.pageCountOptions ?? [];
    updateDraft({
      shopId: numberValue(values.shopId, draft?.shopId),
      name: textValue(values.name),
      applicableProducts: Array.isArray(values.products) ? values.products.map(String) : [],
      pageCount: pageCountOptions.includes(draft?.pageCount ?? 0) ? draft?.pageCount ?? 1 : pageCountOptions[0] ?? draft?.pageCount ?? 1,
      pageCountOptions
    });
  }

  function openSizeOption(option?: CatalogSizeOption) {
    if (option) {
      setEditingSizeOption(option.id);
      sizeOptionForm.setFieldsValue({ id: option.id, label: option.label, ...option.fields });
      return;
    }
    if (!draft) return;
    const id = `draft-size-${crypto.randomUUID()}`;
    const next: CatalogSizeOption = { id, label: '新增规格', fields: { size_unit: 'in', single_side_width: 0, single_side_height: 0, bleed: 0, spine_width: 0, spine_bleed: 0 } };
    updateDraft({ sizeOptions: [...draft.sizeOptions, next], selectedSizeOptionId: id });
    setSelectedSizeOptionId(id);
    setEditingSizeOption(id);
    sizeOptionForm.setFieldsValue({ id, label: next.label, ...next.fields });
  }

  function changeSizeOptionUnit(unit: SizeTemplateUnit) {
    const option = draft?.sizeOptions.find((item) => item.id === editingSizeOption);
    const values = option?.fields.unit_values;
    if (unit === 'in') {
      if (option) sizeOptionForm.setFieldsValue({ size_unit: unit, single_side_width: option.fields.single_side_width, single_side_height: option.fields.single_side_height, bleed: option.fields.bleed, spine_width: option.fields.spine_width, spine_bleed: option.fields.spine_bleed });
      else sizeOptionForm.setFieldValue('size_unit', unit);
      return;
    }
    if (!values) return;
    sizeOptionForm.setFieldsValue({
      size_unit: unit,
      single_side_width: values.single_side_width[unit],
      single_side_height: values.single_side_height[unit],
      bleed: values.bleed[unit],
      spine_width: values.spine_width[unit],
      spine_bleed: values.spine_bleed[unit]
    });
  }

  async function saveSizeOption() {
    const values = await sizeOptionForm.validateFields();
    if (!draft) return;
    const generatedId = `${numberValue(values.single_side_width)}x${numberValue(values.single_side_height)}`;
    const existing = draft.sizeOptions.find((item) => item.id === editingSizeOption);
    // Persisted option IDs are stable business keys for size-specific layers.
    const baseId = existing && !isDraftSizeOption(existing.id) ? existing.id : generatedId;
    let id = baseId;
    let suffix = 2;
    while (draft.sizeOptions.some((option) => option.id === id && option.id !== editingSizeOption)) id = `${baseId}-${suffix++}`;
    if (values.size_unit !== 'in' && !existing) {
      message.warning('新增尺寸方案请先填写英寸数据');
      return;
    }
    const fields = values.size_unit === 'in' || !existing
      ? { ...existing?.fields, size_unit: 'in' as const, single_side_width: values.single_side_width, single_side_height: values.single_side_height, bleed: values.bleed, spine_width: values.spine_width, spine_bleed: values.spine_bleed }
      : existing.fields;
    const option: CatalogSizeOption = { id, label: values.label.trim() || id, fields };
    const sizeOptions = editingSizeOption ? draft.sizeOptions.map((item) => item.id === editingSizeOption ? option : item) : [...draft.sizeOptions, option];
    const nextSelectedSizeOptionId = selectedSizeOptionId === editingSizeOption || !selectedSizeOptionId ? id : selectedSizeOptionId;
    updateDraft({ sizeOptions, selectedSizeOptionId: nextSelectedSizeOptionId });
    setSelectedSizeOptionId(nextSelectedSizeOptionId);
    setEditingSizeOption(id);
  }

  function deleteSizeOption(option: CatalogSizeOption) {
    if (!draft) return;
    const sizeOptions = draft.sizeOptions.filter((item) => item.id !== option.id);
    const nextSelected = selectedSizeOptionId === option.id ? sizeOptions[0]?.id ?? '' : selectedSizeOptionId;
    updateDraft({ sizeOptions, selectedSizeOptionId: nextSelected });
    setSelectedSizeOptionId(nextSelected);
    openSizeOption(sizeOptions.find((item) => item.id === nextSelected));
  }

  function setCurrentLayoutDraft(nextTemplate: TemplateImportDraft) {
    if (!draft || !activeLayout || !activeSizeOption) return;
    const nextSizeLayout = layoutFromDraft(nextTemplate, activeSizeOption.id, canvasForOption(activeSizeOption));
    updateDraft({ fontLayouts: draft.fontLayouts.map((layout) => layout.id === activeLayout.id ? { ...layout, sizeLayouts: layout.sizeLayouts.some((item) => item.sizeOptionId === activeSizeOption.id) ? layout.sizeLayouts.map((item) => item.sizeOptionId === activeSizeOption.id ? nextSizeLayout : item) : [...layout.sizeLayouts, nextSizeLayout] } : layout) });
  }

  async function saveTemplate() {
    if (!draft) return;
    try {
      const values = await form.validateFields();
      let sizeTemplateInfo: Record<string, unknown>[];
      try {
        const parsed = JSON.parse(infoJson || '[]');
        if (!Array.isArray(parsed)) throw new Error('尺寸模板信息必须是数组');
        sizeTemplateInfo = parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)));
      } catch (error) {
        message.error(error instanceof Error ? error.message : '尺寸模板信息 JSON 格式不正确');
        return;
      }
      const pageCountOptions = Array.isArray(values.pageCountOptions) ? values.pageCountOptions.map(numberValue).filter((count: number) => count > 0) : draft.pageCountOptions;
      if (pageCountOptions.length === 0) {
        message.warning('请至少添加一个页数选项');
        return;
      }
      if (draft.sizeOptions.some((option) => isDraftSizeOption(option.id))) {
        message.warning('请先保存新增的尺寸方案');
        return;
      }
      const next: CatalogSizeTemplate = { ...draft, shopId: values.shopId, name: values.name.trim(), applicableProducts: values.products ?? [], pageCount: pageCountOptions.includes(draft.pageCount) ? draft.pageCount : pageCountOptions[0] ?? draft.pageCount, pageCountOptions, sizeTemplateInfo };
      if (!next.name) {
        message.warning('请填写模板名称');
        return;
      }
      setSubmitting(true);
      let response = next.id > 0 ? await browserAlbumApi.catalogSizeTemplates.update(next.id, templatePayload(next)) : await browserAlbumApi.catalogSizeTemplates.create(templatePayload(next));
      if (templatePreviewFile && response.id > 0) {
        const previewImage = await browserAlbumApi.catalogSizeTemplates.uploadPreview(response.id, templatePreviewFile);
        response = { ...response, previewImage };
      }
      // The size-template endpoint may omit the separately managed font layouts.
      // Keep the editor's local associations so they can be persisted through the
      // font-layout sync endpoint immediately after creating the template.
      const saved = next.fontLayouts.length === 0
        ? response
        : { ...response, fontLayouts: next.fontLayouts, selectedFontLayoutId: response.selectedFontLayoutId ?? next.selectedFontLayoutId };
      resetEditor(saved);
      await loadTemplates();
      message.success(next.id > 0 ? '尺寸模板已保存' : '尺寸模板已新增');
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteTemplate(template: CatalogSizeTemplate) {
    try {
      await browserAlbumApi.catalogSizeTemplates.delete(template.id);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      message.success('尺寸模板已删除');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function mountLibraryTemplate(sourceSizeOptionId = mountSourceSize) {
    if (!draft || !mountLibraryId || !sourceSizeOptionId) {
      message.warning('请选择布局模板和来源尺寸');
      return;
    }
    const library = libraryItems.find((item) => item.id === mountLibraryId);
    if (!library) return;
    const name = mountName.trim() || library.name;
    try {
      const mounted: MountedFontLayout = {
        // The library template ID is the stable ID used by the new API.
        id: String(library.id),
        fontLayoutTemplateId: library.id,
        name,
        previewImage: library.previewImage,
        sizeLayouts: draft.sizeOptions.map((option) => option.id === sourceSizeOptionId
          ? { sizeOptionId: option.id, layers: clone(library.layers.objects), canvas: canvasForOption(option) }
          : { sizeOptionId: option.id, layers: [], canvas: canvasForOption(option) })
      };
      updateDraft({ fontLayouts: [...draft.fontLayouts, mounted] });
      setSelectedLayoutId(mounted.id);
      setSelectedSizeOptionId(sourceSizeOptionId);
      message.success('字体布局已添加到尺寸模板');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function removeMountedLayout(layout: MountedFontLayout) {
    if (!draft) return;
    try {
      const nextLayouts = draft.fontLayouts.filter((item) => item.id !== layout.id);
      updateDraft({ fontLayouts: nextLayouts });
      setSelectedLayoutId(nextLayouts[0]?.id);
      message.success('字体布局已移除');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function renameMountedLayout() {
    if (!draft || !renameLayoutId || !renameValue.trim()) return;
    const layout = draft.fontLayouts.find((item) => item.id === renameLayoutId);
    if (!layout) return;
    try {
      const layoutId = layoutApiId(layout);
      if (layoutId) await browserAlbumApi.fontLayoutLibrary.update(layoutId, { name: renameValue.trim() });
      updateDraft({ fontLayouts: draft.fontLayouts.map((item) => item.id === layout.id ? { ...item, name: renameValue.trim() } : item) });
      setRenameLayoutId(undefined);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveCurrentSizeLayout() {
    if (!draft || !activeLayout || !activeSizeLayout || !activeSizeOption) return;
    try {
      const layoutId = layoutApiId(activeLayout);
      if (draft.id > 0 && layoutId) {
        await browserAlbumApi.fontLayoutLibrary.syncSizeOptions(layoutId, draft.id, [{
          sizeOptionId: activeSizeOption.id,
          layers: editorLayersPayload(activeSizeLayout.layers)
        }]);
        updateDraft({
          selectedFontLayoutId: layoutId,
          fontLayouts: draft.fontLayouts.map((layout) => layout.id === activeLayout.id
            ? { ...layout, sizeLayouts: [...layout.sizeLayouts.filter((item) => item.sizeOptionId !== activeSizeOption.id), activeSizeLayout] }
            : layout)
        });
      }
      message.success(`已保存 ${activeSizeOption.label || activeSizeOption.id} 的布局`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  function openSyncModal() {
    if (!activeLayout || !activeSizeOption) {
      message.info('请先选择字体布局和来源尺寸');
      return;
    }
    setSyncState({ open: true, mode: 'scale', targets: draft?.sizeOptions.filter((option) => option.id !== activeSizeOption.id).map((option) => option.id) ?? [] });
  }

  async function syncCurrentLayout() {
    if (!draft || !activeLayout || !activeSizeOption || syncState.targets.length === 0) return;
    try {
      const source = activeLayout.sizeLayouts.find((layout) => layout.sizeOptionId === activeSizeOption.id) ?? activeSizeLayout;
      if (!source) return;
      const syncedLayouts = syncState.targets.map((targetId) => syncLayers(source, draft.sizeOptions.find((option) => option.id === targetId), activeSizeOption, syncState.mode));
      const layoutId = layoutApiId(activeLayout);
      if (draft.id > 0 && layoutId) {
        await browserAlbumApi.fontLayoutLibrary.syncSizeOptions(layoutId, draft.id, syncedLayouts.map((layout) => ({
          sizeOptionId: layout.sizeOptionId,
          layers: editorLayersPayload(layout.layers)
        })));
      }
      const nextLayouts = draft.fontLayouts.map((layout) => layout.id !== activeLayout.id ? layout : {
        ...layout,
        ...(layoutId ? { fontLayoutTemplateId: layoutId } : {}),
        sizeLayouts: [...layout.sizeLayouts.filter((item) => !syncState.targets.includes(item.sizeOptionId)), ...syncedLayouts]
      });
      updateDraft({ ...(layoutId ? { selectedFontLayoutId: layoutId } : {}), fontLayouts: nextLayouts });
      setSyncState((current) => ({ ...current, open: false }));
      message.success(`已同步 ${syncState.targets.length} 个尺寸`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  function openLibraryEditor(item?: FontLayoutLibraryTemplate) {
    setLibraryEditor({ id: item?.id, name: item?.name ?? '', shopId: item?.shopId ?? libraryShopId ?? draft?.shopId ?? selectedShopId ?? shops[0]?.id ?? 0 });
  }

  async function saveLibraryEditor() {
    if (!libraryEditor) return;
    if (!libraryEditor.name.trim()) {
      message.warning('请填写布局模板名称');
      return;
    }
    setLibrarySubmitting(true);
    try {
      let saved: FontLayoutLibraryTemplate;
      const payload = { shopId: libraryEditor.shopId, name: libraryEditor.name.trim() };
      saved = libraryEditor.id
        ? await browserAlbumApi.fontLayoutLibrary.update(libraryEditor.id, payload)
        : await browserAlbumApi.fontLayoutLibrary.create({ ...payload, sortKey: libraryEditor.name.trim(), layers: { objects: [], animations: [], styles: [], dataSources: [] } });
      if (libraryEditor.previewFile) saved = await browserAlbumApi.fontLayoutLibrary.uploadPreview(saved.id, libraryEditor.previewFile);
      setLibraryItems((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setLibraryEditor(undefined);
      if (!libraryEditor.id) {
        setMountLibraryId(saved.id);
        setMountName(saved.name);
        setMountSourceSize(selectedSizeOptionId || draft?.sizeOptions[0]?.id || '');
        setLibraryShopId(saved.shopId);
      }
      message.success(libraryEditor.id ? '字体布局模板已修改' : '字体布局模板已新增');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLibrarySubmitting(false);
    }
  }

  async function deleteLibrary(item: FontLayoutLibraryTemplate) {
    try {
      await browserAlbumApi.fontLayoutLibrary.delete(item.id);
      setLibraryItems((current) => current.filter((candidate) => candidate.id !== item.id));
      message.success('字体布局模板库项已删除');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveAsLibrary(item: FontLayoutLibraryTemplate) {
    const name = `${item.name} - 副本`;
    try {
      const saved = await browserAlbumApi.fontLayoutLibrary.create({
        shopId: item.shopId,
        name,
        sortKey: item.sortKey,
        layers: item.layers
      });
      setLibraryItems((current) => [saved, ...current]);
      message.success('已另存为新的字体布局模板');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  function handlePreviewFile(file?: File) {
    setLibraryEditor((current) => current ? { ...current, previewFile: file } : current);
  }

  const activeSizeValues = activeSizeOption?.fields ? {
    unit: activeSizeOption.fields.size_unit,
    singleWidth: activeSizeOption.fields.single_side_width,
    singleHeight: activeSizeOption.fields.single_side_height,
    spineWidth: activeSizeOption.fields.spine_width,
    spineBleed: activeSizeOption.fields.spine_bleed,
    bleed: activeSizeOption.fields.bleed
  } : { unit: draft?.displayUnit ?? 'in' };

  if (view === 'editor' && !draft) {
    return <section className="panel size-template-redesign size-template-editor-page"><div className="size-template-editor-loading"><Spin size="large" /></div></section>;
  }

  if (view === 'editor' && draft) {
    return (
      <>
        <section className="panel size-template-redesign size-template-editor-page">
          <header className="size-template-redesign-header">
            <div className="size-template-redesign-heading">
              <Button type="text" icon={<ArrowLeftOutlined />} aria-label={embedded ? '返回模板库' : '返回尺寸模板列表'} onClick={leaveEditor} />
              <div><h1>{draft.name || '新建尺寸模板'}</h1></div>
            </div>
            <Space wrap>
              <Button onClick={leaveEditor}>取消</Button>
              <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={() => void saveTemplate()}>保存模板</Button>
            </Space>
          </header>
          {editorLoading ? <div className="size-template-editor-loading"><Spin size="large" /></div> : (
            <div className={`size-template-editor-layout${editorCollapsed ? ' is-collapsed' : ''}`}>
              <aside className="size-template-editor-sidebar">
                <div className="size-template-sidebar-rail"><Tooltip title={editorCollapsed ? '展开编辑栏' : '收起编辑栏'} placement="right"><Button type="text" icon={editorCollapsed ? <RightOutlined /> : <LeftOutlined />} aria-label={editorCollapsed ? '展开编辑栏' : '收起编辑栏'} onClick={() => setEditorCollapsed((current) => !current)} /></Tooltip></div>
                {!editorCollapsed && <div className="size-template-sidebar-content">
                  <Form form={form} layout="vertical" onValuesChange={updateFormValues} initialValues={{ shopId: draft.shopId, name: draft.name, products: draft.applicableProducts, pageCountOptions: draft.pageCountOptions.map(String) }}>
                    <div className="size-template-editor-section">
                      <div className="size-template-section-heading"><div><span className="size-template-section-index">01</span><div><strong>基本信息</strong><small>模板归属与默认生产参数</small></div></div></div>
                      <div className="size-template-form-two-col"><Form.Item name="shopId" label="所属店铺" rules={[{ required: true, message: '请选择店铺' }]}><Select options={shops.map((shop) => ({ value: shop.id, label: shop.shopName || shop.shop || '未命名店铺' }))} onChange={(shopId) => { form.setFieldValue('products', []); updateDraft({ shopId, applicableProducts: [] }); }} /></Form.Item><Form.Item name="name" label="模板名称" rules={[{ required: true, whitespace: true, message: '请输入模板名称' }]}><Input placeholder="例如：婚礼签到册" /></Form.Item></div>
                      <div className="size-template-preview-upload"><div><strong>预览图</strong><span>{templatePreviewFile?.name || (draft.previewImage ? '已上传预览图' : '可选，支持 PNG / JPG / WEBP')}</span></div><Button icon={<UploadOutlined />} onClick={() => templatePreviewRef.current?.click()}>选择图片</Button><input ref={templatePreviewRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; setTemplatePreviewFile(file); }} /></div>
                      <Form.Item name="products" label="适用商品"><Select mode="multiple" className="size-template-products-select" options={availableProducts.map((product) => ({ value: product, label: product }))} placeholder={availableProducts.length ? '选择商品' : '当前店铺暂无商品'} /></Form.Item>
                      <Form.Item name="pageCountOptions" label="页数选项" className="size-template-page-count-form-item"><PageCountOptionsEditor selected={draft.pageCount} onSelect={(pageCount) => updateDraft({ pageCount })} /></Form.Item>
                    </div>
                  </Form>

                  <div className="size-template-editor-section size-template-size-options-section">
                    <div className="size-template-section-heading"><div><span className="size-template-section-index">02</span><div><strong>尺寸方案</strong><small>{draft.sizeOptions.length} 个成品规格</small></div></div><Space size={4}><Button type="text" icon={<PlusOutlined />} onClick={() => openSizeOption()}>新增</Button><Button type="primary" ghost icon={<SaveOutlined />} onClick={() => void saveSizeOption()}>保存</Button></Space></div>
                    <div className="size-template-option-list">
                      {draft.sizeOptions.map((option) => <div className={`size-template-option-row${option.id === selectedSizeOptionId ? ' selected' : ''}`} key={option.id} onClick={() => { setSelectedSizeOptionId(option.id); openSizeOption(option); }}><div><strong>{option.label || '未命名规格'}</strong><small>{isDraftSizeOption(option.id) ? '待填写尺寸数据' : fieldsLabel(option.fields)}</small></div><Space size={0}><Tooltip title="编辑尺寸方案"><Button type="text" size="small" icon={<EditOutlined />} aria-label={`编辑 ${option.label}`} onClick={(event) => { event.stopPropagation(); openSizeOption(option); }} /></Tooltip><Popconfirm title="删除尺寸方案" okText="删除" cancelText="取消" onConfirm={(event) => { event?.stopPropagation(); deleteSizeOption(option); }}><Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={`删除 ${option.label}`} onClick={(event) => event.stopPropagation()} /></Popconfirm></Space></div>)}
                      {draft.sizeOptions.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有尺寸方案" />}
                    </div>
                    <SizeOptionEditor form={sizeOptionForm} editing={Boolean(editingSizeOption)} hasUnitValues={Boolean(draft.sizeOptions.find((item) => item.id === editingSizeOption)?.fields.unit_values)} onUnitChange={changeSizeOptionUnit} />
                  </div>

                  <div className="size-template-editor-section size-template-layout-section">
                    <div className="size-template-section-heading"><div><span className="size-template-section-index">03</span><div><strong>字体布局库</strong><small>从店铺布局库选择后应用到当前尺寸模板</small></div></div><Space size={4} className="size-template-layout-actions"><Button type="text" size="small" icon={<SettingOutlined />} onClick={() => setLibraryOpen(true)}>管理布局库</Button><Button type="text" size="small" icon={<PlusOutlined />} onClick={() => openLibraryEditor()}>新建布局</Button></Space></div>
                    <div className="size-template-layout-picker"><Select size="small" value={libraryShopId ?? draft.shopId} aria-label="字体布局所属店铺" options={shops.map((shop) => ({ value: shop.id, label: shop.shopName || shop.shop || '未命名店铺' }))} onChange={(shopId) => { setLibraryShopId(shopId); setLibrarySearch(''); setMountLibraryId(undefined); }} /><Select size="small" allowClear showSearch filterOption={false} loading={libraryLoading} value={mountLibraryId} aria-label="选择字体布局" placeholder="搜索或选择字体布局" options={libraryFiltered.map((item) => ({ value: item.id, label: `${item.name} · ${item.layers.objects.length} 个图层` }))} onSearch={setLibrarySearch} onChange={(layoutId) => { setMountLibraryId(layoutId); const item = libraryItems.find((candidate) => candidate.id === layoutId); setMountName(item?.name ?? ''); }} /><Button size="small" type="primary" ghost icon={<PlusOutlined />} disabled={!mountLibraryId || !selectedSizeOptionId} onClick={() => void mountLibraryTemplate(selectedSizeOptionId)}>添加</Button></div>
                    <div className="size-template-layout-list">
                      {draft.fontLayouts.map((layout) => <div className={`size-template-layout-row${layout.id === selectedLayoutId ? ' selected' : ''}`} key={layout.id} onClick={() => { setSelectedLayoutId(layout.id); setSelectedElementId(undefined); }}><div className="size-template-layout-preview">{layout.previewImage ? <img src={layout.previewImage} alt="" /> : previewPlaceholder(layout.name)}</div><div className="size-template-layout-copy"><strong>{layout.name}</strong><small>{layout.sizeLayouts.filter((item) => item.layers.length > 0).length}/{draft.sizeOptions.length} 个尺寸已配置</small></div><Space size={0}><Tooltip title="修改布局名称"><Button type="text" size="small" icon={<EditOutlined />} aria-label={`修改 ${layout.name} 名称`} onClick={(event) => { event.stopPropagation(); setRenameLayoutId(layout.id); setRenameValue(layout.name); }} /></Tooltip><Popconfirm title="移除布局" okText="移除" cancelText="取消" onConfirm={() => void removeMountedLayout(layout)}><Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={`移除 ${layout.name}`} onClick={(event) => event.stopPropagation()} /></Popconfirm></Space></div>)}
                      {draft.fontLayouts.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="从模板库添加一个字体布局" />}
                    </div>
                  </div>
                  {activeLayoutDraft && <div className="size-template-editor-section size-template-layer-editor-section"><div className="size-template-section-heading"><div><span className="size-template-section-index">04</span><div><strong>字体布局图层</strong><small>{activeLayout?.name} · {activeSizeOption?.label}</small></div></div></div><TemplateElementEditor template={activeLayoutDraft} fonts={fonts} sizeValues={activeSizeValues} selectedElementId={selectedElementId} onSelect={setSelectedElementId} onChange={setCurrentLayoutDraft} /><LayoutLayersInfo layers={activeSizeLayout?.layers ?? []} /></div>}
                  <JsonInfoEditor value={infoJson} onChange={setInfoJson} />
                </div>}
              </aside>
              <main className="size-template-editor-main">
                <div className="size-template-canvas-toolbar"><div><span className="size-template-eyebrow">实时布局</span><strong>{activeLayout?.name || '选择一个字体布局'}</strong><span>{activeSizeOption ? `${activeSizeOption.label} · ${fieldsLabel(activeSizeOption.fields)}` : '先添加尺寸方案'}</span></div><Space wrap><Select size="small" value={selectedSizeOptionId || undefined} placeholder="选择尺寸" options={draft.sizeOptions.map((option) => ({ value: option.id, label: option.label || option.id }))} onChange={setSelectedSizeOptionId} /><Button size="small" icon={<SaveOutlined />} disabled={!activeSizeLayout} onClick={() => void saveCurrentSizeLayout()}>保存当前尺寸</Button><Button size="small" type="primary" ghost icon={<SyncOutlined />} disabled={!activeLayout || !activeSizeLayout} onClick={openSyncModal}>尺寸同步</Button></Space></div>
                <FabricTemplateCanvas values={activeSizeValues} template={activeLayoutDraft} selectedElementId={selectedElementId} onTemplateChange={setCurrentLayoutDraft} onElementSelect={setSelectedElementId} />
              </main>
            </div>
          )}
        </section>

        <Modal title={renameLayoutId ? '修改布局名称' : ''} open={Boolean(renameLayoutId)} onCancel={() => setRenameLayoutId(undefined)} onOk={() => void renameMountedLayout()} okText="保存" cancelText="取消" destroyOnHidden><Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} /></Modal>
        <LibraryModal open={libraryOpen} items={libraryFiltered} loading={libraryLoading} search={librarySearch} onSearch={setLibrarySearch} onClose={() => setLibraryOpen(false)} onPick={(item) => { setMountLibraryId(item.id); setMountName(item.name); setLibraryOpen(false); }} onCreate={() => openLibraryEditor()} onEdit={openLibraryEditor} onSaveAs={(item) => void saveAsLibrary(item)} onDelete={(item) => void deleteLibrary(item)} onUpload={(item, file) => void browserAlbumApi.fontLayoutLibrary.uploadPreview(item.id, file).then((saved) => setLibraryItems((current) => current.map((candidate) => candidate.id === saved.id ? saved : candidate))).catch((error) => message.error(error instanceof Error ? error.message : String(error)))} />
        <LibraryEditorModal state={libraryEditor} shops={shops} submitting={librarySubmitting} previewRef={importPreviewRef} onChange={setLibraryEditor} onCancel={() => setLibraryEditor(undefined)} onOk={() => void saveLibraryEditor()} onPreviewFile={handlePreviewFile} />
        <SyncModal state={syncState} options={draft.sizeOptions} currentId={selectedSizeOptionId} onChange={setSyncState} onCancel={() => setSyncState((current) => ({ ...current, open: false }))} onOk={() => void syncCurrentLayout()} />
      </>
    );
  }

  return (
    <section className="panel size-template-redesign size-template-catalog-page">
      <header className="size-template-redesign-header size-template-catalog-header"><div><span className="size-template-eyebrow">模板管理 / 尺寸模板</span><h1>尺寸模板</h1><p>按店铺维护成品规格、页数与字体布局实例</p></div><Button type="primary" icon={<PlusOutlined />} disabled={shops.length === 0} onClick={() => void openEditor()}>新增尺寸模板</Button></header>
      <div className="size-template-catalog-toolbar"><Input allowClear prefix={<SearchOutlined />} placeholder="搜索模板、商品或尺寸方案" value={keyword} onChange={(event) => setKeyword(event.target.value)} /><span>{filteredTemplates.length} 个模板</span></div>
      {loading ? <div className="size-template-catalog-loading"><Spin size="large" /></div> : filteredTemplates.length === 0 ? <Empty className="size-template-catalog-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description={shops.length === 0 ? '请先新增店铺' : keyword ? '没有匹配的尺寸模板' : '当前店铺还没有尺寸模板'}><Button type="primary" icon={<PlusOutlined />} disabled={shops.length === 0} onClick={() => void openEditor()}>新增尺寸模板</Button></Empty> : <div className="size-template-catalog-grid">{filteredTemplates.map((template) => <SizeTemplateCard key={template.id} template={template} shop={shops.find((shop) => shop.id === template.shopId)} onEdit={() => void openEditor(template)} onDuplicate={() => void openEditor(template, true)} onDelete={() => void deleteTemplate(template)} />)}</div>}
    </section>
  );
}

function SizeOptionEditor({ form, editing, hasUnitValues, onUnitChange }: { form: ReturnType<typeof Form.useForm<SizeOptionFormValues>>[0]; editing: boolean; hasUnitValues: boolean; onUnitChange(unit: SizeTemplateUnit): void }) {
  const selectedUnit = Form.useWatch('size_unit', form) as SizeTemplateUnit | undefined;
  const readOnly = selectedUnit !== 'in';
  return <div className="size-template-option-editor"><Form form={form} layout="vertical"><Form.Item name="id" hidden><Input /></Form.Item><Form.Item name="label" label="尺寸显示名称"><Input placeholder="例如 9 × 6" /></Form.Item><div className="size-template-form-three-col"><Form.Item name="size_unit" label="查看单位" rules={[{ required: true }]}><Select options={units.map((unit) => ({ ...unit, disabled: unit.value !== 'in' && !hasUnitValues }))} onChange={onUnitChange} /></Form.Item><Form.Item name="single_side_width" label="单面宽" rules={[{ required: true }]}><InputNumber min={0.01} disabled={readOnly} /></Form.Item><Form.Item name="single_side_height" label="单面高" rules={[{ required: true }]}><InputNumber min={0.01} disabled={readOnly} /></Form.Item><Form.Item name="bleed" label="出血"><InputNumber min={0} disabled={readOnly} /></Form.Item><Form.Item name="spine_width" label="书脊宽"><InputNumber min={0} disabled={readOnly} /></Form.Item><Form.Item name="spine_bleed" label="书脊出血"><InputNumber min={0} disabled={readOnly} /></Form.Item></div>{readOnly && <div className="size-template-unit-values-hint">当前单位为换算值，只读。</div>}</Form></div>;
}

function LibraryModal({ open, items, loading, search, onSearch, onClose, onPick, onCreate, onEdit, onSaveAs, onDelete, onUpload }: { open: boolean; items: FontLayoutLibraryTemplate[]; loading: boolean; search: string; onSearch(value: string): void; onClose(): void; onPick(item: FontLayoutLibraryTemplate): void; onCreate(): void; onEdit(item: FontLayoutLibraryTemplate): void; onSaveAs(item: FontLayoutLibraryTemplate): void; onDelete(item: FontLayoutLibraryTemplate): void; onUpload(item: FontLayoutLibraryTemplate, file: File): void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadingItem, setUploadingItem] = useState<number>();
  return <Modal title="字体布局模板库" open={open} onCancel={onClose} footer={null} width={900} destroyOnHidden><div className="size-template-library-toolbar"><Input allowClear prefix={<SearchOutlined />} placeholder="搜索布局模板" value={search} onChange={(event) => onSearch(event.target.value)} /><Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>新增布局模板</Button></div>{loading ? <div className="size-template-library-loading"><Spin /></div> : items.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前店铺还没有字体布局模板" /> : <div className="size-template-library-grid">{items.map((item) => <div className="size-template-library-card" key={item.id}><div className="size-template-library-image">{item.previewImage ? <img src={item.previewImage} alt="" /> : <FileTextOutlined />}</div><div className="size-template-library-card-copy"><strong>{item.name}</strong><span>{item.layers.objects.length} 个图层</span></div><div className="size-template-library-card-actions"><Button size="small" type="primary" ghost onClick={() => onPick(item)}>使用</Button><Tooltip title="编辑"><Button type="text" size="small" icon={<EditOutlined />} aria-label={`编辑 ${item.name}`} onClick={() => onEdit(item)} /></Tooltip><Tooltip title="另存为"><Button type="text" size="small" icon={<CopyOutlined />} aria-label={`另存为 ${item.name}`} onClick={() => onSaveAs(item)} /></Tooltip><Tooltip title="上传预览图"><Button type="text" size="small" icon={<UploadOutlined />} aria-label={`上传 ${item.name} 预览图`} onClick={() => { setUploadingItem(item.id); inputRef.current?.click(); }} /></Tooltip><Popconfirm title="删除布局模板" okText="删除" cancelText="取消" onConfirm={() => onDelete(item)}><Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={`删除 ${item.name}`} /></Popconfirm></div></div>)}</div>}<input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file && uploadingItem) onUpload(items.find((item) => item.id === uploadingItem)!, file); }} /></Modal>;
}

function LibraryEditorModal({ state, shops, submitting, previewRef, onChange, onCancel, onOk, onPreviewFile }: { state?: LibraryEditorState; shops: Shop[]; submitting: boolean; previewRef: RefObject<HTMLInputElement>; onChange(state: LibraryEditorState | undefined): void; onCancel(): void; onOk(): void; onPreviewFile(file?: File): void }) {
  return <Modal title={state?.id ? '编辑字体布局模板' : '新增字体布局模板'} open={Boolean(state)} onCancel={onCancel} onOk={onOk} confirmLoading={submitting} okText="保存" cancelText="取消" destroyOnHidden width={680}>
    {state && <Form layout="vertical">
      <div className="size-template-form-two-col"><Form.Item label="名称" required><Input value={state.name} onChange={(event) => onChange({ ...state, name: event.target.value })} placeholder="例如：封面标题" /></Form.Item><Form.Item label="所属店铺"><Select value={state.shopId} options={shops.map((shop) => ({ value: shop.id, label: shop.shopName || shop.shop || '未命名店铺' }))} onChange={(value) => onChange({ ...state, shopId: value })} /></Form.Item></div>
      <div className="size-template-preview-upload"><div><strong>预览图</strong><span>{state.previewFile?.name || '可选，支持 PNG / JPG / WEBP'}</span></div><Button icon={<UploadOutlined />} onClick={() => previewRef.current?.click()}>选择图片</Button><input ref={previewRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; onPreviewFile(file); }} /></div>
      <div className="size-template-library-inline-hint">新建布局后可在当前尺寸模板的“字体布局图层”区域添加文字、图片和矩形图层。</div>
    </Form>}
  </Modal>;
}

function SyncModal({ state, options, currentId, onChange, onCancel, onOk }: { state: SyncState; options: CatalogSizeOption[]; currentId: string; onChange(next: SyncState): void; onCancel(): void; onOk(): void }) {
  const available = options.filter((option) => option.id !== currentId);
  return <Modal title="尺寸同步" open={state.open} onCancel={onCancel} onOk={onOk} okText="开始同步" cancelText="取消" destroyOnHidden><div className="size-template-sync-source"><span>来源尺寸</span><strong>{options.find((option) => option.id === currentId)?.label || currentId}</strong></div><Form.Item label="同步方式"><Segmented block value={state.mode} options={[{ value: 'scale', label: '按成品比例缩放' }, { value: 'copy', label: '原样复制数值' }]} onChange={(value) => onChange({ ...state, mode: value as SyncState['mode'] })} /></Form.Item><Form.Item label="目标尺寸"><Checkbox.Group value={state.targets} onChange={(values) => onChange({ ...state, targets: values.map(String) })} options={available.map((option) => ({ value: option.id, label: `${option.label} · ${fieldsLabel(option.fields)}` }))} /></Form.Item>{available.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有可同步的其他尺寸" />}</Modal>;
}
