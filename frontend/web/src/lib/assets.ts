/** Public assets must follow the hosting base, including GitHub Pages project paths. */
export function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}
