import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { pushApi } from '@/api';

/**
 * Estado da inscrição, do ponto de vista de quem olha a tela.
 *
 * `subscribed` é inscrição de verdade — permissão concedida E inscrição viva no
 * navegador. A permissão sozinha não basta: ela sobrevive a uma limpeza de
 * dados do site que apaga a inscrição, e nesse caso o botão diria "ativado"
 * para quem não receberia nada.
 */
type PushState = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'idle';

/**
 * Onde o aplicativo está publicado.
 *
 * O `baseUrl` do app.json ("The path will be prepended as-is to links to all
 * bundled resources") põe a versão web sob `/web`, e o `public/` — onde mora o
 * Service Worker — é copiado para dentro dessa mesma pasta. Só que o servidor
 * de desenvolvimento entrega tudo na raiz.
 *
 * Em vez de adivinhar pelo modo de execução, confere no endereço de verdade: se
 * a página está sob o prefixo, o Service Worker também está. Registrar no
 * caminho errado é um 404 silencioso — o registro falha e nada mais acontece.
 */
function prefixoDoApp(): string {
  const declarado = (process.env.EXPO_BASE_URL ?? '').replace(/\/+$/, '');

  if (!declarado) {
    return '';
  }

  const caminho = window.location.pathname;

  return caminho === declarado || caminho.startsWith(`${declarado}/`) ? declarado : '';
}

/**
 * Notificações do navegador para o aviso de "é sua vez".
 *
 * Só na web: no aplicativo nativo o aviso chega pelo canal do Reverb
 * (useUserChannel), que fica de pé enquanto o aplicativo estiver aberto.
 */
export function usePushNotifications() {
  const [state, setState] = useState<PushState>('loading');

  const isSupported =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    // Push exige origem segura. Sem isto o `navigator.serviceWorker` existe mas
    // o registro falha, e o botão prometeria algo que não acontece.
    window.isSecureContext;

  const vapidQuery = useQuery({
    queryKey: ['push', 'vapid'],
    queryFn: () => pushApi.getVapidKey(),
    enabled: isSupported,
    staleTime: Infinity,
    // O 503 de "não configurado" não melhora com insistência.
    retry: false,
  });

  useEffect(() => {
    if (!isSupported) {
      setState('unsupported');

      return;
    }

    let cancelado = false;

    async function sincronizar() {
      if (Notification.permission === 'denied') {
        if (!cancelado) setState('denied');

        return;
      }

      const registro = await navigator.serviceWorker.getRegistration(`${prefixoDoApp()}/`);
      const inscricao = (await registro?.pushManager.getSubscription()) ?? null;

      if (cancelado) return;

      if (!inscricao) {
        setState('idle');

        return;
      }

      setState('subscribed');

      /*
       * O navegador guarda a inscrição; o servidor guarda a lista de para quem
       * enviar. Os dois saem de sincronia sozinhos — o navegador renova a
       * inscrição, ou o servidor a descarta depois de um 410 passageiro — e o
       * jogador não tem como saber: o botão continua dizendo "ativado" e o
       * aviso nunca chega. Reafirmar a inscrição a cada visita conserta isso
       * sem pedir nada a ele (o servidor faz updateOrCreate pelo endpoint).
       */
      try {
        await pushApi.subscribe(inscricao.toJSON());
      } catch {
        // Servidor fora do ar ou sessão expirando: a inscrição do navegador
        // continua válida, e a próxima visita tenta de novo.
      }
    }

    void sincronizar();

    return () => {
      cancelado = true;
    };
  }, [isSupported]);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      /*
       * A chave é buscada aqui, e não lida do estado da consulta acima.
       *
       * O clique acontece uma vez e pode acontecer a qualquer momento — antes
       * da consulta responder, ou depois de o cache dela ter sido invalidado.
       * Ler `vapidQuery.data` amarrava a ativação a um estado que podia não
       * estar lá, e o jogador via "o servidor não está configurado" com o
       * servidor perfeitamente configurado. A consulta fica só para a tela
       * saber se há o que oferecer; quem ativa busca o que precisa.
       */
      const chave = await pushApi.getVapidKey();

      if (!chave) {
        throw new Error('O servidor não está com as notificações configuradas.');
      }

      const permissao = await Notification.requestPermission();

      if (permissao !== 'granted') {
        setState(permissao === 'denied' ? 'denied' : 'idle');

        throw new Error('O navegador não deu permissão para avisar.');
      }

      const prefixo = prefixoDoApp();
      const registro = await navigator.serviceWorker.register(`${prefixo}/sw-push.js`, {
        scope: `${prefixo}/`,
      });

      await navigator.serviceWorker.ready;

      const chaveEmBytes = base64UrlParaBytes(chave);

      /*
       * Reaproveitar a inscrição que já existe, quando existe: o navegador
       * recusa uma segunda com chave diferente (InvalidStateError). E se a
       * chave VAPID do servidor mudou, a antiga não serve mais — o serviço de
       * push rejeita a assinatura — então ela é descartada antes.
       */
      let inscricao = await registro.pushManager.getSubscription();

      if (inscricao && !mesmaChave(inscricao, chaveEmBytes)) {
        await inscricao.unsubscribe();
        inscricao = null;
      }

      if (!inscricao) {
        inscricao = await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: chaveEmBytes,
        });
      }

      await pushApi.subscribe(inscricao.toJSON());

      setState('subscribed');
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      const registro = await navigator.serviceWorker.getRegistration(`${prefixoDoApp()}/`);
      const inscricao = await registro?.pushManager.getSubscription();

      if (inscricao) {
        // O servidor primeiro: é dele que sai o envio. Se esta chamada falhar,
        // a inscrição do navegador continua de pé e o botão mostra o erro, em
        // vez de dizer "desativado" enquanto os avisos seguem chegando.
        await pushApi.unsubscribe(inscricao.endpoint);
        await inscricao.unsubscribe();
      }

      setState('idle');
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
    /** O servidor está sem as chaves VAPID: não há o que ativar. */
    isUnavailable: vapidQuery.isError,
    isLoading: subscribeMutation.isPending || unsubscribeMutation.isPending,
    error: (subscribeMutation.error ?? unsubscribeMutation.error) as Error | null,
    subscribe,
    unsubscribe,
  };
}

/** A chave VAPID chega em base64 URL-safe; o PushManager quer os bytes. */
function base64UrlParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const preenchimento = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalizado = (base64 + preenchimento).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(normalizado);
  // Sobre um ArrayBuffer explícito: o `applicationServerKey` não aceita a
  // possibilidade de SharedArrayBuffer que o construtor simples carrega no tipo.
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));

  for (let i = 0; i < bruto.length; i += 1) {
    bytes[i] = bruto.charCodeAt(i);
  }

  return bytes;
}

function mesmaChave(inscricao: PushSubscription, chave: Uint8Array): boolean {
  const atual = inscricao.options.applicationServerKey;

  if (!atual) {
    return false;
  }

  const bytes = new Uint8Array(atual);

  return bytes.length === chave.length && bytes.every((valor, i) => valor === chave[i]);
}
