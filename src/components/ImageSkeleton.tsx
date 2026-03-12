import { Spinner } from "./Spinner";

interface ImageSkeletonProps {
  size?: "block" | "sm" | "md";
}

const sizeClasses = {
  block: "max-w-[450px] w-full aspect-video max-md:max-w-full",
  sm: "w-20 h-15",
  md: "w-25 h-20",
};

export function ImageSkeleton({ size = "block" }: ImageSkeletonProps) {
  return (
    <div
      className={`flex items-center justify-center bg-slate-100 rounded-sm animate-pulse ${sizeClasses[size]}`}
    >
      <Spinner size={size === "block" ? "md" : "sm"} />
    </div>
  );
}
