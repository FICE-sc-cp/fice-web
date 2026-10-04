export const MAX_UPLOAD_MB = 5;
export const RECEIPT_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf';
export const PHOTO_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

export function uploadProblem(
  file: File,
  { allowPdf }: { allowPdf: boolean },
): string | null {
  const isImage = IMAGE_TYPES.includes(file.type) || IMAGE_EXTENSIONS.test(file.name);
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (!isImage && !(allowPdf && isPdf)) {
    return allowPdf
      ? 'Підтримуються лише JPG, PNG, WEBP або PDF. Фото з iPhone (HEIC) збережіть як JPG або зробіть скриншот.'
      : 'Підтримуються лише JPG, PNG або WEBP. Фото з iPhone (HEIC) збережіть як JPG або зробіть скриншот.';
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `Файл завеликий: максимум ${MAX_UPLOAD_MB} МБ.`;
  }
  return null;
}
export const isRemoteImage = (src: string) => /^https?:\/\//i.test(src);
