export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded bg-muted ${className ?? ""}`}
      {...props}
    />
  );
}
