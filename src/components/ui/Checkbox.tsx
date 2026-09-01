import { Pressable, View } from 'react-native';
import { hitSize, radius, spacing, stroke, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type CheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Linha de explicação abaixo do rótulo, como o `hint` do Input. */
  hint?: string;
  disabled?: boolean;
};

/**
 * Caixa de marcar, para as opções da ficha que são sim ou não.
 *
 * O Chip selecionável resolvia escolher entre alternativas ("qual atributo
 * entra na Defesa"), mas não afirma nada sozinho: um chip apagado parece uma
 * opção que ninguém escolheu, e não uma regra desligada. Aqui a caixa vazia diz
 * "não" com todas as letras, que é o que uma opção como "ignora a penalidade de
 * armadura" precisa dizer quando está desmarcada.
 *
 * Quadrada e de cantos retos, como o resto do tema. A linha inteira é o alvo de
 * toque — em telefone, mirar um quadrado de 20px seria pedir demais.
 */
export function Checkbox({ label, checked, onChange, hint, disabled = false }: CheckboxProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={disabled ? undefined : () => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        minHeight: hitSize.min,
        paddingVertical: spacing.xs,
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          marginTop: 2,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.sm,
          borderWidth: stroke.hairline,
          borderColor: checked ? colors.primary : colors.border,
          backgroundColor: checked ? colors.primary : colors.surfaceAlt,
        }}
      >
        {checked ? <Icon name="confirmar" size={14} color={colors.onPrimary} /> : null}
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body">{label}</Text>
        {hint ? (
          <Text variant="small" tone="muted">
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
