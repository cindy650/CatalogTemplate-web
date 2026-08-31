import type { OrderTemplateExportFile } from '../../api';

export function downloadExportFile(file: OrderTemplateExportFile): void {
  if (file.blob.size === 0) throw new Error('后端返回的导出文件为空。');

  const url = URL.createObjectURL(file.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
