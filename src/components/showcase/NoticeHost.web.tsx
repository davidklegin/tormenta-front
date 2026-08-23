import { createPortal } from 'react-dom';
import { spacing } from '@/theme';
import type { NoticeHostProps } from './NoticeHost.types';

/**
 * Onde os avisos de "Exibir aos outros" são desenhados — versão web.
 *
 * Aqui o aviso **precisa** sair da árvore do app, e não é preciosismo: o
 * react-native-web desenha cada `Modal` num portal preso ao `document.body`
 * com `z-index: 9999`, enquanto quase todo `View` recebe `z-index: 0` — e um
 * elemento posicionado com z-index 0 abre um contexto de empilhamento próprio.
 * O resultado é que qualquer `zIndex` que se peça lá dentro fica preso naquele
 * contexto e perde para o modal, por maior que seja o número. Um aviso que
 * chegasse com a ficha de um poder aberta ficaria atrás do fundo escurecido, e
 * o clique do usuário acertaria o fundo — fechando o painel em vez de abrir a
 * exibição.
 *
 * Indo para o `body`, o aviso disputa de igual para igual e ganha pelo z-index.
 *
 * O contêiner não recebe ponteiro; cada aviso reativa o seu. Sem isso a faixa
 * invisível cobriria o topo da página inteira.
 */
export function NoticeHost({ top, aoLado, children }: NoticeHostProps) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: aoLado ? 'flex-end' : 'stretch',
        paddingLeft: spacing.space4,
        paddingRight: spacing.space4,
        gap: spacing.space2,
        pointerEvents: 'none',
        zIndex: 10000,
      }}
    >
      {children}
    </div>,
    document.body
  );
}
