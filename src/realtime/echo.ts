import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { DEFAULT_REVERB, getApiBaseUrl, tokenStorage } from '@/api';

/**
 * Conexão de tempo real com o Laravel Reverb (briefing §6).
 *
 * Usamos laravel-echo sobre pusher-js porque o Reverb fala o protocolo do
 * Pusher — o mesmo cliente funciona em Android, iOS e web, sem código separado
 * por plataforma.
 *
 * A autorização de canal reaproveita o Bearer token da API: o endpoint
 * /api/broadcasting/auth roda no guard sanctum, então quem não é membro da
 * campanha recebe 403 e sequer assina o canal.
 */

type EchoInstance = InstanceType<typeof Echo>;

let echo: EchoInstance | null = null;
let currentToken: string | null = null;

/**
 * Deriva o host do WebSocket a partir da URL da API.
 *
 * Isso importa quando o backend está atrás de um túnel (ngrok) ou de um domínio
 * em produção: o socket precisa acompanhar o mesmo host, e sob HTTPS só o WSS
 * é aceito pelo navegador.
 */
function resolveConnection() {
  const apiUrl = getApiBaseUrl();

  try {
    const url = new URL(apiUrl);
    const isSecure = url.protocol === 'https:';

    // Com HTTPS assumimos que o WebSocket está publicado no mesmo host, na
    // porta padrão TLS — é como um proxy reverso normalmente expõe o Reverb.
    if (isSecure) {
      return { host: url.hostname, port: 443, forceTLS: true };
    }

    return {
      host: DEFAULT_REVERB.host || url.hostname,
      port: DEFAULT_REVERB.port,
      forceTLS: DEFAULT_REVERB.scheme === 'https',
    };
  } catch {
    return { host: DEFAULT_REVERB.host, port: DEFAULT_REVERB.port, forceTLS: false };
  }
}

export async function getEcho(): Promise<EchoInstance | null> {
  if (!DEFAULT_REVERB.key) {
    // Sem chave configurada não há tempo real; o app cai no modo de
    // atualização periódica (ver useCampaignChannel).
    return null;
  }

  const token = await tokenStorage.get();
  if (!token) {
    return null;
  }

  // Trocar de conta ou de servidor exige uma conexão nova.
  if (echo && currentToken === token) {
    return echo;
  }

  if (echo) {
    disconnectEcho();
  }

  const { host, port, forceTLS } = resolveConnection();
  currentToken = token;

  echo = new Echo({
    broadcaster: 'reverb',
    Pusher,
    key: DEFAULT_REVERB.key,
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS,
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    authEndpoint: `${getApiBaseUrl().replace(/\/+$/, '')}/api/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  });

  return echo;
}

export function disconnectEcho(): void {
  try {
    echo?.disconnect();
  } catch {
    // Desconectar é operação de limpeza: falhar aqui não deve quebrar a tela.
  }

  echo = null;
  currentToken = null;
}

/** Acesso ao socket bruto, para observar o estado da conexão. */
export function getConnectionState(): string | null {
  const connector = echo?.connector as { pusher?: { connection?: { state?: string } } } | undefined;

  return connector?.pusher?.connection?.state ?? null;
}
