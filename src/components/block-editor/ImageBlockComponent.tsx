import type { ImageBlock, ImageItem } from "../../lib/types";
import { ImageSkeleton } from "../ImageSkeleton";
import { Button } from "../ui/button";
import { ImagePicker } from "./ImagePicker";
import { AutoResizeTextarea } from "./TextBlockComponent";

interface ImageBlockComponentProps {
  block: ImageBlock;
  onContentChange: (content: string) => void;
  onImageChange: (file: File) => void;
  onSelectExistingImage: (image: ImageItem) => void;
  githubImages: ImageItem[];
}

export function ImageBlockComponent({
  block,
  onContentChange,
  onImageChange,
  onSelectExistingImage,
  githubImages,
}: ImageBlockComponentProps) {
  return (
    <div className="border border-slate-200 rounded-md overflow-hidden">
      <AutoResizeTextarea
        value={block.content}
        onChange={onContentChange}
        placeholder="画像の説明を入力..."
        className="w-full p-3 resize-none text-base leading-relaxed outline-none border-b border-slate-200 focus:border-b-blue-500 transition-colors overflow-hidden"
      />
      <div className="p-3">
        {block.image.src ? (
          <img
            src={block.image.src}
            alt={block.image.filename}
            className="max-w-[450px] w-full rounded-sm max-md:max-w-full"
          />
        ) : (
          <ImageSkeleton size="block" />
        )}
      </div>
      <div className="px-3 pb-3">
        <ImagePicker
          githubImages={githubImages}
          onSelectExisting={onSelectExistingImage}
          onSelectFile={onImageChange}
          trigger={
            <Button variant="secondary" size="sm">
              画像変更
            </Button>
          }
        />
      </div>
    </div>
  );
}
