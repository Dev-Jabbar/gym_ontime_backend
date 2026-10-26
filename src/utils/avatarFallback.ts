/**
 * Backend equivalent of the frontend's getAvatarFallback: the same logic
 * (one source of truth, `format=png` forced because next/image rejects SVG).
 * It is a separate copy because the backend and the frontend are separate
 * codebases and cannot import from each other.
 */
export function getAvatarFallback(name: string, size = 40): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name,
  )}&background=random&color=fff&size=${size}&format=png`;
}
