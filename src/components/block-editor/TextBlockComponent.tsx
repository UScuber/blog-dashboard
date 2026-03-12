import { useRef, useEffect } from "react";
import type { TextBlock } from "../../lib/types";

interface TextBlockComponentProps {
  block: TextBlock;
  onChange: (content: string) => void;
}

export function TextBlockComponent({
  block,
  onChange,
}: TextBlockComponentProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [block.content]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <textarea
      ref={textareaRef}
      value={block.content}
      onChange={handleInput}
      placeholder="テキストを入力..."
      className="w-full min-h-[80px] p-3 border border-slate-200 rounded-md resize-none text-base leading-relaxed outline-none focus:border-blue-500 transition-colors"
      style={{ fontSize: "16px" }}
    />
  );
}
