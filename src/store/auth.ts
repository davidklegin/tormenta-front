import { create } from 'zustand';
import { ApiError, authApi, getApiBaseUrl, initApiBaseUrl, setApiBaseUrl, tokenStorage } from '@/api';
import type { User } from '@/api/types';

/**
 * Sessão do jogador (briefing §1).
 *
 * O token vive no armazenamento seguro do dispositivo; aqui guardamos apenas o
 * estado em memória que a interface observa. `bootstrap()` roda uma vez na
 * abertura do app e decide entre login e área logada.
 */
type AuthState = {
  user: User | null;
  status: 'loading' | 'authenticated' | 'guest';
  apiUrl: string;
  error: string | null;

  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
  changeApiUrl: (url: string) => Promise<void>;
  clearSession: () => void;
};

const DEVICE_NAME = 'tormenta20-app';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',
  apiUrl: getApiBaseUrl(),
  error: null,

  bootstrap: async () => {
    const apiUrl = await initApiBaseUrl();
    set({ apiUrl });

    const token = await tokenStorage.get();
    if (!token) {
      set({ status: 'guest', user: null });

      return;
    }

    try {
      const user = await authApi.me();
      set({ user, status: 'authenticated', error: null });
    } catch (error) {
      // Token inválido, expirado ou servidor inacessível: volta para o login
      // em vez de deixar o app preso na tela de carregamento.
      await tokenStorage.clear();
      set({
        user: null,
        status: 'guest',
        error: error instanceof ApiError && error.status === 0 ? error.message : null,
      });
    }
  },

  login: async (email, password) => {
    const { token, user } = await authApi.login({ email, password, device_name: DEVICE_NAME });
    await tokenStorage.set(token);
    set({ user, status: 'authenticated', error: null });
  },

  register: async (payload) => {
    const { token, user } = await authApi.register({ ...payload, device_name: DEVICE_NAME });
    await tokenStorage.set(token);
    set({ user, status: 'authenticated', error: null });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Se o servidor não responder, encerramos a sessão localmente mesmo
      // assim: o usuário pediu para sair.
    }

    await tokenStorage.clear();
    set({ user: null, status: 'guest' });
  },

  refreshUser: async () => {
    const user = await authApi.me();
    set({ user });
  },

  setUser: (user) => set({ user }),

  changeApiUrl: async (url) => {
    await setApiBaseUrl(url);
    set({ apiUrl: getApiBaseUrl() });

    // Trocar de servidor invalida a sessão atual: o token pertence ao anterior.
    await tokenStorage.clear();
    set({ user: null, status: 'guest' });
  },

  /** Chamado pelo cliente HTTP quando a API devolve 401. */
  clearSession: () => {
    void tokenStorage.clear();
    set({ user: null, status: 'guest' });
  },
}));
