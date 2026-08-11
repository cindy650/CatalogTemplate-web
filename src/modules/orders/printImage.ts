function imageDataUrl(value: string): string {
  const dataUrlMatch = value.trim().match(/^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/i);
  if (dataUrlMatch) {
    return `data:${dataUrlMatch[1]};base64,${dataUrlMatch[2].replace(/\s/g, '')}`;
  }

  const base64 = value.replace(/\s/g, '');
  if (!base64) throw new Error('打印图片数据为空。');

  const mimeType = base64.startsWith('/9j/')
    ? 'image/jpeg'
    : base64.startsWith('R0lGOD')
      ? 'image/gif'
      : base64.startsWith('UklGR')
        ? 'image/webp'
        : 'image/png';

  return `data:${mimeType};base64,${base64}`;
}

export function printBase64Image(value: string): Promise<void> {
  const source = imageDataUrl(value);

  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.title = '订单打印图片';
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '1px',
      height: '1px',
      border: '0',
      opacity: '0',
      pointerEvents: 'none'
    });
    document.body.append(frame);

    const printWindow = frame.contentWindow;
    const printDocument = frame.contentDocument;
    if (!printWindow || !printDocument) {
      frame.remove();
      reject(new Error('无法创建打印页面。'));
      return;
    }

    let cleanupTimer: number | undefined;
    const cleanup = () => {
      if (cleanupTimer !== undefined) window.clearTimeout(cleanupTimer);
      frame.remove();
    };

    printDocument.open();
    printDocument.write(`<!doctype html>
      <html>
        <head>
          <title>订单打印图片</title>
          <style>
            @page { margin: 0; }
            html, body { width: 100%; height: 100%; margin: 0; }
            body { display: grid; place-items: center; }
            img { display: block; width: 100%; height: 100%; object-fit: contain; }
          </style>
        </head>
        <body><img id="print-image" alt="订单打印图片"></body>
      </html>`);
    printDocument.close();

    const image = printDocument.getElementById('print-image') as HTMLImageElement | null;
    if (!image) {
      cleanup();
      reject(new Error('无法加载打印图片。'));
      return;
    }

    image.onerror = () => {
      cleanup();
      reject(new Error('后端返回的打印图片无法识别。'));
    };
    image.onload = () => {
      try {
        printWindow.addEventListener('afterprint', cleanup, { once: true });
        cleanupTimer = window.setTimeout(cleanup, 60_000);
        printWindow.focus();
        printWindow.print();
        resolve();
      } catch (error) {
        cleanup();
        reject(error);
      }
    };
    image.src = source;
  });
}
