import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { fetchArticles, createArticle, updateArticle } from '../lib/api';
import { parseMarkdown, htmlToBody, toProxyUrl } from '../lib/parser';
import { CATEGORIES } from '../lib/types';

interface ImageItem {
  src: string;        // DataURL (新規) or GitHub path (既存)
  filename: string;
  data: string;       // Base64 (新規のみ)
  isNew: boolean;
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

  // 画像リスト: エディタ内に挿入された画像を順番に管理
  const [imageList, setImageList] = useState<ImageItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
          style: 'max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0;',
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'wysiwyg-editor-content',
      },
    },
  });

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

        // 既存画像リストを構築（プロキシURL経由で表示、PRブランチを指定）
        const existingImages: ImageItem[] = parsed.existingImages.map((src) => ({
          src: toProxyUrl(src, branch),
          filename: src.split('/').pop() || 'image.jpg',
          data: '',
          isNew: false,
        }));
        setImageList(existingImages);

        // サムネイル復元
        if (parsed.thumb && existingImages.length > 0) {
          const thumbIdx = existingImages.findIndex((img) => img.filename === parsed.thumb);
          if (thumbIdx >= 0) setThumbnailIndex(thumbIdx);
        }

        // WYSIWYG エディタに HTML を設定
        editor.commands.setContent(parsed.bodyHtml);
      } catch (err: any) {
        setError(err.message || '記事の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, editor]);

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
    if (!files || files.length === 0 || !editor) return;

    Array.from(files).forEach((file) => {
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

        // エディタにIMG挿入
        editor.chain().focus().setImage({ src: dataUrl }).run();
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  }, [editor]);

  /** エディタ内の画像を収集し、body テキスト + 画像リストを返す */
  const extractContent = useCallback((): { body: string; images: ImageItem[] } => {
    if (!editor) return { body: '', images: [] };

    const html = editor.getHTML();
    const { body, imageSrcs } = htmlToBody(html);

    // imageSrcs の順序で画像リストを構築
    const orderedImages: ImageItem[] = imageSrcs.map((src) => {
      const existing = imageList.find((img) => img.src === src);
      if (existing) return existing;
      // 見つからない場合（通常起こらない）
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
      // サムネイルインデックスを調整（画像順序が変わっている可能性がある）
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
    return <div className="loading">読み込み中...</div>;
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
