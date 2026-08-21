import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Endereço do backend.
 *
 * A URL padrão vem de app.json (extra.apiUrl), mas pode ser trocada em tempo de
 * execução na tela de configurações. Isso é deliberado: quando a API está atrás
 * de um túnel (ngrok) ou muda de host, o app instalado continua utilizável sem
 * precisar de um novo build.
 */
type ExtraConfig = {
  apiUrl?: string;
  reverb?: { key?: string; host?: string; port?: number; scheme?: string };
};

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig;

/**
 * No emulador Android, 10.0.2.2 é o host da máquina; no simulador iOS e na web,
 * localhost. Só vale para desenvolvimento — em produção a URL vem do app.json.
 */
function defaultDevUrl(): string {
  if (Platform.OS === 'android') return 'http://10.0.2.2:8010';
  return 'http://localhost:8010';
}

export const DEFAULT_API_URL = extra.apiUrl ?? defaultDevUrl();

export const DEFAULT_REVERB = {
  key: extra.reverb?.key ?? '',
  host: extra.reverb?.host ?? 'localhost',
  port: extra.reverb?.port ?? 8081,
  scheme: extra.reverb?.scheme ?? 'http',
};

export const API_PREFIX = '/api/v1';

/** Junta base e caminho sem gerar barras duplicadas. */
export function buildUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;

  return `${base}${suffix}`;
}
