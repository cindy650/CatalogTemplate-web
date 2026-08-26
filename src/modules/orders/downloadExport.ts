import type { OrderTemplateExportFile } from '../../api';

function base64Bytes(value: string): ArrayBuffer {
  const normalized = value.replace(/\s/g, '');
  if (!normalized) throw new Error('导出文件数据为空。');

  try {
    const binary = window.atob(normalized);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return buffer;
  } catch {
    throw new Error('后端返回的导出文件无法识别。');
  }
}

export function downloadExportFile(file: OrderTemplateExportFile): void {
  const url = file.ossUrl || URL.createObjectURL(
    new Blob([base64Bytes(file.base64 ?? '')], { type: file.mimeType })
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  if (file.ossUrl) link.target = '_blank';
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  if (!file.ossUrl) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
