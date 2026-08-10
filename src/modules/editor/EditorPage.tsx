import { type DragEvent, useEffect, useRef, useState } from 'react';
import { App, Button, Checkbox, Form, Input, InputNumber, Modal, Select, Space } from 'antd';
import { ExportOutlined, ImportOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import * as fabric from 'fabric';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { AlbumTemplateDocument, ExportFormat, Order } from '@shared/domain';
import type { EditorPageProps } from '../types';
import { browserAlbumApi } from '../../api';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const nowIso = () => new Date().toISOString();

const exportOptions: Array<{ key: ExportFormat; title: string; description: string }> = [
  { key: 'cdr', title: 'CDR', description: 'CorelDRAW 可编辑文件' },
  { key: 'psd', title: 'PSD', description: 'Photoshop 分层文件' },
  { key: 'eps', title: 'EPS', description: 'Photoshop 印刷文件' },
  { key: 'svg', title: 'SVG', description: '通用矢量文件' },
  { key: 'jpg', title: 'JPG', description: '预览图片' },
  { key: 'pdf', title: 'PDF', description: '通用印刷文件' }
];

type Unit = 'mm' | 'cm' | 'in';

type FixedTemplateSettings = {
  unit: Unit;
  singleWidth: number;
  singleHeight: number;
  bleed: number;
  pages: number;
  spineWidth: number;
  spineBleed: number;
  coverName: string;
  coverDate: string;
  coverSubtitle: string;
  spineTop: string;
  spineMiddle: string;
  spineBottom: string;
  backText: string;
  showBackText: boolean;
};

const defaultFixedTemplateSettings: FixedTemplateSettings = {
  unit: 'in',
  singleWidth: 12.01,
  singleHeight: 8.58,
  bleed: 0.24,
  pages: 80,
  spineWidth: 0.65,
  spineBleed: 0.3,
  coverName: 'Wedding Guest Book',
  coverDate: '新人姓名 | 2026.10.01',
  coverSubtitle: 'Our Wedding Day',
  spineTop: 'Guest Book',
  spineMiddle: 'E & J',
  spineBottom: '2025',
  backText: 'Forever & Always',
  showBackText: true
};

const DESIGN_SCALE = 100;

function toInches(value: number, unit: Unit): number {
  if (unit === 'mm') return value / 25.4;
  if (unit === 'cm') return value / 2.54;
  return value;
}

function fromInches(value: number, unit: Unit): number {
  if (unit === 'mm') return value * 25.4;
  if (unit === 'cm') return value * 2.54;
  return value;
}

function createDocumentFromCanvas(
  name: string,
  source: AlbumTemplateDocument['source'],
  canvasJson: unknown,
  existing?: AlbumTemplateDocument
): AlbumTemplateDocument {
  const now = nowIso();
  return {
    schemaVersion: '1.0',
    id: existing?.id ?? crypto.randomUUID(),
    name,
    source,
    pages: [
      {
        id: existing?.pages[0]?.id ?? crypto.randomUUID(),
        name: 'Page 1',
        width: 1200,
        height: 800,
        dpi: 300,
        fabricJson: canvasJson,
        bindings: existing?.pages[0]?.bindings ?? []
      }
    ],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function orderLabel(order: Order): string {
  const detail = [order.customerName, order.status].filter(Boolean).join(' / ');
  return detail ? `${order.orderNo} - ${detail}` : order.orderNo;
}

function addTemplateText(
  instance: fabric.Canvas,
  text: string,
  options: Partial<fabric.TextboxProps> & { left: number; top: number; width: number; templateZone?: 'cover' | 'back' }
): void {
  const textObject = new fabric.Textbox(text, {
    fontFamily: 'Georgia, Microsoft YaHei, serif',
    fontSize: 18,
    fill: '#27334a',
    ...options
  });
  textObject.set('templateZone', options.templateZone ?? 'cover');
  instance.add(textObject);
}

function addSpineText(instance: fabric.Canvas, text: string, left: number, top: number, width: number): void {
  const textObject = new fabric.Text(text.replace(/\r?\n/g, ''), {
    left: left + width / 2,
    top,
    originX: 'center',
    originY: 'center',
    angle: 90,
    fontFamily: 'Georgia, Microsoft YaHei, serif',
    fontSize: 13,
    fill: '#27334a',
    selectable: true
  });
  textObject.set('templateZone', 'spine');
  instance.add(textObject);
}

type TemplateBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
  spineLeft: number;
  spineWidth: number;
  panelWidth: number;
};

function paintFixedTemplate(instance: fabric.Canvas, settings: FixedTemplateSettings): TemplateBounds {
  instance.clear();
  instance.backgroundColor = '#ffffff';
  const availableWidth = 1080;
  const availableHeight = 600;
  const left = 60;
  const top = 100;
  const totalWidth = Math.max(1, settings.singleWidth * 2 + settings.spineWidth);
  const physicalHeight = Math.max(0.1, settings.singleHeight);
  const designScale = Math.min(availableWidth / totalWidth, availableHeight / physicalHeight);
  const templateWidth = totalWidth * designScale;
  const templateHeight = physicalHeight * designScale;
  const spine = settings.spineWidth * designScale;
  const panel = settings.singleWidth * designScale;
  const bleed = toInches(settings.bleed, settings.unit) * designScale;
  const spineBleed = toInches(settings.spineBleed, settings.unit) * designScale;
  const bleedX = Math.min(28, bleed);
  const spineBleedX = Math.min(18, spineBleed);
  const spineLeft = left + panel;
  const rightPanel = spineLeft + spine;

  instance.add(new fabric.Rect({
    left: left - bleedX, top: top - bleedX, width: templateWidth + bleedX * 2, height: templateHeight + bleedX * 2,
    fill: '#fffaf4', stroke: '#ef8a42', strokeDashArray: [8, 5], strokeWidth: 1, selectable: false, evented: false
  }));
  instance.add(new fabric.Rect({
    left, top, width: templateWidth, height: templateHeight,
    fill: '#fffaf4', stroke: '#8aa8d8', strokeWidth: 1, selectable: false, evented: false
  }));
  instance.add(new fabric.Rect({
    left: spineLeft - spineBleedX, top, width: spine + spineBleedX * 2, height: templateHeight,
    fill: 'rgba(116, 196, 255, 0.08)', stroke: '#4bc3d6', strokeDashArray: [4, 4], strokeWidth: 1, selectable: false, evented: false
  }));
  instance.add(new fabric.Line([spineLeft, top, spineLeft, top + templateHeight], { stroke: '#7a8ca8', strokeWidth: 1, selectable: false, evented: false }));
  instance.add(new fabric.Line([rightPanel, top, rightPanel, top + templateHeight], { stroke: '#7a8ca8', strokeWidth: 1, selectable: false, evented: false }));

  if (settings.showBackText) {
    addTemplateText(instance, settings.backText, { left: left + panel * 0.3, top: top + templateHeight * 0.47, width: panel * 0.4, fontSize: 20, textAlign: 'center', templateZone: 'back' });
  }
  addTemplateText(instance, settings.coverName, { left: rightPanel + panel * 0.18, top: top + templateHeight * 0.12, width: panel * 0.64, fontSize: 25, textAlign: 'center', templateZone: 'cover' });
  addTemplateText(instance, settings.coverDate, { left: rightPanel + panel * 0.2, top: top + templateHeight * 0.39, width: panel * 0.6, fontSize: 15, textAlign: 'center', templateZone: 'cover' });
  addTemplateText(instance, settings.coverSubtitle, { left: rightPanel + panel * 0.2, top: top + templateHeight * 0.57, width: panel * 0.6, fontSize: 16, textAlign: 'center', templateZone: 'cover' });

  const spineTextLeft = spineLeft + spine * 0.2;
  const spineTextWidth = Math.max(38, spine * 0.6);
  addSpineText(instance, settings.spineTop, spineTextLeft, top + 55, spineTextWidth);
  addSpineText(instance, settings.spineMiddle, spineTextLeft, top + 240, spineTextWidth);
  addSpineText(instance, settings.spineBottom, spineTextLeft, top + 420, spineTextWidth);
  addTemplateText(instance, '封底', { left: left + panel * 0.42, top: top + templateHeight + 12, width: 80, fontSize: 12, textAlign: 'center', selectable: false, evented: false });
  addTemplateText(instance, '背脊', { left: spineLeft + spine * 0.15, top: top + templateHeight + 12, width: Math.max(42, spine * 0.7), fontSize: 12, textAlign: 'center', selectable: false, evented: false });
  addTemplateText(instance, '封面', { left: rightPanel + panel * 0.42, top: top + templateHeight + 12, width: 80, fontSize: 12, textAlign: 'center', selectable: false, evented: false });
  instance.renderAll();
  const bounds = { left, top, width: templateWidth, height: templateHeight, spineLeft, spineWidth: spine, panelWidth: panel };
  instance.getObjects().forEach((object) => {
    if (object.get('templateZone') !== 'spine') return;
    object.setCoords();
    const rect = object.getBoundingRect();
    const maxHeight = templateHeight - 16;
    if (rect.height > maxHeight) {
      const scale = maxHeight / rect.height;
      object.scaleX *= scale;
      object.scaleY *= scale;
      object.setCoords();
    }
    constrainObjectToTemplate(object, bounds);
  });
  return bounds;
}

function constrainObjectToTemplate(object: fabric.Object, bounds: TemplateBounds): void {
  object.setCoords();
  const zone = object.get('templateZone');
  const minLeft = zone === 'spine'
    ? bounds.spineLeft
    : zone === 'cover'
      ? bounds.spineLeft + bounds.spineWidth
      : bounds.left;
  const maxRight = zone === 'spine'
    ? bounds.spineLeft + bounds.spineWidth
    : zone === 'back'
      ? bounds.left + bounds.panelWidth
      : bounds.left + bounds.width;
  const minTop = bounds.top;
  const maxBottom = bounds.top + bounds.height;
  let rect = object.getBoundingRect();
  const allowedWidth = maxRight - minLeft;
  const allowedHeight = maxBottom - minTop;
  if (rect.width > allowedWidth || rect.height > allowedHeight) {
    const scale = Math.min(allowedWidth / rect.width, allowedHeight / rect.height);
    object.scaleX *= scale;
    object.scaleY *= scale;
    object.setCoords();
    rect = object.getBoundingRect();
  }
  let dx = 0;
  let dy = 0;
  if (rect.left < minLeft) dx = minLeft - rect.left;
  if (rect.left + rect.width > maxRight) dx = maxRight - rect.left - rect.width;
  if (rect.top < minTop) dy = minTop - rect.top;
  if (rect.top + rect.height > maxBottom) dy = maxBottom - rect.top - rect.height;
  object.set({ left: (object.left ?? 0) + dx, top: (object.top ?? 0) + dy });
  object.setCoords();
}

function paintEmptyCanvas(instance: fabric.Canvas, selectedOrder?: Order): void {
  instance.clear();
  instance.backgroundColor = '#ffffff';
  instance.add(new fabric.Textbox(
    selectedOrder ? `当前订单：${selectedOrder.orderNo}` : '选择订单后开始编辑模板',
    {
      left: 72,
      top: 64,
      width: 620,
      fontSize: 34,
      fontFamily: 'Microsoft YaHei',
      fill: '#1d2433'
    }
  ));
  if (selectedOrder) {
    instance.add(new fabric.Textbox(`客户：${selectedOrder.customerName || '未填写'}`, {
      left: 76,
      top: 118,
      width: 620,
      fontSize: 20,
      fontFamily: 'Microsoft YaHei',
      fill: '#64748b'
    }));
  }
  instance.renderAll();
}

export default function EditorPage({
  orders,
  selectedOrderId,
  selectedOrder,
  currentDocument,
  setCurrentDocument,
  setSelectedOrderId,
  setStatus
}: EditorPageProps) {
  const { message } = App.useApp();
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const canvasStageRef = useRef<HTMLDivElement | null>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const templateBoundsRef = useRef<TemplateBounds | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [saveMode, setSaveMode] = useState<'save' | 'saveAs' | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedExportFormats, setSelectedExportFormats] = useState<ExportFormat[]>(['psd']);
  const [exportGuides, setExportGuides] = useState(false);
  const [settings, setSettings] = useState<FixedTemplateSettings>(defaultFixedTemplateSettings);
  const [saveForm] = Form.useForm<{ name: string }>();

  function fitCanvasToStage(instance: fabric.Canvas) {
    const stage = canvasStageRef.current;
    if (!stage) return;
    const availableWidth = stage.clientWidth;
    const availableHeight = stage.clientHeight;
    if (availableWidth <= 0 || availableHeight <= 0) return;
    const scale = Math.min(availableWidth / 1200, availableHeight / 800, 1);
    instance.setZoom(1);
    instance.setDimensions({ width: 1200 * scale, height: 800 * scale }, { cssOnly: true });
    instance.calcOffset();
    instance.requestRenderAll();
  }

  useEffect(() => {
    if (!canvasElementRef.current || fabricCanvasRef.current) return;
    const instance = new fabric.Canvas(canvasElementRef.current, {
      width: 1200,
      height: 800,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true
    });
    fabricCanvasRef.current = instance;
    templateBoundsRef.current = paintFixedTemplate(instance, settings);
    fitCanvasToStage(instance);
    const keepObjectInBounds = ({ target }: { target?: fabric.FabricObject }) => {
      if (target && templateBoundsRef.current && target.get('templateZone')) {
        constrainObjectToTemplate(target, templateBoundsRef.current);
      }
    };
    instance.on('object:moving', keepObjectInBounds);
    instance.on('object:scaling', keepObjectInBounds);
    instance.on('object:rotating', keepObjectInBounds);
    instance.on('object:modified', keepObjectInBounds);
    return () => {
      instance.off('object:moving', keepObjectInBounds);
      instance.off('object:scaling', keepObjectInBounds);
      instance.off('object:rotating', keepObjectInBounds);
      instance.off('object:modified', keepObjectInBounds);
      instance.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    const stage = canvasStageRef.current;
    const instance = fabricCanvasRef.current;
    if (!stage || !instance) return;
    const observer = new ResizeObserver(() => fitCanvasToStage(instance));
    observer.observe(stage);
    fitCanvasToStage(instance);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    templateBoundsRef.current = paintFixedTemplate(fabricCanvasRef.current, settings);
    fitCanvasToStage(fabricCanvasRef.current);
  }, [settings]);

  function updateSetting<Key extends keyof FixedTemplateSettings>(key: Key, value: FixedTemplateSettings[Key]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function canvas(): fabric.Canvas {
    if (!fabricCanvasRef.current) throw new Error('画布尚未初始化');
    return fabricCanvasRef.current;
  }

  function handleOrderChange(orderId: string) {
    setSelectedOrderId(orderId);
    const order = orders.find((item) => item.id === orderId);
    if (order) {
      setStatus(`已选择订单 ${order.orderNo}`);
    }
  }

  function openSaveDialog(saveAs = false) {
    saveForm.setFieldsValue({
      name: saveAs
        ? currentDocument ? `${currentDocument.name} 副本` : '未命名模板'
        : currentDocument?.name ?? '未命名模板'
    });
    setSaveMode(saveAs ? 'saveAs' : 'save');
  }

  async function saveCurrentTemplate({ name }: { name: string }) {
    const saveAs = saveMode === 'saveAs';
    setSaving(true);
    const source = saveAs
      ? { kind: 'saved-as' as const, orderId: currentDocument?.source.orderId ?? selectedOrder?.id }
      : currentDocument?.source ?? (selectedOrder ? { kind: 'generated' as const, orderId: selectedOrder.id } : { kind: 'manual' as const });
    try {
      const doc = createDocumentFromCanvas(name.trim(), source, canvas().toJSON(), saveAs ? undefined : currentDocument);
      const summary = await browserAlbumApi.templates.save(doc);
      setCurrentDocument(doc);
      setStatus(`已保存模板：${summary.name} v${summary.version}`);
      message.success(`已保存模板：${summary.name} v${summary.version}`);
      setSaveMode(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus(`保存模板失败：${errorMessage}`);
      message.error(`保存模板失败：${errorMessage}`);
    } finally {
      setSaving(false);
    }
  }

  async function importFile(file: File) {
    const instance = canvas();
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'svg') {
      const result = await fabric.loadSVGFromString(await file.text());
      const objects = result.objects.filter(Boolean) as fabric.Object[];
      const group = fabric.util.groupSVGElements(objects, result.options);
      group.set({ left: 60, top: 60 });
      instance.add(group);
      instance.renderAll();
      setStatus(`已导入 SVG：${file.name}`);
      message.success(`已导入 SVG：${file.name}`);
      return;
    }
    if (extension === 'jpg' || extension === 'jpeg' || extension === 'png') {
      const image = await fabric.FabricImage.fromURL(await readFileAsDataUrl(file));
      image.scaleToWidth(560);
      image.set({ left: 80, top: 80 });
      instance.add(image);
      instance.renderAll();
      setStatus(`已导入图片：${file.name}`);
      message.success(`已导入图片：${file.name}`);
      return;
    }
    if (extension === 'pdf') {
      const pdf = await (pdfjsLib as any).getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const offscreen = document.createElement('canvas');
      offscreen.width = viewport.width;
      offscreen.height = viewport.height;
      const context = offscreen.getContext('2d');
      if (!context) throw new Error('无法创建 PDF 渲染画布');
      await page.render({ canvasContext: context, viewport }).promise;
      const image = await fabric.FabricImage.fromURL(offscreen.toDataURL('image/jpeg', 0.95));
      image.scaleToWidth(760);
      image.set({ left: 60, top: 60 });
      instance.add(image);
      instance.renderAll();
      setStatus(`已将 PDF 首页作为背景图导入：${file.name}`);
      message.success(`已导入 PDF：首页 ${file.name}`);
      return;
    }
    setStatus(`暂不支持导入：${file.name}`);
    message.warning(`暂不支持导入：${file.name}`);
  }

  function chooseImportFile(file?: File) {
    if (!file) return;
    setSelectedFile(file);
  }

  async function confirmImport() {
    if (!selectedFile) {
      message.warning('请先选择文件');
      return;
    }
    setImporting(true);
    try {
      await importFile(selectedFile);
      setImportOpen(false);
      setSelectedFile(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus(`导入失败：${errorMessage}`);
      message.error(`导入失败：${errorMessage}`);
    } finally {
      setImporting(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    chooseImportFile(event.dataTransfer.files[0]);
  }

  function toggleExportFormat(format: ExportFormat) {
    setSelectedExportFormats((current) =>
      current.includes(format) ? current.filter((item) => item !== format) : [...current, format]
    );
  }

  function confirmExport() {
    if (selectedExportFormats.length === 0) {
      message.warning('请至少选择一种导出格式');
      return;
    }
    const labels = exportOptions
      .filter((item) => selectedExportFormats.includes(item.key))
      .map((item) => item.title)
      .join('、');
    setExportOpen(false);
    setStatus(`已选择导出格式：${labels}。具体导出功能后续接入。`);
    message.info('导出功能后续接入，本次仅完成格式选择弹窗。');
  }

  return (
    <section className="editor-layout">
      <div className="toolbar editor-toolbar">
        <div className="editor-topbar">
          <span className="editor-topbar-label">订单</span>
          <Select
            className="editor-order-select"
            value={selectedOrderId || undefined}
            placeholder="请选择订单"
            disabled={orders.length === 0}
            options={orders.map((order) => ({ value: order.id, label: orderLabel(order) }))}
            onChange={handleOrderChange}
            showSearch
            optionFilterProp="label"
          />
        </div>
        <Space size={8} wrap>
          <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>导入</Button>
          <Button icon={<ExportOutlined />} onClick={() => setExportOpen(true)}>导出</Button>
          <Button icon={<SaveOutlined />} onClick={() => openSaveDialog(false)}>保存</Button>
          <Button onClick={() => openSaveDialog(true)}>另存为</Button>
        </Space>
      </div>

      <div className="editor-workbench">
        <aside className="editor-inspector">
          <div className="inspector-title">文字内容</div>
          <div className="inspector-section">
            <div className="inspector-section-title">封面</div>
            <label>新人姓名<Input value={settings.coverName} onChange={(event) => updateSetting('coverName', event.target.value)} /></label>
            <label>婚礼日期<Input value={settings.coverDate} onChange={(event) => updateSetting('coverDate', event.target.value)} /></label>
            <label>副标题 / 短句<Input value={settings.coverSubtitle} onChange={(event) => updateSetting('coverSubtitle', event.target.value)} /></label>
          </div>
          <div className="inspector-section">
            <div className="inspector-section-title">书脊</div>
            <label>顶部文字<Input maxLength={40} value={settings.spineTop} onChange={(event) => updateSetting('spineTop', event.target.value.replace(/\r?\n/g, ''))} /></label>
            <label>中间文字<Input maxLength={40} value={settings.spineMiddle} onChange={(event) => updateSetting('spineMiddle', event.target.value.replace(/\r?\n/g, ''))} /></label>
            <label>底部文字<Input maxLength={40} value={settings.spineBottom} onChange={(event) => updateSetting('spineBottom', event.target.value.replace(/\r?\n/g, ''))} /></label>
          </div>
          <div className="inspector-section">
            <div className="inspector-section-title inspector-inline-title">
              <span>封底</span>
              <Checkbox checked={settings.showBackText} onChange={(event) => updateSetting('showBackText', event.target.checked)}>显示文字</Checkbox>
            </div>
            <label>封底文字 / 短句<Input value={settings.backText} onChange={(event) => updateSetting('backText', event.target.value)} /></label>
          </div>
          <div className="inspector-section">
            <div className="inspector-section-title">封面尺寸</div>
            <label>单位<Select value={settings.unit} options={[{ value: 'mm', label: 'mm' }, { value: 'cm', label: 'cm' }, { value: 'in', label: 'in' }]} onChange={(value) => updateSetting('unit', value)} /></label>
            <div className="inspector-fields">
              <label>单面宽<InputNumber min={0.1} value={settings.singleWidth} onChange={(value) => updateSetting('singleWidth', value ?? 0.1)} /></label>
              <label>单面高<InputNumber min={0.1} value={settings.singleHeight} onChange={(value) => updateSetting('singleHeight', value ?? 0.1)} /></label>
            </div>
            <div className="inspector-fields">
              <label>出血<InputNumber min={0} value={settings.bleed} onChange={(value) => updateSetting('bleed', value ?? 0)} /></label>
              <label>页数<InputNumber min={1} value={settings.pages} onChange={(value) => updateSetting('pages', value ?? 1)} /></label>
            </div>
            <div className="inspector-fields">
              <label>背脊宽<InputNumber min={0.01} value={settings.spineWidth} onChange={(value) => updateSetting('spineWidth', value ?? 0.01)} /></label>
              <label>背脊出血<InputNumber min={0} value={settings.spineBleed} onChange={(value) => updateSetting('spineBleed', value ?? 0)} /></label>
            </div>
            <p className="inspector-help">出血区域和背脊出血仅作为打印参照线，不参与实际折叠。</p>
          </div>
        </aside>
        <div className="canvas-stage" ref={canvasStageRef}><canvas ref={canvasElementRef} /></div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".acp,.png,.jpg,.jpeg,.pdf,.svg,.eps"
        hidden
        onChange={(event) => {
          chooseImportFile(event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />

      <Modal
        className="editor-file-modal import-file-modal"
        title={null}
        open={importOpen}
        width={660}
        footer={(
          <div className="editor-modal-footer">
            <Button onClick={() => fileInputRef.current?.click()}>选择文件</Button>
            <Button type="primary" loading={importing} onClick={() => void confirmImport()}>确认导入</Button>
            <Button onClick={() => {
              setImportOpen(false);
              setSelectedFile(null);
            }}>取消</Button>
          </div>
        )}
        onCancel={() => {
          setImportOpen(false);
          setSelectedFile(null);
        }}
        destroyOnHidden
      >
        <h2 className="editor-modal-heading">导入文件</h2>
        <div
          className="import-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="import-plus"><PlusOutlined /></div>
          <strong>将文件拖拽到此处，或点击下方选择文件</strong>
          <span>支持 ACP、PNG、JPG、JPEG、PDF、SVG、EPS</span>
          <em>{selectedFile ? selectedFile.name : '尚未选择文件'}</em>
        </div>
      </Modal>

      <Modal
        className="editor-file-modal export-file-modal"
        title="导出文件"
        open={exportOpen}
        width={640}
        footer={(
          <div className="editor-modal-footer export-modal-footer">
            <Button type="primary" onClick={confirmExport}>确认导出</Button>
            <Button onClick={() => setExportOpen(false)}>取消</Button>
          </div>
        )}
        onCancel={() => setExportOpen(false)}
        destroyOnHidden
      >
        <h2 className="editor-modal-heading">选择导出格式</h2>
        <p className="editor-modal-subtitle">可以同时勾选多个格式，确认后只选择一次保存文件夹。</p>
        <div className="export-format-grid">
          {exportOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={selectedExportFormats.includes(option.key) ? 'selected' : ''}
              onClick={() => toggleExportFormat(option.key)}
            >
              <strong>{option.title}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
        <div className="export-options-row">
          <Checkbox checked={exportGuides} onChange={(event) => setExportGuides(event.target.checked)}>同时导出辅助线</Checkbox>
          <span>适用于 CDR、PSD、EPS、SVG、JPG、PDF</span>
        </div>
      </Modal>

      <Modal
        title={saveMode === 'saveAs' ? '另存为模板' : '保存模板'}
        open={saveMode !== null}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        onOk={() => saveForm.submit()}
        onCancel={() => setSaveMode(null)}
        destroyOnHidden
      >
        <Form form={saveForm} layout="vertical" requiredMark={false} onFinish={(values) => void saveCurrentTemplate(values)}>
          <Form.Item
            label="模板名称"
            name="name"
            rules={[
              { required: true, message: '请输入模板名称' },
              { whitespace: true, message: '模板名称不能为空' },
              { max: 80, message: '模板名称不能超过 80 个字符' }
            ]}
          >
            <Input autoFocus placeholder="请输入模板名称" onPressEnter={() => saveForm.submit()} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
