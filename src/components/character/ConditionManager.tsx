import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Chip, HelpNote, Icon, Input, Loading, Sheet, Text } from '@/components/ui';
import type { CharacterCondition } from '@/api/types';
import { useCharacterConditions } from '@/hooks/useCharacters';
import { useReference } from '@/hooks/useReference';
import { hitSize, radius, spacing, stroke, useTheme } from '@/theme';
import { contemTermo, normalizar } from '@/utils/texto';

/**
 * Condições ativas (briefing §19).
 *
 * As 35 condições vêm do apêndice do livro (p. 394), com a descrição completa —
 * a ideia é que ninguém precise largar o app e abrir o PDF no meio do turno.
 *
 * Três decisões pensadas em quem está começando:
 *  - as condições mais frequentes em combate ficam a um toque, sem busca;
 *  - a lista completa mostra o efeito junto do nome, não só o nome;
 *  - reaplicar uma condição que escala é resolvido pelo servidor ("se ficar
 *    abalado novamente, em vez disso fica apavorado"), então o jogador não
 *    precisa saber a cadeia de cor.
 */

/** Atalhos: o que mais aparece numa rodada de combate. */
const FREQUENTES = ['caido', 'abalado', 'desprevenido', 'vulneravel', 'sangrando', 'atordoado'];

export function ConditionManager({
  characterId,
  conditions,
  editable,
}: {
  characterId: number;
  conditions: CharacterCondition[];
  editable: boolean;
}) {
  const reference = useReference();
  const { add, remove, clear } = useCharacterConditions(characterId);

  const { colors } = useTheme();
  const [listaAberta, setListaAberta] = useState(false);
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState<CharacterCondition | null>(null);

  const ativas = new Set(conditions.map((c) => c.key));

  const catalogo = reference.data?.conditions ?? [];

  const frequentes = useMemo(
    () => FREQUENTES.map((key) => catalogo.find((c) => c.key === key)).filter(Boolean),
    [catalogo]
  );

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());

    return termo ? catalogo.filter((c) => contemTermo(c.name, termo)) : catalogo;
  }, [catalogo, busca]);

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="condicao" size={20} color={colors.textMuted} />
          <Text variant="heading" style={{ flex: 1 }}>
            Condições
          </Text>
          {conditions.length > 0 ? <Chip label={String(conditions.length)} tone="warning" compact /> : null}
        </View>

        {conditions.length === 0 ? (
          <Text variant="small" tone="muted">
            Nenhuma condição ativa. Elas aparecem aqui quando algo te afeta em combate — cair no chão, ficar
            cego, começar a sangrar.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {conditions.map((condition) => (
              <Chip
                key={condition.id}
                label={condition.name}
                tone={
                  condition.is_incapacitating ? 'danger' : condition.severity >= 3 ? 'warning' : 'neutral'
                }
                onPress={() => setDetalhe(condition)}
                onRemove={editable && condition.condition_id ? () => remove.mutate(condition.condition_id!) : undefined}
              />
            ))}
          </View>
        )}

        {editable ? (
          <>
            {/* Atalhos para o que mais acontece numa rodada. */}
            {frequentes.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="caption" tone="muted" uppercase>
                  Mais comuns
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {frequentes.map((condition) => {
                    if (!condition) return null;
                    const jaAtiva = ativas.has(condition.key);

                    return (
                      <Pressable
                        key={condition.id}
                        onPress={() => add.mutate({ condition_id: condition.id })}
                        accessibilityRole="button"
                        accessibilityLabel={`Aplicar ${condition.name}`}
                        style={({ pressed }) => ({
                          minHeight: 38,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.xs,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.pill,
                          borderWidth: 1,
                          borderColor: jaAtiva ? colors.borderStrong : colors.border,
                          backgroundColor: pressed ? colors.surfaceHover : colors.surfaceAlt,
                          opacity: jaAtiva ? 0.5 : 1,
                        })}
                      >
                        <Icon name="adicionar" size={14} color={colors.textSubtle} />
                        <Text variant="small" tone="secondary">
                          {condition.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button
                label="Ver todas as condições"
                variant="secondary"
                onPress={() => setListaAberta(true)}
                style={{ flex: 1 }}
              />
              {conditions.length > 0 ? (
                <Button
                  label="Fim de cena"
                  variant="ghost"
                  onPress={() => clear.mutate()}
                  loading={clear.isPending}
                />
              ) : null}
            </View>

            {conditions.length > 0 ? (
              <HelpNote collapsible source="Livro base, p. 394">
                Condições terminam no fim da cena, salvo indicação em contrário. O botão “Fim de cena” limpa
                todas de uma vez.
              </HelpNote>
            ) : null}
          </>
        ) : null}
      </View>

      {/* Lista completa, com o efeito ao lado do nome */}
      <Sheet
        visible={listaAberta}
        onClose={() => setListaAberta(false)}
        title="Condições"
        subtitle="As 35 condições do livro"
      >
        <Input placeholder="Buscar condição…" value={busca} onChangeText={setBusca} autoCorrect={false} />

        {reference.isLoading ? (
          <Loading inline label="Carregando condições…" />
        ) : (
          <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
            {filtradas.map((condition) => {
              const jaAtiva = ativas.has(condition.key);

              return (
                <Pressable
                  key={condition.id}
                  onPress={() => {
                    add.mutate({ condition_id: condition.id });
                    setListaAberta(false);
                    setBusca('');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Aplicar ${condition.name}`}
                  style={({ pressed }) => ({
                    minHeight: hitSize.min,
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                    gap: 2,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text variant="bodyStrong" style={{ flex: 1 }}>
                      {condition.name}
                    </Text>
                    {jaAtiva ? <Chip label="ativa" compact tone="warning" /> : null}
                    {condition.effect_type !== 'nenhum' ? (
                      <Chip label={condition.effect_type_label} compact />
                    ) : null}
                  </View>
                  <Text variant="small" tone="muted" numberOfLines={2}>
                    {condition.description}
                  </Text>
                </Pressable>
              );
            })}

            {filtradas.length === 0 ? (
              <Text variant="small" tone="muted" style={{ padding: spacing.lg }}>
                Nenhuma condição encontrada para “{busca}”.
              </Text>
            ) : null}
          </ScrollView>
        )}
      </Sheet>

      {/* Detalhe: o texto do livro, para consultar sem sair do app */}
      <Sheet visible={detalhe !== null} onClose={() => setDetalhe(null)} title={detalhe?.name ?? ''}>
        <Text variant="body" tone="secondary">
          {detalhe?.description ?? ''}
        </Text>

        {detalhe?.duration_note ? (
          <Text variant="small" tone="muted">
            Duração: {detalhe.duration_note}
          </Text>
        ) : null}

        {editable && detalhe && detalhe.condition_id ? (
          <Button
            label="Remover condição"
            variant="danger"
            onPress={() => {
              remove.mutate(detalhe.condition_id!);
              setDetalhe(null);
            }}
          />
        ) : null}
      </Sheet>
    </Card>
  );
}
