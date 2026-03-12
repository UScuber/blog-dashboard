import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchArticle,
  createArticle,
  updateArticle,
  fetchImageUrl,
} from "../lib/api";
import { showToast } from "../lib/toast";
import { validateTitle } from "../lib/validation";
import { parseMarkdown, toProxyUrl, resetCacheBuster } from "../lib/parser";
import type { ImageItem } from "../lib/types";
import { CATEGORIES } from "../lib/types";
import type { CreateArticleInput, UpdateArticleInput } from "../lib/types";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { LoadingOverlay } from "./LoadingOverlay";
import { LoadingScreen } from "./LoadingScreen";
import { ImageWithLoader } from "./ImageWithLoader";
import { BlockEditor, useBlockEditor } from "./block-editor";

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

  const {
    blocks,
    deletedImages,
    githubImages,
    thumbnailIndex,
    setThumbnailIndex,
    addBlock,
    removeBlock,
    updateBlock,
    moveBlock,
    restoreImage,
    updateImageByOriginalPath,
    loadFromParsed,
    getImages,
    serializeToBody,
  } = useBlockEditor();

  useEffect(() => {
    if (!isEdit || !id) return;

    resetCacheBuster();

    const load = async () => {
      try {
        const article = await fetchArticle(Number(id));
        const parsed = parseMarkdown(article.markdownContent, article.branch);

        setTitle(parsed.title);
        setDate(parsed.date);
        setCategories(parsed.categories);
        setOutline(parsed.outline);

        const placeholderImages: ImageItem[] = parsed.existingImages.map(
          (path, i) => ({
            src: "",
            data: "",
            isNew: false,
            originalPath: path,
            filename: path.split("/").pop() || `image${i}.jpg`,
          }),
        );

        loadFromParsed(parsed, placeholderImages);
        setLoadingContent(false);
        setPageLoading(false);

        parsed.existingImages.forEach((path, i) => {
          const proxyUrl = toProxyUrl(path, article.branch);
          fetchImageUrl(proxyUrl).then((blobUrl) => {
            updateImageByOriginalPath(path, {
              ...placeholderImages[i],
              src: blobUrl,
            });
          });
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "記事の取得に失敗しました";
        showToast(message, "error");
        setLoadingContent(false);
        setPageLoading(false);
      }
    };

    load();
  }, [isEdit, id, loadFromParsed, updateImageByOriginalPath]);

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

  const handleSubmit = async () => {
    const titleValidation = validateTitle(title);
    if (!titleValidation.valid) {
      showToast(titleValidation.error || "タイトルエラー", "error");
      return;
    }

    const { body, images } = serializeToBody();

    if (!body.trim() && images.length === 0) {
      showToast("本文を入力してください", "error");
      return;
    }

    setSubmitting(true);

    try {
      if (isEdit && id) {
        const input: UpdateArticleInput = {
          title,
          date,
          categories,
          outline,
          body,
          images: images.map((img) => ({
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
          images: images
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

  const editorImages = getImages();

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

        <div className="mt-4 mb-4">
          <Label className="mb-2 block">本文</Label>
          <div className="relative">
            {loadingContent && <LoadingOverlay message="本文を読み込み中..." />}
            <BlockEditor
              blocks={blocks}
              deletedImages={deletedImages}
              githubImages={githubImages}
              onAddBlock={addBlock}
              onRemoveBlock={removeBlock}
              onUpdateBlock={updateBlock}
              onMoveBlock={moveBlock}
              onRestoreImage={restoreImage}
            />
          </div>
        </div>

        {editorImages.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <Label>サムネイル画像を選択</Label>
            <div className="flex gap-3 flex-wrap mt-2 max-md:grid max-md:grid-cols-3 max-md:gap-2">
              {editorImages.map((img, i) => (
                <button
                  key={img.originalPath || img.filename || i}
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
