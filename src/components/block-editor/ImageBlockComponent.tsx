import { useRef, useEffect } from "react";
import type { ImageBlock, ImageItem } from "../../lib/types";
import { Button } from "../ui/button";
import { ImagePicker } from "./ImagePicker";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.content]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onContentChange(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden">
      <textarea
        ref={textareaRef}
        value={block.content}
        onChange={handleInput}
        placeholder="画像の説明を入力..."
        className="w-full min-h-[60px] p-3 resize-none text-base leading-relaxed outline-none border-b border-slate-200 focus:border-b-blue-500 transition-colors"
        style={{ fontSize: "16px" }}
      />
      <div className="p-3">
        <img
          src={block.image.src}
          alt={block.image.filename}
          className="max-w-[450px] w-full rounded-sm max-md:max-w-full"
        />
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
