/**
 * Persistencia del idioma (Mobile Ready).
 * Desarrollo: localStorage.
 * Para compilación nativa (Capacitor), descomentar y usar @capacitor/preferences:
 *
 *   import { Preferences } from '@capacitor/preferences';
 *   export async function getStoredLanguage() {
 *     const { value } = await Preferences.get({ key: 'app-language' });
 *     return value ?? null;
 *   }
 *   export async function setStoredLanguage(locale) {
 *     await Preferences.set({ key: 'app-language', value: locale });
 *   }
 *
 * Alternativa React Native: AsyncStorage.
 */

const STORAGE_KEY = "digitalbrain-language";

export function getStoredLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredLanguage(locale) {
  try {
    if (locale) localStorage.setItem(STORAGE_KEY, locale);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
