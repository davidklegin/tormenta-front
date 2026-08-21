import { apiRequest } from '../client';
import type { AuthResponse, Envelope, User } from '../types';

export const authApi = {
  register: (payload: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    nickname?: string;
    device_name?: string;
  }) => apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: payload, anonymous: true }),

  login: (payload: { email: string; password: string; device_name?: string }) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: payload, anonymous: true }),

  logout: () => apiRequest<{ message: string }>('/auth/logout', { method: 'POST' }),

  me: () => apiRequest<Envelope<User>>('/auth/me').then((r) => r.data),

  updateProfile: (payload: { name?: string; nickname?: string; bio?: string; email?: string }) =>
    apiRequest<Envelope<User>>('/auth/me', { method: 'PUT', body: payload }).then((r) => r.data),

  updatePassword: (payload: { current_password: string; password: string; password_confirmation: string }) =>
    apiRequest<{ message: string }>('/auth/me/password', { method: 'PUT', body: payload }),

  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
      anonymous: true,
    }),

  resetPassword: (payload: {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) =>
    apiRequest<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: payload,
      anonymous: true,
    }),
};
