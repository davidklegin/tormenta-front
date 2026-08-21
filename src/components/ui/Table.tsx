import { useState } from 'react';
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing, stroke, useTheme } from '@/theme';
import { Text } from './Text';

export type TableColumn<T> = {
  key: string;
  header: string;
  /** Largura fixa em pontos, ou peso relativo quando omitida. */
  width?: number;
  flex?: number;
  align?: 'left' | 'center' | 'right';
  render: (row: T) => React.ReactNode;
};

export type TableProps<T> = {
  columns: TableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T, index: number) => string;
  onRowPress?: (row: T) => void;
  /** Rola na horizontal quando as colunas não cabem — típico no celular. */
  minWidth?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Tabela de perícias e equipamento.
 *
 * Cabeçalho em faixa rubra com texto claro, corpo zebrado alternando `surface`
 * e `surfaceAlt`, cantos retos e nenhuma borda vertical. A zebra faz o trabalho
 * que as linhas de grade fariam, e sem o ruído: em uma lista de 29 perícias, a
 * grade vira gaiola.
 *
 * Quando as colunas não cabem, a tabela rola na horizontal em vez de espremer —
 * uma coluna de 24px de largura não é uma coluna, é um problema.
 */
export function Table<T>({ columns, rows, keyExtractor, onRowPress, minWidth, style }: TableProps<T>) {
  const { colors } = useTheme();
  const [hover, setHover] = useState<string | null>(null);

  const celula = (coluna: TableColumn<T>): ViewStyle => ({
    width: coluna.width,
    flex: coluna.width ? undefined : (coluna.flex ?? 1),
    paddingHorizontal: spacing.space3,
    paddingVertical: spacing.space2,
    justifyContent: 'center',
    alignItems: coluna.align === 'right' ? 'flex-end' : coluna.align === 'center' ? 'center' : 'flex-start',
  });

  const tabela = (
    <View
      role="table"
      style={[
        {
          minWidth,
          borderWidth: stroke.hairline,
          borderColor: colors.border,
          borderRadius: radius.none,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View role="rowheader" style={{ flexDirection: 'row', backgroundColor: colors.primary }}>
        {columns.map((coluna) => (
          <View key={coluna.key} style={celula(coluna)}>
            <Text variant="caption" style={{ color: colors.onPrimary }} numberOfLines={1}>
              {coluna.header}
            </Text>
          </View>
        ))}
      </View>

      {rows.map((linha, indice) => {
        const chave = keyExtractor(linha, indice);
        const zebrada = indice % 2 === 1;
        const realce = hover === chave;

        const conteudo = (
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: realce ? colors.surfaceHover : zebrada ? colors.surfaceAlt : colors.surface,
            }}
          >
            {columns.map((coluna) => (
              <View key={coluna.key} style={celula(coluna)}>
                {coluna.render(linha)}
              </View>
            ))}
          </View>
        );

        if (!onRowPress) return <View key={chave}>{conteudo}</View>;

        return (
          <Pressable
            key={chave}
            onPress={() => onRowPress(linha)}
            onHoverIn={() => setHover(chave)}
            onHoverOut={() => setHover((atual) => (atual === chave ? null : atual))}
            accessibilityRole="button"
          >
            {conteudo}
          </Pressable>
        );
      })}
    </View>
  );

  if (!minWidth) return tabela;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {tabela}
    </ScrollView>
  );
}
