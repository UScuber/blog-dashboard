import { useRef, useEffect } from "react";
import type { TextBlock } from "../../lib/types";

interface AutoResizeTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className = "w-full p-3 border border-slate-200 rounded-md resize-none text-base leading-relaxed outline-none focus:border-blue-500 transition-colors overflow-hidden",
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleInput}
      placeholder={placeholder}
      rows={1}
      className={className}
      style={{ fontSize: "16px" }}
    />
  );
}

interface TextBlockComponentProps {
  block: TextBlock;
  onChange: (content: string) => void;
}

export function TextBlockComponent({
  block,
  onChange,
}: TextBlockComponentProps) {
  return (
    <AutoResizeTextarea
      value={block.content}
      onChange={onChange}
      placeholder="テキストを入力..."
    />
  );
}
