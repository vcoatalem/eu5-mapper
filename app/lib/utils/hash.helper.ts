export class HashHelper {
  public static getGitHash(): string {
    const elt = document.querySelector('meta[name="commit-sha"]');
    return elt?.getAttribute('content') || '';
  }
}