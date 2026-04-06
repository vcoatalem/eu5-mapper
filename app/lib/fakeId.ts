/**
 * Returns a stable fake user ID for dev mode, undefined in production.
 * This gates the entire save-file import feature until real auth is implemented.
 *
 * Value: "dev_{NEXT_PUBLIC_GIT_SHA}" — stable across page reloads for the same build.
 * NEXT_PUBLIC_GIT_SHA is injected by scripts/inject-commit-sha.sh.
 */
export function getFakeId(): string | undefined {
  if (process.env.NODE_ENV !== "development") return undefined;
  const sha = process.env.NEXT_PUBLIC_GIT_SHA;
  if (!sha) return undefined;
  return `dev_${sha}`;
}
