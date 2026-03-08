/**
 * Canvas API を使った画像圧縮ユーティリティ
 * 横向き: 最大 1200x800px / 縦向き: 最大 800x1200px
 * JPEG quality 0.8、Base64 文字列を返す
 */

const LONG_SIDE = 1200;
const SHORT_SIDE = 800;
const JPEG_QUALITY = 0.8;

/**
 * 画像ファイルを圧縮し、Base64 文字列（data:image/jpeg;base64,... 形式）で返す。
 * - 縦横の向きに応じて最大サイズを切り替え
 * - アスペクト比を維持してリサイズ（拡大はしない）
 * - JPEG に変換
 */
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // 縦向き・横向きに応じて上限を切り替え
  const isPortrait = height > width;
  const maxW = isPortrait ? SHORT_SIDE : LONG_SIDE;
  const maxH = isPortrait ? LONG_SIDE : SHORT_SIDE;

  // 縮小率を計算（拡大はしない）
  const scale = Math.min(1, maxW / width, maxH / height);
  const destW = Math.round(width * scale);
  const destH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = destW;
  canvas.height = destH;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, destW, destH);
  bitmap.close();

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
