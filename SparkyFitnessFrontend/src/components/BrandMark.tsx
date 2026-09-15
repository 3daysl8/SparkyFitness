import { useId } from 'react';

/** The Ouroboros ring mark on a transparent background, for places (like the
 * header) where it needs to sit directly on the surrounding surface instead
 * of inside its own app-icon tile. `/images/logo.webp` bakes in an opaque
 * rounded-square backdrop (it's meant for the OS icon/social-preview/auth
 * screens), so it can't blend into a bar the way this inline SVG can. */
export function BrandMark({
  size = 36,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const gradientId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Ouros Life"
      className={className}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="4"
          y1="8"
          x2="44"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="35%" stopColor="#6366f1" />
          <stop offset="70%" stopColor="#d946ef" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <circle
        cx="24"
        cy="24"
        r="18"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}
