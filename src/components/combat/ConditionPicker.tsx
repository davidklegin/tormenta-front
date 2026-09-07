import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { CombatEntry, ReferenceCondition } from '@/api/types';
import { Button, Input, Sheet, Text } from '@/components/ui';
import { radius, spacing, stroke, useTheme } from '@/theme';
import { useConditionLook } from './ConditionBadges';

type Props = {
  visible: boolean;
  onClose: () => void;
  entry: CombatEntry | null;
  conditions: ReferenceCondition[];
  onApply: (conditionKey: string, duration: number | null) => void;
};

/** Durações que a mesa usa sem pensar; o resto vai no campo livre. */
const DURACOES = [1, 2, 3, 5, 10];

/**
 * O menu de condições do mestre.
 *
 * A lista inteira do livro cabe numa tela rolável com busca — filtrar por
 * severidade ou tipo daria mais toques para achar "caído", que é a condição
 * que a mesa mais aplica.
 *
 * A duração é opcional de propósito: metade das condições da mesa sai por uma
 * ação ("levantar"), não por contagem de rodadas, e obrigar um número ali
 * encheria a tela de contadores que ninguém vai respeitar.
 */
export function ConditionPicker({ visible, onClose, entry, conditions, onApply }: Props) {
  const { colors } = useTheme();
  const resolver = useConditionLook();

  const [busca, setBusca] = useState('');
  const [duracao, setDuracao] = useState<number | null>(null);

  const catalogo = useMemo(() => {
    const mapa = new Map<string, ReferenceCondition>();
    for (const c of conditions) mapa.set(c.key, c);
    return mapa;
  }, [conditions]);

  const jaAplicadas = useMemo(
    () => new Set((entry?.conditions ?? []).map((c) => c.key)),
    [entry?.conditions]
  );

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (termo === '') return conditions;

    return conditions.filter(
      (c) => c.name.toLowerCase().includes(termo) || c.key.includes(termo)
    );
  }, [conditions, busca]);

  const fechar = () => {
    setBusca('');
    setDuracao(null);
    onClose();
  };

  const aplicar = (key: string) => {
    onApply(key, duracao);
    fechar();
  };

  return (
    <Sheet
      visible={visible}
      onClose={fechar}
      title="Aplicar condição"
      subtitle={entry ? entry.name : undefined}
    >
      <View style={{ gap: spacing.sm }}>
        <Input
          label="Buscar"
          value={busca}
          onChangeText={setBusca}
          placeholder="caído, cego, atordoado…"
          autoCapitalize="none"
        />

        <View>
          <Text variant="caption" tone="muted" uppercase>
            Duração
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
            <DuracaoChip
              rotulo="Até tirar"
              ativa={duracao === null}
              onPress={() => setDuracao(null)}
            />

            {DURACOES.map((rodadas) => (
              <DuracaoChip
                key={rodadas}
                rotulo={`${rodadas}r`}
                ativa={duracao === rodadas}
                onPress={() => setDuracao(rodadas)}
              />
            ))}
          </View>
        </View>

        <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 2 }}>
          {filtradas.map((condicao) => {
            const look = resolver(condicao.key, catalogo);
            const aplicada = jaAplicadas.has(condicao.key);

            return (
              <Pressable
                key={condicao.key}
                onPress={() => !aplicada && aplicar(condicao.key)}
                disabled={aplicada}
                accessibilityRole="button"
                accessibilityState={{ disabled: aplicada }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                  borderRadius: radius.md,
                  opacity: aplicada ? 0.4 : 1,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                })}
              >
                <View
                  style={{
                    width: 34,
                    alignItems: 'center',
                    paddingVertical: 2,
                    borderRadius: radius.sm,
                    backgroundColor: look.fill,
                  }}
                >
                  <Text variant="caption" style={{ color: look.ink }}>
                    {look.abbr}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text variant="small" numberOfLines={1}>
                    {condicao.name}
                  </Text>

                  {/* `caption` é versalete de rótulo: uma frase inteira nele
                      vira um berro difícil de ler. */}
                  <Text variant="small" tone="muted" numberOfLines={1}>
                    {aplicada ? 'Já aplicada' : condicao.description}
                  </Text>
                </View>

                {condicao.is_incapacitating && (
                  <Text variant="caption" tone="danger">
                    Incapacita
                  </Text>
                )}
              </Pressable>
            );
          })}

          {filtradas.length === 0 && (
            <Text variant="small" tone="muted" center style={{ paddingVertical: spacing.md }}>
              Nenhuma condição com esse nome.
            </Text>
          )}
        </ScrollView>

        <Button label="Fechar" variant="secondary" onPress={fechar} />
      </View>
    </Sheet>
  );
}

function DuracaoChip({
  rotulo,
  ativa,
  onPress,
}: {
  rotulo: string;
  ativa: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: ativa }}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.pill,
        borderWidth: stroke.hairline,
        borderColor: ativa ? colors.accent : colors.border,
        backgroundColor: ativa ? colors.accentFill : 'transparent',
      }}
    >
      <Text variant="caption" tone={ativa ? 'gold' : 'muted'}>
        {rotulo}
      </Text>
    </Pressable>
  );
}
