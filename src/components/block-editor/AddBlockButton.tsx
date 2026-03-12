import { useState } from "react";
import { Plus } from "lucide-react";
import type { ImageItem } from "../../lib/types";
import { Button } from "../ui/button";
import { ImagePicker } from "./ImagePicker";

interface AddBlockButtonProps {
  onAddText: () => void;
  onAddImage: (file: File) => void;
  onAddExistingImage: (image: ImageItem) => void;
  githubImages: ImageItem[];
  variant?: "inline" | "bottom";
}

export function AddBlockButton({
  onAddText,
  onAddImage,
  onAddExistingImage,
  githubImages,
  variant = "inline",
}: AddBlockButtonProps) {
  const [expanded, setExpanded] = useState(false);

  if (variant === "bottom") {
    return (
      <div className="flex flex-col gap-2 mt-4">
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            onAddText();
          }}
        >
          テキストを追加
        </Button>
        <ImagePicker
          githubImages={githubImages}
          onSelectExisting={onAddExistingImage}
          onSelectFile={onAddImage}
          trigger={
            <Button variant="secondary" className="w-full">
              画像付きテキストを追加
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center my-2">
      <div className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
      {!expanded ? (
        <Button
          variant="ghost"
          size="sm"
          className="relative z-10 bg-white text-slate-400 hover:text-slate-600"
          onClick={() => setExpanded(true)}
        >
          <Plus className="w-4 h-4 mr-1" />
          追加
        </Button>
      ) : (
        <div className="relative z-10 flex gap-2 bg-white px-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onAddText();
              setExpanded(false);
            }}
          >
            テキスト
          </Button>
          <ImagePicker
            githubImages={githubImages}
            onSelectExisting={(image) => {
              onAddExistingImage(image);
              setExpanded(false);
            }}
            onSelectFile={(file) => {
              onAddImage(file);
              setExpanded(false);
            }}
            trigger={
              <Button variant="secondary" size="sm">
                画像付きテキスト
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(false)}
            className="text-slate-400"
          >
            ✕
          </Button>
        </div>
      )}
    </div>
  );
}
