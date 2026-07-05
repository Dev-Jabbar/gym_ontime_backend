/**
 * Backend equivalent of the frontend's getAvatarFallback — same
 * reasoning (single source of truth, format=png forced to avoid
 * next/image's SVG rejection). Kept as a separate copy from the
 * frontend one since this is a different codebase/deployment
 * (Express backend vs. Next.js frontend), not importable across
 * the two.
 */
export function getAvatarFallback(name: string, size = 40): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name,
  )}&background=random&color=fff&size=${size}&format=png`;
}
