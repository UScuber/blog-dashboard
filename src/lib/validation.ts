import { parse, isAfter, startOfToday } from "date-fns";
import { ja } from "date-fns/locale";

// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARS = /[/\\:*?"<>|\x00-\x1f]/;

const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$/i;

export function validateDate(date: string): {
  valid: boolean;
  error?: string;
} {
  if (!date) {
    return { valid: false, error: "日付を入力してください" };
  }
  const parsed = parse(date, "yyyy-MM-dd", new Date(), { locale: ja });
  if (isAfter(parsed, startOfToday())) {
    return { valid: false, error: "未来の日付は選択できません" };
  }
  return { valid: true };
}

export function validateOutline(outline: string): {
  valid: boolean;
  error?: string;
} {
  if (!outline || outline.trim().length === 0) {
    return { valid: false, error: "概要を入力してください" };
  }
  if (outline.includes("\n")) {
    return { valid: false, error: "概要に改行は使用できません" };
  }
  return { valid: true };
}

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
