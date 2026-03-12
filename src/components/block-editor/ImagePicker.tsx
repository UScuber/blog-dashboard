import { useState, useRef, type ReactNode } from "react";
import type { ImageItem } from "../../lib/types";
import { ImageWithLoader } from "../ImageWithLoader";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface ImagePickerProps {
  githubImages: ImageItem[];
  onSelectExisting: (image: ImageItem) => void;
  onSelectFile: (file: File) => void;
  trigger: ReactNode;
}

export function ImagePicker({
  githubImages,
  onSelectExisting,
  onSelectFile,
  trigger,
}: ImagePickerProps) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerClick = () => {
    if (githubImages.length === 0) {
      fileInputRef.current?.click();
    } else {
      setOpen(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelectFile(file);
      e.target.value = "";
    }
    setOpen(false);
  };

  return (
    <>
      <div onClick={handleTriggerClick}>{trigger}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>画像を追加</DialogTitle>
            <DialogDescription>
              画像を新規で追加、または既に追加された画像から選択してください。
            </DialogDescription>
          </DialogHeader>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            ファイルから選択
          </Button>
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              追加済み画像から選択
            </p>
            <div className="grid grid-cols-3 gap-2">
              {githubImages.map((img, i) => (
                <button
                  key={i}
                  className="bg-transparent border border-slate-200 rounded-sm p-1 cursor-pointer transition-colors hover:border-blue-600"
                  onClick={() => {
                    onSelectExisting(img);
                    setOpen(false);
                  }}
                >
                  <ImageWithLoader src={img.src} alt={img.filename} size="sm" />
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}
