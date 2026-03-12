import { useToast } from "../lib/toast";

export function Toast() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  const typeClasses = {
    error: "bg-red-600",
    success: "bg-green-600",
    info: "bg-blue-600",
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-[400px] max-md:left-4 max-md:max-w-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start justify-between gap-3 px-4 py-3 rounded-lg text-sm text-white break-words ${typeClasses[t.type]} ${
            t.removing
              ? "animate-[toast-out_0.3s_ease_forwards]"
              : "animate-[toast-in_0.3s_ease]"
          }`}
        >
          <span>{t.message}</span>
          <button
            className="bg-transparent border-none text-white text-lg cursor-pointer p-0 leading-none opacity-80 shrink-0 hover:opacity-100"
            onClick={() => dismiss(t.id)}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
