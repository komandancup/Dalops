export function emailDariUsername(u: string): string {
  return `${u}@warung.app`;
}

export function usernameValid(u: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(u);
}
