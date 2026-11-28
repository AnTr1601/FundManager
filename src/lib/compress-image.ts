/**
 * Nén ảnh phía trình duyệt trước khi tải lên (NFR, AT-15): thu nhỏ cạnh dài về
 * ≤ maxDim px và giảm chất lượng JPEG tới khi ≤ maxBytes. Chạy ở client.
 */
export async function compressImage(
  file: File,
  opts: { maxDim?: number; maxBytes?: number } = {},
): Promise<File> {
  const maxDim = opts.maxDim ?? 1600;
  const maxBytes = opts.maxBytes ?? 500_000;
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.9;
  let blob = await toJpegBlob(canvas, quality);
  while (blob && blob.size > maxBytes && quality > 0.3) {
    quality -= 0.1;
    blob = await toJpegBlob(canvas, quality);
  }
  if (!blob || blob.size >= file.size) return file;

  const base = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

function toJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
}
