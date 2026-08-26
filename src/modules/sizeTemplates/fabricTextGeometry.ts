import * as fabric from 'fabric';

export type TextFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function singleGlyphOpticalScale(object: fabric.IText): number {
  const value = String(object.text || '').trim();
  if (Array.from(value).length !== 1 || typeof document === 'undefined') return 1;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return 1;
  const fontSize = Math.max(1, Number(object.fontSize) || 1);
  context.font = `${object.fontStyle || 'normal'} ${object.fontWeight || 'normal'} ${fontSize}px ${object.fontFamily || 'sans-serif'}`;
  const reference = /[A-Z]/.test(value) ? 'H' : /[a-z]/.test(value) ? 'x' : /\d/.test(value) ? '0' : '';
  if (!reference) return 1;
  const glyphAscent = context.measureText(value).actualBoundingBoxAscent;
  const referenceAscent = context.measureText(reference).actualBoundingBoxAscent;
  if (glyphAscent <= 0 || referenceAscent <= 0) return 1;
  return Math.min(1.25, Math.max(0.85, referenceAscent / glyphAscent));
}

export function fitTextObjectToFrame(object: fabric.IText, frame: TextFrame): void {
  object.set({
    left: frame.x + frame.width / 2,
    top: frame.y + frame.height / 2,
    originX: 'center',
    originY: 'center'
  });
  object.initDimensions();
  // Rotated bounding boxes swap and expand their axes. Fit against the local
  // dimensions so changing only the angle cannot resize or stretch the text.
  // Font size is the source of truth for text height. A glyph's advance width
  // differs by character (for example, E and J), so using width as a normal
  // fit constraint would give same-size characters different vertical scales.
  // Only reduce the uniform scale when the complete text actually exceeds the
  // frame; otherwise preserve the natural Fabric font metrics at scale 1.
  const naturalWidth = Math.max(1, Number(object.width) || 1);
  const naturalHeight = Math.max(1, Number(object.height) || 1);
  const textLength = Array.from(String(object.text || '').replace(/\s/g, '')).length;
  const widthScale = textLength <= 1 ? 1 : frame.width / naturalWidth;
  // A single glyph must keep the font-size-derived height. Imported frames can
  // have slightly different heights for E/J even when their font settings are
  // identical; fitting those frames would make one glyph visibly smaller.
  const fitScale = textLength <= 1
    ? singleGlyphOpticalScale(object)
    : Math.min(1, widthScale, frame.height / naturalHeight);
  object.set({ scaleX: fitScale, scaleY: fitScale });
  object.setCoords();
}

export function textFrameFromObject(object: fabric.FabricObject): TextFrame {
  const center = object.getCenterPoint();
  const width = Math.max(1, object.getScaledWidth());
  const height = Math.max(1, object.getScaledHeight());
  return {
    x: Number(center.x) - width / 2,
    y: Number(center.y) - height / 2,
    width,
    height
  };
}
