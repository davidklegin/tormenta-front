import { View } from 'react-native';
import { spacing } from '@/theme';
import type { NoticeHostProps } from './NoticeHost.types';

/**
 * Onde os avisos de "Exibir aos outros" são desenhados — versão de celular.
 *
 * Uma faixa presa ao topo, com `pointerEvents="box-none"`: ela ocupa a largura
 * da tela só para posicionar, e apenas os próprios avisos recebem toque — o
 * resto continua chegando à tela de baixo.
 *
 * Ressalva conhecida: no celular, um aviso que chega enquanto **outro modal já
 * está aberto** fica atrás dele, porque o `Modal` nativo é uma janela própria
 * do sistema e nada da árvore de baixo passa por cima. Como o aviso é efêmero,
 * o efeito é perdê-lo — não travar nada. Na web isto não acontece: lá a versão
 * `.web.tsx` desenha por fora, num portal.
 */
export function NoticeHost({ top, aoLado, children }: NoticeHostProps) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        alignItems: aoLado ? 'flex-end' : 'stretch',
        paddingHorizontal: spacing.space4,
        gap: spacing.space2,
      }}
    >
      {children}
    </View>
  );
}
