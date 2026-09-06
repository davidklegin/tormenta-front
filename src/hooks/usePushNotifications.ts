import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { pushApi } from '@/api';

type PushState = 'loading' | 'unsupported' | 'denied' | 'granted' | 'default';

/**
 * Hook para gerenciar Web Push Notifications.
 *
 * Retorna o estado atual das permissões e funções para solicitar/remover.
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading');
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  // Só funciona na web
  const isSupported =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  // Buscar chave VAPID
  const vapidQuery = useQuery({
    queryKey: ['push', 'vapid'],
    queryFn: () => pushApi.getVapidKey(),
    enabled: isSupported && state !== 'unsupported',
    staleTime: Infinity,
  });

  // Verificar estado inicial
  useEffect(() => {
    if (!isSupported) {
      setState('unsupported');
      return;
    }

    // Verificar permissão atual
    const permission = Notification.permission;
    setState(permission as PushState);

    // Registrar service worker se não estiver registrado
    navigator.serviceWorker.getRegistration('/sw-push.js').then((reg) => {
      if (reg) {
        setRegistration(reg);
      }
    });
  }, [isSupported]);

  // Mutation para registrar subscription no servidor
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!vapidQuery.data) {
        throw new Error('Chave VAPID não disponível');
      }

      // Solicitar permissão
      const permission = await Notification.requestPermission();

      if (permission !== 'granted') {
        setState(permission as PushState);
        throw new Error('Permissão negada');
      }

      setState('granted');

      // Registrar service worker
      let reg = registration;
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw-push.js');
        setRegistration(reg);
      }

      // Aguardar service worker ativo
      await navigator.serviceWorker.ready;

      // Criar subscription
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidQuery.data),
      });

      // Enviar para o servidor
      const json = subscription.toJSON();
      return pushApi.subscribe(json);
    },
  });

  // Mutation para remover subscription
  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      if (!registration) {
        return;
      }

      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await pushApi.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }

      setState('default');
    },
  });

  const subscribe = useCallback(() => {
    subscribeMutation.mutate();
  }, [subscribeMutation]);

  const unsubscribe = useCallback(() => {
    unsubscribeMutation.mutate();
  }, [unsubscribeMutation]);

  return {
    state,
    isSupported,
    isLoading: subscribeMutation.isPending || unsubscribeMutation.isPending,
    error: subscribeMutation.error || unsubscribeMutation.error,
    subscribe,
    unsubscribe,
  };
}

/**
 * Converte uma string base64 URL-safe para Uint8Array.
 * Necessário para o applicationServerKey do PushManager.
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray.buffer as ArrayBuffer;
}
