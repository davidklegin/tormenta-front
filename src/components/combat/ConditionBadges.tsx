import { useMemo } from 'react';
import { View, Pressable } from 'react-native';
import type { CombatCondition, ReferenceCondition } from '@/api/types';
import { Text } from '@/components/ui';
import { radius, useTheme } from '@/theme';

/**
 * Como uma condição se apresenta na tela: nome, sigla e cor.
 *
 * Nada disso é tabelado à mão. O nome vem do catálogo do servidor (a mesma
 * fonte que a ficha usa), a sigla sai das três primeiras letras dele, e a cor
 * sai da severidade — uma lista de 35 cores escritas aqui divergiria do seeder
 * na primeira condição que a errata acrescentasse.
 */
export type ConditionLook = {
  key: string;
  name: string;
  abbr: string;
  fill: string;
  ink: string;
};

/** Índice key → condição do catálogo, para achar o nome sem varrer a lista. */
export function useConditionCatalog(conditions: ReferenceCondition[] | undefined) {
  return useMemo(() => {
    const mapa = new Map<string, ReferenceCondition>();

    for (const condicao of conditions ?? []) {
      mapa.set(condicao.key, condicao);
    }

    return mapa;
  }, [conditions]);
}

/**
 * Resolve a aparência de uma condição.
 *
 * Fora do catálogo (uma chave antiga guardada num combate salvo, por exemplo)
 * a condição ainda aparece: some o nome bonito, não o marcador.
 */
export function useConditionLook() {
  const { colors } = useTheme();

  return useMemo(() => {
    const tintas = {
      leve: { fill: colors.warningFill, ink: colors.warningInk },
      grave: { fill: colors.dangerFill, ink: colors.dangerInk },
      pesada: { fill: colors.primaryFill, ink: colors.primaryInk },
    };

    return (key: string, catalogo: Map<string, ReferenceCondition>): ConditionLook => {
      const oficial = catalogo.get(key);
      const nome = oficial?.name ?? formatarChave(key);
      const severidade = oficial?.severity ?? 3;

      // Incapacitante é sempre o tom mais forte: perder o turno não é um
      // detalhe de grau, e o mestre precisa achar isso na lista de relance.
      const tinta = oficial?.is_incapacitating
        ? tintas.pesada
        : severidade <= 2
          ? tintas.leve
          : severidade <= 4
            ? tintas.grave
            : tintas.pesada;

      return {
        key,
        name: nome,
        abbr: nome.slice(0, 3).toUpperCase(),
        fill: tinta.fill,
        ink: tinta.ink,
      };
    };
  }, [colors]);
}

function formatarChave(key: string): string {
  return key
    .split('_')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

type Props = {
  conditions: CombatCondition[];
  catalog: Map<string, ReferenceCondition>;
  compact?: boolean;
  onRemove?: (condition: CombatCondition) => void;
};

/**
 * Os marcadores de condição pendurados numa entrada do combate.
 *
 * No modo compacto mostra a sigla — é o que cabe ao lado do nome na fila de
 * iniciativa. Aberto mostra o nome inteiro, e o toque tira a condição.
 */
export function ConditionBadges({ conditions, catalog, compact = false, onRemove }: Props) {
  const resolver = useConditionLook();

  if (conditions.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
      {conditions.map((condition) => {
        const look = resolver(condition.key, catalog);
        const conteudo = (
          <View
            style={{
              backgroundColor: look.fill,
              paddingHorizontal: compact ? 4 : 6,
              paddingVertical: compact ? 1 : 2,
              borderRadius: radius.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Text variant="caption" style={{ color: look.ink }}>
              {compact ? look.abbr : look.name}
            </Text>

            {condition.duration !== null && (
              <Text variant="caption" style={{ color: look.ink, opacity: 0.75 }}>
                {condition.duration}
              </Text>
            )}
          </View>
        );

        if (!onRemove) {
          return <View key={condition.id}>{conteudo}</View>;
        }

        return (
          <Pressable
            key={condition.id}
            onPress={() => onRemove(condition)}
            accessibilityRole="button"
            accessibilityLabel={`Remover ${look.name}`}
            hitSlop={6}
          >
            {conteudo}
          </Pressable>
        );
      })}
    </View>
  );
}
