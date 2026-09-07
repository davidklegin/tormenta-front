import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/ui';
import { radius, spacing, stroke, useTheme } from '@/theme';

type Props = {
  /** Nome de quem vai levar, para o campo dizer em quem está batendo. */
  alvo: string;
  onSubmit: (amount: number) => void;
  onClose: () => void;
};

/** Os valores que a mesa aplica sem pensar; o resto vai no campo. */
const ATALHOS = [1, 5, 10];

/**
 * Onde o dano é aplicado.
 *
 * Um número digitado com sinal seria ambíguo na pressa — "5" é cura ou dano? —
 * então o gesto é sempre "quanto" e o sinal vem do botão: a fileira vermelha
 * fere, a verde cura, e o campo obedece ao botão que for tocado depois dele.
 *
 * O teclado numérico de celular não tem sinal de menos, o que sozinho já
 * inviabilizaria digitar "-15" no aparelho onde a mesa mais usa isto.
 */
export function DamagePopover({ alvo, onSubmit, onClose }: Props) {
  const { colors } = useTheme();

  const [valor, setValor] = useState('');
  const campo = useRef<TextInput>(null);

  useEffect(() => {
    // Um quadro depois: focar no mesmo tick em que o painel monta não pega o
    // campo em nenhuma das plataformas.
    const id = setTimeout(() => campo.current?.focus(), 60);

    return () => clearTimeout(id);
  }, []);

  const aplicar = (sinal: -1 | 1) => {
    const quantia = Number.parseInt(valor, 10);

    if (!Number.isFinite(quantia) || quantia <= 0) return;

    onSubmit(sinal * quantia);
    setValor('');
  };

  return (
    <View style={{ padding: spacing.sm, gap: spacing.xs }}>
      {/*
        Campo e botões em linhas separadas porque a barra lateral é estreita:
        os três lado a lado empurravam "Cura" para fora da borda.
      */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <TextInput
          ref={campo}
          value={valor}
          onChangeText={(texto) => setValor(texto.replace(/[^0-9]/g, ''))}
          onSubmitEditing={() => aplicar(-1)}
          placeholder="Quanto?"
          placeholderTextColor={colors.textSubtle}
          keyboardType="number-pad"
          returnKeyType="done"
          accessibilityLabel={`Quantidade de dano ou cura em ${alvo}`}
          style={{
            flex: 1,
            height: 32,
            paddingHorizontal: spacing.sm,
            borderRadius: radius.sm,
            borderWidth: stroke.hairline,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 14,
          }}
        />

        <BotaoDeSinal rotulo={`Ferir ${alvo}`} texto="Dano" tom="danger" onPress={() => aplicar(-1)} />
        <BotaoDeSinal rotulo={`Curar ${alvo}`} texto="Cura" tom="success" onPress={() => aplicar(1)} />

        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
        >
          <Text variant="small" tone="muted">
            ✕
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.xxs }}>
        {ATALHOS.map((quantia) => (
          <Atalho key={`d${quantia}`} texto={`−${quantia}`} tom="danger" onPress={() => onSubmit(-quantia)} />
        ))}

        {ATALHOS.map((quantia) => (
          <Atalho key={`c${quantia}`} texto={`+${quantia}`} tom="success" onPress={() => onSubmit(quantia)} />
        ))}
      </View>
    </View>
  );
}

function BotaoDeSinal({
  rotulo,
  texto,
  tom,
  onPress,
}: {
  rotulo: string;
  texto: string;
  tom: 'danger' | 'success';
  onPress: () => void;
}) {
  const { colors } = useTheme();

  const fundo = tom === 'danger' ? colors.dangerFill : colors.successFill;
  const tinta = tom === 'danger' ? colors.dangerInk : colors.successInk;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.xs,
        height: 32,
        justifyContent: 'center',
        borderRadius: radius.sm,
        backgroundColor: fundo,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant="caption" style={{ color: tinta }}>
        {texto}
      </Text>
    </Pressable>
  );
}

function Atalho({
  texto,
  tom,
  onPress,
}: {
  texto: string;
  tom: 'danger' | 'success';
  onPress: () => void;
}) {
  const { colors } = useTheme();

  const tinta = tom === 'danger' ? colors.dangerInk : colors.successInk;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tom === 'danger' ? `Dano de ${texto.slice(1)}` : `Cura de ${texto.slice(1)}`}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.xxs,
        borderRadius: radius.sm,
        borderWidth: stroke.hairline,
        borderColor: colors.border,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
      })}
    >
      <Text variant="caption" style={{ color: tinta }}>
        {texto}
      </Text>
    </Pressable>
  );
}
