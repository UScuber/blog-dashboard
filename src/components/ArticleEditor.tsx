import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { fetchArticles, createArticle, updateArticle } from '../lib/api';
import { parseMarkdown, htmlToBody, toProxyUrl } from '../lib/parser';
import { CATEGORIES } from '../lib/types';

interface ImageItem {
  src: string;           // DataURL (新規) or ProxyURL (既存)
  filename: string;
  data: string;          // Base64 (新規のみ)
  isNew: boolean;
  originalPath?: string; // 既存画像のGitHub上パス (例: "/assets/img/blog/.../image001.jpg")
}

export default function ArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [categories, setCategories] = useState<string[]>([]);
  const [outline, setOutline] = useState('');
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [imageList, setImageList] = useState<ImageItem[]>([]);
  const [showImagePool, setShowImagePool] = useState(false);
  const [unusedImages, setUnusedImages] = useState<ImageItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagePoolRef = useRef<HTMLDivElement>(null);
  const addImageRef = useRef<(file: File) => void>(undefined);

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
      Image.configure({
        inline: false,
        HTMLAttributes: {
          style: 'max-width: 450px; height: auto; border-radius: 4px; margin: 8px 0;',
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'wysiwyg-editor-content',
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) addImageRef.current?.(file);
            return true;
          }
        }
        return false;
      },
    },
  });

  /** 画像ファイルをエディタに追加する共通ヘルパー */
  const addImageToEditor = useCallback((file: File) => {
    if (!editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      const newItem: ImageItem = {
        src: dataUrl,
        filename: file.name,
        data: base64,
        isNew: true,
      };
      setImageList((prev) => [...prev, newItem]);
      editor.chain().focus().setImage({ src: dataUrl }).run();
    };
    reader.readAsDataURL(file);
  }, [editor]);

  addImageRef.current = addImageToEditor;

  // 編集時: 既存記事を読み込む
  useEffect(() => {
    if (!isEdit || !editor) return;

    (async () => {
      try {
        const articles = await fetchArticles();
        const article = articles.find((a) => a.id === Number(id));
        if (!article) {
          setError('記事が見つかりません');
          setLoading(false);
          return;
        }

        const branch = article.branch;
        const parsed = parseMarkdown(article.markdownContent, branch);
        setTitle(parsed.title);
        setDate(parsed.date);
        setCategories(parsed.categories);
        setOutline(parsed.outline);

        const existingImages: ImageItem[] = parsed.existingImages.map((src) => ({
          src: toProxyUrl(src, branch),
          filename: src.split('/').pop() || 'image.jpg',
          data: '',
          isNew: false,
          originalPath: src,
        }));
        setImageList(existingImages);

        if (parsed.thumb && existingImages.length > 0) {
          const thumbIdx = existingImages.findIndex((img) => img.filename === parsed.thumb);
          if (thumbIdx >= 0) setThumbnailIndex(thumbIdx);
        }

        editor.commands.setContent(parsed.bodyHtml);
      } catch (err: any) {
        setError(err.message || '記事の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, editor]);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (imagePoolRef.current && !imagePoolRef.current.contains(e.target as Node)) {
        setShowImagePool(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategoryToggle = (cat: string) => {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleImageInsert = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => addImageToEditor(file));
    e.target.value = '';
  }, [addImageToEditor]);

  /** エディタ内で使用中の画像srcを収集 */
  const getUsedSrcs = useCallback((): Set<string> => {
    if (!editor) return new Set();
    const json = editor.getJSON();
    const srcs = new Set<string>();
    const walk = (node: any) => {
      if (node.type === 'image' && node.attrs?.src) {
        srcs.add(node.attrs.src);
      }
      if (node.content) {
        for (const child of node.content) walk(child);
      }
    };
    walk(json);
    return srcs;
  }, [editor]);

  /** 追加済み画像プールの表示切替 */
  const toggleImagePool = () => {
    if (!showImagePool) {
      const usedSrcs = getUsedSrcs();
      setUnusedImages(imageList.filter((img) => !usedSrcs.has(img.src)));
    }
    setShowImagePool((prev) => !prev);
  };

  /** 未使用画像をエディタに再挿入 */
  const handleReinsertImage = (img: ImageItem) => {
    if (!editor) return;
    editor.chain().focus().setImage({ src: img.src }).run();
    setShowImagePool(false);
  };

  /** エディタ内の画像を収集し、body テキスト + 画像リストを返す */
  const extractContent = useCallback((): { body: string; images: ImageItem[] } => {
    if (!editor) return { body: '', images: [] };

    const html = editor.getHTML();
    const { body, imageSrcs } = htmlToBody(html);

    const orderedImages: ImageItem[] = imageSrcs.map((src) => {
      const existing = imageList.find((img) => img.src === src);
      if (existing) return existing;
      return { src, filename: src.split('/').pop() || 'image.jpg', data: '', isNew: false };
    });

    return { body, images: orderedImages };
  }, [editor, imageList]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }

    const { body, images } = extractContent();
    if (!body.trim() && images.length === 0) {
      alert('本文を入力してください');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const thumbIdx = thumbnailIndex < images.length ? thumbnailIndex : 0;

      if (isEdit) {
        await updateArticle(Number(id), {
          title,
          date,
          categories,
          outline,
          thumbnailIndex: thumbIdx,
          body,
          images: images.map((img) => ({
            filename: img.filename,
            data: img.data,
            isNew: img.isNew,
            originalPath: img.originalPath,
          })),
        });
      } else {
        await createArticle({
          title,
          date,
          categories,
          outline,
          thumbnailIndex: thumbIdx,
          body,
          images: images
            .filter((img) => img.isNew)
            .map((img) => ({
              filename: img.filename,
              data: img.data,
            })),
        });
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || '送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <p className="loading-text">記事の内容を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="editor-page">
      <div className="editor-single">
        <h2>{isEdit ? '記事を編集' : '新規記事作成'}</h2>

        {error && <div className="error-message"><p>{error}</p></div>}

        {/* メタ情報フォーム */}
        <div className="form-row">
          <div className="form-group form-group-flex">
            <label htmlFor="title">タイトル</label>
            <input
              id="title"
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="記事のタイトル"
            />
          </div>
          <div className="form-group" style={{ width: 180, flexShrink: 0 }}>
            <label htmlFor="date">日付</label>
            <input
              id="date"
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>カテゴリ</label>
          <div className="category-checkboxes">
            {CATEGORIES.map((cat) => (
              <label key={cat} className="category-checkbox">
                <input
                  type="checkbox"
                  checked={categories.includes(cat)}
                  onChange={() => handleCategoryToggle(cat)}
                />
                <span>{cat}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="outline">概要 (outline)</label>
          <input
            id="outline"
            type="text"
            className="form-input"
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            placeholder="記事の概要を入力..."
          />
        </div>

        {/* WYSIWYG エディタ */}
        <div className="form-group">
          <label>本文</label>
          <div className="wysiwyg-toolbar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleImageInsert}
            >
              画像を挿入
            </button>
            {imageList.length > 0 && (
              <div className="image-pool-wrapper" ref={imagePoolRef}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={toggleImagePool}
                >
                  追加済み画像から選択
                </button>
                {showImagePool && (
                  <div className="image-pool-dropdown">
                    {unusedImages.length === 0 ? (
                      <p className="image-pool-empty">再挿入可能な画像はありません</p>
                    ) : (
                      <div className="image-pool-grid">
                        {unusedImages.map((img, idx) => (
                          <div
                            key={idx}
                            className="image-pool-item"
                            onClick={() => handleReinsertImage(img)}
                          >
                            <img src={img.src} alt={img.filename} />
                            <span>{img.filename}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="wysiwyg-editor-wrapper">
            <EditorContent editor={editor} />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {/* サムネイル選択 */}
        {imageList.length > 0 && (
          <div className="image-list">
            <label>サムネイル画像を選択 (クリックで選択)</label>
            <div className="image-thumbnails">
              {imageList.map((img, idx) => (
                <div
                  key={idx}
                  className={`image-thumb ${idx === thumbnailIndex ? 'image-thumb-selected' : ''}`}
                  onClick={() => setThumbnailIndex(idx)}
                >
                  <img src={img.src} alt={img.filename} />
                  <span className="image-label">
                    {img.filename}
                    {idx === thumbnailIndex && <span className="thumb-badge">THUMB</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* フッター */}
      <div className="editor-footer">
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/')}
          disabled={submitting}
        >
          戻る
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? '送信中...' : isEdit ? '更新' : 'プレビュー申請'}
        </button>
      </div>
    </div>
  );
}
