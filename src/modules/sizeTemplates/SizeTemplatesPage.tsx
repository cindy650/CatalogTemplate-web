import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from 'react';
import {
  ArrowLeftOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  HolderOutlined,
  UploadOutlined,
  PlusOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  App,
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Tooltip
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type {
  FontLayoutTemplate,
  FontLibraryItem,
  Shop,
  SizeTemplate,
  SizeTemplateFormData,
  SizeTemplateFormOption,
  SizeTemplateOptionPayload,
  SizeTemplatePayload,
  SizeTemplateUnit,
  TemplateImportDraft
} from '@shared/domain';
import { browserAlbumApi } from '../../api';
import type { SizeTemplatesPageProps } from '../types';
import TemplateElementEditor from './TemplateElementEditor';
import FabricTemplateCanvas from './FabricTemplateCanvas';

type SizeTemplateFormValues = {
  shopId: number;
  name: string;
  products: string[];
  unit: SizeTemplateUnit;
  singleWidth: number;
  singleHeight: number;
  bleed: number;
  pages: number;
  spineWidthMode?: 'fixed' | 'by_page_count';
  spineWidth: number;
  spineBleed: number;
  sizeOption?: string;
};

type SizeTemplateView = 'list' | 'create' | 'edit' | 'detail';

type SizeOptionFormValues = {
  value: string;
  label: string;
  unit: SizeTemplateUnit;
  spineWidthMode: 'fixed' | 'by_page_count';
  singleWidth: number;
  singleHeight: number;
  bleed: number;
  spineWidth: number;
  spineBleed: number;
};

type SizeOptionDialog = {
  mode: 'create' | 'edit';
  originalValue?: string;
};

type SizeOptionDropTarget = {
  value: string;
  position: 'before' | 'after';
};

type LocalFontLayoutDraft = {
  id: number;
  name: string;
  draft: TemplateImportDraft;
};

function shopLabel(shop: Shop): string {
  return shop.shopName || shop.shop || '未命名店铺';
}

function ProductTags({ products }: { products: string[] }) {
  if (products.length === 0) return <>-</>;
  return (
    <Space size={[4, 4]} wrap>
      {products.slice(0, 3).map((product) => <Tag key={product}>{product}</Tag>)}
      {products.length > 3 && <Tag>+{products.length - 3}</Tag>}
    </Space>
  );
}

function fontLayoutLabel(template: FontLayoutTemplate): string {
  return template.name || template.fontName || `字体布局 ${template.id}`;
}

function FontLayoutTags({ templates }: { templates: FontLayoutTemplate[] }) {
  if (templates.length === 0) return <>-</>;
  return (
    <Space size={[4, 4]} wrap>
      {templates.slice(0, 3).map((template) => <Tag key={template.id}>{fontLayoutLabel(template)}</Tag>)}
      {templates.length > 3 && <Tag>+{templates.length - 3}</Tag>}
    </Space>
  );
}

function FontLayoutCardPicker({
  selectedId,
  onSelect,
  onRename,
  templates,
  loading
}: {
  selectedId?: number;
  onSelect?: (templateId?: number) => void;
  onRename?: (templateId: number) => void;
  templates: FontLayoutTemplate[];
  loading: boolean;
}) {
  if (loading && templates.length === 0) {
    return <div className="font-layout-card-empty">正在加载字体布局模板...</div>;
  }
  if (templates.length === 0) {
    return <div className="font-layout-card-empty">当前店铺暂无字体布局模板</div>;
  }

  return (
    <div className="font-layout-card-list" role="listbox" aria-label="字体布局模板">
      {templates.map((template) => {
        const selected = selectedId === template.id;
        return (
          <div className="font-layout-card-shell" key={template.id}>
            <button
              className={`font-layout-card${selected ? ' selected' : ''}`}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onSelect?.(selected ? undefined : template.id)}
            >
              <span className="font-layout-card-check" aria-hidden="true">
                {selected && <CheckOutlined />}
              </span>
              <span className="font-layout-card-copy">
                <strong>{fontLayoutLabel(template)}</strong>
                {(template.fontName || template.description || template.syncedSizeOptionIds?.length) && (
                  <small>{[
                    template.fontName,
                    template.description,
                    template.syncedSizeOptionIds?.length ? `已同步 ${template.syncedSizeOptionIds.length} 个尺寸` : ''
                  ].filter(Boolean).join(' · ')}</small>
                )}
              </span>
            </button>
            <Tooltip title="修改名字">
              <Button
                className="font-layout-card-rename"
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label={`修改 ${fontLayoutLabel(template)} 的名字`}
                onClick={() => onRename?.(template.id)}
              />
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}

function mergeFontLayoutTemplates(...lists: FontLayoutTemplate[][]): FontLayoutTemplate[] {
  const merged = new Map<number, FontLayoutTemplate>();
  lists.flat().forEach((template) => {
    if (template.id > 0) merged.set(template.id, template);
  });
  return Array.from(merged.values());
}

function positiveNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeImportedTemplate(template: TemplateImportDraft): TemplateImportDraft {
  const nestedLayouts = Array.isArray(template.font_layout_templates)
    ? template.font_layout_templates.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : [];
  const firstLayout = nestedLayouts.find((layout) => Array.isArray(layout.elements));
  const rawElements = Array.isArray(template.elements) && template.elements.length > 0
    ? template.elements
    : firstLayout && Array.isArray(firstLayout.elements)
      ? firstLayout.elements
      : [];
  const elements = rawElements.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const element = item as Record<string, unknown>;
    const content = objectValue(element.content);
    const frame = objectValue(element.frame);
    const { region_id: _regionId, ...frameWithoutRegion } = frame;
    const { content: _content, region_id: _elementRegionId, element_id: _legacyElementId, source_ref: _sourceRef, ...withoutLegacyFields } = element;
    const text = element.text ?? content.literal;
    const rule = element.rule ?? content.rule;
    const type = String(element.type || '').toLowerCase() === 'text' ? 'text' : 'image';
    const normalizedElement: Record<string, unknown> = {
      ...withoutLegacyFields,
      type,
      ...(text !== undefined ? { text } : {}),
      ...(rule && typeof rule === 'object' ? { rule } : {})
    };
    if (type === 'image') {
      delete normalizedElement.text;
      delete normalizedElement.rule;
      delete normalizedElement.font;
      delete normalizedElement.style;
    } else {
      const style = objectValue(element.style);
      const { vertical: _legacyVertical, ...styleWithoutLegacyFlag } = style;
      normalizedElement.style = {
        ...styleWithoutLegacyFlag,
        writing_mode: style.writing_mode === 'vertical' || style.vertical === true ? 'vertical' : 'horizontal'
      };
    }
    if (Object.prototype.hasOwnProperty.call(element, 'frame')) normalizedElement.frame = frameWithoutRegion;
    return normalizedElement;
  });
  const sourceOptions = objectValue(template.options);
  const {
    reference_canvas: _sourceReferenceCanvas,
    responsive_version: _sourceResponsiveVersion,
    reference_size_option: _sourceReferenceOption,
    responsive_layout: _sourceResponsiveLayout,
    ...sourceOptionsWithoutLegacyLayout
  } = sourceOptions;
  const nestedOptions = objectValue(firstLayout?.options);
  const {
    reference_canvas: _nestedReferenceCanvas,
    responsive_version: _nestedResponsiveVersion,
    reference_size_option: _nestedReferenceOption,
    responsive_layout: _nestedResponsiveLayout,
    ...nestedOptionsWithoutLegacyLayout
  } = nestedOptions;
  return {
    ...template,
    safe_distance: Math.max(0, finiteNumber(template.safe_distance ?? firstLayout?.safe_distance, 0)),
    options: Object.keys(nestedOptionsWithoutLegacyLayout).length > 0
      ? nestedOptionsWithoutLegacyLayout
      : sourceOptionsWithoutLegacyLayout,
    elements,
    font_layout_templates: undefined
  };
}

function framePreviewSource(frame: Record<string, unknown>): Record<string, unknown> {
  const editedFrame = objectValue(frame.edited_px ?? frame.current_px ?? frame.preview_px);
  if (Object.keys(editedFrame).length > 0) return editedFrame;
  return objectValue(frame.reference_px ?? frame.reference ?? frame);
}

function formValuesFromTemplate(template: SizeTemplate, copy = false): SizeTemplateFormValues {
  const sizeForm = template.sizeForm;
  return {
    shopId: template.shopId,
    name: copy ? `${template.name} - 副本` : template.name,
    products: template.products,
    unit: sizeForm.size_unit,
    singleWidth: twoDecimalNumber(sizeForm.single_side_width, 210),
    singleHeight: twoDecimalNumber(sizeForm.single_side_height, 297),
    spineWidth: twoDecimalNumber(sizeForm.spine_width, 10),
    bleed: twoDecimalNumber(sizeForm.bleed, 3),
    spineBleed: twoDecimalNumber(sizeForm.spine_bleed, 0),
    pages: Math.max(1, Math.round(Number(sizeForm.page_count) || 1)),
    sizeOption: sizeForm.size_option ?? undefined,
    spineWidthMode: sizeForm.spine_width_mode
  };
}

function emptySizeFormData(): SizeTemplateFormData {
  return {
    size_option: null,
    size_unit: 'in',
    single_side_width: 0,
    single_side_height: 0,
    bleed: 0,
    page_count: 0,
    page_count_arr: [],
    spine_width_mode: 'fixed',
    spine_width: 0,
    spine_bleed: 0,
    size_unit_options: ['in', 'mm', 'cm'],
    size_options: [],
    status: 'needs_values'
  };
}

function twoDecimalNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : fallback;
}

function twoDecimalFormatter(value: string | number | undefined): string {
  if (value === undefined || value === null || value === '') return '';
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '';
}

function editorValuesFromSizeData(
  optionId: string,
  unit: SizeTemplateUnit,
  sizeData: SizeTemplateFormData
): Partial<SizeTemplateFormValues> {
  return {
    sizeOption: optionId,
    unit,
    singleWidth: twoDecimalNumber(sizeData.single_side_width),
    singleHeight: twoDecimalNumber(sizeData.single_side_height),
    bleed: twoDecimalNumber(sizeData.bleed),
    pages: Math.max(1, Math.round(Number(sizeData.page_count) || 1)),
    spineWidthMode: sizeData.spine_width_mode,
    spineWidth: twoDecimalNumber(sizeData.spine_width),
    spineBleed: twoDecimalNumber(sizeData.spine_bleed)
  };
}

function editorValuesFromOption(
  option: SizeTemplateFormOption,
  unit: SizeTemplateUnit
): Partial<SizeTemplateFormValues> {
  const unitData = option[unit];
  return {
    sizeOption: option.value,
    unit,
    singleWidth: twoDecimalNumber(unitData?.single_side_width),
    singleHeight: twoDecimalNumber(unitData?.single_side_height),
    bleed: twoDecimalNumber(unitData?.bleed),
    pages: Math.max(1, Math.round(Number(option.page_count) || 1)),
    spineWidthMode: option.spine_width_mode ?? 'fixed',
    spineWidth: twoDecimalNumber(unitData?.spine_width),
    spineBleed: twoDecimalNumber(unitData?.spine_bleed)
  };
}

function sizeDataFromOption(
  sizeForm: SizeTemplateFormData | undefined,
  optionId: string | undefined,
  unit: SizeTemplateUnit
): { option: SizeTemplateFormOption; data: SizeTemplateFormData } | undefined {
  if (!sizeForm || !optionId) return undefined;
  const option = sizeForm.size_options.find((item) => item.value === optionId);
  const unitData = option?.[unit];
  if (!option || option.disabled || !unitData) return undefined;
  return {
    option,
    data: {
      ...sizeForm,
      ...unitData,
      page_count: option.page_count,
      spine_width_mode: option.spine_width_mode,
      size_option: option.value,
      size_unit: unit
    }
  };
}

function selectedSizeFormOption(sizeForm?: SizeTemplateFormData): SizeTemplateFormOption | undefined {
  return sizeForm?.size_options.find((option) => option.value === sizeForm.size_option) ?? sizeForm?.size_options[0];
}

function publicSizeOptionsPayload(
  sizeForm: SizeTemplateFormData | undefined,
  currentValues: SizeTemplateFormValues
): SizeTemplatePayload['sizeOptions'] {
  if (!sizeForm) return [];
  return sizeForm.size_options
    .filter((option) => option.in || option.mm || option.cm)
    .map((option) => {
      const selectedUnit = option.size_unit ?? (option.in ? 'in' : option.mm ? 'mm' : 'cm');
      const unitValues = (option[selectedUnit] ?? option.in ?? option.mm ?? option.cm) as NonNullable<SizeTemplateFormOption['in']>;
      const isCurrentOption = option.value === currentValues.sizeOption;
      const useCurrentValues = isCurrentOption;
      return {
        id: option.id ?? option.value,
        label: option.label,
        size_unit: useCurrentValues ? currentValues.unit : selectedUnit,
        single_side_width: useCurrentValues ? currentValues.singleWidth : unitValues.single_side_width,
        single_side_height: useCurrentValues ? currentValues.singleHeight : unitValues.single_side_height,
        bleed: useCurrentValues ? currentValues.bleed : unitValues.bleed,
        spine_width: useCurrentValues ? currentValues.spineWidth : unitValues.spine_width,
        spine_bleed: useCurrentValues ? currentValues.spineBleed : unitValues.spine_bleed,
        spine_width_mode: useCurrentValues ? (currentValues.spineWidthMode ?? 'fixed') : option.spine_width_mode,
        select: isCurrentOption,
      };
    });
}

function optionFormValues(option?: SizeTemplateFormOption, fallbackUnit: SizeTemplateUnit = 'in'): SizeOptionFormValues {
  const unit = option?.size_unit ?? fallbackUnit;
  const unitValues = option?.[unit] ?? option?.in ?? option?.mm ?? option?.cm;
  return {
    value: option?.value ?? '',
    label: option?.label ?? '',
    unit: option?.size_unit ?? fallbackUnit,
    spineWidthMode: option?.spine_width_mode ?? 'fixed',
    singleWidth: twoDecimalNumber(unitValues?.single_side_width, 0),
    singleHeight: twoDecimalNumber(unitValues?.single_side_height, 0),
    bleed: twoDecimalNumber(unitValues?.bleed, 0),
    spineWidth: twoDecimalNumber(unitValues?.spine_width, 0),
    spineBleed: twoDecimalNumber(unitValues?.spine_bleed, 0)
  };
}

function optionPayload(values: SizeOptionFormValues, select: boolean, unit: SizeTemplateUnit = values.unit): SizeTemplateOptionPayload {
  return {
    id: values.value.trim(),
    label: values.label.trim(),
    size_unit: unit,
    single_side_width: values.singleWidth,
    single_side_height: values.singleHeight,
    bleed: values.bleed,
    spine_width: values.spineWidth,
    spine_bleed: values.spineBleed,
    spine_width_mode: values.spineWidthMode,
    select
  };
}

function SizeTemplateCanvasPreview({
  values,
  importedTemplate,
  selectedElementId,
  onTemplateChange,
  onElementSelect
}: {
  values: Partial<SizeTemplateFormValues>;
  importedTemplate?: TemplateImportDraft;
  selectedElementId?: string;
  onTemplateChange?: (template: TemplateImportDraft) => void;
  onElementSelect?: (elementId: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderedElementsRef = useRef<Array<{
    elementId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
  }>>([]);
  const dragRef = useRef<{
    elementId: string;
    startX: number;
    startY: number;
    originalX: number;
    originalY: number;
    originalWidth: number;
    originalHeight: number;
    scale: number;
  }>();

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const draw = () => {
      const bounds = stage.getBoundingClientRect();
      const width = Math.max(240, Math.floor(bounds.width));
      const height = Math.max(420, Math.floor(bounds.height));
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * pixelRatio);
      canvas.height = Math.floor(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const context = canvas.getContext('2d');
      if (!context) return;
      renderedElementsRef.current = [];
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);

      const singleWidth = Math.max(0.01, positiveNumber(values.singleWidth, 210));
      const singleHeight = Math.max(0.01, positiveNumber(values.singleHeight, 297));
      const spineWidth = positiveNumber(values.spineWidth, 10);
      const bleed = positiveNumber(values.bleed, 3);
      const spineBleed = positiveNumber(values.spineBleed, 0);
      const unit = values.unit ?? 'mm';
      const totalWidth = singleWidth * 2 + spineWidth + bleed * 2;
      const totalHeight = singleHeight + bleed * 2;
      const headerSpace = 54;
      const footerSpace = 64;
      const paddingX = 42;
      const scale = Math.min(
        Math.max(1, width - paddingX * 2) / totalWidth,
        Math.max(1, height - headerSpace - footerSpace) / totalHeight
      );
      const drawingWidth = totalWidth * scale;
      const drawingHeight = totalHeight * scale;
      const outerX = (width - drawingWidth) / 2;
      const outerY = headerSpace + Math.max(0, (height - headerSpace - footerSpace - drawingHeight) / 2);
      const trimX = outerX + bleed * scale;
      const trimY = outerY + bleed * scale;
      const trimWidth = (singleWidth * 2 + spineWidth) * scale;
      const trimHeight = singleHeight * scale;
      const panelWidth = singleWidth * scale;
      const spinePixels = spineWidth * scale;
      const spineX = trimX + panelWidth;
      const coverX = spineX + spinePixels;
      const spineBleedPixels = Math.min(panelWidth / 3, spineBleed * scale);
      const regionDisplayRects: Record<string, { x: number; y: number; width: number; height: number }> = {
        canvas: { x: outerX, y: outerY, width: drawingWidth, height: drawingHeight },
        back_cover: { x: trimX, y: trimY, width: panelWidth, height: trimHeight },
        spine: { x: spineX, y: trimY, width: spinePixels, height: trimHeight },
        front_cover: { x: coverX, y: trimY, width: panelWidth, height: trimHeight }
      };

      context.save();
      context.shadowColor = 'rgba(15, 23, 42, 0.2)';
      context.shadowBlur = 22;
      context.shadowOffsetY = 10;
      context.fillStyle = '#fffaf4';
      context.fillRect(outerX, outerY, drawingWidth, drawingHeight);
      context.restore();

      context.fillStyle = '#ffffff';
      context.fillRect(trimX, trimY, trimWidth, trimHeight);
      context.fillStyle = '#f7f9fc';
      context.fillRect(trimX, trimY, panelWidth, trimHeight);
      context.fillStyle = '#eef6ff';
      context.fillRect(coverX, trimY, panelWidth, trimHeight);

      if (spinePixels > 0) {
        context.fillStyle = 'rgba(22, 119, 255, 0.1)';
        context.fillRect(spineX - spineBleedPixels, trimY, spinePixels + spineBleedPixels * 2, trimHeight);
        context.fillStyle = '#dbeafe';
        context.fillRect(spineX, trimY, spinePixels, trimHeight);
      }

      context.strokeStyle = '#ef8a42';
      context.lineWidth = 1.5;
      context.setLineDash([8, 5]);
      context.strokeRect(outerX, outerY, drawingWidth, drawingHeight);
      context.setLineDash([]);
      context.strokeStyle = '#8aa8d8';
      context.lineWidth = 1;
      context.strokeRect(trimX, trimY, trimWidth, trimHeight);
      context.beginPath();
      context.moveTo(spineX, trimY);
      context.lineTo(spineX, trimY + trimHeight);
      context.moveTo(coverX, trimY);
      context.lineTo(coverX, trimY + trimHeight);
      context.stroke();

      context.strokeStyle = '#0891b2';
      context.lineWidth = 1.5;
      context.setLineDash([6, 4]);
      context.beginPath();
      context.moveTo(spineX - spineBleedPixels, trimY);
      context.lineTo(spineX - spineBleedPixels, trimY + trimHeight);
      context.moveTo(coverX + spineBleedPixels, trimY);
      context.lineTo(coverX + spineBleedPixels, trimY + trimHeight);
      context.stroke();
      context.setLineDash([]);

      const importedDocument = objectValue(importedTemplate?.document);
      const importedReference = objectValue(importedDocument.reference);
      const importedWidth = positiveNumber(importedReference.width, 0);
      const importedHeight = positiveNumber(importedReference.height, 0);
      const importedElements = Array.isArray(importedTemplate?.elements)
        ? importedTemplate.elements.filter((element): element is Record<string, unknown> => Boolean(element && typeof element === 'object'))
        : [];
      if (importedWidth > 0 && importedHeight > 0 && importedElements.length > 0) {
        const importedScale = Math.min(drawingWidth / importedWidth, drawingHeight / importedHeight);
        const importedOffsetX = outerX + (drawingWidth - importedWidth * importedScale) / 2;
        const importedOffsetY = outerY + (drawingHeight - importedHeight * importedScale) / 2;
        context.save();
        context.lineWidth = 1;
        context.setLineDash([3, 3]);
        importedElements.forEach((element) => {
          const frame = objectValue(element.frame);
          const editedFrame = objectValue(frame.edited_px ?? frame.current_px ?? frame.preview_px);
          const hasEditedFrame = Object.keys(editedFrame).length > 0;
          const previewFrame = framePreviewSource(frame);
          const elementX = positiveNumber(previewFrame.x ?? frame.x, 0);
          const elementY = positiveNumber(previewFrame.y ?? frame.y, 0);
          const elementWidth = positiveNumber(previewFrame.width ?? frame.width, 0);
          const elementHeight = positiveNumber(previewFrame.height ?? frame.height, 0);
          if (elementWidth <= 0 || elementHeight <= 0) return;
          let x = importedOffsetX + elementX * importedScale;
          let y = importedOffsetY + elementY * importedScale;
          let w = elementWidth * importedScale;
          let h = elementHeight * importedScale;
          let sourceX = elementX;
          let sourceY = elementY;
          let sourceWidth = elementWidth;
          let sourceHeight = elementHeight;
          const relativeFrame = objectValue(frame.relative);
          const regionId = String(frame.region_id ?? previewFrame.region_id ?? 'canvas');
          const regionRect = regionDisplayRects[regionId] ?? regionDisplayRects.canvas;
          const relativeWidth = finiteNumber(relativeFrame.width, -1);
          const relativeHeight = finiteNumber(relativeFrame.height, -1);
          if (!hasEditedFrame && relativeWidth > 0 && relativeHeight > 0) {
            x = regionRect.x + finiteNumber(relativeFrame.x, 0) * regionRect.width;
            y = regionRect.y + finiteNumber(relativeFrame.y, 0) * regionRect.height;
            w = relativeWidth * regionRect.width;
            h = relativeHeight * regionRect.height;
            sourceX = (x - importedOffsetX) / importedScale;
            sourceY = (y - importedOffsetY) / importedScale;
            sourceWidth = w / importedScale;
            sourceHeight = h / importedScale;
          }
          const isText = String(element.type || '').toLowerCase() === 'text';
          const selected = String(element.id || '') === selectedElementId;
          renderedElementsRef.current.push({ elementId: String(element.id || ''), x, y, width: w, height: h, scale: importedScale, sourceX, sourceY, sourceWidth, sourceHeight });
          context.strokeStyle = selected ? '#1677ff' : isText ? '#7c3aed' : '#64748b';
          context.lineWidth = selected ? 2.5 : 1;
          context.fillStyle = isText ? 'rgba(124, 58, 237, 0.1)' : 'rgba(100, 116, 139, 0.08)';
          context.fillRect(x, y, w, h);
          context.strokeRect(x, y, w, h);
          if (isText && w > 46 && h > 16) {
            const content = objectValue(element.content);
            const label = String(element.text || content.literal || element.name || '').trim();
            if (label) {
              context.setLineDash([]);
              context.fillStyle = '#6d28d9';
              const font = objectValue(element.font);
              const scaledFontSize = Math.max(8, Math.min(48, positiveNumber(font.size_px, 10) * importedScale));
              const scaledTracking = finiteNumber(font.tracking, 0) * importedScale;
              const scaledLeading = Math.max(scaledFontSize, finiteNumber(font.leading_px, scaledFontSize * 1.2) * importedScale);
              context.font = `${scaledFontSize}px Microsoft YaHei, sans-serif`;
              (context as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${scaledTracking}px`;
              const textAlign = font.text_align === 'center' || font.text_align === 'right' ? font.text_align : 'left';
              context.textAlign = textAlign;
              context.textBaseline = 'top';
              label.slice(0, 48).split(/\r?\n/).forEach((line, lineIndex) => {
                const textX = textAlign === 'center' ? x + w / 2 : textAlign === 'right' ? x + w - 4 : x + 4;
                context.fillText(line, textX, y + 3 + lineIndex * scaledLeading);
              });
              (context as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
              context.setLineDash([3, 3]);
            }
          }
        });
        context.restore();
      }

      context.fillStyle = '#172033';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.font = '600 14px Microsoft YaHei, sans-serif';
      if (panelWidth >= 72) {
        context.fillText('封底', trimX + panelWidth / 2, Math.max(12, trimY - 18));
        context.fillText('封面', coverX + panelWidth / 2, Math.max(12, trimY - 18));
      }
      if (spinePixels >= 24) {
        context.save();
        context.translate(spineX + spinePixels / 2, Math.max(12, trimY - 18));
        context.fillText('书脊', 0, 0);
        context.restore();
      }

      context.fillStyle = '#536179';
      context.font = '12px Microsoft YaHei, sans-serif';
      context.fillText(`${singleWidth} x ${singleHeight} ${unit}`, trimX + panelWidth / 2, outerY + drawingHeight + 24);
      context.fillText(`书脊 ${spineWidth} · 出血 ${spineBleed} ${unit}`, spineX + spinePixels / 2, outerY + drawingHeight + 44);
      context.fillText(`${singleWidth} x ${singleHeight} ${unit}`, coverX + panelWidth / 2, outerY + drawingHeight + 24);

      context.textAlign = 'left';
      context.fillStyle = '#ef8a42';
      context.fillText(`出血 ${bleed} ${unit}`, Math.max(12, outerX), 25);
      context.textAlign = 'right';
      context.fillStyle = '#2563eb';
      context.fillText(`成品 ${singleWidth * 2 + spineWidth} x ${singleHeight} ${unit}`, Math.min(width - 12, outerX + drawingWidth), 25);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [importedTemplate, selectedElementId, values]);

  function updateDraggedElement(elementId: string, deltaX: number, deltaY: number) {
    if (!importedTemplate || !onTemplateChange) return;
    const elements = Array.isArray(importedTemplate.elements) ? importedTemplate.elements : [];
    onTemplateChange({
      ...importedTemplate,
      elements: elements.map((item) => {
        if (!item || typeof item !== 'object') return item;
        const element = item as Record<string, unknown>;
        if (String(element.id || '') !== elementId) return element;
        const frame = objectValue(element.frame);
        const referenceFrame = framePreviewSource(frame);
        const nextEditedFrame = {
          ...referenceFrame,
          x: finiteNumber(dragRef.current?.originalX, finiteNumber(referenceFrame.x, 0)) + deltaX,
          y: finiteNumber(dragRef.current?.originalY, finiteNumber(referenceFrame.y, 0)) + deltaY,
          width: positiveNumber(dragRef.current?.originalWidth, positiveNumber(referenceFrame.width, 0)),
          height: positiveNumber(dragRef.current?.originalHeight, positiveNumber(referenceFrame.height, 0))
        };
        return {
          ...element,
          frame: {
            ...frame,
            edited_px: nextEditedFrame
          }
        };
      })
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !importedTemplate) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = [...renderedElementsRef.current].reverse().find((item) => (
      item.elementId && x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height
    ));
    if (!hit) return;
    const element = (Array.isArray(importedTemplate.elements) ? importedTemplate.elements : [])
      .find((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && String((item as Record<string, unknown>).id || '') === hit.elementId));
    if (!element) return;
    const frame = objectValue(element.frame);
    const referenceFrame = framePreviewSource(frame);
    dragRef.current = {
      elementId: hit.elementId,
      startX: x,
      startY: y,
      originalX: hit.sourceX || positiveNumber(referenceFrame.x, 0),
      originalY: hit.sourceY || positiveNumber(referenceFrame.y, 0),
      originalWidth: hit.sourceWidth || positiveNumber(referenceFrame.width, 0),
      originalHeight: hit.sourceHeight || positiveNumber(referenceFrame.height, 0),
      scale: hit.scale || 1
    };
    onElementSelect?.(hit.elementId);
    canvas.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas || drag.scale <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    updateDraggedElement(drag.elementId, (x - drag.startX) / drag.scale, (y - drag.startY) / drag.scale);
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    canvasRef.current?.releasePointerCapture(event.pointerId);
    dragRef.current = undefined;
  }

  return (
    <section className="size-template-preview-surface" aria-label="尺寸模板实时画布">
      <header className="size-template-preview-header">
        <div><strong>画布预览</strong><span>按实际尺寸比例</span></div>
        <Tag color="blue">{values.unit ?? 'mm'}</Tag>
      </header>
      <div className="size-template-preview-stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
    </section>
  );
}

export default function SizeTemplatesPage({ shops, selectedShopId }: SizeTemplatesPageProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<SizeTemplateFormValues>();
  const [optionForm] = Form.useForm<SizeOptionFormValues>();
  const [templates, setTemplates] = useState<SizeTemplate[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<SizeTemplate>();
  const [view, setView] = useState<SizeTemplateView>('list');
  const [previewValues, setPreviewValues] = useState<Partial<SizeTemplateFormValues>>({});
  const [sizeFormData, setSizeFormData] = useState<SizeTemplateFormData>();
  const [importedTemplate, setImportedTemplate] = useState<TemplateImportDraft>();
  const [analyzingImport, setAnalyzingImport] = useState(false);
  const [useAiSuggestions, setUseAiSuggestions] = useState(false);
  const [strictFonts, setStrictFonts] = useState(true);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [fonts, setFonts] = useState<FontLibraryItem[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string>();
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [fontLayoutTemplates, setFontLayoutTemplates] = useState<FontLayoutTemplate[]>([]);
  const [localFontLayoutDrafts, setLocalFontLayoutDrafts] = useState<LocalFontLayoutDraft[]>([]);
  const [loadingFontLayouts, setLoadingFontLayouts] = useState(false);
  const [focusedFontLayoutId, setFocusedFontLayoutId] = useState<number>();
  const [fontLayoutDialogOpen, setFontLayoutDialogOpen] = useState(false);
  const [fontLayoutDialogSubmitting, setFontLayoutDialogSubmitting] = useState(false);
  const [fontLayoutName, setFontLayoutName] = useState('');
  const [fontLayoutDraft, setFontLayoutDraft] = useState<TemplateImportDraft>();
  const [fontLayoutEditingId, setFontLayoutEditingId] = useState<number>();
  const [optionDialog, setOptionDialog] = useState<SizeOptionDialog>();
  const [optionSubmitting, setOptionSubmitting] = useState(false);
  const [draggedSizeOptionValue, setDraggedSizeOptionValue] = useState<string>();
  const [sizeOptionDropTarget, setSizeOptionDropTarget] = useState<SizeOptionDropTarget>();
  const [addingPageCount, setAddingPageCount] = useState(false);
  const [pageCountDraft, setPageCountDraft] = useState<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const pageCountCommitRef = useRef(false);
  const productRequestIdRef = useRef(0);
  const fontLayoutRequestIdRef = useRef(0);
  const templateRequestIdRef = useRef(0);
  const selectedUnit = Form.useWatch('unit', form) ?? 'in';
  const selectedOptionValue = Form.useWatch('sizeOption', form);
  const selectedSpineWidthMode = Form.useWatch('spineWidthMode', form) ?? 'fixed';
  const selectedPageCount = Form.useWatch('pages', form) ?? 1;
  const selectedOption = sizeFormData?.size_options.find((option) => option.value === selectedOptionValue);
  const pageCountOptions = Array.from(new Set(
    (sizeFormData?.page_count_arr ?? [])
      .map((count) => Math.round(Number(count)))
      .filter((count) => count > 0)
  )).sort((left, right) => left - right);

  useEffect(() => {
    void browserAlbumApi.fonts.list().then(setFonts).catch(() => setFonts([]));
  }, []);

  useEffect(() => {
    if (focusedFontLayoutId === undefined || focusedFontLayoutId > 0 || !fontLayoutDraft) return;
    setLocalFontLayoutDrafts((current) => current.map((item) => item.id === focusedFontLayoutId
      ? { ...item, name: fontLayoutName || item.name, draft: fontLayoutDraft }
      : item));
  }, [focusedFontLayoutId, fontLayoutDraft, fontLayoutName]);

  useEffect(() => {
    setView('list');
    setActiveTemplate(undefined);
    setImportedTemplate(undefined);
    setImportWarnings([]);
    setSelectedElementId(undefined);
    setSizeFormData(undefined);
    setAvailableProducts([]);
    setFontLayoutTemplates([]);
    setLocalFontLayoutDrafts([]);
    setFocusedFontLayoutId(undefined);
    setFontLayoutEditingId(undefined);
    setFontLayoutName('');
    setFontLayoutDraft(undefined);
    setFontLayoutDialogOpen(false);
    setOptionDialog(undefined);
    productRequestIdRef.current += 1;
    fontLayoutRequestIdRef.current += 1;
    void loadTemplates(selectedShopId);
  }, [selectedShopId]);

  useEffect(() => {
    if (view !== 'create' && view !== 'edit') return;
    setFocusedFontLayoutId(undefined);
    setFontLayoutEditingId(undefined);
    setFontLayoutName('');
    setFontLayoutDraft(undefined);
    if (activeTemplate) {
      const values = formValuesFromTemplate(activeTemplate, view === 'create');
      form.setFieldsValue(values);
      setPreviewValues(values);
      setSizeFormData(activeTemplate.sizeForm);
      const normalizedLayout = activeTemplate.layoutTemplate
        ? normalizeImportedTemplate(activeTemplate.layoutTemplate)
        : undefined;
      setImportedTemplate(normalizedLayout);
      const firstElement = Array.isArray(normalizedLayout?.elements)
        ? normalizedLayout.elements[0]
        : undefined;
      setSelectedElementId(firstElement && typeof firstElement === 'object' ? String((firstElement as Record<string, unknown>).id || '') : undefined);
      void loadShopProducts(activeTemplate.shopId);
      void loadFontLayoutTemplates(
        activeTemplate.shopId,
        activeTemplate.id,
        activeTemplate.fontLayoutTemplates,
        activeTemplate.fontLayoutTemplateIds
      );
      return;
    }
    const values: SizeTemplateFormValues = {
      shopId: selectedShopId ?? shops[0]?.id ?? 0,
      name: '',
      products: [],
      unit: 'in',
      singleWidth: 0,
      singleHeight: 0,
      spineWidth: 0,
      bleed: 0,
      spineBleed: 0,
      pages: 80,
      spineWidthMode: 'fixed'
    };
    form.setFieldsValue(values);
    setPreviewValues(values);
    setSizeFormData(emptySizeFormData());
    setImportedTemplate(undefined);
    setSelectedElementId(undefined);
    if (values.shopId > 0) void loadShopProducts(values.shopId);
    if (values.shopId > 0) void loadFontLayoutTemplates(values.shopId);
  }, [activeTemplate?.id, form, selectedShopId, shops, view]);

  function applyTemplateRefresh(template: SizeTemplate) {
    const values = formValuesFromTemplate(template);
    setActiveTemplate(template);
    setTemplates((current) => current.some((item) => item.id === template.id)
      ? current.map((item) => item.id === template.id ? template : item)
      : [template, ...current]);
    form.setFieldsValue(values);
    setPreviewValues(values);
    setSizeFormData(template.sizeForm);
    setImportedTemplate(template.layoutTemplate ? normalizeImportedTemplate(template.layoutTemplate) : undefined);
    setFontLayoutTemplates((current) => mergeFontLayoutTemplates(current, template.fontLayoutTemplates));
  }

  async function loadTemplateFormData(template: SizeTemplate) {
    try {
      const selectedOption = template.sizeForm.size_option ?? undefined;
      const selectedUnit = template.sizeForm.size_unit;
      const loadedForm = await browserAlbumApi.sizeTemplates.form(template.id, {
        sizeOption: selectedOption,
        unit: selectedUnit
      });
      const mergedForm = {
        ...loadedForm,
        size_options: loadedForm.size_options.length > 0 ? loadedForm.size_options : template.sizeForm.size_options
      };
      setSizeFormData(mergedForm);
      if (selectedOption) {
        const values = editorValuesFromSizeData(selectedOption, selectedUnit, mergedForm);
        form.setFieldsValue(values);
        setPreviewValues((current) => ({ ...current, ...values }));
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  function applySizeSelection(optionId: string | undefined, unit: SizeTemplateUnit) {
    if (!optionId) return;
    const option = sizeFormData?.size_options.find((item) => item.value === optionId);
    if (!option) return;
    const values = editorValuesFromOption(option, unit);
    const unitValues = option[unit];
    setSizeFormData((current) => current ? {
      ...current,
      ...(unitValues ?? {}),
      page_count: option.page_count || current.page_count,
      spine_width_mode: option.spine_width_mode,
      size_option: optionId,
      size_unit: unit
    } : current);
    form.setFieldsValue(values);
    setPreviewValues((current) => ({ ...current, ...values }));
  }

  function applyPageCount(value: number | null) {
    if (value == null || !Number.isFinite(value)) return;
    const pages = Math.max(1, Math.round(value));
    form.setFieldValue('pages', pages);
    setPreviewValues((current) => ({ ...current, pages }));
    setSizeFormData((current) => current ? { ...current, page_count: pages } : current);
  }

  function commitPageCountOption() {
    if (pageCountCommitRef.current) return;
    const value = Number(pageCountDraft);
    if (!Number.isFinite(value) || value < 1) {
      message.warning('请先输入页数');
      return;
    }
    const pages = Math.round(value);
    pageCountCommitRef.current = true;
    if (pageCountOptions.includes(pages)) {
      message.info(`${pages} 页已经在选项中`);
      applyPageCount(pages);
      setAddingPageCount(false);
      setPageCountDraft(null);
      return;
    }
    setSizeFormData((current) => current ? {
      ...current,
      page_count_arr: Array.from(new Set([...current.page_count_arr, pages])).sort((left, right) => left - right)
    } : current);
    applyPageCount(pages);
    setAddingPageCount(false);
    setPageCountDraft(null);
  }

  function removePageCountOption(pages: number) {
    setSizeFormData((current) => current ? {
      ...current,
      page_count_arr: current.page_count_arr.filter((count) => Math.round(Number(count)) !== pages)
    } : current);
  }

  function optionUnit(option: SizeTemplateFormOption, preferred: SizeTemplateUnit): SizeTemplateUnit {
    if (option[preferred]) return preferred;
    return (['in', 'mm', 'cm'] as SizeTemplateUnit[]).find((unit) => Boolean(option[unit])) ?? preferred;
  }

  function optionDimensionLabel(option: SizeTemplateFormOption, unit: SizeTemplateUnit): string {
    const values = option[unit];
    if (!values) return '尺寸值待完善';
    return `${twoDecimalNumber(values.single_side_width)} × ${twoDecimalNumber(values.single_side_height)} ${unit}`;
  }

  function dragSizeOptionOver(event: DragEvent<HTMLButtonElement>, targetValue: string) {
    if (!draggedSizeOptionValue || draggedSizeOptionValue === targetValue) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after';
    if (sizeOptionDropTarget?.value !== targetValue || sizeOptionDropTarget.position !== position) {
      setSizeOptionDropTarget({ value: targetValue, position });
    }
  }

  function dropSizeOption(event: DragEvent<HTMLButtonElement>, targetValue: string) {
    event.preventDefault();
    const sourceValue = draggedSizeOptionValue || event.dataTransfer.getData('text/plain');
    const position = sizeOptionDropTarget?.value === targetValue ? sizeOptionDropTarget.position : 'before';
    setSizeFormData((current) => {
      if (!current || !sourceValue || sourceValue === targetValue) return current;
      const sourceIndex = current.size_options.findIndex((option) => option.value === sourceValue);
      if (sourceIndex < 0) return current;
      const nextOptions = [...current.size_options];
      const [movedOption] = nextOptions.splice(sourceIndex, 1);
      const targetIndex = nextOptions.findIndex((option) => option.value === targetValue);
      if (!movedOption || targetIndex < 0) return current;
      nextOptions.splice(targetIndex + (position === 'after' ? 1 : 0), 0, movedOption);
      return { ...current, size_options: nextOptions };
    });
    setDraggedSizeOptionValue(undefined);
    setSizeOptionDropTarget(undefined);
  }

  function finishSizeOptionDrag() {
    setDraggedSizeOptionValue(undefined);
    setSizeOptionDropTarget(undefined);
  }

  async function loadShopProducts(shopId: number) {
    const requestId = productRequestIdRef.current + 1;
    productRequestIdRef.current = requestId;
    const cachedProducts = shops.find((shop) => shop.id === shopId)?.products ?? [];
    setAvailableProducts(cachedProducts);
    setLoadingProducts(cachedProducts.length === 0);
    try {
      const shop = await browserAlbumApi.shops.get(shopId);
      if (productRequestIdRef.current !== requestId) return;
      setAvailableProducts(shop.products);
    } catch (error) {
      if (productRequestIdRef.current !== requestId) return;
      if (cachedProducts.length === 0) {
        setAvailableProducts([]);
        message.error(error instanceof Error ? error.message : String(error));
      }
    } finally {
      if (productRequestIdRef.current === requestId) setLoadingProducts(false);
    }
  }

  async function loadFontLayoutTemplates(
    shopId: number,
    sizeTemplateId?: number,
    linkedTemplates: FontLayoutTemplate[] = [],
    linkedIds: number[] = []
  ) {
    const requestId = fontLayoutRequestIdRef.current + 1;
    fontLayoutRequestIdRef.current = requestId;
    setFontLayoutTemplates(linkedTemplates);
    setLoadingFontLayouts(true);
    try {
      if (sizeTemplateId !== undefined && linkedIds.length > 0) {
        const details = await Promise.all(linkedIds.map(async (templateId) => {
          try {
            return await browserAlbumApi.fontLayoutTemplates.get(templateId);
          } catch {
            return undefined;
          }
        }));
        if (fontLayoutRequestIdRef.current !== requestId) return;
        setFontLayoutTemplates(mergeFontLayoutTemplates(
          linkedTemplates,
          details.filter((template): template is FontLayoutTemplate => Boolean(template))
        ));
        return;
      }
      const templates = await browserAlbumApi.fontLayoutTemplates.list({ shopId, sizeTemplateId });
      if (fontLayoutRequestIdRef.current !== requestId) return;
      setFontLayoutTemplates(mergeFontLayoutTemplates(linkedTemplates, templates));
    } catch (error) {
      if (fontLayoutRequestIdRef.current !== requestId) return;
      setFontLayoutTemplates(linkedTemplates);
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      if (fontLayoutRequestIdRef.current === requestId) setLoadingFontLayouts(false);
    }
  }

  function emptyFontLayoutDraft(): TemplateImportDraft {
    return {
      canvas: { width: 1000, height: 800 },
      options: {
        coordinate_system: 'top-left',
        scaling: { mode: 'uniform' }
      },
      safe_distance: 0,
      elements: [],
    };
  }

  function updateFontLayoutFromEditor(template: TemplateImportDraft) {
    setFontLayoutDraft(template);
  }

  function updateImportedLayoutFromEditor(template: TemplateImportDraft) {
    setImportedTemplate(template);
  }

  function currentFontLayoutCanvas(template?: TemplateImportDraft): { width: number; height: number } {
    const canvas = objectValue(template?.canvas);
    return {
      width: Math.max(1, finiteNumber(canvas.width, 1000)),
      height: Math.max(1, finiteNumber(canvas.height, 800))
    };
  }

  function openNewFontLayoutTemplate() {
    setFontLayoutEditingId(undefined);
    setFocusedFontLayoutId(undefined);
    setSelectedElementId(undefined);
    setFontLayoutName('');
    setFontLayoutDraft(emptyFontLayoutDraft());
    setFontLayoutDialogOpen(true);
  }

  async function openRenameFontLayout(templateId: number) {
    if (focusedFontLayoutId !== templateId || !fontLayoutDraft) {
      await openFontLayoutTemplate(templateId);
    }
    setFontLayoutDialogOpen(true);
  }

  async function openFontLayoutTemplate(templateId: number) {
    setFocusedFontLayoutId(templateId);
    setFontLayoutEditingId(undefined);
    setFontLayoutDraft(undefined);
    setFontLayoutName('');
    setSelectedElementId(undefined);
    if (templateId < 0) {
      const localDraft = localFontLayoutDrafts.find((item) => item.id === templateId);
      if (localDraft) {
        setFontLayoutName(localDraft.name);
        setFontLayoutDraft(localDraft.draft);
        const firstElement = Array.isArray(localDraft.draft.elements) ? localDraft.draft.elements[0] : undefined;
        setSelectedElementId(firstElement && typeof firstElement === 'object' ? String((firstElement as Record<string, unknown>).id || '') : undefined);
      }
      return;
    }
    setFontLayoutDialogSubmitting(true);
    try {
      const detail = await browserAlbumApi.fontLayoutTemplates.get(templateId);
      setFontLayoutEditingId(detail.id);
      setFontLayoutName(detail.name);
      const normalizedDetail = normalizeImportedTemplate({
        ...emptyFontLayoutDraft(),
        ...(detail.canvas ? { canvas: detail.canvas } : {}),
        safe_distance: detail.safeDistance,
        ...(detail.options ? { options: detail.options } : {}),
        elements: detail.elements ?? []
      });
      setFontLayoutDraft(normalizedDetail);
      const firstElement = detail.elements?.[0];
      setSelectedElementId(firstElement ? String(firstElement.id || '') : undefined);
    } catch (error) {
      setFocusedFontLayoutId(undefined);
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setFontLayoutDialogSubmitting(false);
    }
  }

  function closeFontLayoutTemplate() {
    setFocusedFontLayoutId(undefined);
    setFontLayoutEditingId(undefined);
    setFontLayoutName('');
    setFontLayoutDraft(undefined);
    const firstImportedElement = Array.isArray(importedTemplate?.elements) ? importedTemplate.elements[0] : undefined;
    setSelectedElementId(firstImportedElement && typeof firstImportedElement === 'object'
      ? String((firstImportedElement as Record<string, unknown>).id || '')
      : undefined);
  }

  async function saveFontLayoutTemplate() {
    const shopId = form.getFieldValue('shopId') || activeTemplate?.shopId || selectedShopId || shops[0]?.id;
    if (!shopId) {
      message.warning('请先选择店铺');
      return;
    }
    if (!fontLayoutName.trim()) {
      message.warning('请先输入字体名');
      return;
    }
    const sizeTemplateId = activeTemplate?.id;
    if (!fontLayoutEditingId && !sizeTemplateId) {
      message.warning('请先保存尺寸模板，再新增关联的字体布局模板');
      return;
    }
    const draft = fontLayoutDraft ?? emptyFontLayoutDraft();
    const elements = Array.isArray(draft.elements)
      ? draft.elements
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => {
          const placement = objectValue(item.placement);
          if (!Object.prototype.hasOwnProperty.call(placement, 'safe_distance_px')) return item;
          const nextPlacement = Object.fromEntries(
            Object.entries(placement).filter(([key]) => key !== 'safe_distance_px')
          );
          return {
            ...item,
            placement: Object.keys(nextPlacement).length ? nextPlacement : undefined
          };
        })
      : [];
    const temporaryId = focusedFontLayoutId !== undefined && focusedFontLayoutId < 0 ? focusedFontLayoutId : undefined;
    const safeDistance = Math.max(0, finiteNumber(draft.safe_distance, 0));
    const options = { ...objectValue(draft.options), safe_distance: safeDistance };
    setFontLayoutDialogSubmitting(true);
    try {
      const saved = fontLayoutEditingId
        ? await browserAlbumApi.fontLayoutTemplates.update(
          fontLayoutEditingId,
          { name: fontLayoutName.trim(), safeDistance, elements, options }
        )
        : await browserAlbumApi.fontLayoutTemplates.create({
          shopId,
          sizeTemplateId: sizeTemplateId!,
          name: fontLayoutName.trim(),
          safeDistance,
          elements,
          options
        });
      setFontLayoutTemplates((current) => mergeFontLayoutTemplates(current, [saved]));
      if (temporaryId !== undefined) {
        setLocalFontLayoutDrafts((current) => current.filter((item) => item.id !== temporaryId));
      }
      setFocusedFontLayoutId(saved.id);
      setFontLayoutEditingId(saved.id);
      setFontLayoutName(saved.name);
      const normalizedSaved = normalizeImportedTemplate({
        ...emptyFontLayoutDraft(),
        canvas: saved.canvas ?? currentFontLayoutCanvas(draft),
        safe_distance: saved.safeDistance,
        ...(saved.options ? { options: saved.options } : {}),
        elements: saved.elements ?? elements
      });
      setFontLayoutDraft(normalizedSaved);
      setFontLayoutDialogOpen(false);
      message.success(fontLayoutEditingId ? '字体布局模板已保存' : '字体布局模板已新增');
      if (shopId) void loadFontLayoutTemplates(shopId, activeTemplate?.id);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setFontLayoutDialogSubmitting(false);
    }
  }

  async function deleteFocusedFontLayoutTemplate() {
    if (!focusedFontLayoutId) {
      message.info('请先选择要删除的字体布局模板');
      return;
    }
    if (focusedFontLayoutId < 0) {
      setLocalFontLayoutDrafts((current) => current.filter((item) => item.id !== focusedFontLayoutId));
      setFontLayoutTemplates((current) => current.filter((item) => item.id !== focusedFontLayoutId));
      closeFontLayoutTemplate();
      message.success('临时字体布局已移除');
      return;
    }
    try {
      await browserAlbumApi.fontLayoutTemplates.delete(focusedFontLayoutId);
      setFontLayoutTemplates((current) => current.filter((item) => item.id !== focusedFontLayoutId));
      closeFontLayoutTemplate();
      message.success('字体布局模板已删除');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  async function loadTemplates(shopId: number | undefined): Promise<SizeTemplate[]> {
    const requestId = templateRequestIdRef.current + 1;
    templateRequestIdRef.current = requestId;
    if (shopId === undefined) {
      setTemplates([]);
      setLoading(false);
      return [];
    }
    setLoading(true);
    try {
      const loadedTemplates = await browserAlbumApi.sizeTemplates.list(shopId);
      if (templateRequestIdRef.current === requestId) setTemplates(loadedTemplates);
      return loadedTemplates;
    } catch (error) {
      if (templateRequestIdRef.current === requestId) {
        setTemplates([]);
        message.error(error instanceof Error ? error.message : String(error));
      }
      return [];
    } finally {
      if (templateRequestIdRef.current === requestId) setLoading(false);
    }
  }

  const filteredTemplates = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    return templates.filter((template) => {
      if (!normalizedKeyword) return true;
      const shop = shops.find((item) => item.id === template.shopId);
      const sizeValues = template.sizeForm.size_options.flatMap((option) => [option.value, option.label]);
      const fontValues = template.fontLayoutTemplates.flatMap((fontTemplate) => [
        fontLayoutLabel(fontTemplate),
        fontTemplate.fontName
      ]);
      return [
        template.name,
        template.shop,
        template.shopName,
        ...template.products,
        ...sizeValues,
        ...fontValues,
        shop ? shopLabel(shop) : ''
      ]
        .some((value) => value.toLocaleLowerCase().includes(normalizedKeyword));
    });
  }, [keyword, shops, templates]);

  function openTemplateForm(template?: SizeTemplate, copy = false) {
    if (!template && selectedShopId === undefined) {
      message.warning('请先新增店铺');
      return;
    }
    setActiveTemplate(template);
    setView(template && !copy ? 'edit' : 'create');
    if (template && !copy) {
      void browserAlbumApi.sizeTemplates.get(template.id)
        .then((detail) => {
          applyTemplateRefresh(detail);
          void loadTemplateFormData(detail);
        })
        .catch((error) => message.error(error instanceof Error ? error.message : String(error)));
    }
  }

  async function analyzeImportFile(file: File) {
    setAnalyzingImport(true);
    try {
      const currentValues = form.getFieldsValue();
      const result = await browserAlbumApi.templateImports.analyze(file, {
        use_ai: useAiSuggestions,
        strict_fonts: false,
        ocr_languages: 'eng+chi_sim',
        template_name: currentValues.name?.trim() || activeTemplate?.name,
        product_names: currentValues.products ?? activeTemplate?.products ?? [],
        size_form: {
          ...(sizeFormData ?? emptySizeFormData()),
          size_option: currentValues.sizeOption ?? null,
          size_unit: currentValues.unit,
          single_side_width: currentValues.singleWidth,
          single_side_height: currentValues.singleHeight,
          bleed: currentValues.bleed,
          page_count: currentValues.pages,
          spine_width_mode: currentValues.spineWidthMode ?? 'fixed',
          spine_width: currentValues.spineWidth,
          spine_bleed: currentValues.spineBleed
        }
      });
      const resultRecord = objectValue(result as unknown);
      const resultLayouts = Array.isArray(resultRecord.font_layout_templates) ? resultRecord.font_layout_templates : [];
      const templateRecord = objectValue(result.template);
      const templateWithLayouts = resultLayouts.length > 0
        ? { ...templateRecord, font_layout_templates: resultLayouts }
        : templateRecord;
      const normalizedSourceTemplate = normalizeImportedTemplate(templateWithLayouts);
      const normalizedTemplate = normalizedSourceTemplate;
      const temporaryId = -Date.now();
      const temporaryName = file.name || '未命名 PSD';
      setLocalFontLayoutDrafts((current) => [
        ...current.filter((item) => item.id !== temporaryId),
        { id: temporaryId, name: temporaryName, draft: normalizedTemplate }
      ]);
      setFontLayoutTemplates((current) => [
        ...current.filter((item) => item.id > 0),
        { id: temporaryId, shopId: currentValues.shopId || activeTemplate?.shopId || selectedShopId || 0, safeDistance: 0, name: temporaryName, description: 'PSD 识别草稿', fontName: '', createdAt: '', updatedAt: '' }
      ]);
      setFocusedFontLayoutId(temporaryId);
      setFontLayoutEditingId(undefined);
      setFontLayoutName(temporaryName);
      setFontLayoutDraft(normalizedTemplate);
      setFontLayoutDialogOpen(false);
      const source = objectValue(result.template.source);
      const ocr = objectValue(source.ocr);
      const warnings = [
        ...(Array.isArray(result.warnings) ? result.warnings : []),
        ...(Array.isArray(result.template.warnings) ? result.template.warnings : []),
        ...(Array.isArray(ocr.warnings) ? ocr.warnings : [])
      ].map(String);
      setImportWarnings(Array.from(new Set(warnings)));
      const firstElement = Array.isArray(normalizedTemplate.elements) ? normalizedTemplate.elements[0] : undefined;
      setSelectedElementId(firstElement && typeof firstElement === 'object' ? String((firstElement as Record<string, unknown>).id || '') : undefined);
      const metadata = objectValue(result.template.metadata);
      const currentName = form.getFieldValue('name');
      if (!currentName && metadata.name) {
        form.setFieldValue('name', String(metadata.name));
      }
      message.success(`已识别 ${Array.isArray(normalizedTemplate.elements) ? normalizedTemplate.elements.length : 0} 个图层元素`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setAnalyzingImport(false);
    }
  }

  function backToList() {
    if (submitting) return;
    setView('list');
    setActiveTemplate(undefined);
  }

  function setLocalOptions(options: SizeTemplateFormOption[], selectedValue?: string) {
    const base = { ...(sizeFormData ?? emptySizeFormData()), size_options: options };
    const nextValue = options.some((option) => option.value === selectedValue)
      ? selectedValue
      : options[0]?.value;
    const selection = sizeDataFromOption(base, nextValue, 'in');
    const nextSizeForm = selection
      ? { ...selection.data, status: 'ready' }
      : { ...emptySizeFormData(), size_options: options };
    setSizeFormData(nextSizeForm);
    if (selection) {
      const values = editorValuesFromSizeData(selection.option.value, 'in', nextSizeForm);
      form.setFieldsValue(values);
      setPreviewValues((current) => ({ ...current, ...values }));
    } else {
      form.setFieldsValue({ sizeOption: undefined, unit: 'in' });
      setPreviewValues((current) => ({ ...current, sizeOption: undefined, unit: 'in' }));
    }
  }

  function openSizeOptionDialog(mode: SizeOptionDialog['mode']) {
    const option = mode === 'edit' ? selectedOption : undefined;
    if (mode === 'edit' && !option) return;
    optionForm.setFieldsValue(optionFormValues(option, selectedUnit));
    setOptionDialog({ mode, originalValue: option?.value });
  }

  async function refreshEditedTemplate(templateId: number, shopId: number): Promise<SizeTemplate | undefined> {
    const loadedTemplates = await loadTemplates(shopId);
    const refreshedTemplate = loadedTemplates.find((template) => template.id === templateId);
    if (refreshedTemplate) {
      applyTemplateRefresh(refreshedTemplate);
      await loadTemplateFormData(refreshedTemplate);
    }
    return refreshedTemplate;
  }

  async function submitSizeOption() {
    if (!optionDialog) return;
    const values = await optionForm.validateFields();
    const isSelected = optionDialog.mode === 'create' || selectedOptionValue === optionDialog.originalValue;
    const payload = optionPayload(values, isSelected);
    const duplicate = sizeFormData?.size_options.some((option) => (
      option.value === payload.id && option.value !== optionDialog.originalValue
    ));
    if (duplicate) {
      optionForm.setFields([{ name: 'value', errors: ['尺寸方案值不能重复'] }]);
      return;
    }

    setOptionSubmitting(true);
    try {
      if (view === 'edit' && activeTemplate) {
        if (optionDialog.mode === 'edit') {
          const optionId = selectedOption?.id ?? optionDialog.originalValue;
          if (!optionId) throw new Error('尺寸方案缺少 option_id，无法编辑。');
          await browserAlbumApi.sizeTemplates.options.update(activeTemplate.id, optionId, payload);
          message.success('尺寸方案已更新');
        } else {
          await browserAlbumApi.sizeTemplates.options.create(activeTemplate.id, payload);
          message.success('尺寸方案已新增');
        }
        await refreshEditedTemplate(activeTemplate.id, activeTemplate.shopId);
      } else {
        const currentOptions = sizeFormData?.size_options ?? [];
        const option: SizeTemplateFormOption = {
          id: payload.id,
          value: payload.id,
          label: payload.label,
          disabled: false,
          page_count: Math.max(1, Math.round(Number(form.getFieldValue('pages')) || sizeFormData?.page_count || 1)),
          size_unit: payload.size_unit,
          spine_width_mode: payload.spine_width_mode,
          in: payload.size_unit === 'in' ? {
            single_side_width: payload.single_side_width,
            single_side_height: payload.single_side_height,
            bleed: payload.bleed,
            spine_width: payload.spine_width,
            spine_bleed: payload.spine_bleed
          } : null,
          mm: payload.size_unit === 'mm' ? {
            single_side_width: payload.single_side_width,
            single_side_height: payload.single_side_height,
            bleed: payload.bleed,
            spine_width: payload.spine_width,
            spine_bleed: payload.spine_bleed
          } : null,
          cm: payload.size_unit === 'cm' ? {
            single_side_width: payload.single_side_width,
            single_side_height: payload.single_side_height,
            bleed: payload.bleed,
            spine_width: payload.spine_width,
            spine_bleed: payload.spine_bleed
          } : null,
        };
        const nextOptions = optionDialog.mode === 'edit'
          ? currentOptions.map((item) => item.value === optionDialog.originalValue ? option : item)
          : [...currentOptions, option];
        setLocalOptions(nextOptions, isSelected ? option.value : selectedOptionValue);
      }
      setOptionDialog(undefined);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setOptionSubmitting(false);
    }
  }

  async function saveSelectedSizeOption() {
    if (!selectedOption) return;
    let values: SizeTemplateFormValues;
    try {
      values = await form.validateFields([
        'singleWidth',
        'singleHeight',
        'bleed',
        'pages',
        'spineWidthMode',
        'spineWidth',
        'spineBleed'
      ]);
    } catch {
      return;
    }

    const payload = optionPayload({
      value: selectedOption.value,
      label: selectedOption.label || selectedOption.value,
      unit: values.unit,
      spineWidthMode: values.spineWidthMode ?? 'fixed',
      singleWidth: values.singleWidth,
      singleHeight: values.singleHeight,
      bleed: values.bleed,
      spineWidth: values.spineWidth,
      spineBleed: values.spineBleed
    }, true, values.unit);

    setOptionSubmitting(true);
    try {
      if (view === 'edit' && activeTemplate) {
        const optionId = selectedOption.id ?? selectedOption.value;
        await browserAlbumApi.sizeTemplates.options.update(activeTemplate.id, optionId, payload);
        await refreshEditedTemplate(activeTemplate.id, activeTemplate.shopId);
      } else {
        const updatedOption: SizeTemplateFormOption = {
          ...selectedOption,
          disabled: false,
          size_unit: payload.size_unit,
          spine_width_mode: payload.spine_width_mode,
          in: payload.size_unit === 'in' ? {
            single_side_width: payload.single_side_width,
            single_side_height: payload.single_side_height,
            bleed: payload.bleed,
            spine_width: payload.spine_width,
            spine_bleed: payload.spine_bleed
          } : selectedOption.in,
          mm: payload.size_unit === 'mm' ? {
            single_side_width: payload.single_side_width,
            single_side_height: payload.single_side_height,
            bleed: payload.bleed,
            spine_width: payload.spine_width,
            spine_bleed: payload.spine_bleed
          } : selectedOption.mm,
          cm: payload.size_unit === 'cm' ? {
            single_side_width: payload.single_side_width,
            single_side_height: payload.single_side_height,
            bleed: payload.bleed,
            spine_width: payload.spine_width,
            spine_bleed: payload.spine_bleed
          } : selectedOption.cm
        };
        setLocalOptions(
          (sizeFormData?.size_options ?? []).map((option) => (
            option.value === selectedOption.value ? updatedOption : option
          )),
          selectedOption.value
        );
      }
      message.success('尺寸方案已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setOptionSubmitting(false);
    }
  }

  async function deleteSizeOption() {
    if (!selectedOption) return;
    if (view === 'edit' && activeTemplate) {
      const optionId = selectedOption.id ?? selectedOption.value;
      try {
        await browserAlbumApi.sizeTemplates.options.delete(activeTemplate.id, optionId);
        await refreshEditedTemplate(activeTemplate.id, activeTemplate.shopId);
        message.success('尺寸方案已删除');
      } catch (error) {
        message.error(error instanceof Error ? error.message : String(error));
      }
      return;
    }
    setLocalOptions(
      (sizeFormData?.size_options ?? []).filter((option) => option.value !== selectedOption.value),
      selectedOptionValue
    );
  }

  async function submitTemplate() {
    const values = await form.validateFields();
    const products = Array.from(new Set((values.products ?? []).map((product) => product.trim()).filter(Boolean)));
    const sizeOptions = publicSizeOptionsPayload(sizeFormData, values);
    if (importedTemplate && sizeOptions.length === 0) {
      message.error('请先新增尺寸方案，再保存导入的布局规则。');
      return;
    }
    const payload: SizeTemplatePayload = {
      shopId: values.shopId,
      name: values.name.trim(),
      products,
      unit: values.unit,
      sizeOption: values.sizeOption ?? null,
      pageCount: values.pages,
      pageCountArr: sizeFormData?.page_count_arr?.length ? sizeFormData.page_count_arr : [values.pages],
      sizeOptions
    };
    setSubmitting(true);
    let newlyCreatedTemplate: SizeTemplate | undefined;
    try {
      let savedTemplate: SizeTemplate;
      if (view === 'edit' && activeTemplate) {
        savedTemplate = await browserAlbumApi.sizeTemplates.update(activeTemplate.id, payload);
        message.success('尺寸模板已更新');
      } else {
        savedTemplate = await browserAlbumApi.sizeTemplates.create(payload);
        newlyCreatedTemplate = savedTemplate;
        message.success('尺寸模板已新增');
      }
      if (importedTemplate) {
        if (savedTemplate.sizeForm.status === 'needs_values') {
          throw new Error('当前尺寸方案未完善，不能生成布局规则。');
        }
        const finalized = await browserAlbumApi.templateImports.finalize(
          importedTemplate,
          savedTemplate.id,
          strictFonts
        );
        setImportedTemplate(normalizeImportedTemplate(finalized.template));
        savedTemplate = {
          ...savedTemplate,
          layoutTemplate: normalizeImportedTemplate(finalized.template)
        };
        message.success('模板布局规则已保存');
      }
      const loadedTemplates = await loadTemplates(values.shopId);
      applyTemplateRefresh(loadedTemplates.find((template) => template.id === savedTemplate.id) ?? savedTemplate);
      setView('edit');
    } catch (error) {
      if (newlyCreatedTemplate) {
        setActiveTemplate({ ...newlyCreatedTemplate, layoutTemplate: importedTemplate });
        setView('edit');
      }
      message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteTemplate(template: SizeTemplate) {
    try {
      await browserAlbumApi.sizeTemplates.delete(template.id);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      message.success(`已删除“${template.name}”`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : String(error));
    }
  }

  const columns: ColumnsType<SizeTemplate> = [
    {
      title: '展示名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, template) => (
        <div className="size-template-name">
          <strong>{name}</strong>
          <span>{template.products.length > 0 ? `${template.products[0]}${template.products.length > 1 ? ` 等 ${template.products.length} 个商品` : ''}` : '未关联商品'}</span>
        </div>
      )
    },
    {
      title: '店铺',
      dataIndex: 'shopId',
      key: 'shopId',
      width: 150,
      render: (_shopId: number, template) => (
        template.shopName
        || template.shop
        || shopLabel(shops.find((shop) => shop.id === template.shopId) ?? ({ shop: '未知店铺' } as Shop))
      )
    },
    {
      title: '规格',
      key: 'sizeOptions',
      width: 220,
      render: (_, template) => {
        const currentValue = template.sizeForm.size_option;
        const options = template.sizeForm.size_options;
        return (
          <div className="size-template-size-cell">
            {options.length > 0 ? (
              <Space size={[4, 4]} wrap>
                {options.map((option) => (
                  <Tag
                    key={option.value}
                    color={option.value === currentValue ? 'blue' : undefined}
                  >
                    {option.value}
                  </Tag>
                ))}
                {template.sizeForm.status === 'needs_values' && <Tag color="warning">尺寸未完善</Tag>}
              </Space>
            ) : (
              <Tag color="warning">待填写</Tag>
            )}
          </div>
        );
      }
    },
    {
      title: '字体布局',
      key: 'fontLayoutTemplates',
      width: 240,
      render: (_, template) => <FontLayoutTags templates={template.fontLayoutTemplates} />
    },
    {
      title: '操作',
      key: 'actions',
      width: 176,
      render: (_, template) => (
        <Space size={0}>
          <Tooltip title="查看详情">
            <Button type="text" icon={<EyeOutlined />} aria-label={`查看 ${template.name}`} onClick={() => {
              setActiveTemplate(template);
              setView('detail');
            }} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined />} aria-label={`编辑 ${template.name}`} onClick={() => openTemplateForm(template)} />
          </Tooltip>
          <Tooltip title="复制">
            <Button type="text" icon={<CopyOutlined />} aria-label={`复制 ${template.name}`} onClick={() => openTemplateForm(template, true)} />
          </Tooltip>
          <Popconfirm title="删除尺寸模板" description={`确定删除“${template.name}”吗？`} okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => deleteTemplate(template)}>
            <Tooltip title="删除"><Button type="text" danger icon={<DeleteOutlined />} aria-label={`删除 ${template.name}`} /></Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const activeShopName = selectedShopId === undefined
    ? '暂无店铺'
    : shopLabel(shops.find((shop) => shop.id === selectedShopId) ?? ({ shop: '未知店铺' } as Shop));

  if (view === 'detail' && activeTemplate) {
    const detailValues = formValuesFromTemplate(activeTemplate);
    const detailOption = selectedSizeFormOption(activeTemplate.sizeForm);
    return (
      <section className="panel size-template-subpage">
        <header className="panel-header size-template-subpage-header">
          <div className="size-template-subpage-title">
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回尺寸模板列表" onClick={backToList} />
            <div><h1>尺寸模板详情</h1><p>{activeTemplate.name}</p></div>
          </div>
          <Button type="primary" icon={<EditOutlined />} onClick={() => openTemplateForm(activeTemplate)}>编辑模板</Button>
        </header>
        <div className="size-template-detail-surface">
          <Descriptions bordered column={{ xs: 1, sm: 2, lg: 3 }}>
            <Descriptions.Item label="模板名称">{activeTemplate.name}</Descriptions.Item>
            <Descriptions.Item label="所属店铺">{activeTemplate.shopName || activeTemplate.shop || shopLabel(shops.find((shop) => shop.id === activeTemplate.shopId) ?? ({ shop: '未知店铺' } as Shop))}</Descriptions.Item>
            <Descriptions.Item label="适用商品"><ProductTags products={activeTemplate.products} /></Descriptions.Item>
            <Descriptions.Item label="字体布局模板"><FontLayoutTags templates={activeTemplate.fontLayoutTemplates} /></Descriptions.Item>
            <Descriptions.Item label="当前尺寸方案">
              {detailOption ? (
                <Space size={4} wrap>
                  <Tag color="blue">{detailOption.label}</Tag>
                  {activeTemplate.sizeForm.status === 'needs_values' && <Tag color="warning">尺寸未完善</Tag>}
                </Space>
              ) : <Tag color="warning">待填写</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="单面尺寸">{detailValues.singleWidth} x {detailValues.singleHeight} {detailValues.unit}</Descriptions.Item>
            <Descriptions.Item label="书脊宽">{detailValues.spineWidth} {detailValues.unit}</Descriptions.Item>
            <Descriptions.Item label="四周出血">{detailValues.bleed} {detailValues.unit}</Descriptions.Item>
            <Descriptions.Item label="书脊出血">{detailValues.spineBleed} {detailValues.unit}</Descriptions.Item>
            <Descriptions.Item label="页数">{detailValues.pages}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{new Date(activeTemplate.updatedAt).toLocaleString()}</Descriptions.Item>
          </Descriptions>
        </div>
      </section>
    );
  }

  if (view === 'create' || (view === 'edit' && activeTemplate)) {
    const activeFontLayoutDraft = fontLayoutDraft && (focusedFontLayoutId || fontLayoutDialogOpen)
      ? fontLayoutDraft
      : undefined;
    return (
      <>
      <section className="panel size-template-subpage">
        <header className="panel-header size-template-subpage-header">
          <div className="size-template-subpage-title">
            <Button type="text" icon={<ArrowLeftOutlined />} aria-label="返回尺寸模板列表" onClick={backToList} />
            <div>
              <h1>{view === 'edit' ? '编辑尺寸模板' : '新增尺寸模板'}</h1>
              <p>{activeShopName}</p>
            </div>
          </div>
          <Space>
            <Button onClick={backToList}>取消</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={submitting} onClick={() => void submitTemplate()}>保存</Button>
          </Space>
        </header>
        <div className="size-template-design-workspace">
          <div className="size-template-form-surface">
            <Form
              form={form}
              layout="vertical"
              requiredMark="optional"
              className="size-template-form"
              onValuesChange={(_, values) => setPreviewValues(values)}
            >
              <div className="size-template-form-grid size-template-base-grid">
                <Form.Item name="shopId" label="所属店铺" rules={[{ required: true, message: '请选择店铺' }]}>
                  <Select
                    options={shops.map((shop) => ({ value: shop.id, label: shopLabel(shop) }))}
                    onChange={(shopId) => {
                      form.setFieldsValue({ products: [] });
                      setAvailableProducts(shops.find((shop) => shop.id === shopId)?.products ?? []);
                      setFontLayoutTemplates([]);
                      closeFontLayoutTemplate();
                      void loadShopProducts(shopId);
                      void loadFontLayoutTemplates(shopId);
                    }}
                  />
                </Form.Item>
                <Form.Item name="name" label="模板名称" rules={[{ required: true, whitespace: true, message: '请输入模板名称' }]}>
                  <Input placeholder="例如 12寸横版相册" maxLength={60} />
                </Form.Item>
                <Form.Item name="products" label="适用商品" rules={[{ required: true, type: 'array', min: 1, message: '请选择至少一个商品' }]}>
                  <Select
                    className="size-template-products-select"
                    mode="multiple"
                    showSearch={false}
                    optionFilterProp="label"
                    loading={loadingProducts}
                    maxTagCount={3}
                    maxTagTextLength={8}
                    maxTagPlaceholder={(omitted) => `+${omitted.length}`}
                    placeholder={loadingProducts ? '正在加载当前店铺商品' : '请选择当前店铺商品'}
                    notFoundContent={loadingProducts ? '正在加载...' : '当前店铺暂无商品'}
                    options={availableProducts.map((product) => ({ value: product, label: product }))}
                  />
                </Form.Item>
              </div>
              <div className="size-spec-manager">
                <div className="size-spec-header">
                  <div>
                    <strong>尺寸方案</strong>
                    <span>{sizeFormData?.status === 'needs_values' ? '待填写' : `${sizeFormData?.size_options.length ?? 0} 个方案`}</span>
                  </div>
                  <Space className="size-spec-actions" size={4}>
                    <Tooltip title="新增尺寸方案">
                      <Button icon={<PlusOutlined />} aria-label="新增尺寸方案" onClick={() => openSizeOptionDialog('create')}>新增</Button>
                    </Tooltip>
                    <Tooltip title="保存当前尺寸方案">
                      <Button icon={<SaveOutlined />} aria-label="保存当前尺寸方案" loading={optionSubmitting} disabled={!selectedOption} onClick={() => void saveSelectedSizeOption()}>保存</Button>
                    </Tooltip>
                    <Popconfirm
                      title="删除尺寸方案"
                      description={selectedOption ? `确定删除“${selectedOption.label}”吗？` : ''}
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      disabled={!selectedOption}
                      onConfirm={() => void deleteSizeOption()}
                    >
                      <Tooltip title="删除当前尺寸方案">
                        <Button danger icon={<DeleteOutlined />} aria-label="删除当前尺寸方案" disabled={!selectedOption}>删除</Button>
                      </Tooltip>
                    </Popconfirm>
                  </Space>
                </div>
                {sizeFormData?.status === 'needs_values' && (
                  <Alert
                    type="warning"
                    showIcon
                    title={selectedOption
                      ? `“${selectedOption.label || selectedOption.value}${selectedOption.label && selectedOption.label !== selectedOption.value ? `（${selectedOption.value}）` : ''}”尺寸方案还没有可用的尺寸数据`
                      : '该模板还没有可用的尺寸方案'}
                  />
                )}
                <Form.Item name="sizeOption" hidden rules={[{ required: Boolean(sizeFormData?.size_options.length), message: '请选择尺寸方案' }]}>
                  <Input />
                </Form.Item>
                <div className="size-option-menu" role="tablist" aria-label="尺寸方案">
                  {(sizeFormData?.size_options ?? []).map((option) => {
                    const displayUnit = optionUnit(option, selectedUnit);
                    const isSelected = option.value === selectedOptionValue;
                    const dropPosition = sizeOptionDropTarget?.value === option.value
                      ? sizeOptionDropTarget.position
                      : undefined;
                    return (
                      <button
                        className={`size-option-menu-item${isSelected ? ' selected' : ''}${draggedSizeOptionValue === option.value ? ' dragging' : ''}${dropPosition ? ` drop-${dropPosition}` : ''}`}
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        aria-label={`${option.label || option.value}，拖拽可调整顺序`}
                        title="拖拽调整顺序"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', option.value);
                          setDraggedSizeOptionValue(option.value);
                          setSizeOptionDropTarget(undefined);
                        }}
                        onDragOver={(event) => dragSizeOptionOver(event, option.value)}
                        onDrop={(event) => dropSizeOption(event, option.value)}
                        onDragEnd={finishSizeOptionDrag}
                        onClick={() => void applySizeSelection(option.value, displayUnit)}
                      >
                        <span className="size-option-menu-title"><HolderOutlined aria-hidden="true" /><strong>{option.label || option.value}</strong></span>
                        <small>{optionDimensionLabel(option, displayUnit)}</small>
                      </button>
                    );
                  })}
                  {(sizeFormData?.size_options ?? []).length === 0 && (
                    <div className="size-option-menu-empty">点击右上角“新增”添加尺寸方案</div>
                  )}
                </div>
                <div className="size-template-size-controls">
                <Form.Item name="unit" label="单位" rules={[{ required: true }]}>
                  <Select
                    options={(sizeFormData?.size_unit_options ?? ['in', 'mm', 'cm']).map((unit) => ({
                      value: unit,
                      label: unit,
                      disabled: view !== 'edit' || !activeTemplate
                        ? selectedOption ? !selectedOption[unit] : unit !== 'in'
                        : false
                    }))}
                    onChange={(unit: SizeTemplateUnit) => void applySizeSelection(form.getFieldValue('sizeOption'), unit)}
                  />
                </Form.Item>
                <Form.Item name="singleWidth" label="单面宽" rules={selectedOption ? [{ required: true, min: 0.01, type: 'number', message: '请输入大于 0 的单面宽' }] : []}>
                  <InputNumber min={0.01} precision={2} formatter={twoDecimalFormatter} disabled={!selectedOption} />
                </Form.Item>
                <Form.Item name="singleHeight" label="单面高" rules={selectedOption ? [{ required: true, min: 0.01, type: 'number', message: '请输入大于 0 的单面高' }] : []}>
                  <InputNumber min={0.01} precision={2} formatter={twoDecimalFormatter} disabled={!selectedOption} />
                </Form.Item>
                <Form.Item name="bleed" label="出血" rules={selectedOption ? [{ required: true, min: 0, type: 'number', message: '请输入不小于 0 的出血' }] : []}>
                  <InputNumber min={0} precision={2} formatter={twoDecimalFormatter} disabled={!selectedOption} />
                </Form.Item>
                <Form.Item
                  name="pages"
                  hidden
                  rules={selectedOption ? [{ required: true, min: 1, type: 'integer', message: '请选择大于 0 的整数页数' }] : []}
                >
                  <InputNumber />
                </Form.Item>
                <Form.Item className="page-count-form-item" label="页数" required={Boolean(selectedOption)}>
                  <div className="page-count-control">
                    <div className="page-count-options" role="listbox" aria-label="可选页数">
                      {pageCountOptions.map((count) => (
                        <div className="page-count-option-shell" key={count}>
                          <Button
                            className="page-count-option-value"
                            size="small"
                            type={selectedPageCount === count ? 'primary' : 'default'}
                            disabled={!selectedOption}
                            role="option"
                            aria-selected={selectedPageCount === count}
                            onClick={() => applyPageCount(count)}
                          >{count}</Button>
                          <Tooltip title={`删除 ${count} 页选项`}>
                            <Button
                              className="page-count-option-delete"
                              type="text"
                              size="small"
                              danger
                              icon={<CloseOutlined />}
                              disabled={!selectedOption}
                              aria-label={`删除 ${count} 页选项`}
                              onClick={() => removePageCountOption(count)}
                            />
                          </Tooltip>
                        </div>
                      ))}
                      {addingPageCount ? (
                        <InputNumber
                          className="page-count-option-input"
                          size="small"
                          min={1}
                          precision={0}
                          controls={false}
                          autoFocus
                          value={pageCountDraft}
                          onChange={setPageCountDraft}
                          onPressEnter={commitPageCountOption}
                          onBlur={() => {
                            if (pageCountDraft == null) setAddingPageCount(false);
                            else commitPageCountOption();
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== 'Escape') return;
                            pageCountCommitRef.current = true;
                            setAddingPageCount(false);
                            setPageCountDraft(null);
                          }}
                        />
                      ) : (
                        <Tooltip title="添加页数选项">
                          <Button
                            size="small"
                            icon={<PlusOutlined />}
                            disabled={!selectedOption}
                            aria-label="添加页数选项"
                            onClick={() => {
                              pageCountCommitRef.current = false;
                              setPageCountDraft(null);
                              setAddingPageCount(true);
                            }}
                          />
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </Form.Item>
                <Form.Item
                  className="spine-mode-form-item"
                  name="spineWidthMode"
                  label="背脊计算方式"
                  extra={selectedOption
                    ? selectedSpineWidthMode === 'by_page_count'
                      ? `按 ${selectedPageCount} 页计算，每页背脊宽会随页数生成。`
                      : '固定宽度，不随页数变化。'
                    : undefined}
                  rules={selectedOption ? [{ required: true }] : []}
                >
                  <Radio.Group
                    optionType="button"
                    buttonStyle="solid"
                    disabled={!selectedOption}
                    options={[{ value: 'fixed', label: '固定宽度' }, { value: 'by_page_count', label: '按页数' }]}
                  />
                </Form.Item>
                <Form.Item name="spineWidth" label={selectedSpineWidthMode === 'by_page_count' ? '每页背脊宽' : '背脊宽'} rules={selectedOption ? [{ required: true, min: 0, type: 'number', message: '请输入不小于 0 的背脊宽' }] : []}>
                  <InputNumber min={0} precision={2} formatter={twoDecimalFormatter} disabled={!selectedOption} />
                </Form.Item>
                <Form.Item name="spineBleed" label="背脊出血" rules={selectedOption ? [{ required: true, min: 0, type: 'number', message: '请输入不小于 0 的背脊出血' }] : []}>
                  <InputNumber min={0} precision={2} formatter={twoDecimalFormatter} disabled={!selectedOption} />
                </Form.Item>
                </div>
              </div>
            <section className="font-layout-association" aria-label="关联的字体布局">
              <div className="font-layout-association-heading">
                <div className="font-layout-association-copy"><strong>关联的字体布局</strong><span>选择要应用到模板中的文字布局。</span></div>
                <Space className="font-layout-actions" size={6} wrap={false}>
                  <Button size="small" icon={<PlusOutlined />} onClick={openNewFontLayoutTemplate}>新增</Button>
                  <Button
                    size="small"
                    icon={<SaveOutlined />}
                    loading={fontLayoutDialogSubmitting}
                    disabled={focusedFontLayoutId === undefined || !fontLayoutDraft}
                    onClick={() => void saveFontLayoutTemplate()}
                  >保存</Button>
                  <Popconfirm title="删除字体布局模板？" okText="删除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => void deleteFocusedFontLayoutTemplate()}>
                    <Button size="small" danger icon={<DeleteOutlined />} disabled={!focusedFontLayoutId}>删除</Button>
                  </Popconfirm>
                </Space>
              </div>
              <FontLayoutCardPicker
                selectedId={focusedFontLayoutId}
                templates={fontLayoutTemplates}
                loading={loadingFontLayouts}
                onRename={(templateId) => void openRenameFontLayout(templateId)}
                onSelect={(templateId) => templateId ? void openFontLayoutTemplate(templateId) : closeFontLayoutTemplate()}
              />
            </section>
            </Form>
            <div className="size-template-import-box">
              <div className="size-template-import-heading">
                <div><strong>导入 PSD / 图片模板</strong><span>分析图层、文字、字体和坐标，保存后可同步到全部尺寸方案。</span></div>
                <Button icon={<UploadOutlined />} loading={analyzingImport} onClick={() => importInputRef.current?.click()}>选择文件</Button>
                <input
                  ref={importInputRef}
                  type="file"
                  hidden
                  accept=".psd,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = '';
                    if (file) void analyzeImportFile(file);
                  }}
                />
              </div>
              <Checkbox checked={useAiSuggestions} onChange={(event) => setUseAiSuggestions(event.target.checked)}>
                使用 DeepSeek 字段语义建议（不修改坐标）
              </Checkbox>
              <Checkbox checked={strictFonts} onChange={(event) => setStrictFonts(event.target.checked)}>
                保存时严格校验每个文字块字体
              </Checkbox>
              {importedTemplate && (
                <Alert
                  className="size-template-import-success"
                  type="success"
                  showIcon
                  title={`已加载 ${Array.isArray(importedTemplate.elements) ? importedTemplate.elements.length : 0} 个识别元素`}
                  description={importWarnings.length > 0
                    ? `画布中的紫色框表示文字元素，灰色框表示图层或图片元素。识别提示：${importWarnings.join('；')}`
                    : '画布中的紫色框表示文字元素，灰色框表示图层或图片元素。保存时会提交二次编辑结果。'}
                />
              )}
            </div>
            {activeFontLayoutDraft ? (
              <TemplateElementEditor
                template={activeFontLayoutDraft}
                fonts={fonts}
                sizeValues={previewValues}
                selectedElementId={selectedElementId}
                onSelect={setSelectedElementId}
                onChange={updateFontLayoutFromEditor}
              />
            ) : importedTemplate ? (
              <TemplateElementEditor
                template={importedTemplate}
                fonts={fonts}
                sizeValues={previewValues}
                selectedElementId={selectedElementId}
                onSelect={setSelectedElementId}
                onChange={updateImportedLayoutFromEditor}
              />
            ) : null}
          </div>
          <FabricTemplateCanvas
            values={previewValues}
            template={activeFontLayoutDraft ?? importedTemplate}
            selectedElementId={selectedElementId}
            onTemplateChange={activeFontLayoutDraft ? setFontLayoutDraft : setImportedTemplate}
            onElementSelect={setSelectedElementId}
          />
        </div>
      </section>
      <Modal
        title={fontLayoutEditingId || (focusedFontLayoutId !== undefined && focusedFontLayoutId < 0) ? '修改字体布局名称' : '新增字体布局'}
        open={fontLayoutDialogOpen}
        width={480}
        confirmLoading={fontLayoutDialogSubmitting}
        okText="保存"
        cancelText="取消"
        onOk={() => void saveFontLayoutTemplate()}
        onCancel={() => {
          if (!fontLayoutDialogSubmitting) setFontLayoutDialogOpen(false);
        }}
        destroyOnHidden
      >
        <Form layout="vertical" requiredMark="optional">
          <Form.Item label="字体名" required>
            <Input
              autoFocus
              value={fontLayoutName}
              placeholder="例如：封面标题"
              onChange={(event) => setFontLayoutName(event.target.value)}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={optionDialog?.mode === 'edit' ? '编辑尺寸方案' : '新增尺寸方案'}
        open={Boolean(optionDialog)}
        confirmLoading={optionSubmitting}
        okText="保存"
        cancelText="取消"
        onOk={() => void submitSizeOption()}
        onCancel={() => {
          if (!optionSubmitting) setOptionDialog(undefined);
        }}
      >
        <Form form={optionForm} layout="vertical" requiredMark="optional">
          <div className="size-spec-form-grid">
            <Form.Item name="value" label="方案值" rules={[{ required: true, whitespace: true, message: '请输入方案值' }]}>
              <Input placeholder="例如 9x6" />
            </Form.Item>
            <Form.Item name="label" label="显示名称" rules={[{ required: true, whitespace: true, message: '请输入显示名称' }]}>
              <Input placeholder="例如 9*6" />
            </Form.Item>
            <Form.Item name="unit" label="尺寸单位" rules={[{ required: true, message: '请选择尺寸单位' }]}>
              <Select options={[{ value: 'in', label: 'in' }, { value: 'mm', label: 'mm' }, { value: 'cm', label: 'cm' }]} />
            </Form.Item>
            <Form.Item name="spineWidthMode" label="背脊计算方式" rules={[{ required: true }]}>
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                options={[{ value: 'fixed', label: '固定宽度' }, { value: 'by_page_count', label: '按页数' }]}
              />
            </Form.Item>
            <Form.Item name="singleWidth" label="单面宽" rules={[{ required: true, min: 0.01, type: 'number', message: '请输入大于 0 的单面宽' }]}>
              <InputNumber min={0.01} precision={2} formatter={twoDecimalFormatter} />
            </Form.Item>
            <Form.Item name="singleHeight" label="单面高" rules={[{ required: true, min: 0.01, type: 'number', message: '请输入大于 0 的单面高' }]}>
              <InputNumber min={0.01} precision={2} formatter={twoDecimalFormatter} />
            </Form.Item>
            <Form.Item name="bleed" label="出血" rules={[{ required: true, min: 0, type: 'number', message: '请输入不小于 0 的出血' }]}>
              <InputNumber min={0} precision={2} formatter={twoDecimalFormatter} />
            </Form.Item>
            <Form.Item name="spineWidth" label="背脊宽" rules={[{ required: true, min: 0, type: 'number', message: '请输入不小于 0 的背脊宽' }]}>
              <InputNumber min={0} precision={2} formatter={twoDecimalFormatter} />
            </Form.Item>
            <Form.Item name="spineBleed" label="背脊出血" rules={[{ required: true, min: 0, type: 'number', message: '请输入不小于 0 的背脊出血' }]}>
              <InputNumber min={0} precision={2} formatter={twoDecimalFormatter} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
      </>
    );
  }

  return (
    <section className="panel size-templates-panel">
      <header className="panel-header size-templates-header">
        <div className="size-templates-heading">
          <h1>尺寸模板管理</h1>
          <p>{activeShopName} · {filteredTemplates.length} 个模板</p>
        </div>
        <Space className="size-templates-toolbar" wrap>
          <Input allowClear prefix={<SearchOutlined />} placeholder="搜索模板或商品" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          <Button type="primary" icon={<PlusOutlined />} disabled={shops.length === 0} onClick={() => openTemplateForm()}>新增模板</Button>
        </Space>
      </header>

      <div className="table-card size-templates-table-card">
          <Table<SizeTemplate>
            rowKey="id"
            columns={columns}
            dataSource={filteredTemplates}
            loading={loading}
            pagination={{ pageSize: 12, showSizeChanger: false, hideOnSinglePage: true }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={shops.length === 0 ? '请先新增店铺' : '该分类下暂无尺寸模板'} /> }}
          />
      </div>

    </section>
  );
}
