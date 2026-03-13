import type { Block, ImageBlock, ImageItem } from "../../lib/types";
import { compressImage } from "../../lib/imageCompressor";
import { showToast } from "../../lib/toast";
import { TextBlockComponent } from "./TextBlockComponent";
import { ImageBlockComponent } from "./ImageBlockComponent";
import { BlockToolbar } from "./BlockToolbar";
import { AddBlockButton } from "./AddBlockButton";
import { createTextBlock, createImageBlock } from "./useBlockEditor";
import { ImageWithLoader } from "../ImageWithLoader";
import { Button } from "../ui/button";
import { Dropdown } from "../Dropdown";
import { useMemo, useState } from "react";

interface BlockEditorProps {
  blocks: Block[];
  deletedImages: ImageItem[];
  githubImages: ImageItem[];
  onAddBlock: (block: Block, afterIndex?: number) => void;
  onRemoveBlock: (id: string) => void;
  onUpdateBlock: (
    id: string,
    updates: { content?: string; image?: ImageItem },
  ) => void;
  onMoveBlock: (id: string, direction: "up" | "down") => void;
  onRestoreImage: (image: ImageItem) => void;
}

function generateFilename(originalName: string): string {
  const ext = originalName.split(".").pop() || "jpg";
  return `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

async function fileToImageBlock(file: File): Promise<Block> {
  const base64 = await compressImage(file);
  const image: ImageItem = {
    src: `data:image/jpeg;base64,${base64}`,
    data: base64,
    isNew: true,
    originalPath: "",
    filename: generateFilename(file.name),
  };
  return createImageBlock(image);
}

async function fileToImageItem(file: File): Promise<ImageItem> {
  const base64 = await compressImage(file);
  return {
    src: `data:image/jpeg;base64,${base64}`,
    data: base64,
    isNew: true,
    originalPath: "",
    filename: generateFilename(file.name),
  };
}

export function BlockEditor({
  blocks,
  deletedImages,
  githubImages,
  onAddBlock,
  onRemoveBlock,
  onUpdateBlock,
  onMoveBlock,
  onRestoreImage,
}: BlockEditorProps) {
  const [deletedPoolOpen, setDeletedPoolOpen] = useState(false);

  const availableGithubImages = useMemo(() => {
    const usedPaths = new Set(
      blocks
        .filter((b): b is ImageBlock => b.type === "image")
        .map((b) => b.image.originalPath)
        .filter(Boolean),
    );
    return githubImages.filter((img) => !usedPaths.has(img.originalPath));
  }, [blocks, githubImages]);

  const handleAddText = (afterIndex?: number) => {
    onAddBlock(createTextBlock(), afterIndex);
  };

  const handleAddImage = async (file: File, afterIndex?: number) => {
    try {
      const block = await fileToImageBlock(file);
      onAddBlock(block, afterIndex);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "画像の処理に失敗しました";
      showToast(message, "error");
    }
  };

  const handleImageChange = async (blockId: string, file: File) => {
    try {
      const image = await fileToImageItem(file);
      onUpdateBlock(blockId, { image });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "画像の処理に失敗しました";
      showToast(message, "error");
    }
  };

  const handleAddExistingImage = (image: ImageItem, afterIndex?: number) => {
    onAddBlock(createImageBlock(image), afterIndex);
  };

  const handleImageSelectExisting = (blockId: string, image: ImageItem) => {
    onUpdateBlock(blockId, { image });
  };

  if (blocks.length === 0) {
    return (
      <div className="border border-dashed border-slate-300 rounded-md p-8 text-center">
        <p className="text-slate-500 mb-4">記事の本文を作成しましょう</p>
        <AddBlockButton
          variant="bottom"
          onAddText={() => handleAddText()}
          onAddImage={(file) => handleAddImage(file)}
          onAddExistingImage={(image) => handleAddExistingImage(image)}
          githubImages={availableGithubImages}
        />
      </div>
    );
  }

  return (
    <div>
      {blocks.map((block, index) => (
        <div key={block.id}>
          {block.type === "text" ? (
            <TextBlockComponent
              block={block}
              onChange={(content) => onUpdateBlock(block.id, { content })}
            />
          ) : (
            <ImageBlockComponent
              block={block}
              onContentChange={(content) =>
                onUpdateBlock(block.id, { content })
              }
              onImageChange={(file) => handleImageChange(block.id, file)}
              onSelectExistingImage={(image) =>
                handleImageSelectExisting(block.id, image)
              }
              githubImages={availableGithubImages}
            />
          )}
          <BlockToolbar
            isFirst={index === 0}
            isLast={index === blocks.length - 1}
            onMoveUp={() => onMoveBlock(block.id, "up")}
            onMoveDown={() => onMoveBlock(block.id, "down")}
            onDelete={() => onRemoveBlock(block.id)}
          />
          {index < blocks.length - 1 && (
            <AddBlockButton
              onAddText={() => handleAddText(index)}
              onAddImage={(file) => handleAddImage(file, index)}
              onAddExistingImage={(image) =>
                handleAddExistingImage(image, index)
              }
              githubImages={availableGithubImages}
            />
          )}
        </div>
      ))}

      <div className="border-t border-slate-200 mt-4 pt-4">
        <AddBlockButton
          variant="bottom"
          onAddText={() => handleAddText()}
          onAddImage={(file) => handleAddImage(file)}
          onAddExistingImage={(image) => handleAddExistingImage(image)}
          githubImages={availableGithubImages}
        />
        {deletedImages.length > 0 && (
          <div className="mt-2">
            <Dropdown
              open={deletedPoolOpen}
              onClose={() => setDeletedPoolOpen(false)}
              mobileMode="bottomsheet"
              trigger={
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setDeletedPoolOpen(!deletedPoolOpen)}
                >
                  削除済み画像から選択
                </Button>
              }
            >
              <div className="p-3">
                <div className="grid grid-cols-3 gap-2">
                  {deletedImages.map((img, i) => (
                    <button
                      key={i}
                      className="bg-transparent border border-slate-200 rounded-sm p-1 cursor-pointer transition-colors hover:border-blue-600"
                      onClick={() => {
                        onRestoreImage(img);
                        setDeletedPoolOpen(false);
                      }}
                    >
                      <ImageWithLoader
                        src={img.src}
                        alt={img.filename}
                        size="sm"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </Dropdown>
          </div>
        )}
      </div>
    </div>
  );
}
