import { downloadFile } from '@telegram-apps/sdk';
import { apiUrl } from './api';

export async function saveFile({
  fileName,
  createLink,
  loadBlob,
}: {
  fileName: string;
  createLink: () => Promise<{ path: string }>;
  loadBlob: () => Promise<Blob>;
}): Promise<void> {
  if (downloadFile.isAvailable()) {
    const { path } = await createLink();
    await downloadFile(new URL(apiUrl(path), window.location.origin).toString(), fileName);
    return;
  }

  const blob = await loadBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
