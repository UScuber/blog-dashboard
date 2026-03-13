import { useEffect } from "react";
import { useBlocker } from "react-router-dom";

interface UseUnsavedChangesOptions {
  isDirty: boolean;
  shouldBlock: () => boolean;
}

export function useUnsavedChanges({
  isDirty,
  shouldBlock,
}: UseUnsavedChangesOptions) {
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state === "blocked") {
      const proceed = window.confirm(
        "編集内容が保存されていません。ページを離れますか？",
      );
      if (proceed) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
