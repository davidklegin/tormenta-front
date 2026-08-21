import { View, type StyleProp, type ViewStyle } from 'react-native';
import { spacing, useResponsive } from '@/theme';

export type ResponsiveGridProps = {
  children: React.ReactNode[];
  /** Colunas por faixa; por padrão segue a sugestão do breakpoint. */
  columns?: { phone?: number; tablet?: number; desktop?: number };
  gap?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Grade que muda de colunas conforme a largura (briefing §21).
 *
 * Usa flexBasis em porcentagem em vez de FlatList com numColumns porque as
 * listas do app são pequenas (personagens de uma mesa) e assim o número de
 * colunas acompanha a rotação do aparelho sem remontar a lista.
 */
export function ResponsiveGrid({ children, columns, gap = spacing.space3, style }: ResponsiveGridProps) {
  const { breakpoint, columns: suggested } = useResponsive();

  const count =
    breakpoint === 'desktop'
      ? (columns?.desktop ?? suggested)
      : breakpoint === 'tablet'
        ? (columns?.tablet ?? suggested)
        : (columns?.phone ?? 1);

  if (count <= 1) {
    return <View style={[{ gap }, style]}>{children}</View>;
  }

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap }, style]}>
      {children.map((child, index) => (
        <View
          key={index}
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: `${100 / count - 2}%`,
            minWidth: 260,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
