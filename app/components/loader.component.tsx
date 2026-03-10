interface LoaderProps {
  size?: number;
  className?: string;
}

export function Loader({ size = 24, className }: LoaderProps) {
  return (
    <div
      className={className ? `grid place-items-center ${className}` : undefined}
    >
      <span
        className="inline-block rounded-full border-2 border-gray-200 border-t-gray-700 animate-spin will-change-transform"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
