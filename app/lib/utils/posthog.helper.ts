export class PosthogHelper {
  public static isPosthogEnabled(): boolean {
    const isDev = process.env.NODE_ENV === 'development';
    return !isDev;
  }
}