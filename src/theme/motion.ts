import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing, Platform } from 'react-native';

/**
 * Tempos e curvas do movimento.
 *
 * Três durações, e não uma para cada efeito: quando cada componente escolhe o
 * seu próprio número, a interface inteira perde o ritmo. `fast` é resposta a
 * toque, `base` é mudança de estado, `slow` é ornamento — o brilho que cruza o
 * botão, o d20 girando.
 *
 * Os nomes espelham `--dur-fast`, `--dur-base` e `--dur-slow` do CSS da web;
 * `tools/gen-theme-css.mjs` escreve os dois a partir daqui.
 */
export const duration = {
  fast: 140,
  base: 240,
  slow: 520,
} as const;

/**
 * Usar o driver nativo?
 *
 * No Android e no iOS, sim: a animação passa para a thread de UI e continua
 * fluida mesmo com o JavaScript ocupado — que é justamente o que acontece
 * quando a ficha está recalculando. Na web não existe driver nativo, e pedir
 * por ele faz o React Native Web despejar um aviso a cada animação antes de
 * cair no caminho em JavaScript. O resultado é o mesmo; o aviso, não.
 */
export const nativeDriver = Platform.OS !== 'web';

/** Saída desacelerada: entra rápido, assenta devagar. */
export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  decelerate: Easing.out(Easing.cubic),
  emphasis: Easing.bezier(0.34, 1.2, 0.64, 1),
} as const;

/**
 * O usuário pediu menos movimento?
 *
 * Na web isso é `prefers-reduced-motion`; no celular, a chave de "reduzir
 * movimento" do sistema. O React Native unifica as duas atrás desta API, então
 * o aplicativo só precisa perguntar uma vez.
 *
 * Quem consome deve manter o **estado final** do efeito e descartar só a
 * animação: sumir com o resultado junto com o movimento seria trocar um
 * problema de acessibilidade por outro.
 */
export function useReducedMotion(): boolean {
  const [reduzido, setReduzido] = useState(false);

  useEffect(() => {
    let ativo = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((valor) => {
        if (ativo) setReduzido(valor);
      })
      .catch(() => {
        // Plataforma sem a informação: mantemos o movimento padrão.
      });

    const inscricao = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzido);

    return () => {
      ativo = false;
      inscricao.remove();
    };
  }, []);

  return reduzido;
}
