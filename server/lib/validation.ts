import { HTTPException } from "hono/http-exception";
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
  const result = validateTitle(input.title);
  if (!result.valid) {
    throw new HTTPException(400, { message: result.error });
  }
}
