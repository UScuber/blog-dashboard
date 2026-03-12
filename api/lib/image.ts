import sharp from "sharp";

export function getImageSequenceName(index: number): string {
  return `image${String(index + 1).padStart(3, "0")}.jpg`;
}

export function determineThumbnail(
  imageCount: number,
  thumbnailIndex?: number,
): string {
  if (imageCount <= 0) return "";
  const idx =
    typeof thumbnailIndex === "number" &&
    thumbnailIndex >= 0 &&
    thumbnailIndex < imageCount
      ? thumbnailIndex
      : 0;
  return getImageSequenceName(idx);
}

export async function compressImage(base64Data: string): Promise<string> {
  const buffer = Buffer.from(base64Data, "base64");
  const metadata = await sharp(buffer).metadata();

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const isLandscape = width >= height;

  const maxWidth = isLandscape ? 1200 : 800;
  const maxHeight = isLandscape ? 800 : 1200;

  const compressed = await sharp(buffer)
    .resize(maxWidth, maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ mozjpeg: true, quality: 80 })
    .toBuffer();

  return compressed.toString("base64");
}
