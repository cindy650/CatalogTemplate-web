import { useEffect, useRef, useState } from 'react';
import {
  BoldOutlined,
  BorderOutlined,
  DeleteOutlined,
  FileImageOutlined,
  FontSizeOutlined,
  ItalicOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  SwapOutlined
} from '@ant-design/icons';
import { App, Button, Checkbox, ColorPicker, Empty, Input, InputNumber, Popconfirm, Radio, Select, Space, Tag, Tooltip } from 'antd';
import type { FontLibraryItem, TemplateImportDraft } from '@shared/domain';

type TemplateElement = Record<string, unknown>;

type SizeValues = {
  unit?: string;
  singleWidth?: number;
  singleHeight?: number;
  spineWidth?: number;
  bleed?: number;
};

type TemplateElementEditorProps = {
  template: TemplateImportDraft;
  fonts: FontLibraryItem[];
  sizeValues: SizeValues;
  selectedElementId?: string;
  onChange: (template: TemplateImportDraft) => void;
  onSelect: (elementId: string) => void;
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function elementList(template: TemplateImportDraft): TemplateElement[] {
  return Array.isArray(template.elements)
    ? template.elements.filter((item): item is TemplateElement => Boolean(item && typeof item === 'object'))
    : [];
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function frameValue(element: TemplateElement): Record<string, unknown> {
  const frame = recordValue(element.frame);
  const base = recordValue(frame.reference_px ?? frame.reference ?? frame);
  const override = recordValue(frame.edited_px ?? frame.current_px ?? frame.preview_px);
  return { ...base, ...override };
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function uniqueElementId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

async function readImage(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  });
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('图片尺寸读取失败'));
    image.src = dataUrl;
  });
  return { dataUrl, ...dimensions };
}

export default function TemplateElementEditor({
  template,
  fonts,
  sizeValues,
  selectedElementId,
  onChange,
  onSelect
}: TemplateElementEditorProps) {
  const { message } = App.useApp();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [addingImage, setAddingImage] = useState(false);
  const historyRef = useRef<TemplateImportDraft[]>([]);
  const currentTemplateRef = useRef(template);
  const currentSignatureRef = useRef(JSON.stringify(template));
  const skipHistoryRef = useRef(false);
  const clipboardRef = useRef<TemplateElement>();
  const elements = elementList(template);

  function applyTemplateChange(nextTemplate: TemplateImportDraft) {
    onChange(nextTemplate);
  }

  useEffect(() => {
    const signature = JSON.stringify(template);
    if (signature !== currentSignatureRef.current) {
      if (!skipHistoryRef.current) historyRef.current = [...historyRef.current.slice(-49), clone(currentTemplateRef.current)];
      currentTemplateRef.current = template;
      currentSignatureRef.current = signature;
      skipHistoryRef.current = false;
    }
  }, [template]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      const selectedIndex = elements.findIndex((element) => String(element.id || '') === selectedElementId);
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.key.toLowerCase() === 'z') {
        const previous = historyRef.current.pop();
        if (!previous) return;
        event.preventDefault();
        skipHistoryRef.current = true;
        onChange(previous);
        const previousElements = elementList(previous);
        onSelect(previousElements[selectedIndex]?.id ? String(previousElements[selectedIndex].id) : '');
        return;
      }

      if (modifier && event.key.toLowerCase() === 'c') {
        if (selectedIndex < 0) return;
        event.preventDefault();
        clipboardRef.current = clone(elements[selectedIndex]);
        return;
      }

      if (modifier && event.key.toLowerCase() === 'v') {
        if (!clipboardRef.current) return;
        event.preventDefault();
        const pasted = clone(clipboardRef.current);
        const baseId = String(pasted.id || 'element');
        const existingIds = new Set(elements.map((element) => String(element.id || '')));
        let pastedId = `${baseId}-copy`;
        let suffix = 2;
        while (existingIds.has(pastedId)) pastedId = `${baseId}-copy-${suffix++}`;
        pasted.id = pastedId;
        pasted.name = `${String(pasted.name || baseId)} 副本`;
        pasted.z_index = elements.length;
        if (pasted.frame && typeof pasted.frame === 'object' && !Array.isArray(pasted.frame)) {
          const frame = clone(pasted.frame as Record<string, unknown>);
          frame.x = numberValue(frame.x) + 20;
          frame.y = numberValue(frame.y) + 20;
          pasted.frame = frame;
        }
        applyTemplateChange({ ...template, elements: [...elements, pasted] });
        onSelect(pastedId);
        return;
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIndex >= 0) {
        event.preventDefault();
        applyTemplateChange({ ...template, elements: elements.filter((_, index) => index !== selectedIndex) });
        const nextElement = elements[selectedIndex + 1] ?? elements[selectedIndex - 1];
        onSelect(nextElement?.id ? String(nextElement.id) : '');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [elements, onChange, onSelect, selectedElementId, template]);
  // Keep the editor on the same stable logical plane as Fabric. Physical
  // geometry is derived only from the selected size template.
  const canvas = recordValue(template.canvas);
  const referenceWidth = Math.max(1, numberValue(canvas.width, 1000));
  const referenceHeight = Math.max(1, numberValue(canvas.height, 800));
  const singleWidth = Math.max(0.01, numberValue(sizeValues.singleWidth, referenceWidth / 2));
  const singleHeight = Math.max(0.01, numberValue(sizeValues.singleHeight, referenceHeight));
  const spineWidth = Math.max(0, numberValue(sizeValues.spineWidth));
  const bleed = Math.max(0, numberValue(sizeValues.bleed));
  const physicalWidth = Math.max(0.01, singleWidth * 2 + spineWidth + bleed * 2);
  const physicalHeight = Math.max(0.01, singleHeight + bleed * 2);
  const referenceScale = Math.min(referenceWidth / physicalWidth, referenceHeight / physicalHeight);
  const trimX = (referenceWidth - (singleWidth * 2 + spineWidth) * referenceScale) / 2;
  const trimY = (referenceHeight - singleHeight * referenceScale) / 2;
  const panelWidth = singleWidth * referenceScale;
  const trimHeight = singleHeight * referenceScale;

  function replaceElement(index: number, element: TemplateElement) {
    const next = [...elements];
    next[index] = element;
    applyTemplateChange({ ...template, elements: next });
  }

  function removeElement(index: number) {
    const next = elements.filter((_, itemIndex) => itemIndex !== index);
    applyTemplateChange({ ...template, elements: next });
    if (String(elements[index]?.id) === selectedElementId && next[0]) onSelect(String(next[0].id));
  }

  function updateFrame(index: number, key: 'x' | 'y' | 'width' | 'height', value: unknown) {
    const element = elements[index];
    const frame = recordValue(element.frame);
    const referenceFrame = frameValue(element);
    const nextReference = { ...referenceFrame, [key]: value };
    const nextFrame = {
      ...frame,
      [key]: value,
      reference_px: nextReference,
      edited_px: nextReference
    };
    replaceElement(index, { ...element, frame: nextFrame });
  }

  function reorderElement(index: number, targetIndex: number) {
    if (targetIndex < 0 || targetIndex >= elements.length || targetIndex === index) return;
    const next = [...elements];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    applyTemplateChange({
      ...template,
      elements: next.map((element, elementIndex) => ({ ...element, z_index: elementIndex }))
    });
    onSelect(String(moved.id || ''));
  }

  function updatePlacement(index: number, patch: Record<string, unknown>, realign = true) {
    const element = elements[index];
    const placement = Object.fromEntries(
      Object.entries({ ...recordValue(element.placement), ...patch })
        .filter(([key, value]) => key !== 'safe_distance_px' && value !== undefined)
    );
    if (!realign) {
      replaceElement(index, { ...element, placement });
      return;
    }
    const frame = frameValue(element);
    const width = Math.max(1, numberValue(frame.width, 1));
    const height = Math.max(1, numberValue(frame.height, 1));
    const spineX = trimX + panelWidth;
    const coverX = spineX + spineWidth * referenceScale;
    const elementCenterX = numberValue(frame.x) + width / 2;
    const regionType = spineWidth > 0 && elementCenterX >= spineX && elementCenterX <= coverX
      ? 'spine'
      : elementCenterX < spineX
        ? 'back'
        : 'cover';
    const region = {
      x: regionType === 'back' ? trimX : regionType === 'cover' ? coverX : spineX,
      y: trimY,
      width: Math.max(0, regionType === 'spine' ? spineWidth * referenceScale : panelWidth),
      height: trimHeight
    };
    const regionX = numberValue(region.x);
    const regionY = numberValue(region.y);
    const regionWidth = Math.max(1, numberValue(region.width, referenceWidth));
    const regionHeight = Math.max(1, numberValue(region.height, referenceHeight));
    let x = numberValue(frame.x);
    let y = numberValue(frame.y);
    if (regionType !== 'spine' && placement.horizontal === 'left') x = regionX;
    if (regionType !== 'spine' && placement.horizontal === 'center') x = regionX + (regionWidth - width) / 2;
    if (regionType !== 'spine' && placement.horizontal === 'right') x = regionX + regionWidth - width;
    if (placement.vertical === 'top') y = regionY;
    if (placement.vertical === 'middle') y = regionY + (regionHeight - height) / 2;
    if (placement.vertical === 'bottom') y = regionY + regionHeight - height;
    const nextReference = { ...frame, x, y };
    replaceElement(index, {
      ...element,
      placement,
      frame: { ...recordValue(element.frame), x, y, reference_px: nextReference, edited_px: nextReference }
    });
  }

  function updateFont(index: number, patch: Record<string, unknown>) {
    const element = elements[index];
    const currentFont = recordValue(element.font);
    const nextFont = { ...currentFont, ...patch };
    const sizeChanged = Object.prototype.hasOwnProperty.call(patch, 'size_px');
    const currentSize = numberValue(currentFont.size_px);
    const nextSize = numberValue(nextFont.size_px);
    const spacingChanged = Object.prototype.hasOwnProperty.call(patch, 'tracking')
      || Object.prototype.hasOwnProperty.call(patch, 'word_spacing')
      || Object.prototype.hasOwnProperty.call(patch, 'leading_px');
    if ((sizeChanged || spacingChanged) && currentSize > 0 && nextSize > 0) {
      const frame = frameValue(element);
      const width = Math.max(1, numberValue(frame.width, 1));
      const height = Math.max(1, numberValue(frame.height, 1));
      const scale = nextSize / currentSize;
      let nextWidth = Math.max(1, width * scale);
      let nextHeight = Math.max(1, height * scale);
      if (spacingChanged) {
        const style = recordValue(element.style);
        const vertical = Boolean(style.vertical) || String(style.writing_mode || '') === 'vertical';
        const rawText = String(element.text ?? element.name ?? '');
        const text = rawText.replace(/\r?\n/g, '');
        const lines = vertical ? [text] : rawText.split(/\r?\n/);
        const characterCount = vertical
          ? Array.from(text).length
          : Math.max(0, ...lines.map((line) => Array.from(line).length));
        const lineCount = vertical ? characterCount : lines.length;
        const previousTracking = numberValue(currentFont.tracking, 0);
        const nextTracking = numberValue(nextFont.tracking, 0);
        const previousWordSpacing = numberValue(currentFont.word_spacing, 0);
        const nextWordSpacing = numberValue(nextFont.word_spacing, 0);
        const previousWordCount = (text.match(/[ \t]/g) || []).length;
        const nextWordSpacingDelta = nextWordSpacing - previousWordSpacing;
        const previousLeading = Math.max(currentSize, numberValue(currentFont.leading_px, currentSize * 1.2));
        const nextLeading = Math.max(nextSize, numberValue(nextFont.leading_px, nextSize * 1.2));
        const trackingDelta = (nextTracking - previousTracking) / 1000 * nextSize * Math.max(0, characterCount - 1);
        const leadingDelta = (nextLeading - previousLeading) * Math.max(0, lineCount - 1);
        if (vertical) nextHeight = Math.max(1, nextHeight + trackingDelta + leadingDelta);
        else nextWidth = Math.max(1, nextWidth + trackingDelta + nextWordSpacingDelta * previousWordCount);
        if (!vertical) nextHeight = Math.max(1, nextHeight + leadingDelta);
      }
      const placement = recordValue(element.placement);
      const anchorX = String(placement.horizontal ?? 'center');
      const anchorY = String(placement.vertical ?? 'middle');
      const factorX = anchorX === 'left' ? 0 : anchorX === 'right' ? 1 : 0.5;
      const factorY = anchorY === 'top' ? 0 : anchorY === 'bottom' ? 1 : 0.5;
      const anchorPointX = numberValue(frame.x) + width * factorX;
      const anchorPointY = numberValue(frame.y) + height * factorY;
      const nextReference = {
        ...frame,
        x: anchorPointX - nextWidth * factorX,
        y: anchorPointY - nextHeight * factorY,
        width: nextWidth,
        height: nextHeight
      };
      replaceElement(index, {
        ...element,
        font: nextFont,
        frame: {
          ...recordValue(element.frame),
          ...nextReference,
          reference_px: nextReference,
          edited_px: nextReference
        }
      });
      return;
    }
    replaceElement(index, { ...element, font: nextFont });
  }

  function addTextElement() {
    const id = uniqueElementId('text');
    const width = Math.max(120, Math.round(referenceWidth * 0.3));
    const height = Math.max(36, Math.round(referenceHeight * 0.08));
    const frame = {
      x: Math.round((referenceWidth - width) / 2),
      y: Math.round((referenceHeight - height) / 2),
      width,
      height
    };
    const next: TemplateElement = {
      id,
      type: 'text',
      name: '新增文字',
      text: '文字内容',
      z_index: elements.length,
      frame: { ...frame, reference_px: frame },
      font: { status: 'unassigned', font_id: null, font_name: '', font_family: '', postscript_name: '', file_path: '', size_px: 32 },
      style: { writing_mode: 'horizontal', fill_color: '#172033' },
      transform: { rotation_deg: 0, flip_horizontal: false, flip_vertical: false }
    };
    applyTemplateChange({ ...template, elements: [...elements, next] });
    onSelect(id);
  }

  function addRectangleElement() {
    const id = uniqueElementId('rectangle');
    const coverX = trimX + panelWidth + spineWidth * referenceScale;
    const availableWidth = Math.max(1, panelWidth);
    const availableHeight = Math.max(1, trimHeight);
    const width = Math.max(1, Math.min(180, availableWidth * 0.4));
    const height = Math.max(1, Math.min(120, availableHeight * 0.3));
    const frame = {
      x: coverX + (availableWidth - width) / 2,
      y: trimY + (availableHeight - height) / 2,
      width,
      height
    };
    const next: TemplateElement = {
      id,
      type: 'image',
      name: '新增矩形',
      z_index: elements.length,
      frame: { ...frame, reference_px: frame },
      asset: { asset_id: id, kind: 'rectangle' },
      appearance: { shape: 'rectangle', fill_color: '#1677ff', opacity: 100 },
      transform: { rotation_deg: 0, flip_horizontal: false, flip_vertical: false }
    };
    applyTemplateChange({ ...template, elements: [...elements, next] });
    onSelect(id);
  }

  async function addImageElement(file: File) {
    setAddingImage(true);
    try {
      const image = await readImage(file);
      const maxWidth = referenceWidth * 0.35;
      const maxHeight = referenceHeight * 0.35;
      const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const id = uniqueElementId('image');
      const frame = {
        x: Math.round((referenceWidth - width) / 2),
        y: Math.round((referenceHeight - height) / 2),
        width,
        height
      };
      const next: TemplateElement = {
        id,
        type: 'image',
        name: file.name,
        z_index: elements.length,
        frame: { ...frame, reference_px: frame },
        asset: {
          asset_id: id,
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          data_url: image.dataUrl
        }
      };
      applyTemplateChange({ ...template, elements: [...elements, next] });
      onSelect(id);
      message.success('图片元素已添加');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setAddingImage(false);
    }
  }

  return (
    <section className="template-elements-editor" aria-label="图层元素编辑器">
      <header className="template-elements-header">
        <div>
          <strong>图层元素</strong>
          <span>{elements.length} 个元素，坐标单位为原图像素；区域对齐按当前尺寸单位计算</span>
        </div>
        <Space size={6}>
          <Tooltip title="新增文字元素">
            <Button icon={<FontSizeOutlined />} onClick={addTextElement}>文字</Button>
          </Tooltip>
          <Tooltip title="新增图片元素">
            <Button icon={<FileImageOutlined />} loading={addingImage} onClick={() => imageInputRef.current?.click()}>图片</Button>
          </Tooltip>
          <Tooltip title="新增矩形元素">
            <Button icon={<BorderOutlined />} onClick={addRectangleElement}>矩形</Button>
          </Tooltip>
          <input
            ref={imageInputRef}
            hidden
            type="file"
            accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              if (file) void addImageElement(file);
            }}
          />
        </Space>
      </header>
      {elements.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="导入文件或新增元素后在此编辑" />
      ) : (
        <div className="template-elements-list">
          {elements.map((element, index) => {
            const id = String(element.id || `element-${index + 1}`);
            const type = String(element.type || 'layer').toLowerCase();
            const frame = frameValue(element);
            const font = recordValue(element.font);
            const style = recordValue(element.style);
            const transform = recordValue(element.transform);
            const asset = recordValue(element.asset);
            const appearance = recordValue(element.appearance);
            const isRectangle = type === 'image'
              && (appearance.shape === 'rectangle' || asset.kind === 'rectangle');
            const placement = recordValue(element.placement);
            const rule = recordValue(element.rule);
            const hasRule = Object.keys(rule).length > 0;
            const selected = id === selectedElementId;
            const frameFields: Array<'x' | 'y' | 'width' | 'height'> = type === 'image'
              ? ['x', 'y', 'width', 'height']
              : ['x', 'y'];
            return (
              <article className={`template-element-item${selected ? ' selected' : ''}`} key={id}>
                <button className="template-element-summary" type="button" onClick={() => onSelect(id)}>
                  <span className="template-element-index">{index + 1}</span>
                  <span className="template-element-title">
                    <strong>{String(element.name || id)}</strong>
                    <small>{Math.round(numberValue(frame.x))}, {Math.round(numberValue(frame.y))} · {Math.round(numberValue(frame.width))} x {Math.round(numberValue(frame.height))}</small>
                  </span>
                  <Tag color={type === 'text' ? 'purple' : type === 'image' ? 'blue' : 'default'}>{type}</Tag>
                </button>

                {selected && (
                  <div className="template-element-fields">
                    <div className="template-element-properties-heading">
                      <div>
                        <strong>图层属性</strong>
                        <span>{String(element.name || id)}</span>
                      </div>
                      <Tag color={type === 'text' ? 'purple' : type === 'image' ? 'blue' : 'default'}>{type}</Tag>
                    </div>
                    <div className="template-element-field template-element-field-wide">
                      <label>元素名称</label>
                      <Input value={String(element.name || '')} onChange={(event) => replaceElement(index, { ...element, name: event.target.value })} />
                    </div>
                    {frameFields.map((key) => (
                      <div className="template-element-field" key={key}>
                        <label>{key === 'x' ? 'X' : key === 'y' ? 'Y' : key === 'width' ? '宽度' : '高度'}</label>
                        <InputNumber
                          min={key === 'width' || key === 'height' ? 1 : undefined}
                          precision={2}
                          value={numberValue(frame[key])}
                          onChange={(value) => updateFrame(index, key, value ?? 0)}
                        />
                      </div>
                    ))}

                    <div className="template-element-section-title">图层层级</div>
                    <div className="template-element-field template-element-field-wide template-element-layer-actions">
                      <Tooltip title="置顶">
                        <Button aria-label="置顶" icon={<VerticalAlignTopOutlined />} disabled={index === elements.length - 1} onClick={() => reorderElement(index, elements.length - 1)} />
                      </Tooltip>
                      <Tooltip title="上移">
                        <Button aria-label="上移" icon={<ArrowUpOutlined />} disabled={index === elements.length - 1} onClick={() => reorderElement(index, index + 1)} />
                      </Tooltip>
                      <Tooltip title="下移">
                        <Button aria-label="下移" icon={<ArrowDownOutlined />} disabled={index === 0} onClick={() => reorderElement(index, index - 1)} />
                      </Tooltip>
                      <Tooltip title="置底">
                        <Button aria-label="置底" icon={<VerticalAlignBottomOutlined />} disabled={index === 0} onClick={() => reorderElement(index, 0)} />
                      </Tooltip>
                    </div>

                    <div className="template-element-section-title">区域约束</div>
                    <div className="template-element-field template-element-field-wide">
                      <Checkbox
                        checked={Boolean(element.allow_overflow)}
                        onChange={(event) => replaceElement(index, { ...element, allow_overflow: event.target.checked })}
                      >不受区域限制</Checkbox>
                    </div>

                    <div className="template-element-section-title">区域对齐</div>
                    <div className="template-element-field template-element-field-wide">
                      <label>水平对齐</label>
                      <Space.Compact className="template-element-alignment">
                        {([{ label: '左', value: 'left' }, { label: '居中', value: 'center' }, { label: '右', value: 'right' }] as const).map((option) => (
                          <Button
                            key={option.value}
                            type={placement.horizontal === option.value ? 'primary' : 'default'}
                            aria-pressed={placement.horizontal === option.value}
                            onClick={() => updatePlacement(index, {
                              horizontal: placement.horizontal === option.value ? undefined : option.value
                            })}
                          >{option.label}</Button>
                        ))}
                      </Space.Compact>
                    </div>
                    <div className="template-element-field template-element-field-wide">
                      <label>垂直对齐</label>
                      <Space.Compact className="template-element-alignment">
                        {([{ label: '上', value: 'top' }, { label: '居中', value: 'middle' }, { label: '下', value: 'bottom' }] as const).map((option) => (
                          <Button
                            key={option.value}
                            type={placement.vertical === option.value ? 'primary' : 'default'}
                            aria-pressed={placement.vertical === option.value}
                            onClick={() => updatePlacement(index, {
                              vertical: placement.vertical === option.value ? undefined : option.value
                            })}
                          >{option.label}</Button>
                        ))}
                      </Space.Compact>
                    </div>
                    {type === 'text' && (
                      <>
                        <div className="template-element-section-title">文字内容与来源</div>
                        <div className="template-element-field template-element-field-wide">
                          <label>预览文字</label>
                          <Input
                            value={String(element.text || '')}
                            onChange={(event) => {
                              const text = event.target.value;
                              replaceElement(index, {
                                ...element,
                                text
                              });
                            }}
                          />
                        </div>
                        <div className="template-element-field template-element-field-wide">
                          <label>文字排列</label>
                          <Radio.Group
                            optionType="button"
                            buttonStyle="solid"
                            value={String(style.writing_mode || (style.vertical ? 'vertical' : 'horizontal'))}
                            options={[{ label: '横排', value: 'horizontal' }, { label: '竖排', value: 'vertical' }]}
                            onChange={(event) => {
                              const { vertical: _legacyVertical, ...nextStyle } = style;
                              replaceElement(index, {
                                ...element,
                                style: { ...nextStyle, writing_mode: event.target.value }
                              });
                            }}
                          />
                        </div>
                        <div className="template-element-field">
                          <label>旋转角度</label>
                          <InputNumber
                            min={-360}
                            max={360}
                            precision={1}
                            value={numberValue(transform.rotation_deg)}
                            onChange={(value) => replaceElement(index, {
                              ...element,
                              transform: { ...transform, rotation_deg: value ?? 0 }
                            })}
                          />
                        </div>
                        <div className="template-element-field template-element-field-wide">
                          <Checkbox
                            checked={hasRule}
                            onChange={(event) => replaceElement(index, {
                              ...element,
                              ...(event.target.checked ? { rule: { ...rule, description: String(rule.description || '') } } : { rule: undefined })
                            })}
                          >规则</Checkbox>
                        </div>
                        {hasRule && (
                          <>
                            <div className="template-element-field template-element-field-wide">
                              <label>规则</label>
                              <Input
                                value={String(rule.description || '')}
                                placeholder="可选，填写文字生成规则"
                                onChange={(event) => replaceElement(index, { ...element, rule: { ...rule, description: event.target.value } })}
                              />
                            </div>
                          </>
                        )}

                        <div className="template-element-section-title">独立字体</div>
                        <div className="template-element-field template-element-field-wide">
                          <label>字体库</label>
                          <Select
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            placeholder={fonts.length ? '选择已启用字体' : '字体库暂无数据，可手动填写下方名称'}
                            value={font.font_id ? numberValue(font.font_id) : undefined}
                            options={fonts.map((item) => ({ value: item.id, label: `${item.name}${item.family ? ` · ${item.family}` : ''}` }))}
                            onChange={(fontId) => {
                              const item = fonts.find((fontItem) => fontItem.id === fontId);
                              updateFont(index, item ? {
                                font_id: item.id,
                                font_name: item.name,
                                font_family: item.family || item.name,
                                postscript_name: item.name,
                                file_path: item.filePath,
                                status: 'assigned'
                              } : { font_id: null, font_name: '', font_family: '', file_path: '' });
                            }}
                          />
                        </div>
                        <div className="template-element-field template-element-field-wide">
                          <label>PostScript 字体名称</label>
                          <Input
                            value={String(font.postscript_name || font.font_name || font.font_family || font.family || '')}
                            placeholder="例如 ArialMT"
                            onChange={(event) => updateFont(index, {
                              postscript_name: event.target.value,
                              font_name: event.target.value,
                              font_family: event.target.value,
                              status: event.target.value.trim() ? 'assigned' : 'unassigned'
                            })}
                          />
                        </div>
                        {([['size_px', '字号']] as const).map(([key, label]) => (
                          <div className="template-element-field" key={key}>
                            <label>{label}</label>
                            <InputNumber
                              min={key === 'size_px' ? 0.1 : undefined}
                              precision={2}
                              value={font[key] == null ? null : numberValue(font[key])}
                              onChange={(value) => {
                                if (value === null || value === undefined) return;
                                updateFont(index, { [key]: value });
                              }}
                            />
                          </div>
                        ))}
                        <div className="template-element-field">
                          <label>字间距（‰）</label>
                          <InputNumber
                            min={-1000}
                            precision={2}
                            value={font.tracking == null ? 0 : numberValue(font.tracking)}
                            onChange={(value) => updateFont(index, { tracking: value ?? 0 })}
                          />
                        </div>
                        <div className="template-element-field">
                          <label>单词间距（px）</label>
                          <InputNumber
                            precision={2}
                            value={font.word_spacing == null ? 0 : numberValue(font.word_spacing)}
                            onChange={(value) => updateFont(index, { word_spacing: value ?? 0 })}
                          />
                        </div>
                        <div className="template-element-field">
                          <label>行距（px）</label>
                          <InputNumber
                            min={0}
                            precision={2}
                            value={font.leading_px == null
                              ? Math.max(1, numberValue(font.size_px, 32) * 1.2)
                              : numberValue(font.leading_px)}
                            onChange={(value) => updateFont(index, { leading_px: value ?? 0 })}
                          />
                        </div>
                        <div className="template-element-field">
                          <label>文字颜色</label>
                          <ColorPicker
                            className="template-element-color-picker"
                            value={String(recordValue(element.style).fill_color || font.color || '#172033')}
                            showText
                            onChange={(color) => replaceElement(index, { ...element, style: { ...recordValue(element.style), fill_color: color.toHexString() } })}
                          />
                        </div>
                        <div className="template-element-field">
                          <label>字形</label>
                          <Space size={4}>
                            <Tooltip title="加粗">
                              <Button
                                type={font.bold ? 'primary' : 'default'}
                                icon={<BoldOutlined />}
                                aria-label="加粗"
                                aria-pressed={Boolean(font.bold)}
                                onClick={() => updateFont(index, { bold: !font.bold })}
                              />
                            </Tooltip>
                            <Tooltip title="倾斜">
                              <Button
                                type={font.italic ? 'primary' : 'default'}
                                icon={<ItalicOutlined />}
                                aria-label="倾斜"
                                aria-pressed={Boolean(font.italic)}
                                onClick={() => updateFont(index, { italic: !font.italic })}
                              />
                            </Tooltip>
                          </Space>
                        </div>
                      </>
                    )}

                    {type === 'image' && (
                      <>
                        <div className="template-element-section-title">{isRectangle ? '矩形属性' : '图片属性'}</div>
                        {isRectangle ? (
                          <div className="template-element-field">
                            <label>填充颜色</label>
                            <ColorPicker
                              className="template-element-color-picker"
                              value={String(appearance.fill_color || '#1677ff')}
                              showText
                              onChange={(color) => replaceElement(index, {
                                ...element,
                                appearance: { ...appearance, fill_color: color.toHexString() }
                              })}
                            />
                          </div>
                        ) : (
                          <div className="template-element-field template-element-field-wide">
                            <label>图片来源</label>
                            <Input value={String(asset.url || asset.data_url || '')} placeholder="图片 URL 或 Data URL" onChange={(event) => replaceElement(index, { ...element, asset: { ...asset, url: event.target.value } })} />
                          </div>
                        )}
                        {isRectangle && <div className="template-element-field">
                          <label>不透明度</label>
                          <InputNumber min={0} max={100} precision={0} value={numberValue(appearance.opacity, 100)} onChange={(value) => replaceElement(index, { ...element, appearance: { ...appearance, opacity: value ?? 100 } })} />
                        </div>}
                        <div className="template-element-field">
                          <label>旋转角度</label>
                          <InputNumber
                            min={-360}
                            max={360}
                            precision={1}
                            value={numberValue(transform.rotation_deg ?? appearance.rotation)}
                            onChange={(value) => replaceElement(index, { ...element, transform: { ...transform, rotation_deg: value ?? 0 } })}
                          />
                        </div>
                        <div className="template-element-field template-element-field-wide">
                          <label>翻转</label>
                          <Space size={4}>
                            <Tooltip title="水平翻转">
                              <Button
                                icon={<SwapOutlined />}
                                type={Boolean(transform.flip_horizontal ?? transform.flipX) ? 'primary' : 'default'}
                                aria-label="水平翻转"
                                aria-pressed={Boolean(transform.flip_horizontal ?? transform.flipX)}
                                onClick={() => replaceElement(index, {
                                  ...element,
                                  transform: { ...transform, flip_horizontal: !Boolean(transform.flip_horizontal ?? transform.flipX) }
                                })}
                              />
                            </Tooltip>
                            <Tooltip title="垂直翻转">
                              <Button
                                icon={<SwapOutlined rotate={90} />}
                                type={Boolean(transform.flip_vertical ?? transform.flipY) ? 'primary' : 'default'}
                                aria-label="垂直翻转"
                                aria-pressed={Boolean(transform.flip_vertical ?? transform.flipY)}
                                onClick={() => replaceElement(index, {
                                  ...element,
                                  transform: { ...transform, flip_vertical: !Boolean(transform.flip_vertical ?? transform.flipY) }
                                })}
                              />
                            </Tooltip>
                          </Space>
                        </div>
                      </>
                    )}

                    <div className="template-element-delete">
                      <Popconfirm title="删除该元素？" okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => removeElement(index)}>
                        <Button danger icon={<DeleteOutlined />}>删除元素</Button>
                      </Popconfirm>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
