import { Spinner } from "./Spinner";

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Spinner size="lg" />
      {message && <p className="text-slate-500 text-sm">{message}</p>}
    </div>
  );
}
