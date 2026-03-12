import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { fetchArticle, createArticle, updateArticle } from "../lib/api";
import { showToast } from "../lib/toast";
import { validateTitle } from "../lib/validation";
import {
  parseMarkdown,
  htmlToBody,
  toProxyUrl,
  resetCacheBuster,
} from "../lib/parser";
import { compressImage } from "../lib/imageCompressor";
import { CATEGORIES } from "../lib/types";
import type {
  ImageItem,
  CreateArticleInput,
  UpdateArticleInput,
} from "../lib/types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { LoadingOverlay } from "./LoadingOverlay";
import { LoadingScreen } from "./LoadingScreen";
import { ImageWithLoader } from "./ImageWithLoader";
import { Dropdown } from "./Dropdown";

export function ArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [outline, setOutline] = useState("");
  const [titleError, setTitleError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingContent, setLoadingContent] = useState(isEdit);
  const [pageLoading, setPageLoading] = useState(isEdit);

  const [imageList, setImageList] = useState<ImageItem[]>([]);
  const [editorImages, setEditorImages] = useState<ImageItem[]>([]);
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const [imagePoolOpen, setImagePoolOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageListRef = useRef<ImageItem[]>(imageList);
  imageListRef.current = imageList;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
      }),
      Image.configure({ inline: false }),
    ],
    editable: !isEdit,
    content: "",
  });

  const syncEditorImages = useCallback(() => {
    if (!editor) return;
    const json = editor.getJSON();
    const srcs: string[] = [];
    const walk = (node: Record<string, unknown>) => {
      if (node.type === "image" && node.attrs) {
        const attrs = node.attrs as { src?: string };
        if (attrs.src) srcs.push(attrs.src);
      }
      if (Array.isArray(node.content)) {
        node.content.forEach((child: Record<string, unknown>) => walk(child));
      }
    };
    walk(json as Record<string, unknown>);

    setImageList((prev) => {
      const imgs = srcs
        .map((src) => prev.find((img) => img.src === src))
        .filter((img): img is ImageItem => Boolean(img));
      setEditorImages(imgs);

      setThumbnailIndex((prevIdx) => {
        if (imgs.length === 0) return 0;
        if (prevIdx >= imgs.length) return 0;
        return prevIdx;
      });

      return prev;
    });
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.on("update", syncEditorImages);
    return () => {
      editor.off("update", syncEditorImages);
    };
  }, [editor, syncEditorImages]);

  useEffect(() => {
    if (!isEdit || !id || !editor) return;

    resetCacheBuster();

    const load = async () => {
      try {
        const article = await fetchArticle(Number(id));
        const parsed = parseMarkdown(article.markdownContent, article.branch);

        setTitle(parsed.title);
        setDate(parsed.date);
        setCategories(parsed.categories);
        setOutline(parsed.outline);

        const existingImgs: ImageItem[] = parsed.existingImages.map(
          (path, i) => ({
            src: toProxyUrl(path, article.branch),
            data: "",
            isNew: false,
            originalPath: path,
            filename: path.split("/").pop() || `image${i}.jpg`,
          }),
        );

        setImageList(existingImgs);

        editor.commands.setContent(parsed.bodyHtml);

        if (parsed.thumb) {
          const thumbIdx = existingImgs.findIndex(
            (img) => img.filename === parsed.thumb,
          );
          if (thumbIdx >= 0) setThumbnailIndex(thumbIdx);
        }

        editor.setEditable(true);
        setLoadingContent(false);
        setPageLoading(false);

        setTimeout(() => syncEditorImages(), 0);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "記事の取得に失敗しました";
        showToast(message, "error");
        setLoadingContent(false);
        setPageLoading(false);
      }
    };

    load();
  }, [isEdit, id, editor, syncEditorImages]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (value.length > 0) {
      const result = validateTitle(value);
      setTitleError(result.valid ? "" : result.error || "");
    } else {
      setTitleError("");
    }
  };

  const toggleCategory = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const addImagesToEditor = useCallback(
    async (files: FileList | File[]) => {
      if (!editor) return;
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        try {
          const dataUrl = await compressImage(file);

          const existing = imageListRef.current.find(
            (img) => img.data === dataUrl,
          );
          if (existing) {
            editor.chain().focus().setImage({ src: existing.src }).run();
            continue;
          }

          const ext = file.name.split(".").pop() || "jpg";
          const filename = `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

          const newImage: ImageItem = {
            src: dataUrl,
            data: dataUrl,
            isNew: true,
            originalPath: "",
            filename,
          };

          setImageList((prev) => [...prev, newImage]);
          editor.chain().focus().setImage({ src: dataUrl }).run();
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "画像の処理に失敗しました";
          showToast(message, "error");
        }
      }
    },
    [editor],
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addImagesToEditor(e.target.files);
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (!editor) return;

    const handlePaste = (_view: unknown, event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return false;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        event.preventDefault();
        addImagesToEditor(imageFiles);
        return true;
      }
      return false;
    };

    editor.view.dom.addEventListener(
      "paste",
      handlePaste as unknown as EventListener,
    );
    return () => {
      editor.view.dom.removeEventListener(
        "paste",
        handlePaste as unknown as EventListener,
      );
    };
  }, [editor, addImagesToEditor]);

  const unusedImages = imageList.filter(
    (img) => !editorImages.some((ei) => ei.src === img.src),
  );

  const reinsertImage = (img: ImageItem) => {
    if (!editor) return;
    editor.chain().focus().setImage({ src: img.src }).run();
    setImagePoolOpen(false);
  };

  const handleSubmit = async () => {
    const titleValidation = validateTitle(title);
    if (!titleValidation.valid) {
      showToast(titleValidation.error || "タイトルエラー", "error");
      return;
    }

    const html = editor?.getHTML() || "";
    const { body, imageSrcs } = htmlToBody(html);

    if (!body.trim() && imageSrcs.length === 0) {
      showToast("本文を入力してください", "error");
      return;
    }

    const orderedImages = imageSrcs
      .map((src) => {
        const exact = imageList.find((img) => img.src === src);
        if (exact) return exact;
        const proxy = imageList.find(
          (img) =>
            src.includes(encodeURIComponent(img.originalPath)) ||
            img.src === src,
        );
        return proxy || imageList[0];
      })
      .filter(Boolean);

    setSubmitting(true);

    try {
      if (isEdit && id) {
        const input: UpdateArticleInput = {
          title,
          date,
          categories,
          outline,
          body,
          images: orderedImages.map((img) => ({
            filename: img.filename,
            data: img.isNew ? img.data : "",
            isNew: img.isNew,
            originalPath: img.originalPath,
          })),
          thumbnailIndex,
        };
        await updateArticle(Number(id), input);
        showToast("記事を更新しました", "success");
      } else {
        const input: CreateArticleInput = {
          title,
          date,
          categories,
          outline,
          body,
          images: orderedImages
            .filter((img) => img.isNew)
            .map((img) => ({
              filename: img.filename,
              data: img.data,
            })),
          thumbnailIndex,
        };
        await createArticle(input);
        showToast("記事を作成しました", "success");
      }
      navigate("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "送信に失敗しました";
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (pageLoading) {
    return <LoadingScreen message="記事を読み込み中..." />;
  }

  return (
    <div className="pb-20">
      <div className="bg-white border border-slate-200 rounded-lg p-6 max-md:p-4">
        <h1 className="text-xl font-bold mb-5">
          {isEdit ? "記事を編集" : "新規記事作成"}
        </h1>

        <div className="flex gap-4 mb-4 max-md:flex-col">
          <div className="flex flex-col gap-1.5 flex-1">
            <Label htmlFor="title">タイトル</Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="記事のタイトル"
            />
            {titleError && <p className="text-red-600 text-xs">{titleError}</p>}
          </div>

          <div className="flex flex-col gap-1.5 w-45 flex-none max-md:w-full">
            <Label htmlFor="date">日付</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 flex-1">
          <Label>カテゴリ</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <label
                key={cat}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-[13px] cursor-pointer transition-colors select-none max-md:px-3.5 max-md:py-2 max-md:text-sm ${
                  categories.includes(cat)
                    ? "bg-blue-100 border-blue-600 text-blue-800"
                    : "border-slate-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={categories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  className="hidden"
                />
                {cat}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 mt-4">
          <Label htmlFor="outline">概要 (outline)</Label>
          <Input
            id="outline"
            type="text"
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            placeholder="記事の概要"
          />
        </div>

        <div className="flex gap-2 mt-4 mb-2 flex-wrap max-md:flex-col">
          <Button
            variant="secondary"
            className="max-md:w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            画像を挿入
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {isEdit && (
            <Dropdown
              open={imagePoolOpen}
              onClose={() => setImagePoolOpen(false)}
              mobileMode="bottomsheet"
              trigger={
                <Button
                  variant="secondary"
                  className="max-md:w-full"
                  onClick={() => setImagePoolOpen(!imagePoolOpen)}
                >
                  追加済み画像から選択
                </Button>
              }
            >
              <div className="p-3">
                {unusedImages.length === 0 ? (
                  <p className="text-slate-500 text-[13px] text-center py-5">
                    再挿入可能な画像はありません
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {unusedImages.map((img, i) => (
                      <button
                        key={i}
                        className="bg-transparent border border-slate-200 rounded-sm p-1 cursor-pointer transition-colors hover:border-blue-600"
                        onClick={() => reinsertImage(img)}
                      >
                        <ImageWithLoader
                          src={img.src}
                          alt={img.filename}
                          size="sm"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Dropdown>
          )}
        </div>

        <div className="relative border border-slate-200 rounded-md min-h-75 mb-4">
          {loadingContent && <LoadingOverlay message="本文を読み込み中..." />}
          <EditorContent editor={editor} className="tiptap-editor" />
          {editor && editor.isEmpty && !loadingContent && (
            <div className="absolute top-4 left-4 text-slate-400 text-sm pointer-events-none">
              記事の本文を入力...
            </div>
          )}
        </div>

        {editorImages.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <Label>サムネイル画像を選択</Label>
            <div className="flex gap-3 flex-wrap mt-2 max-md:grid max-md:grid-cols-3 max-md:gap-2">
              {editorImages.map((img, i) => (
                <button
                  key={img.src}
                  className={`relative bg-transparent rounded-md p-1 cursor-pointer transition-colors border-2 max-md:w-full ${
                    i === thumbnailIndex
                      ? "border-blue-600"
                      : "border-transparent"
                  }`}
                  onClick={() => setThumbnailIndex(i)}
                >
                  <ImageWithLoader src={img.src} alt={img.filename} size="md" />
                  {i === thumbnailIndex && (
                    <span className="absolute -top-1.5 -right-1.5">
                      <Badge variant="info">THUMB</Badge>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-8 py-3 bg-white border-t border-slate-200 z-50 max-md:px-4 max-md:py-3">
        <Button
          variant="secondary"
          onClick={() => navigate("/")}
          disabled={submitting}
        >
          戻る
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? "送信中..." : isEdit ? "更新" : "プレビュー申請"}
        </Button>
      </div>
    </div>
  );
}
