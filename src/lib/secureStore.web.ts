/**
 * expo-secure-store has no web implementation. The web target exists for browser tests, so keys go to
 * localStorage in plain text – do not ship the web build to users as is.
 */
const PREFIX = 'secure:';

export async function getItemAsync(key: string): Promise<string | null> {
  return localStorage.getItem(PREFIX + key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  localStorage.setItem(PREFIX + key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  localStorage.removeItem(PREFIX + key);
}
