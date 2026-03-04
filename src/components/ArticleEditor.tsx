import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchArticles, createArticle, updateArticle } from '../lib/api';
import { parseMarkdown } from '../lib/parser';

interface ImageItem {
  filename: string;
  data: string;     // Base64
  isNew: boolean;
  previewUrl: string;
}

export default function ArticleEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [body, setBody] = useState('');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 編集時: 既存記事を読み込む
  useEffect(() => {
    if (!isEdit) return;

    (async () => {
      try {
        const articles = await fetchArticles();
        const article = articles.find((a) => a.id === Number(id));
        if (!article) {
          setError('記事が見つかりません');
          setLoading(false);
          return;
        }

        const parsed = parseMarkdown(article.markdownContent);
        setTitle(parsed.title);
        setDate(parsed.date);
        setBody(parsed.body);

        // 既存画像をImageItemに変換
        const existingImages: ImageItem[] = parsed.existingImages.map((src, i) => ({
          filename: src.split('/').pop() || `image-${i}`,
          data: '',
          isNew: false,
          previewUrl: src,
        }));
        setImages(existingImages);
      } catch (err: any) {
        setError(err.message || '記事の読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const handleImageInsert = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // data:image/...;base64,XXXX から Base64 部分を取得
        const base64 = result.split(',')[1];
        const newImage: ImageItem = {
          filename: file.name,
          data: base64,
          isNew: true,
          previewUrl: result,
        };

        setImages((prev) => {
          const newImages = [...prev, newImage];
          const index = newImages.length - 1;

          // テキストエリアのカーソル位置にプレースホルダーを挿入
          const textarea = textareaRef.current;
          if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const placeholder = `[image:${index}]`;
            const newText = text.substring(0, start) + placeholder + text.substring(end);
            setBody(newText);

            // カーソル位置を調整
            requestAnimationFrame(() => {
              textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
              textarea.focus();
            });
          }

          return newImages;
        });
      };
      reader.readAsDataURL(file);
    });

    // input をリセットして同じファイルを再選択可能にする
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    // プレースホルダーの番号を振り直す
    setBody((prev) => {
      let newBody = prev.replace(new RegExp(`\\[image:${index}\\]`, 'g'), '');
      // index より大きい番号を1つ減らす
      for (let i = index + 1; i < images.length; i++) {
        newBody = newBody.replace(new RegExp(`\\[image:${i}\\]`, 'g'), `[image:${i - 1}]`);
      }
      return newBody;
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }
    if (!body.trim()) {
      alert('本文を入力してください');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (isEdit) {
        await updateArticle(Number(id), {
          title,
          date,
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

  // プレビュー用: [image:N] を実際の画像に置換した HTML を生成
  const renderPreview = () => {
    const frontMatter = `---\nlayout: post\ntitle: "${title}"\ndate: ${date}\n---`;

    let previewBody = body;

    // [image:N] を <img> タグに置換
    previewBody = previewBody.replace(/\[image:(\d+)\]/g, (_, idx) => {
      const i = parseInt(idx, 10);
      if (i >= 0 && i < images.length) {
        return `<img src="${images[i].previewUrl}" alt="${images[i].filename}" style="max-width:100%;height:auto;">`;
      }
      return `[image:${idx}]`;
    });

    // 改行を <br> に変換
    previewBody = previewBody.replace(/\n/g, '<br>');

    return { frontMatter, previewBody };
  };

  if (loading) {
    return <div className="loading">読み込み中...</div>;
  }

  const preview = renderPreview();

  return (
    <div className="editor-page">
      <div className="editor-layout">
        {/* 左側: エディタ */}
        <div className="editor-panel">
          <h2>{isEdit ? '記事を編集' : '新規記事作成'}</h2>

          {error && <div className="error-message"><p>{error}</p></div>}

          <div className="form-group">
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

          <div className="form-group">
            <label htmlFor="date">日付</label>
            <input
              id="date"
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="body">本文</label>
            <div className="textarea-toolbar">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleImageInsert}
              >
                画像を挿入
              </button>
            </div>
            <textarea
              id="body"
              ref={textareaRef}
              className="form-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="記事の本文を入力..."
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {/* 挿入済み画像一覧 */}
          {images.length > 0 && (
            <div className="image-list">
              <label>挿入済み画像</label>
              <div className="image-thumbnails">
                {images.map((img, idx) => (
                  <div key={idx} className="image-thumb">
                    <img
                      src={img.previewUrl}
                      alt={img.filename}
                    />
                    <span className="image-label">[image:{idx}]</span>
                    <button
                      type="button"
                      className="image-remove"
                      onClick={() => handleRemoveImage(idx)}
                      title="削除"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右側: プレビュー */}
        <div className="preview-panel">
          <h2>プレビュー</h2>
          <div className="preview-content">
            <pre className="preview-frontmatter">{preview.frontMatter}</pre>
            <div
              className="preview-body"
              dangerouslySetInnerHTML={{ __html: preview.previewBody }}
            />
          </div>
        </div>
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
          {submitting
            ? '送信中...'
            : isEdit
              ? '更新'
              : 'プレビュー申請'}
        </button>
      </div>
    </div>
  );
}
