// A menu photo that serves a WebP copy when one exists and falls back to the original file.
export function MenuPhoto({ src, webp, alt, className, size, priority = false, onLoad }: {
  src: string; webp?: string | undefined; alt: string; className?: string; size: number; priority?: boolean; onLoad?: () => void;
}) {
  const img = (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      className={className}
      onLoad={onLoad}
    />
  );
  if (!webp) return img;
  return (
    <picture className="block">
      <source srcSet={webp} type="image/webp" />
      {img}
    </picture>
  );
}
