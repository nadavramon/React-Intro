const refreshTokenStore: Map<string, string> = new Map();

export function save(token: string, userId: string): void {
  refreshTokenStore.set(token, userId);
}

export function findByToken(token: string): string | undefined {
  return refreshTokenStore.get(token);
}

export function remove(token: string): void {
  refreshTokenStore.delete(token);
}
