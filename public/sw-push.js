/**
 * Service Worker das notificações do navegador.
 *
 * É o que faz o aviso de "é sua vez" alcançar o jogador com o aplicativo
 * fechado — o canal do Reverb (useUserChannel) só existe enquanto a aba está
 * aberta, e numa mesa de verdade ela quase nunca está.
 *
 * Nada aqui usa caminho absoluto. O aplicativo é publicado sob `/web` (o
 * `baseUrl` do app.json) mas o servidor de desenvolvimento o entrega na raiz, e
 * `self.registration.scope` já traz o prefixo certo nos dois casos.
 */

function noEscopo(caminho) {
  return new URL(caminho, self.registration.scope).toString();
}

/*
 * Assumir o controle na primeira carga, sem esperar um recarregamento.
 *
 * Não é otimização: `client.navigate()`, lá embaixo, só funciona em abas que
 * este Service Worker controla. Sem o claim, o primeiro toque numa notificação
 * abriria uma aba nova em vez de aproveitar a que já está aberta.
 */
self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  /*
   * A inscrição é `userVisibleOnly`, então todo push precisa virar notificação
   * visível. Sair daqui sem mostrar nada faz o Chrome exibir por conta própria
   * o aviso genérico de "site atualizado em segundo plano" — e, repetido,
   * revoga a permissão do site. Por isso o payload ilegível ainda vira aviso.
   */
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (erro) {
      payload = { body: event.data.text() };
    }
  }

  const opcoes = {
    body: payload.body || '',
    icon: noEscopo(payload.icon || 'icon-192.png'),
    badge: noEscopo('icon-badge.png'),
    tag: payload.tag || 'tormenta20',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    // Fica na tela até o jogador responder: a vez dele não expira sozinha.
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'Tormenta20', opcoes));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const dados = event.notification.data || {};

  const destino =
    dados.type === 'combat_turn' && dados.campaign_id
      ? noEscopo('campanhas/' + dados.campaign_id)
      : noEscopo('');

  event.waitUntil(
    (async function () {
      const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const janela of janelas) {
        if (!janela.url.startsWith(self.registration.scope)) {
          continue;
        }

        // Reaproveitar a aba que já existe, e não empilhar uma cópia do
        // aplicativo por notificação tocada.
        await janela.focus();

        if (janela.url !== destino) {
          await janela.navigate(destino).catch(function () {
            // Aba fora do controle deste Service Worker: fica onde está, já
            // focada, que é melhor do que abrir outra.
          });
        }

        return;
      }

      await self.clients.openWindow(destino);
    })()
  );
});
