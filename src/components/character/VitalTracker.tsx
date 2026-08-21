import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Icon, ProgressBar, Text, type IconName } from '@/components/ui';
import { QUICK_STEPS } from '@/rules';
import { hitSize, radius, spacing, stroke, useTheme, vitalColors, type Palette } from '@/theme';

export type VitalTrackerProps = {
  label: string;
  icon?: IconName;
  current: number;
  max: number;
  temp?: number;
  color?: string;
  trackColor?: string;
  /** Somente leitura quando o mestre está olhando ficha alheia. */
  editable?: boolean;
  onChange?: (delta: number) => void;
  onSetValue?: (value: number) => void;
  footnote?: string;
};

/**
 * Controle de vida e mana (briefing §19).
 *
 * Pensado para o meio de uma rodada: o número grande é legível do outro lado da
 * mesa, e os botões de −1/+1 ficam sempre visíveis, com alvo de 48pt. Os passos
 * maiores e o campo de valor exato ficam atrás de "Mais", para o caso comum não
 * pagar o preço da tela cheia de botões.
 *
 * Pontos temporários aparecem separados porque, pelas regras (p. 106), são
 * gastos primeiro e podem passar do total.
 */
export function VitalTracker({
  label,
  icon,
  current,
  max,
  temp = 0,
  color,
  trackColor,
  editable = true,
  onChange,
  onSetValue,
  footnote,
}: VitalTrackerProps) {
  const { colors } = useTheme();
  const vitais = vitalColors(colors);

  const [maisAberto, setMaisAberto] = useState(false);

  const preenchimento = color ?? vitais.hp;
  const calha = trackColor ?? vitais.hpTrack;

  const efetivo = current + temp;
  const critico = max > 0 && efetivo / max <= 0.25;
  const caido = efetivo <= 0;
  const acimaDoMaximo = current > max;

  const corDoValor = caido ? colors.dangerInk : critico ? colors.warningInk : colors.text;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: stroke.hairline,
        borderColor: caido ? colors.danger : colors.border,
        borderTopWidth: stroke.seal,
        borderTopColor: caido ? colors.danger : colors.accent,
        padding: spacing.space4,
        gap: spacing.space3,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {icon ? <Icon name={icon} size={18} color={preenchimento} /> : null}
        <Text variant="smallStrong" tone="secondary" style={{ flex: 1 }}>
          {label}
        </Text>
        {temp > 0 ? (
          <Text variant="smallStrong" style={{ color: preenchimento }}>
            +{temp} temporário
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
        <Text variant="numericLarge" style={{ color: corDoValor }}>
          {current}
        </Text>
        <Text variant="title" tone="muted">
          / {max}
        </Text>
        {acimaDoMaximo ? (
          <Text variant="small" style={{ color: preenchimento, marginLeft: spacing.space1 }}>
            acima do total
          </Text>
        ) : null}
      </View>

      <ProgressBar value={current} max={max} temp={temp} color={preenchimento} trackColor={trackColor} />

      {footnote ? (
        <Text variant="small" tone={caido ? 'danger' : 'muted'}>
          {footnote}
        </Text>
      ) : null}

      {editable && onChange ? (
        <>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <BotaoPasso rotulo="−1" tom="danger" onPress={() => onChange(-1)} />
            <BotaoPasso rotulo="+1" tom="success" onPress={() => onChange(1)} />
            <BotaoPasso
              rotulo={maisAberto ? 'Fechar' : 'Mais'}
              tom="neutro"
              onPress={() => setMaisAberto((aberto) => !aberto)}
            />
          </View>

          {maisAberto ? (
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {QUICK_STEPS.map((passo) => (
                  <BotaoPasso
                    key={`menos-${passo}`}
                    rotulo={`−${passo}`}
                    tom="danger"
                    compacto
                    onPress={() => onChange(-passo)}
                  />
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                {QUICK_STEPS.map((passo) => (
                  <BotaoPasso
                    key={`mais-${passo}`}
                    rotulo={`+${passo}`}
                    tom="success"
                    compacto
                    onPress={() => onChange(passo)}
                  />
                ))}
              </View>

              {onSetValue ? <LinhaValorExato max={max} onSubmit={onSetValue} /> : null}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function BotaoPasso({
  rotulo,
  tom,
  onPress,
  compacto = false,
}: {
  rotulo: string;
  tom: 'danger' | 'success' | 'neutro';
  onPress: () => void;
  compacto?: boolean;
}) {
  const { colors } = useTheme();

  const paleta = {
    danger: { fundo: colors.dangerFill, texto: colors.dangerInk, borda: colors.danger },
    success: { fundo: colors.successFill, texto: colors.successInk, borda: colors.success },
    neutro: { fundo: colors.surfaceAlt, texto: colors.textMuted, borda: colors.borderStrong },
  }[tom];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ pressed }) => ({
        flex: 1,
        height: compacto ? 40 : hitSize.combat,
        borderRadius: radius.md,
        backgroundColor: paleta.fundo,
        borderWidth: stroke.hairline,
        borderColor: paleta.borda,
        borderBottomWidth: stroke.seal,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant={compacto ? 'smallStrong' : 'bodyStrong'} style={{ color: paleta.texto }}>
        {rotulo}
      </Text>
    </Pressable>
  );
}

/** Campo para o valor exato — usado quando o mestre dita um número. */
function LinhaValorExato({ max, onSubmit }: { max: number; onSubmit: (value: number) => void }) {
  const { colors } = useTheme();
  const [texto, setTexto] = useState('');

  const enviar = () => {
    const valor = Number.parseInt(texto, 10);
    if (Number.isFinite(valor)) {
      onSubmit(valor);
      setTexto('');
    }
  };

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
      <View
        style={{
          flex: 1,
          height: 40,
          borderRadius: radius.none,
          borderBottomWidth: stroke.seal,
          borderBottomColor: colors.border,
          justifyContent: 'center',
          paddingHorizontal: spacing.md,
        }}
      >
        <TextInput
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={enviar}
          keyboardType="numbers-and-punctuation"
          placeholder={`Definir valor exato (total: ${max})`}
          placeholderTextColor={colors.textSubtle}
          returnKeyType="done"
          accessibilityLabel="Definir valor exato"
          style={{ color: colors.text, fontSize: 14, outlineStyle: 'none' } as never}
        />
      </View>

      <Pressable
        onPress={enviar}
        accessibilityRole="button"
        accessibilityLabel="Aplicar valor"
        style={({ pressed }) => ({
          height: 40,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text variant="smallStrong" style={{ color: colors.onPrimary }}>
          OK
        </Text>
      </Pressable>
    </View>
  );
}
