import sharp from "sharp";

const LONG_SIDE = 1200;
const SHORT_SIDE = 800;
const JPEG_QUALITY = 80;

/**
 * Base64 画像を圧縮して Base64 文字列で返す。
 * - 縦横の向きに応じて最大サイズを切り替え
 *   横向き: 最大 1200x800px / 縦向き: 最大 800x1200px
 * - JPEG mozjpeg quality 80 に変換
 */
export async function compressImage(base64Data: string): Promise<string> {
  const input = Buffer.from(base64Data, "base64");

  // 元画像のサイズを取得して縦横判定
  const metadata = await sharp(input).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const isPortrait = height > width;

  const maxW = isPortrait ? SHORT_SIDE : LONG_SIDE;
  const maxH = isPortrait ? LONG_SIDE : SHORT_SIDE;

  const compressed = await sharp(input)
    .resize(maxW, maxH, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return compressed.toString("base64");
}
