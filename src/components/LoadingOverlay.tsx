import { Spinner } from "./Spinner";

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center gap-3 z-10 rounded-md">
      <Spinner size="md" />
      {message && <p className="text-slate-500 text-sm">{message}</p>}
    </div>
  );
}
