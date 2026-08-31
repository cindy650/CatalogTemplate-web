(function installImageMapHeadlessRenderer(global) {
  'use strict';

  const fabric = global.fabric;
  if (!fabric) throw new Error('Fabric 7.4.0 未加载');

  installTextWordSpacingSupport();

  global.ImageMapHeadlessRenderer = Object.freeze({
    render,
    version: '0.1.0',
    fabricVersion: fabric.version,
  });

  async function render(options) {
    const source = clone(options?.json);
    const rawObjects = extractObjects(source);
    const workarea = rawObjects.find(item => String(item?.id || '').toLowerCase() === 'workarea');
    if (!workarea) throw new Error('图层 JSON 缺少 id=workarea 的画布对象');

    const bounds = resolveWorkareaBounds(workarea);
    const cropWidth = Math.ceil(bounds.width);
    const cropHeight = Math.ceil(bounds.height);
    const dpi = positive(options?.dpi ?? 300, 'dpi');
    const quality = bounded(options?.quality ?? 0.95, 0, 1, 'quality');
    const formats = normalizeFormats(options?.formats);
    const multiplier = dpi / 96;
    const canvasElement = global.document.getElementById('image-map-render-canvas')
      || global.document.createElement('canvas');
    const canvas = new fabric.StaticCanvas(canvasElement, {
      width: cropWidth,
      height: cropHeight,
      renderOnAddRemove: false,
      enableRetinaScaling: false,
      backgroundColor: options?.backgroundColor || workarea.backgroundColor || '#ffffff',
    });
    canvas.setDimensions({ width: cropWidth, height: cropHeight });

    const warnings = [];
    await loadFonts(rawObjects, warnings);
    const objectsToRender = [];
    if (typeof workarea.src === 'string' && workarea.src) objectsToRender.push(workarea);
    objectsToRender.push(...rawObjects.filter(item => String(item?.id || '').toLowerCase() !== 'workarea'));

    for (const serialized of objectsToRender) {
      const local = toWorkareaScene(serialized, bounds);
      const object = await createObject(local, warnings);
      if (!object) continue;
      canvas.add(object);
      object.setCoords?.();
    }

    canvas.backgroundColor = options?.backgroundColor || workarea.backgroundColor || '#ffffff';
    canvas.renderAll();
    const outputCanvas = canvas.toCanvasElement(multiplier, {
      left: 0,
      top: 0,
      width: cropWidth,
      height: cropHeight,
    });
    const images = {};
    if (formats.includes('jpg')) {
      images.jpg = outputCanvas.toDataURL('image/jpeg', quality);
    }
    if (formats.includes('png')) {
      images.png = outputCanvas.toDataURL('image/png');
    }
    if (formats.includes('svg')) {
      images.svg = buildSvg(canvas, workarea, bounds, rawObjects);
    }
    if (formats.includes('text-to-svg')) {
      images.textToSvg = await buildTextToSvg(canvas, workarea, bounds, rawObjects);
    }
    const geometry = canvas.getObjects().map(object => ({
      id: object.id ?? null,
      type: object.type,
      left: object.left,
      top: object.top,
      width: object.width,
      height: object.height,
      scaleX: object.scaleX,
      scaleY: object.scaleY,
    }));
    const result = {
      images,
      width: outputCanvas.width,
      height: outputCanvas.height,
      cssWidth: cropWidth,
      cssHeight: cropHeight,
      dpi,
      objectCount: canvas.getObjects().length,
      geometry,
      warnings,
      fabricVersion: fabric.version,
    };
    canvas.dispose();
    return result;
  }

  function extractObjects(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.objects)) return value.objects;
    if (Array.isArray(value?.layers?.objects)) return value.layers.objects;
    throw new Error('图层 JSON 必须是对象数组，或包含 objects/layers.objects 数组');
  }

  function resolveWorkareaBounds(workarea) {
    const angle = Number(workarea.angle || 0);
    if (angle !== 0) throw new Error('不支持旋转后的 workarea');
    const scaledWidth = finiteOrNull(workarea.width) !== null
      ? Math.abs(Number(workarea.width) * numberOr(workarea.scaleX, 1))
      : null;
    const scaledHeight = finiteOrNull(workarea.height) !== null
      ? Math.abs(Number(workarea.height) * numberOr(workarea.scaleY, 1))
      : null;
    const width = positive(scaledWidth || workarea.workareaWidth, 'workarea.width');
    const height = positive(scaledHeight || workarea.workareaHeight, 'workarea.height');
    const left = finite(workarea.left, 'workarea.left') - originOffset(workarea.originX, width, 'x');
    const top = finite(workarea.top, 'workarea.top') - originOffset(workarea.originY, height, 'y');
    return { left, top, width, height };
  }

  function toWorkareaScene(serialized, bounds) {
    const local = clone(serialized);
    if (finiteOrNull(local.left) !== null) local.left = Number(local.left) - bounds.left;
    if (finiteOrNull(local.top) !== null) local.top = Number(local.top) - bounds.top;
    if (String(local.id || '').toLowerCase() === 'workarea') {
      local.selectable = false;
      local.evented = false;
    }
    if (/^https?:/i.test(String(local.src || '')) && local.crossOrigin == null) {
      local.crossOrigin = 'anonymous';
    }
    return local;
  }

  function collectFontSources(objects, options = {}) {
    const fonts = new Map();
    visit(objects, object => {
      const family = String(object.fontFamily || '').trim();
      const url = String(object.fontUrl || object.font_url || '').trim();
      const loadUrl = String(object.fontDataUrl || '').trim() || url;
      if (!family || !url) return;
      const weight = object.fontWeight || 'normal';
      const style = object.fontStyle || 'normal';
      const key = `${family}\u0000${url}\u0000${weight}\u0000${style}`;
      fonts.set(key, { family, url, loadUrl, weight, style });
    });
    return [...fonts.values()].map(font => options.textToSvg
      ? { family: font.family, url: font.url, loadUrl: font.loadUrl }
      : font);
  }

  function layerNames(objects) {
    return new Map(objects.map(object => [
      String(object?.id || ''),
      String(object?.name || (String(object?.id || '').toLowerCase() === 'workarea' ? '画布' : object?.id) || object?.type || '图层'),
    ]));
  }

  function renderedPrintGuides(workarea, bounds) {
    const guides = Array.isArray(workarea.printGuides) ? workarea.printGuides : [];
    const logicalWidth = numberOr(workarea.workareaWidth, bounds.width) || bounds.width;
    const logicalHeight = numberOr(workarea.workareaHeight, bounds.height) || bounds.height;
    const scaleX = bounds.width / logicalWidth;
    const scaleY = bounds.height / logicalHeight;
    return guides.map(guide => ({
      ...guide,
      position: (Number(guide.position) || 0) * (guide.orientation === 'vertical' ? scaleX : scaleY),
    }));
  }

  function exportOptions(canvas, workarea, bounds, objects, textToSvg = false) {
    const rawSvg = canvas.toSVG({
      width: bounds.width,
      height: bounds.height,
      viewBox: { x: 0, y: 0, width: bounds.width, height: bounds.height },
    });
    return {
      rawSvg,
      bounds: { left: 0, top: 0, width: bounds.width, height: bounds.height },
      backgroundColor: String(workarea.backgroundColor || '#ffffff'),
      layerNames: layerNames(objects),
      fontSources: collectFontSources(objects, { textToSvg }),
      printGuides: renderedPrintGuides(workarea, bounds),
    };
  }

  function buildSvg(canvas, workarea, bounds, objects) {
    const exporter = global.ImageMapEditorSvgExport;
    if (!exporter?.exportCorelCompatibleSvg) throw new Error('编辑器 SVG 导出模块未加载');
    return exporter.exportCorelCompatibleSvg(exportOptions(canvas, workarea, bounds, objects));
  }

  async function buildTextToSvg(canvas, workarea, bounds, objects) {
    const exporter = global.ImageMapEditorSvgExport;
    if (!exporter?.exportTextToSvg) throw new Error('编辑器 text-to-svg 导出模块未加载');
    return exporter.exportTextToSvg(exportOptions(canvas, workarea, bounds, objects, true));
  }

  async function createObject(serialized, warnings) {
    const type = normalizeType(serialized.type);
    if (type === 'textbox') return createNoWrapText(serialized);
    if (type === 'svg') return createSvg(serialized);
    if (type === 'arrow') return createArrow(serialized);
    if (type === 'cube') return createCube(serialized);
    if (type === 'gif') return createImageLike(serialized, warnings);
    if (['chart', 'element', 'iframe', 'video'].includes(type)) {
      warnings.push(`对象 ${serialized.id || '<无 id>'} (${serialized.type}) 是 DOM 图层，静态画布导出时不绘制`);
      return null;
    }
    try {
      const objects = await fabric.util.enlivenObjects([serialized]);
      if (!objects.length) throw new Error('Fabric 未返回对象');
      return objects[0];
    } catch (error) {
      throw new Error(`无法还原对象 ${serialized.id || '<无 id>'} (${serialized.type || '未知类型'}): ${error.message}`);
    }
  }

  function createNoWrapText(serialized) {
    const options = without(serialized, ['type', 'text', 'width', 'height']);
    // FabricText only breaks on explicit newline characters. Keeping left/top
    // and origin preserves the authored anchor while the natural width grows.
    return new fabric.FabricText(String(serialized.text || ''), options);
  }

  async function createImageLike(serialized, warnings) {
    if (!serialized.src) {
      warnings.push(`对象 ${serialized.id || '<无 id>'} (${serialized.type}) 缺少 src，已忽略`);
      return null;
    }
    const image = await fabric.FabricImage.fromURL(String(serialized.src), {
      crossOrigin: serialized.crossOrigin || 'anonymous',
    });
    const options = without(serialized, ['type']);
    image.set(options);
    return image;
  }

  async function createSvg(serialized) {
    const source = serialized.svg || serialized.src;
    if (!source) throw new Error(`SVG 对象 ${serialized.id || '<无 id>'} 缺少 svg/src`);
    const inline = String(serialized.loadType || '').toLowerCase() === 'svg' || /^\s*</.test(String(source));
    const parsed = inline
      ? await fabric.loadSVGFromString(String(source))
      : await fabric.loadSVGFromURL(String(source), { crossOrigin: 'anonymous' });
    const children = (parsed.objects || []).filter(Boolean);
    const grouped = fabric.util.groupSVGElements(children, parsed.options || {});
    const desiredHeight = Number(serialized.height) * numberOr(serialized.scaleY, 1);
    const sourceHeight = Number(grouped.height) || 1;
    const scale = Number.isFinite(desiredHeight) && desiredHeight > 0
      ? desiredHeight / sourceHeight
      : numberOr(grouped.scaleY, 1);
    const options = without(serialized, ['type', 'objects', 'layoutManager']);
    grouped.set({ ...options, scaleX: scale, scaleY: scale });
    if (serialized.fill || serialized.stroke) {
      const items = typeof grouped.getObjects === 'function' ? grouped.getObjects() : [grouped];
      for (const item of items) {
        if (serialized.fill) item.set('fill', serialized.fill);
        if (serialized.stroke) item.set('stroke', serialized.stroke);
      }
    }
    return grouped;
  }

  function createArrow(serialized) {
    const points = [serialized.x1 || 0, serialized.y1 || 0, serialized.x2 || 0, serialized.y2 || 0];
    const object = new fabric.Line(points, without(serialized, ['type']));
    const renderLine = object._render.bind(object);
    object._render = function renderArrow(context) {
      renderLine(context);
      context.save();
      const angle = Math.atan2(this.y2 - this.y1, this.x2 - this.x1);
      context.translate((this.x2 - this.x1) / 2, (this.y2 - this.y1) / 2);
      context.rotate(angle);
      context.beginPath();
      context.moveTo(5, 0);
      context.lineTo(-5, 5);
      context.lineTo(-5, -5);
      context.closePath();
      context.fillStyle = this.stroke || this.fill || '#000000';
      context.fill();
      context.restore();
    };
    return object;
  }

  function createCube(serialized) {
    const object = new fabric.FabricObject(without(serialized, ['type']));
    object._render = function renderCube(context) {
      const fill = String(this.fill || '#000000');
      const width = Number(this.width) || 0;
      const height = Number(this.height) || 0;
      const wx = width / 2;
      const wy = width / 2;
      const h = height / 2;
      const draw = (points, face, stroke) => {
        context.beginPath();
        points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
        context.closePath();
        context.fillStyle = face;
        context.strokeStyle = stroke;
        context.stroke();
        context.fill();
      };
      draw([[0, wy], [-wx, wy - wx * 0.5], [-wx, wy - h - wx * 0.5], [0, wy - h]], shade(fill, -10), fill);
      draw([[0, wy], [wy, wy - wy * 0.5], [wy, wy - h - wy * 0.5], [0, wy - h]], shade(fill, 10), shade(fill, 50));
      draw([[0, wy - h], [-wx, wy - h - wx * 0.5], [-wx + wy, wy - h - (wx + wy) * 0.5], [wy, wy - h - wy * 0.5]], shade(fill, 20), shade(fill, 60));
    };
    return object;
  }

  async function loadFonts(objects, warnings) {
    const fonts = new Map();
    visit(objects, object => {
      const family = String(object.fontFamily || '').trim();
      const url = String(object.fontDataUrl || object.fontUrl || object.font_url || '').trim();
      if (!family || !url) return;
      const weight = String(object.fontWeight || 'normal');
      const style = String(object.fontStyle || 'normal');
      fonts.set(`${family}\u0000${weight}\u0000${style}`, { family, url, weight, style });
    });
    for (const font of fonts.values()) {
      try {
        const face = new FontFace(font.family, `url(${JSON.stringify(font.url)})`, {
          weight: font.weight,
          style: font.style,
        });
        await face.load();
        global.document.fonts.add(face);
      } catch (error) {
        warnings.push(`字体 ${font.family} 加载失败: ${error.message}`);
      }
    }
    await global.document.fonts.ready;
  }

  function visit(objects, callback) {
    for (const object of objects) {
      if (!object || typeof object !== 'object') continue;
      callback(object);
      if (Array.isArray(object.objects)) visit(object.objects, callback);
    }
  }

  function installTextWordSpacingSupport() {
    const prototype = fabric.FabricText?.prototype;
    if (!prototype || prototype.wordSpacingPatchInstalled) return;
    const getGraphemeBox = prototype._getGraphemeBox;
    const renderChars = prototype._renderChars;
    prototype._getGraphemeBox = function getWordSpacedBox(grapheme, ...args) {
      const box = getGraphemeBox.call(this, grapheme, ...args);
      const spacing = Number(this.wordSpacing) || 0;
      if (spacing !== 0 && /\s/u.test(grapheme)) {
        const width = (this.fontSize * spacing) / 1000;
        box.width += width;
        box.kernedWidth += width;
      }
      return box;
    };
    prototype._renderChars = function renderWordSpacedChars(...args) {
      if ((Number(this.wordSpacing) || 0) === 0 || this.charSpacing !== 0) return renderChars.apply(this, args);
      this.charSpacing = Number.EPSILON;
      try {
        return renderChars.apply(this, args);
      } finally {
        this.charSpacing = 0;
      }
    };
    prototype.wordSpacingPatchInstalled = true;
  }

  function normalizeFormats(value) {
    const formats = Array.isArray(value) && value.length ? value : ['jpg', 'png'];
    const normalized = [...new Set(formats.map(item => String(item).toLowerCase() === 'jpeg' ? 'jpg' : String(item).toLowerCase()))];
    if (normalized.some(item => !['jpg', 'png', 'svg', 'text-to-svg'].includes(item))) throw new Error('仅支持 jpg、png、svg 和 text-to-svg');
    return normalized;
  }

  function normalizeType(value) {
    return String(value || '').replace(/[-_]/g, '').toLowerCase();
  }

  function originOffset(origin, size, axis) {
    const value = String(origin || (axis === 'x' ? 'left' : 'top')).toLowerCase();
    if (value === 'center' || value === 'middle') return size / 2;
    if (value === 'right' || value === 'bottom') return size;
    return 0;
  }

  function shade(color, percent) {
    const match = /^#?([0-9a-f]{6})$/i.exec(color);
    if (!match) return color;
    const amount = Math.round(2.55 * percent);
    const number = parseInt(match[1], 16);
    const channel = shift => Math.max(0, Math.min(255, (number >> shift & 0xff) + amount));
    return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
  }

  function without(value, keys) {
    const copy = { ...value };
    keys.forEach(key => delete copy[key]);
    return copy;
  }

  function clone(value) {
    if (value == null) throw new Error('缺少图层 JSON');
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function positive(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new Error(`${name} 必须大于 0`);
    return number;
  }

  function finite(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`${name} 必须是有效数字`);
    return number;
  }

  function finiteOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function bounded(value, min, max, name) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
      throw new Error(`${name} 必须在 ${min} 到 ${max} 之间`);
    }
    return number;
  }
})(globalThis);
