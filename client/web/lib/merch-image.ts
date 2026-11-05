const MAX_FULL_BYTES = 4.5 * 1024 * 1024; // the upload limit is 5 MB

export async function shrinkImage(file: Blob, maxSide: number, quality: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(
          new Error(
            'Не вдалося прочитати зображення. Фото з iPhone (HEIC) збережіть як JPG або зробіть скриншот.',
          ),
        );
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#fff'; // a transparent PNG mockup must not turn black
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // JPEG only: Safari's canvas.toBlob('image/webp') silently returns PNG.
    return await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Не вдалося обробити зображення'))),
        'image/jpeg',
        quality,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Full and thumb for a product photo. Quality steps down so the 5 MB limit holds. */
export async function preparePhoto(file: Blob): Promise<{ full: Blob; thumb: Blob }> {
  let full = await shrinkImage(file, 2560, 0.9);
  for (const quality of [0.8, 0.7]) {
    if (full.size <= MAX_FULL_BYTES) break;
    full = await shrinkImage(file, 2560, quality);
  }
  return { full, thumb: await shrinkImage(file, 640, 0.8) };
}
