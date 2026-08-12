// Client-side image preparation: downscale + re-encode to JPEG base64.
// Sonnet 5 vision reads up to 2576px on the long edge — we send 2200px to keep
// handwriting legible while keeping the upload ~0.5-1MB per photo.
const MAX_LONG_EDGE = 2200;
const JPEG_QUALITY = 0.85;

export interface PreparedImage {
  data: string; // base64, no data: prefix
  mediaType: string; // always image/jpeg after re-encode
  previewUrl: string; // object URL for the thumbnail
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  const long = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, MAX_LONG_EDGE / long);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // white background so transparent PNGs don't turn black in JPEG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("แปลงรูปไม่สำเร็จ"))),
      "image/jpeg",
      JPEG_QUALITY,
    ),
  );

  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }

  return {
    data: btoa(binary),
    mediaType: "image/jpeg",
    previewUrl: URL.createObjectURL(blob),
  };
}
