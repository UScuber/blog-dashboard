const MAX_LANDSCAPE_WIDTH = 1200;
const MAX_LANDSCAPE_HEIGHT = 800;
const MAX_PORTRAIT_WIDTH = 800;
const MAX_PORTRAIT_HEIGHT = 1200;
const JPEG_QUALITY = 0.8;

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        const isLandscape = width >= height;

        const maxW = isLandscape ? MAX_LANDSCAPE_WIDTH : MAX_PORTRAIT_WIDTH;
        const maxH = isLandscape ? MAX_LANDSCAPE_HEIGHT : MAX_PORTRAIT_HEIGHT;

        let newW = width;
        let newH = height;

        if (newW > maxW) {
          newH = Math.round((newH * maxW) / newW);
          newW = maxW;
        }
        if (newH > maxH) {
          newW = Math.round((newW * maxH) / newH);
          newH = maxH;
        }

        const canvas = document.createElement("canvas");
        canvas.width = newW;
        canvas.height = newH;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context unavailable"));
          return;
        }

        ctx.drawImage(img, 0, 0, newW, newH);
        const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        resolve(dataUrl.split(",")[1]);
      };
      img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () =>
      reject(new Error("ファイルの読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}
