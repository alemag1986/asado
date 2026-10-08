export const MAX_EDGE = 1024;

export interface Downscaled {
  blob: Blob;
  dataUrl: string;
}

/** Reads a photo, downsizes to ≤1024px, strips EXIF, returns JPEG. */
export async function downscale(file: File): Promise<Downscaled> {
  const source = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, 0, 0, width, height);
  source.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', 0.82),
  );
  return { blob, dataUrl: canvas.toDataURL('image/jpeg', 0.82) };
}