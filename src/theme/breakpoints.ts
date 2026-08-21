import { useWindowDimensions } from 'react-native';

/**
 * Faixas de layout (briefing §21).
 *
 * O app não é uma tela de celular esticada: cada faixa muda a ESTRUTURA da
 * interface, não apenas a largura. Abas viram barra lateral, a ficha passa de
 * uma para várias colunas e o Painel do Mestre vira uma grade.
 */
export const breakpoints = {
  phone: 0,
  tablet: 700,
  desktop: 1100,
} as const;

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();

  if (width >= breakpoints.desktop) return 'desktop';
  if (width >= breakpoints.tablet) return 'tablet';
  return 'phone';
}

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const breakpoint = useBreakpoint();

  return {
    width,
    height,
    breakpoint,
    isPhone: breakpoint === 'phone',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    /** Colunas sugeridas para grades de cards. */
    columns: breakpoint === 'desktop' ? 3 : breakpoint === 'tablet' ? 2 : 1,
    /** Largura máxima de conteúdo, para o texto não esticar demais no desktop. */
    contentMaxWidth: breakpoint === 'desktop' ? 1280 : undefined,
  };
}

/** Escolhe um valor conforme a faixa atual, com fallback para a menor definida. */
export function selectByBreakpoint<T>(
  breakpoint: Breakpoint,
  values: { phone: T; tablet?: T; desktop?: T }
): T {
  if (breakpoint === 'desktop') return values.desktop ?? values.tablet ?? values.phone;
  if (breakpoint === 'tablet') return values.tablet ?? values.phone;
  return values.phone;
}
