import { useRef, useEffect, type ReactNode } from "react";

interface DropdownProps {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  mobileMode?: "dropdown" | "bottomsheet";
}

export function Dropdown({
  open,
  onClose,
  trigger,
  children,
  mobileMode = "dropdown",
}: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  const isBottomsheet = mobileMode === "bottomsheet";

  return (
    <div className="relative inline-block" ref={ref}>
      {trigger}
      {open && (
        <>
          {isBottomsheet && (
            <div
              className="hidden max-md:block fixed inset-0 bg-black/30 z-90"
              onClick={onClose}
            />
          )}
          <div
            className={`absolute top-full left-0 z-50 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg min-w-60 max-h-75 overflow-y-auto ${
              isBottomsheet
                ? "max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:top-auto max-md:rounded-t-2xl max-md:rounded-b-none max-md:max-h-[60vh] max-md:z-100 max-md:mt-0"
                : ""
            }`}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}
