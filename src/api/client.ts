import { API_PREFIX, DEFAULT_API_URL, buildUrl } from './config';
import { apiUrlStorage, tokenStorage } from './storage';

/**
 * Cliente HTTP do app.
 *
 * Fino de propósito: adiciona o Bearer token, normaliza erros do Laravel e
 * avisa quando a sessão expira. Cache e revalidação são responsabilidade do
 * TanStack Query, não daqui.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: Record<string, string[]> = {},
    public readonly payload: unknown = null
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Erro de validação do Laravel (422). */
  get isValidation(): boolean {
    return this.status === 422;
  }

  /** Conflito de versão da ficha: alguém salvou antes (409). */
  get isConflict(): boolean {
    return this.status === 409;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** Primeira mensagem de erro de um campo, para exibir junto ao input. */
  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

let baseUrl = DEFAULT_API_URL;
let onUnauthorized: (() => void) | null = null;

/** Carrega a URL salva pelo usuário, se houver. Chamado na inicialização. */
export async function initApiBaseUrl(): Promise<string> {
  const stored = await apiUrlStorage.get();
  baseUrl = stored?.trim() ? stored.trim() : DEFAULT_API_URL;

  return baseUrl;
}

export function getApiBaseUrl(): string {
  return baseUrl;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  const clean = url.trim().replace(/\/+$/, '');
  baseUrl = clean || DEFAULT_API_URL;

  if (clean) {
    await apiUrlStorage.set(clean);
  } else {
    await apiUrlStorage.clear();
  }
}

/** Registra o que fazer quando a API responde 401 (limpar sessão e sair). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Requisição sem token (login, cadastro, recuperação de senha). */
  anonymous?: boolean;
  signal?: AbortSignal;
};

function buildQuery(query: RequestOptions['query']): string {
  if (!query) return '';

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  }

  const qs = params.toString();

  return qs ? `?${qs}` : '';
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, anonymous = false, signal } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    // Túneis do ngrok interpõem uma página de aviso em requisições que parecem
    // vir de navegador. Este cabeçalho pula o aviso e devolve o JSON direto.
    'ngrok-skip-browser-warning': 'true',
  };

  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (!anonymous) {
    const token = await tokenStorage.get();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const url = buildUrl(baseUrl, `${API_PREFIX}${path}`) + buildQuery(query);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    // Falha de rede: o servidor pode estar fora, o túnel caiu ou não há internet.
    throw new ApiError(
      'Não foi possível falar com o servidor. Verifique sua conexão e o endereço da API.',
      0
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const raw = await response.text();
  let data: unknown = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    const payload = (data ?? {}) as { message?: string; errors?: Record<string, string[]> };

    if (response.status === 401 && !anonymous) {
      onUnauthorized?.();
    }

    throw new ApiError(
      payload.message ?? `Erro ${response.status} ao falar com o servidor.`,
      response.status,
      payload.errors ?? {},
      data
    );
  }

  return data as T;
}

/** Envio de arquivo (avatar do personagem, foto de perfil). */
export async function apiUpload<T>(
  path: string,
  formData: FormData,
  method: 'POST' | 'PUT' = 'POST'
): Promise<T> {
  return apiRequest<T>(path, { method, body: formData });
}
