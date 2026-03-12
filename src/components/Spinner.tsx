interface SpinnerProps {
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-3.5 h-3.5 border-2",
  md: "w-8 h-8 border-3",
  lg: "w-10 h-10 border-4",
};

export function Spinner({ size = "md" }: SpinnerProps) {
  return (
    <div
      className={`rounded-full border-solid border-slate-200 border-t-blue-600 animate-spin shrink-0 ${sizeClasses[size]}`}
    />
  );
}
