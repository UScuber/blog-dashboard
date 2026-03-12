import { useState, useCallback } from "react";
import type {
  Block,
  TextBlock,
  ImageBlock,
  ImageItem,
  ParsedArticle,
} from "../../lib/types";

const BLOCK_SEPARATOR = "\n\n<br>\n\n";

function createId(): string {
  return crypto.randomUUID();
}

export function createTextBlock(content = ""): TextBlock {
  return { id: createId(), type: "text", content };
}

export function createImageBlock(image: ImageItem, content = ""): ImageBlock {
  return { id: createId(), type: "image", content, image };
}

export function serializeToBody(blocks: Block[]): {
  body: string;
  images: ImageItem[];
} {
  const images: ImageItem[] = [];
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      parts.push(block.content);
    } else {
      const imageIndex = images.length;
      images.push(block.image);
      const textPart = block.content.trim();
      if (textPart) {
        parts.push(`${textPart}\n\n[image:${imageIndex}]`);
      } else {
        parts.push(`[image:${imageIndex}]`);
      }
    }
  }

  return { body: parts.join(BLOCK_SEPARATOR), images };
}

export function deserializeFromParsed(
  parsed: ParsedArticle,
  resolvedImages: ImageItem[],
): Block[] {
  const { body } = parsed;
  const blocks: Block[] = [];

  const existingImgs = resolvedImages;

  // Try splitting by block separator first (new format)
  if (body.includes("<br>")) {
    const segments = body.split(BLOCK_SEPARATOR);
    for (const segment of segments) {
      const trimmed = segment.trim();
      if (!trimmed) continue;

      const imageMatch = trimmed.match(/\[image:(\d+)\]/);
      if (imageMatch) {
        const imageIndex = parseInt(imageMatch[1], 10);
        const image = existingImgs[imageIndex];
        if (image) {
          const content = trimmed.replace(/\n*\[image:\d+\]\n*/g, "").trim();
          blocks.push(createImageBlock(image, content));
        }
      } else {
        blocks.push(createTextBlock(trimmed));
      }
    }
  } else {
    // Fallback for old format (no <br> separators)
    const parts = body.split(/(\[image:\d+\])/);
    let pendingText = "";

    for (const part of parts) {
      const imageMatch = part.match(/^\[image:(\d+)\]$/);
      if (imageMatch) {
        const imageIndex = parseInt(imageMatch[1], 10);
        const image = existingImgs[imageIndex];
        if (image) {
          blocks.push(createImageBlock(image, pendingText.trim()));
          pendingText = "";
        }
      } else {
        const trimmed = part.trim();
        if (trimmed) {
          if (pendingText) {
            blocks.push(createTextBlock(pendingText.trim()));
          }
          pendingText = trimmed;
        }
      }
    }

    if (pendingText.trim()) {
      blocks.push(createTextBlock(pendingText.trim()));
    }
  }

  return blocks;
}

export function useBlockEditor() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [deletedImages, setDeletedImages] = useState<ImageItem[]>([]);
  const [githubImages, setGithubImages] = useState<ImageItem[]>([]);
  const [thumbnailIndex, setThumbnailIndex] = useState(0);

  const addBlock = useCallback((block: Block, afterIndex?: number) => {
    setBlocks((prev) => {
      if (afterIndex !== undefined && afterIndex >= 0) {
        const next = [...prev];
        next.splice(afterIndex + 1, 0, block);
        return next;
      }
      return [...prev, block];
    });
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => {
      const block = prev.find((b) => b.id === id);
      if (block?.type === "image") {
        setDeletedImages((del) => [...del, block.image]);
      }
      return prev.filter((b) => b.id !== id);
    });
  }, []);

  const updateBlock = useCallback(
    (
      id: string,
      updates: Partial<Pick<TextBlock, "content">> &
        Partial<Pick<ImageBlock, "image">>,
    ) => {
      setBlocks((prev) =>
        prev.map((b) => {
          if (b.id !== id) return b;
          if (b.type === "text") {
            return { ...b, ...updates };
          }
          return { ...b, ...updates };
        }),
      );
    },
    [],
  );

  const moveBlock = useCallback((id: string, direction: "up" | "down") => {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      if (index < 0) return prev;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const restoreImage = useCallback((image: ImageItem) => {
    setDeletedImages((prev) => prev.filter((img) => img.src !== image.src));
    setBlocks((prev) => [...prev, createImageBlock(image)]);
  }, []);

  const loadFromParsed = useCallback(
    (parsed: ParsedArticle, resolvedImages: ImageItem[]) => {
      const loaded = deserializeFromParsed(parsed, resolvedImages);
      setBlocks(loaded);
      setGithubImages(resolvedImages);

      if (parsed.thumb) {
        const imageBlocks = loaded.filter(
          (b): b is ImageBlock => b.type === "image",
        );
        const thumbIdx = imageBlocks.findIndex(
          (b) => b.image.filename === parsed.thumb,
        );
        if (thumbIdx >= 0) setThumbnailIndex(thumbIdx);
      }
    },
    [],
  );

  const getImages = useCallback((): ImageItem[] => {
    return blocks
      .filter((b): b is ImageBlock => b.type === "image")
      .map((b) => b.image);
  }, [blocks]);

  return {
    blocks,
    setBlocks,
    deletedImages,
    githubImages,
    thumbnailIndex,
    setThumbnailIndex,
    addBlock,
    removeBlock,
    updateBlock,
    moveBlock,
    restoreImage,
    loadFromParsed,
    getImages,
    serializeToBody: () => serializeToBody(blocks),
  };
}
