import { HTTPException } from "hono/http-exception";
import { parse, isAfter, startOfToday } from "date-fns";
import { ja } from "date-fns/locale";
import type { ArticleInput } from "./types";

// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARS = /[/\\:*?"<>|\x00-\x1f]/;

const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i;

export function validateTitle(title: string): {
  valid: boolean;
  error?: string;
} {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: "タイトルを入力してください" };
  }

  const match = title.match(FORBIDDEN_CHARS);
  if (match) {
    return {
      valid: false,
      error: `タイトルに使用できない文字が含まれています: ${match[0]}`,
    };
  }

  if (
    title.startsWith(" ") ||
    title.startsWith(".") ||
    title.endsWith(" ") ||
    title.endsWith(".")
  ) {
    return {
      valid: false,
      error: "タイトルの先頭・末尾にスペースやピリオドは使用できません",
    };
  }

  if (RESERVED_NAMES.test(title)) {
    return { valid: false, error: "タイトルに予約語は使用できません" };
  }

  return { valid: true };
}

export function validateArticleInput(input: ArticleInput): void {
  if (!input.title || !input.date || input.body === undefined) {
    throw new HTTPException(400, {
      message: "タイトル、日付、本文は必須です",
    });
  }

  const titleResult = validateTitle(input.title);
  if (!titleResult.valid) {
    throw new HTTPException(400, { message: titleResult.error });
  }

  const parsedDate = parse(input.date, "yyyy-MM-dd", new Date(), {
    locale: ja,
  });
  if (isAfter(parsedDate, startOfToday())) {
    throw new HTTPException(400, { message: "未来の日付は選択できません" });
  }

  if (!input.categories || input.categories.length === 0) {
    throw new HTTPException(400, {
      message: "カテゴリを1つ以上選択してください",
    });
  }

  if (
    !input.outline ||
    input.outline.trim().length === 0 ||
    input.outline.includes("\n")
  ) {
    throw new HTTPException(400, {
      message: "概要は1文字以上、改行なしで入力してください",
    });
  }

  if (!input.body || !input.body.trim()) {
    throw new HTTPException(400, { message: "本文を入力してください" });
  }
}
