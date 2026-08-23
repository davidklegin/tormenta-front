import { View } from 'react-native';
import { spacing } from '@/theme';
import { Text } from './Text';

export type DetailRowProps = {
  label: string;
  value: string | null | undefined;
};

/**
 * Uma linha de ficha: rótulo à esquerda, valor à direita.
 *
 * É como o livro apresenta o cabeçalho de uma magia — Execução, Alcance, Alvo,
 * Duração, Resistência —, e some sozinha quando não há valor, para a magia sem
 * área não deixar uma linha vazia no meio da lista.
 */
export function DetailRow({ label, value }: DetailRowProps) {
  if (!value) return null;

  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <Text variant="small" style={{ flex: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}
