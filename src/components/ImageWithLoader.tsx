import { useState } from "react";
import { ImageSkeleton } from "./ImageSkeleton";
import { Spinner } from "./Spinner";

interface ImageWithLoaderProps {
  src: string;
  alt: string;
  size?: "sm" | "md";
}

export function ImageWithLoader({
  src,
  alt,
  size = "md",
}: ImageWithLoaderProps) {
  const [loaded, setLoaded] = useState(false);
  const [prevSrc, setPrevSrc] = useState(src);

  if (prevSrc !== src) {
    setPrevSrc(src);
    setLoaded(false);
  }

  const sizeClasses = {
    sm: "w-20 h-15",
    md: "w-25 h-20",
  };

  if (!src) {
    return <ImageSkeleton size={size} />;
  }

  return (
    <div
      className={`relative flex items-center justify-center bg-slate-100 rounded-sm overflow-hidden shrink-0 ${sizeClasses[size]}`}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size="sm" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className="w-full h-full object-cover"
        style={{ display: loaded ? "block" : "none" }}
      />
    </div>
  );
}
