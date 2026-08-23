import { apiRequest } from '../client';
import type { ShowcaseEvent, ShowcaseKind } from '../types';

/**
 * "Exibir aos outros" — aponta um item da ficha para todo mundo que está com o
 * app aberto (briefing §21).
 *
 * Mandamos só a identificação do item; o servidor é quem carrega o conteúdo e
 * publica. Enviar o texto daqui deixaria qualquer um transmitir um poder
 * inventado para a plataforma inteira.
 */
export const showcaseApi = {
  share: (kind: ShowcaseKind, characterId: number, resourceId: number) =>
    apiRequest<{ data: ShowcaseEvent }>('/showcase', {
      method: 'POST',
      body: { kind, character_id: characterId, resource_id: resourceId },
    }).then((r) => r.data),
};
