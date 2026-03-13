import { useEffect } from "react";
import { useBlocker } from "react-router-dom";

interface UseUnsavedChangesOptions {
  isDirty: boolean;
  enabled: boolean;
}

export function useUnsavedChanges({
  isDirty,
  enabled,
}: UseUnsavedChangesOptions) {
  const shouldBlock = isDirty && enabled;

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
    if (!shouldBlock) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlock]);
}
