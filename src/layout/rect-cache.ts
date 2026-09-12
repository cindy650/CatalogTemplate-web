type RectCache = {
  current: DOMRect;
  destroy: () => void;
};

/** Keeps pointer coordinates aligned after layout/scroll changes without reading layout every move. */
export function createRectCache(element: Element): RectCache {
  let current = element.getBoundingClientRect();
  let frame = 0;

  const refresh = () => {
    frame = 0;
    current = element.getBoundingClientRect();
  };
  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(refresh);
  };

  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true, capture: true });

  return {
    get current() {
      return current;
    },
    destroy() {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    }
  };
}
