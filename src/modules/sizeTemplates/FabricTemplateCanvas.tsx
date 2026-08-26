import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as fabric from 'fabric';
import type { TemplateImportDraft } from '@shared/domain';
import { fitTextObjectToFrame, textFrameFromObject } from './fabricTextGeometry';

type PreviewValues = {
  sizeOption?: string;
  unit?: string;
  singleWidth?: number;
  singleHeight?: number;
  spineWidth?: number;
  spineBleed?: number;
  bleed?: number;
  backgroundColor?: string;
};

type FabricTemplateCanvasProps = {
  values: PreviewValues;
  template?: TemplateImportDraft;
  selectedElementId?: string;
  onTemplateChange?: (template: TemplateImportDraft) => void;
  onElementSelect?: (elementId: string) => void;
};

export type FabricTemplateCanvasHandle = {
  exportPng(): void;
};

type TemplateElement = Record<string, unknown>;

class WordSpacingIText extends fabric.IText {
  wordSpacing = 0;

  _getGraphemeBox(grapheme: string, lineIndex: number, charIndex: number, prevGrapheme?: string) {
    const box = super._getGraphemeBox(grapheme, lineIndex, charIndex, prevGrapheme);
    if ((grapheme === ' ' || grapheme === '\t') && Number.isFinite(this.wordSpacing)) {
      box.width += this.wordSpacing;
      box.kernedWidth += this.wordSpacing;
    }
    return box;
  }
}

type GuideLayout = {
  singleWidth: number;
  singleHeight: number;
  spineWidth: number;
  spineBleed: number;
  bleed: number;
  scale: number;
  trimX: number;
  trimY: number;
  trimWidth: number;
  trimHeight: number;
  spineX: number;
  coverX: number;
  outerX: number;
  outerWidth: number;
};

type ElementBounds = { left: number; top: number; width: number; height: number };
type ElementRegion = 'back' | 'spine' | 'cover';
type ElementRegionBounds = Record<ElementRegion, ElementBounds>;

const MAX_REFERENCE_DIMENSION = 20_000;
const MAX_PHYSICAL_VALUE = 1_000_000;
const MAX_OBJECT_SIZE_FACTOR = 4;
const MAX_RENDERED_TEXT_LENGTH = 5_000;
const fontLoadCache = new Map<string, Promise<void>>();

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = numberValue(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function limitedNumber(value: unknown, fallback: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, numberValue(value, fallback)));
}

function frameValue(element: TemplateElement): Record<string, unknown> {
  const frame = recordValue(element.frame);
  const base = recordValue(frame.reference_px ?? frame.reference ?? frame);
  const override = recordValue(frame.edited_px ?? frame.current_px ?? frame.preview_px);
  return {
    ...base,
    ...override,
    ...(Object.prototype.hasOwnProperty.call(frame, 'relative') ? { relative: frame.relative } : {})
  };
}

function displayFrame(
  element: TemplateElement,
  referenceWidth: number,
  referenceHeight: number
): Record<string, unknown> {
  const frame = frameValue(element);
  const relative = recordValue(frame.relative);
  const relativeX = numberValue(relative.x, Number.NaN);
  const relativeY = numberValue(relative.y, Number.NaN);
  const relativeWidth = numberValue(relative.width, Number.NaN);
  const relativeHeight = numberValue(relative.height, Number.NaN);
  const x = numberValue(frame.x, Number.NaN);
  const y = numberValue(frame.y, Number.NaN);
  const width = numberValue(frame.width, Number.NaN);
  const height = numberValue(frame.height, Number.NaN);
  const outsideReference = !Number.isFinite(x)
    || !Number.isFinite(y)
    || !Number.isFinite(width)
    || !Number.isFinite(height)
    || x < -referenceWidth * 0.25
    || y < -referenceHeight * 0.25
    || x + width > referenceWidth * 1.25
    || y + height > referenceHeight * 1.25
    || width > referenceWidth * 1.25
    || height > referenceHeight * 1.25;
  if (outsideReference
    && Number.isFinite(relativeX)
    && Number.isFinite(relativeY)
    && Number.isFinite(relativeWidth)
    && Number.isFinite(relativeHeight)
    && relativeX >= 0
    && relativeY >= 0
    && relativeWidth > 0
    && relativeHeight > 0) {
    return {
      ...frame,
      x: relativeX * referenceWidth,
      y: relativeY * referenceHeight,
      width: relativeWidth * referenceWidth,
      height: relativeHeight * referenceHeight
    };
  }
  return frame;
}

function elementList(template?: TemplateImportDraft): TemplateElement[] {
  if (!Array.isArray(template?.elements)) return [];
  return template.elements
    .map((element, index) => ({ element, index }))
    .filter((item): item is { element: TemplateElement; index: number } => Boolean(item.element && typeof item.element === 'object'))
    .sort((left, right) => numberValue(left.element.z_index, left.index) - numberValue(right.element.z_index, right.index))
    .map(({ element }) => element);
}

function referenceSize(template?: TemplateImportDraft): { width: number; height: number } {
  const canvas = recordValue(template?.canvas);
  return {
    width: Math.min(MAX_REFERENCE_DIMENSION, positiveNumber(canvas.width, 1000)),
    height: Math.min(MAX_REFERENCE_DIMENSION, positiveNumber(canvas.height, 800))
  };
}

function imageSource(element: TemplateElement): string {
  const asset = recordValue(element.asset);
  return String(asset.url ?? asset.data_url ?? asset.dataUrl ?? '').trim();
}

function textValue(element: TemplateElement): string {
  // Text whitespace is meaningful, especially trailing spaces in editable copy.
  return String(element.text ?? element.name ?? '');
}

async function ensureElementFont(font: Record<string, unknown>): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
  const family = String(font.font_family ?? font.font_name ?? font.family ?? '').trim();
  const source = String(font.file_path ?? font.file_url ?? font.url ?? '').trim();
  if (!family || !source) return;
  const key = `${family}\n${source}`;
  let pending = fontLoadCache.get(key);
  if (!pending) {
    pending = (async () => {
      const face = new FontFace(family, `url(${JSON.stringify(source)})`);
      const loaded = await face.load();
      document.fonts.add(loaded);
    })().catch(() => undefined);
    fontLoadCache.set(key, pending);
  }
  await pending;
}

function setElementId(object: fabric.FabricObject, elementId: string): void {
  object.set('elementId', elementId);
  object.set('templateElement', true);
}

function addGuideText(instance: fabric.Canvas, text: string, left: number, top: number, options: Partial<fabric.ITextProps> = {}): void {
  const label = new fabric.Text(text, {
    left,
    top,
    fill: '#536179',
    fontFamily: 'Microsoft YaHei, sans-serif',
    fontSize: 14,
    fontWeight: '600',
    selectable: false,
    evented: false,
    excludeFromExport: true,
    ...options
  });
  label.set('templateGuide', true);
  instance.add(label);
}

function guideLayout(width: number, height: number, values: PreviewValues): GuideLayout {
  const singleWidth = Math.min(MAX_PHYSICAL_VALUE, positiveNumber(values.singleWidth, width / 3));
  const singleHeight = Math.min(MAX_PHYSICAL_VALUE, positiveNumber(values.singleHeight, height));
  const spineWidth = limitedNumber(values.spineWidth, 0, 0, MAX_PHYSICAL_VALUE);
  const spineBleed = limitedNumber(values.spineBleed, 0, 0, MAX_PHYSICAL_VALUE);
  const bleed = limitedNumber(values.bleed, 0, 0, MAX_PHYSICAL_VALUE);
  // Each single side includes the adjacent spine bleed in the canvas layout.
  // Regular bleed is the only additional outer export margin.
  const panelPhysicalWidth = singleWidth + spineBleed;
  const trimPhysicalWidth = panelPhysicalWidth * 2 + spineWidth;
  const physicalWidth = Math.max(0.01, trimPhysicalWidth + bleed * 2);
  const scale = Math.min(width / physicalWidth, height / Math.max(0.01, singleHeight + bleed * 2));
  const trimWidth = trimPhysicalWidth * scale;
  const trimHeight = singleHeight * scale;
  const outerX = (width - physicalWidth * scale) / 2;
  const trimX = outerX + bleed * scale;
  const trimY = (height - trimHeight) / 2;
  const spineX = trimX + panelPhysicalWidth * scale;
  return {
    singleWidth,
    singleHeight,
    spineWidth,
    spineBleed,
    bleed,
    scale,
    trimX,
    trimY,
    trimWidth,
    trimHeight,
    outerX,
    outerWidth: physicalWidth * scale,
    spineX,
    coverX: spineX + spineWidth * scale
  };
}

function clampObjectToBounds(
  object: fabric.FabricObject,
  bounds: ElementBounds,
  allowHorizontalOverflow = false
): boolean {
  if (object.get('allowOverflow') === true) return false;
  object.setCoords();
  let rect = object.getBoundingRect();
  let changed = false;
  const fitScale = Math.min(
    1,
    allowHorizontalOverflow
      ? 1
      : rect.width > 0 && bounds.width > 0 ? bounds.width / rect.width : 1,
    rect.height > 0 && bounds.height > 0 ? bounds.height / rect.height : 1
  );
  if (fitScale < 0.9999) {
    object.set({
      scaleX: numberValue(object.scaleX, 1) * fitScale,
      scaleY: numberValue(object.scaleY, 1) * fitScale
    });
    object.setCoords();
    rect = object.getBoundingRect();
    changed = true;
  }
  const right = bounds.left + bounds.width;
  const bottom = bounds.top + bounds.height;
  let deltaX = 0;
  let deltaY = 0;
  if (!allowHorizontalOverflow) {
    if (rect.width > bounds.width) deltaX = bounds.left + bounds.width / 2 - (rect.left + rect.width / 2);
    else if (rect.left < bounds.left) deltaX = bounds.left - rect.left;
    else if (rect.left + rect.width > right) deltaX = right - rect.left - rect.width;
  }
  if (rect.height > bounds.height) deltaY = bounds.top + bounds.height / 2 - (rect.top + rect.height / 2);
  else if (rect.top < bounds.top) deltaY = bounds.top - rect.top;
  else if (rect.top + rect.height > bottom) deltaY = bottom - rect.top - rect.height;
  if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
    object.set({
      left: numberValue(object.left) + deltaX,
      top: numberValue(object.top) + deltaY
    });
    object.setCoords();
    changed = true;
  }
  return changed;
}

function objectRegion(object: fabric.FabricObject, bounds: ElementRegionBounds): ElementRegion {
  object.setCoords();
  const rect = object.getBoundingRect();
  const centerX = rect.left + rect.width / 2;
  return bounds.spine.width > 0
    && centerX >= bounds.spine.left
    && centerX <= bounds.spine.left + bounds.spine.width
    ? 'spine'
    : centerX < bounds.spine.left
      ? 'back'
      : 'cover';
}

function clampObjectToRegion(object: fabric.FabricObject, bounds: ElementRegionBounds): boolean {
  const region = objectRegion(object, bounds);
  return clampObjectToBounds(object, bounds[region], region === 'spine');
}

function clampMovingObject(object: fabric.FabricObject, bounds: ElementRegionBounds): boolean {
  if (object.get('allowOverflow') === true) return false;
  const region = objectRegion(object, bounds);
  object.setCoords();
  const rect = object.getBoundingRect();
  const regionBounds = bounds[region];
  const right = regionBounds.left + regionBounds.width;
  const bottom = regionBounds.top + regionBounds.height;
  let deltaX = 0;
  let deltaY = 0;
  if (region === 'back' && rect.left < regionBounds.left) deltaX = regionBounds.left - rect.left;
  if (region === 'cover' && rect.left + rect.width > right) deltaX = right - rect.left - rect.width;
  if (rect.height > regionBounds.height) deltaY = regionBounds.top + regionBounds.height / 2 - (rect.top + rect.height / 2);
  else if (rect.top < regionBounds.top) deltaY = regionBounds.top - rect.top;
  else if (rect.top + rect.height > bottom) deltaY = bottom - rect.top - rect.height;
  if (Math.abs(deltaX) <= 0.01 && Math.abs(deltaY) <= 0.01) return false;
  object.set({
    left: numberValue(object.left) + deltaX,
    top: numberValue(object.top) + deltaY
  });
  object.setCoords();
  return true;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select'
    || target.isContentEditable;
}

function addGuideObjects(instance: fabric.Canvas, width: number, height: number, values: PreviewValues): void {
  instance.backgroundColor = values.backgroundColor || '#ffffff';
  const {
    singleWidth,
    singleHeight,
    spineWidth,
    spineBleed,
    bleed,
    scale,
    trimX,
    trimY,
    trimWidth,
    trimHeight,
    outerX,
    outerWidth,
    spineX,
    coverX
  } = guideLayout(width, height, values);
  const panelWidth = (singleWidth + spineBleed) * scale;
  instance.add(new fabric.Rect({
    left: outerX,
    top: trimY - bleed * scale,
    width: outerWidth,
    height: trimHeight + bleed * scale * 2,
    fill: 'transparent',
    stroke: '#ef8a42',
    strokeDashArray: [8, 5],
    strokeWidth: 1,
    selectable: false,
    evented: false,
    excludeFromExport: true
  }));
  instance.add(new fabric.Rect({
    left: trimX,
    top: trimY,
    width: trimWidth,
    height: trimHeight,
    fill: 'transparent',
    stroke: '#8aa8d8',
    strokeWidth: 1,
    selectable: false,
    evented: false,
    excludeFromExport: true
  }));
  instance.add(new fabric.Line([spineX, trimY, spineX, trimY + trimHeight], {
    stroke: '#7a8ca8',
    strokeWidth: 1,
    selectable: false,
    evented: false,
    excludeFromExport: true
  }));
  instance.add(new fabric.Line([coverX, trimY, coverX, trimY + trimHeight], {
    stroke: '#7a8ca8',
    strokeWidth: 1,
    selectable: false,
    evented: false,
    excludeFromExport: true
  }));
  const spineBleedPixels = Math.min(singleWidth * scale / 3, spineBleed * scale);
  if (spineBleedPixels > 0) {
    [spineX - spineBleedPixels, coverX + spineBleedPixels].forEach((x) => {
      instance.add(new fabric.Line([x, trimY, x, trimY + trimHeight], {
        stroke: '#0891b2',
        strokeWidth: 1.5,
        strokeDashArray: [6, 4],
        selectable: false,
        evented: false,
        excludeFromExport: true
      }));
    });
  }

  const unit = values.unit ?? 'mm';
  const coverLabelY = Math.max(8, trimY - 28);
  addGuideText(instance, '封底', trimX + panelWidth / 2, coverLabelY, {
    originX: 'center',
    fontSize: 13
  });
  addGuideText(instance, '书脊', spineX + (spineWidth * scale) / 2, coverLabelY, {
    originX: 'center',
    fontSize: 13
  });
  addGuideText(instance, '封面', coverX + panelWidth / 2, coverLabelY, {
    originX: 'center',
    fontSize: 13
  });
  const dimensionY = Math.min(height - 48, trimY + trimHeight + 14);
  addGuideText(instance, `${twoDecimalNumber(singleWidth + spineBleed)} × ${twoDecimalNumber(singleHeight)} ${unit}`, trimX + panelWidth / 2, dimensionY, {
    originX: 'center',
    fontSize: 11,
    fontWeight: 'normal'
  });
  addGuideText(instance, `${twoDecimalNumber(singleWidth + spineBleed)} × ${twoDecimalNumber(singleHeight)} ${unit}`, coverX + panelWidth / 2, dimensionY, {
    originX: 'center',
    fontSize: 11,
    fontWeight: 'normal'
  });
  addGuideText(
    instance,
    `成品 ${twoDecimalNumber(singleWidth * 2 + spineWidth + spineBleed * 2)} × ${twoDecimalNumber(singleHeight)} ${unit}`,
    width / 2,
    Math.min(height - 30, trimY + trimHeight + 30),
    { originX: 'center', fontSize: 12, fontWeight: 'normal' }
  );
  addGuideText(
    instance,
    `出血 ${twoDecimalNumber(bleed)} ${unit} · 背脊出血 ${twoDecimalNumber(spineBleed)} ${unit}`,
    width / 2,
    Math.min(height - 8, trimY + trimHeight + 46),
    { originX: 'center', fontSize: 12, fontWeight: 'normal', fill: '#64748b' }
  );
}

function twoDecimalNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
}

async function elementObject(
  element: TemplateElement,
  referenceWidth: number,
  referenceHeight: number
): Promise<fabric.FabricObject> {
  const id = String(element.id || 'element');
  const type = String(element.type || 'layer').toLowerCase();
  const frame = displayFrame(element, referenceWidth, referenceHeight);
  const font = recordValue(element.font);
  const style = recordValue(element.style);
  const transform = recordValue(element.transform);
  const appearance = recordValue(element.appearance);
  const asset = recordValue(element.asset);
  const isRectangle = type === 'image'
    && (appearance.shape === 'rectangle' || asset.kind === 'rectangle');
  const rawText = textValue(element);
  const text = rawText.length > MAX_RENDERED_TEXT_LENGTH ? `${rawText.slice(0, MAX_RENDERED_TEXT_LENGTH)}…` : rawText;
  const maxObjectWidth = Math.max(1, referenceWidth * MAX_OBJECT_SIZE_FACTOR);
  const maxObjectHeight = Math.max(1, referenceHeight * MAX_OBJECT_SIZE_FACTOR);
  const width = Math.min(maxObjectWidth, positiveNumber(frame.width, type === 'text' ? Math.max(120, referenceWidth * 0.3) : referenceWidth * 0.25));
  const height = Math.min(maxObjectHeight, positiveNumber(frame.height, type === 'text' ? Math.max(36, referenceHeight * 0.08) : referenceHeight * 0.25));
  const left = limitedNumber(frame.x, 0, -maxObjectWidth, maxObjectWidth);
  const top = limitedNumber(frame.y, 0, -maxObjectHeight, maxObjectHeight);
  const angle = numberValue(transform.rotation_deg ?? transform.rotation) % 360;
  const flipX = Boolean(transform.flip_horizontal ?? transform.flipX);
  const flipY = Boolean(transform.flip_vertical ?? transform.flipY);

  if (type === 'text') {
    const vertical = Boolean(style.vertical) || String(style.writing_mode || '') === 'vertical';
    // Vertical Latin text is one upright character per line; preserve spaces as word gaps.
    const displayText = vertical ? Array.from(text.replace(/\r?\n/g, '')).join('\n') : text;
    const fontSize = limitedNumber(font.size_px, 32, 1, Math.max(referenceWidth, referenceHeight) * 2);
    const tracking = limitedNumber(font.tracking, 0, -10_000, 10_000);
    const wordSpacing = limitedNumber(font.word_spacing, 0, -10_000, 10_000);
    const leadingPx = limitedNumber(font.leading_px, fontSize * 1.2, fontSize, Math.max(referenceWidth, referenceHeight) * 4);
    const verticalTrackingPx = tracking / 1000 * fontSize;
    await ensureElementFont(font);
    const object = new WordSpacingIText(displayText || '文字', {
      fontFamily: String(font.font_family ?? font.font_name ?? font.family ?? 'Microsoft YaHei'),
      fontSize,
      fontWeight: font.bold ? 'bold' : 'normal',
      fontStyle: font.italic ? 'italic' : 'normal',
      fill: String(style.fill_color ?? font.color ?? '#172033'),
      strokeWidth: 0,
      textAlign: 'left',
      lineHeight: (leadingPx + (vertical ? verticalTrackingPx : 0)) / fontSize,
      charSpacing: vertical ? 0 : tracking,
      angle,
      flipX,
      flipY,
      editable: true,
      lockScalingX: true,
      lockScalingY: true,
      objectCaching: false,
      padding: 0
    } as any);
    object.wordSpacing = vertical ? 0 : wordSpacing;
    object.set('allowOverflow', element.allow_overflow === true);
    fitTextObjectToFrame(object, { x: left, y: top, width, height });
    object.setControlsVisibility({
      mt: false,
      mb: false,
      ml: false,
      mr: false,
      tl: false,
      tr: false,
      bl: false,
      br: false,
      mtr: true
    });
    object.set('verticalText', vertical);
    object.set('renderTextTruncated', rawText.length > MAX_RENDERED_TEXT_LENGTH);
    object.set('renderedTextSnapshot', String(object.text || ''));
    setElementId(object, id);
    return object;
  }

  const source = imageSource(element);
  if (type === 'image' && source) {
    try {
      const image = await fabric.FabricImage.fromURL(source);
      const naturalWidth = Math.max(1, image.width || width);
      const naturalHeight = Math.max(1, image.height || height);
      image.set({
        left,
        top,
        scaleX: width / naturalWidth,
        scaleY: height / naturalHeight,
        angle,
        flipX,
        flipY,
        opacity: Math.max(0, Math.min(1, numberValue(appearance.opacity, 100) / 100))
      });
      image.set('allowOverflow', element.allow_overflow === true);
      setElementId(image, id);
      return image;
    } catch {
      // Keep an editable placeholder when an asset URL cannot be loaded.
    }
  }

  const object = new fabric.Rect({
    left,
    top,
    width,
    height,
    fill: isRectangle
      ? String(appearance.fill_color || '#1677ff')
      : type === 'image' ? 'rgba(37, 99, 235, 0.14)' : 'rgba(100, 116, 139, 0.14)',
    stroke: isRectangle ? undefined : type === 'image' ? '#2563eb' : '#64748b',
    strokeDashArray: isRectangle ? undefined : [5, 4],
    strokeWidth: isRectangle ? 0 : 1,
    angle,
    flipX,
    flipY,
    opacity: Math.max(0, Math.min(1, numberValue(appearance.opacity, 100) / 100)),
    padding: isRectangle ? 0 : 4
  });
  object.set('allowOverflow', element.allow_overflow === true);
  if (type !== 'image') {
    object.set({ lockScalingX: true, lockScalingY: true });
    object.setControlsVisibility({
      mt: false,
      mb: false,
      ml: false,
      mr: false,
      tl: false,
      tr: false,
      bl: false,
      br: false
    });
  }
  setElementId(object, id);
  return object;
}

function elementWithObjectState(item: TemplateElement, object: fabric.FabricObject): TemplateElement {
  const frame = recordValue(item.frame);
  object.setCoords();
  const isText = String(item.type || '').toLowerCase() === 'text';
  const geometry = (() => {
    if (isText) {
      return textFrameFromObject(object);
    }
    const visualFrame = object.getBoundingRect();
    return {
      x: numberValue(visualFrame.left, numberValue(object.left)),
      y: numberValue(visualFrame.top, numberValue(object.top)),
      width: Math.max(1, numberValue(visualFrame.width, numberValue(frame.width, 1))),
      height: Math.max(1, numberValue(visualFrame.height, numberValue(frame.height, 1)))
    };
  })();
  const nextFrame = {
    ...frame,
    ...geometry,
    ...(frame.reference_px ? { reference_px: { ...recordValue(frame.reference_px), ...geometry } } : {}),
    ...(frame.edited_px ? { edited_px: { ...recordValue(frame.edited_px), ...geometry } } : {})
  };
  const transform = {
    ...recordValue(item.transform),
    rotation_deg: numberValue(object.angle),
    flip_horizontal: Boolean(object.flipX),
    flip_vertical: Boolean(object.flipY)
  };
  const next: TemplateElement = { ...item, frame: nextFrame, transform };
  if (isText) {
    const textObject = object as fabric.IText;
    const vertical = Boolean(object.get('verticalText'));
    const renderedText = String(textObject.text || '');
    const renderedTextSnapshot = String(object.get('renderedTextSnapshot') || '');
    if (!object.get('renderTextTruncated') || renderedText !== renderedTextSnapshot) {
      next.text = vertical ? renderedText.replace(/\n/g, '') : renderedText;
    }
    next.font = {
      ...recordValue(item.font),
      // The backend font size is the layout value. Rotation and region
      // constraints use a uniform object scale and must not alter it.
      size_px: numberValue(recordValue(item.font).size_px, numberValue(textObject.fontSize)),
      font_family: String(textObject.fontFamily || ''),
      bold: textObject.fontWeight === 'bold' || numberValue(textObject.fontWeight) >= 600,
      italic: textObject.fontStyle === 'italic',
      word_spacing: numberValue((textObject as WordSpacingIText).wordSpacing, numberValue(recordValue(item.font).word_spacing))
    };
    next.style = {
      ...recordValue(item.style),
      fill_color: String(textObject.fill || '')
    };
  }
  return next;
}

const FabricTemplateCanvas = forwardRef<FabricTemplateCanvasHandle, FabricTemplateCanvasProps>(function FabricTemplateCanvas({
  values,
  template,
  selectedElementId,
  onTemplateChange,
  onElementSelect
}: FabricTemplateCanvasProps, ref) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const templateRef = useRef(template);
  const selectedElementRef = useRef(selectedElementId);
  const onTemplateChangeRef = useRef(onTemplateChange);
  const onElementSelectRef = useRef(onElementSelect);
  const renderVersionRef = useRef(0);
  const renderingRef = useRef(false);
  const elementBoundsRef = useRef<ElementRegionBounds>({
    back: { left: 0, top: 0, width: 500, height: 800 },
    spine: { left: 500, top: 0, width: 0, height: 800 },
    cover: { left: 500, top: 0, width: 500, height: 800 }
  });

  templateRef.current = template;
  selectedElementRef.current = selectedElementId;
  onTemplateChangeRef.current = onTemplateChange;
  onElementSelectRef.current = onElementSelect;
  const currentReference = referenceSize(template);

  const exportPng = () => {
    const instance = fabricCanvasRef.current;
    if (!instance) return;
    const layout = guideLayout(currentReference.width, currentReference.height, values);
    const bleedPixels = Math.max(0, layout.bleed * layout.scale);
    const horizontalBleedPixels = Math.max(0, layout.bleed * layout.scale);
    const left = Math.max(0, layout.trimX - horizontalBleedPixels);
    const top = Math.max(0, layout.trimY - bleedPixels);
    const right = Math.min(currentReference.width, layout.trimX + layout.trimWidth + horizontalBleedPixels);
    const bottom = Math.min(currentReference.height, layout.trimY + layout.trimHeight + bleedPixels);
    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const previousViewport: fabric.TMat2D = instance.viewportTransform
      ? [...instance.viewportTransform] as fabric.TMat2D
      : [1, 0, 0, 1, 0, 0];
    try {
      instance.setViewportTransform([1, 0, 0, 1, 0, 0]);
      const dataUrl = instance.toDataURL({ format: 'png', left, top, width, height, multiplier: 2 });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `template-${values.sizeOption || 'preview'}.png`;
      link.click();
    } finally {
      instance.setViewportTransform(previousViewport);
      instance.requestRenderAll();
    }
  };

  useImperativeHandle(ref, () => ({ exportPng }), [exportPng]);

  function fitCanvas(instance: fabric.Canvas, width: number, height: number) {
    const stage = stageRef.current;
    if (!stage) return;
    const availableWidth = stage.clientWidth;
    const availableHeight = stage.clientHeight;
    if (availableWidth <= 0 || availableHeight <= 0) return;
    const scale = Math.min(availableWidth / width, availableHeight / height);
    const offsetX = (availableWidth - width * scale) / 2;
    const offsetY = (availableHeight - height * scale) / 2;
    instance.setDimensions({ width: availableWidth, height: availableHeight });
    instance.setViewportTransform([scale, 0, 0, scale, offsetX, offsetY]);
    instance.calcOffset();
    instance.requestRenderAll();
  }

  function syncObject(object: fabric.FabricObject) {
    const elementId = String(object.get('elementId') || '');
    const currentTemplate = templateRef.current;
    const change = onTemplateChangeRef.current;
    if (!elementId || !currentTemplate || !change) return;
    const elements = elementList(currentTemplate);
    const nextElements = elements.map((item) => {
      if (String(item.id || '') !== elementId) return item;
      return elementWithObjectState(item, object);
    });
    const nextTemplate = { ...currentTemplate, elements: nextElements };
    change(nextTemplate);
  }

  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;
    const instance = new fabric.Canvas(canvasRef.current, {
      width: 1,
      height: 1,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      selection: true
    });
    fabricCanvasRef.current = instance;
    const selectObject = (event: { selected?: fabric.FabricObject[]; target?: fabric.FabricObject }) => {
      const object = event.selected?.[0] ?? event.target;
      const elementId = object?.get('elementId');
      if (elementId) onElementSelectRef.current?.(String(elementId));
    };
    const clearSelection = () => {
      if (!renderingRef.current) onElementSelectRef.current?.('');
    };
    const constrainObject = (event: { target?: fabric.FabricObject }) => {
      if (!event.target?.get('elementId')) return;
      if (clampMovingObject(event.target, elementBoundsRef.current)) instance.requestRenderAll();
    };
    const constrainTransformedObject = (event: { target?: fabric.FabricObject }) => {
      if (!event.target?.get('elementId')) return;
      if (clampObjectToRegion(event.target, elementBoundsRef.current)) instance.requestRenderAll();
    };
    const modifyObject = (event: { target?: fabric.FabricObject }) => {
      if (!event.target) return;
      clampObjectToRegion(event.target, elementBoundsRef.current);
      syncObject(event.target);
    };
    const moveSelectedObject = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return;
      const movement = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }
      }[event.key];
      if (!movement) return;
      const object = instance.getActiveObject();
      if (!object?.get('elementId')) return;
      if (object instanceof fabric.IText && object.isEditing) return;
      event.preventDefault();
      object.set({
        left: numberValue(object.left) + movement.x,
        top: numberValue(object.top) + movement.y
      });
      object.setCoords();
      clampMovingObject(object, elementBoundsRef.current);
      instance.requestRenderAll();
      syncObject(object);
    };
    const finishKeyboardMove = (event: KeyboardEvent) => {
      if (isEditableKeyboardTarget(event.target)) return;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const object = instance.getActiveObject();
      if (!object?.get('elementId')) return;
      if (object instanceof fabric.IText && object.isEditing) return;
      if (clampObjectToRegion(object, elementBoundsRef.current)) instance.requestRenderAll();
      syncObject(object);
    };
    instance.on('selection:created', selectObject);
    instance.on('selection:updated', selectObject);
    instance.on('selection:cleared', clearSelection);
    instance.on('object:moving', constrainObject);
    instance.on('object:scaling', constrainTransformedObject);
    instance.on('object:rotating', constrainTransformedObject);
    instance.on('object:modified', modifyObject);
    instance.on('text:editing:exited', modifyObject);
    window.addEventListener('keydown', moveSelectedObject);
    window.addEventListener('keyup', finishKeyboardMove);
    return () => {
      instance.off('selection:created', selectObject);
      instance.off('selection:updated', selectObject);
      instance.off('selection:cleared', clearSelection);
      instance.off('object:moving', constrainObject);
      instance.off('object:scaling', constrainTransformedObject);
      instance.off('object:rotating', constrainTransformedObject);
      instance.off('object:modified', modifyObject);
      instance.off('text:editing:exited', modifyObject);
      window.removeEventListener('keydown', moveSelectedObject);
      window.removeEventListener('keyup', finishKeyboardMove);
      instance.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const instance = fabricCanvasRef.current;
    if (!stage || !instance) return;
    const observer = new ResizeObserver(() => fitCanvas(instance, currentReference.width, currentReference.height));
    observer.observe(stage);
    fitCanvas(instance, currentReference.width, currentReference.height);
    return () => observer.disconnect();
  }, [currentReference.width, currentReference.height]);

  useEffect(() => {
    const instance = fabricCanvasRef.current;
    if (!instance) return;
    const reference = referenceSize(template);
    const layout = guideLayout(reference.width, reference.height, values);
    const displayElements = elementList(template);
    const panelWidth = (layout.singleWidth + layout.spineBleed) * layout.scale;
    elementBoundsRef.current = {
      back: {
        left: layout.trimX,
        top: layout.trimY,
        width: Math.max(0, panelWidth),
        height: layout.trimHeight
      },
      spine: {
        left: layout.spineX,
        top: layout.trimY,
        width: Math.max(0, layout.spineWidth * layout.scale),
        height: layout.trimHeight
      },
      cover: {
        left: layout.coverX,
        top: layout.trimY,
        width: Math.max(0, panelWidth),
        height: layout.trimHeight
      }
    };
    const renderVersion = ++renderVersionRef.current;
    renderingRef.current = true;
    instance.clear();
    addGuideObjects(instance, reference.width, reference.height, values);
    const renderElements = async () => {
      for (const element of displayElements) {
        if (renderVersion !== renderVersionRef.current) return;
        const object = await elementObject(element, reference.width, reference.height);
        if (renderVersion !== renderVersionRef.current) return;
        clampObjectToRegion(object, elementBoundsRef.current);
        instance.add(object);
      }
      if (renderVersion !== renderVersionRef.current) return;
      const currentSelectedId = selectedElementRef.current;
      if (currentSelectedId) {
        const selected = instance.getObjects().find((object) => object.get('elementId') === currentSelectedId);
        if (selected) instance.setActiveObject(selected);
      }
      fitCanvas(instance, reference.width, reference.height);
      instance.requestRenderAll();
      renderingRef.current = false;
    };
    void renderElements();
    return () => {
      if (renderVersion === renderVersionRef.current) {
        renderVersionRef.current += 1;
        renderingRef.current = false;
      }
    };
  }, [template, values]);

  useEffect(() => {
    const instance = fabricCanvasRef.current;
    if (!instance) return;
    if (!selectedElementId) {
      if (instance.getActiveObject()) instance.discardActiveObject();
      instance.requestRenderAll();
      return;
    }
    const selected = instance.getObjects().find((object) => object.get('elementId') === selectedElementId);
    if (selected && instance.getActiveObject() !== selected) {
      instance.setActiveObject(selected);
      instance.requestRenderAll();
    }
  }, [selectedElementId]);

  return (
    <section className="size-template-preview-surface" aria-label="尺寸模板实时画布">
      <header className="size-template-preview-header">
        <div><strong>画布预览</strong><span>Fabric 可编辑画布</span></div>
        <span className="size-template-preview-unit">{values.unit ?? 'mm'}</span>
      </header>
      <div className="size-template-preview-stage" ref={stageRef}>
        <canvas ref={canvasRef} />
      </div>
    </section>
  );
});

FabricTemplateCanvas.displayName = 'FabricTemplateCanvas';

export default FabricTemplateCanvas;
