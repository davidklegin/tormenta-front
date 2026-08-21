import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Armazenamento do token de sessão (briefing §1: persistência da sessão).
 *
 * No celular usamos o SecureStore, que guarda no Keychain (iOS) ou Keystore
 * (Android). Na web o SecureStore não existe, então caímos no AsyncStorage —
 * que em RN Web é localStorage. A interface é a mesma nos três alvos, então o
 * resto do app não precisa saber onde o token mora.
 */
const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);

    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return AsyncStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key);

    return;
  }

  await SecureStore.deleteItemAsync(key);
}

const TOKEN_KEY = 'tormenta20.auth.token';
const API_URL_KEY = 'tormenta20.api.url';

export const tokenStorage = {
  get: () => getItem(TOKEN_KEY),
  set: (token: string) => setItem(TOKEN_KEY, token),
  clear: () => removeItem(TOKEN_KEY),
};

/** URL da API escolhida pelo usuário; sobrepõe a do build quando presente. */
export const apiUrlStorage = {
  get: () => AsyncStorage.getItem(API_URL_KEY),
  set: (url: string) => AsyncStorage.setItem(API_URL_KEY, url),
  clear: () => AsyncStorage.removeItem(API_URL_KEY),
};
