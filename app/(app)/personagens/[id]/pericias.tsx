import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { charactersApi } from '@/api';
import type { Character, CharacterSkill } from '@/api/types';
import { Card, Chip, HelpNote, Input, SegmentedControl, Sheet, Text } from '@/components/ui';
import { SheetScreen } from '@/components/character/SheetScreen';
import { signed } from '@/rules';
import { radius, spacing, stroke, useTheme } from '@/theme';

type Filter = 'todas' | 'treinadas' | 'usaveis';

/** Faixa aceita pela API (CharacterSkillController::update). */
const LIMITE_DE_OUTROS = 50;

/** Largura das duas colunas numéricas — a mesma no cabeçalho e nas linhas. */
const COLUNA_OUTROS = 56;
const COLUNA_TOTAL = 48;

/**
 * Texto do campo "Outros".
 *
 * Zero vira campo vazio (com placeholder): vinte caixas escritas "0" só somam
 * ruído. O negativo usa hífen comum, e não o "−" de `signed`, porque este é o
 * campo que a pessoa digita — e nenhum teclado tem o sinal tipográfico.
 */
function textoDeOutros(valor: number): string {
  if (valor === 0) return '';

  return valor > 0 ? `+${valor}` : String(valor);
}

/** Aceita "+2", "2", "-1", "−1" e vazio; corta na faixa que a API aceita. */
function lerOutros(texto: string): number {
  const numero = Number.parseInt(texto.replace('−', '-'), 10);
  if (! Number.isFinite(numero)) return 0;

  return Math.max(-LIMITE_DE_OUTROS, Math.min(LIMITE_DE_OUTROS, numero));
}

/**
 * Aba Perícias (briefing §10).
 *
 * Mostra todas as perícias do sistema com o valor calculado e o detalhamento
 * (½ nível + atributo + treinamento + outros − penalidade de armadura). Marcar
 * "treinada" e ajustar "outros" são um toque na própria linha, como na ficha
 * de papel: são as duas colunas que o jogador mexe na mesa. Tocar no nome abre
 * o detalhamento, que é só leitura.
 */
export default function SkillsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <SkillsContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}

/**
 * O conteúdo vive em um componente próprio, e não em uma função dentro do JSX:
 * assim os hooks são sempre chamados na mesma ordem, mesmo quando a ficha ainda
 * está carregando.
 */
function SkillsContent({ characterId, character }: { characterId: number; character: Character }) {
  const { colors } = useTheme();

  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>('todas');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<CharacterSkill | null>(null);

  const updateSkill = useMutation({
    mutationFn: ({ skillId, payload }: { skillId: number; payload: Record<string, unknown> }) =>
      charactersApi.updateSkill(characterId, skillId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['character', characterId] });
    },
  });

  const canEdit = character.permissions.can_update;

  const skills = useMemo(() => {
    const term = query.trim().toLowerCase();

    return character.skills.filter((skill) => {
      if (term && !skill.name.toLowerCase().includes(term)) return false;
      if (filter === 'treinadas') return skill.trained;
      if (filter === 'usaveis') return skill.usable;

      return true;
    });
  }, [character.skills, filter, query]);

  const trainedCount = character.skills.filter((skill) => skill.trained).length;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip label={`${trainedCount} treinadas`} tone="primary" compact />
        <Chip label={`Bônus de treino ${signed(character.progression.training_bonus)}`} compact />
        <Chip label={`½ nível ${signed(character.progression.half_level)}`} compact />
      </View>

      <HelpNote collapsible source="Livro base, p. 114">
        Toque no quadradinho para marcar uma perícia como treinada — é o que a sua classe e sua origem
        concedem. Em "Outros" vão os modificadores que não saem da fórmula: bônus de item, poder ou
        bênção da mesa. Toque no nome da perícia para ver de onde cada número vem.
      </HelpNote>

      <Input placeholder="Buscar perícia…" value={query} onChangeText={setQuery} autoCorrect={false} />

      <SegmentedControl
        value={filter}
        onChange={setFilter}
        segments={[
          { value: 'todas', label: 'Todas' },
          { value: 'treinadas', label: 'Treinadas' },
          { value: 'usaveis', label: 'Disponíveis' },
        ]}
      />

      <Card padded={false}>
        {/* Cabeçalho: sem ele, a caixinha no meio da linha não se explica. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ width: 22 }} />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            Perícia
          </Text>
          <Text variant="caption" tone="muted" style={{ width: COLUNA_OUTROS, textAlign: 'center' }}>
            Outros
          </Text>
          <Text variant="caption" tone="muted" style={{ width: COLUNA_TOTAL, textAlign: 'right' }}>
            Total
          </Text>
        </View>

        {skills.map((skill, index) => (
          <SkillRow
            key={skill.id}
            skill={skill}
            canEdit={canEdit}
            isLast={index === skills.length - 1}
            onOpenDetail={() => setDetail(skill)}
            onToggleTrained={() =>
              updateSkill.mutate({ skillId: skill.id, payload: { trained: !skill.trained } })
            }
            onChangeOther={(value) =>
              updateSkill.mutate({ skillId: skill.id, payload: { other_bonus: value } })
            }
          />
        ))}

        {skills.length === 0 ? (
          <Text variant="small" tone="muted" style={{ padding: spacing.lg }}>
            Nenhuma perícia encontrada.
          </Text>
        ) : null}
      </Card>

      {/* Detalhe: de onde vem cada número. A edição fica na linha. */}
      <Sheet visible={detail !== null} onClose={() => setDetail(null)} title={detail?.name ?? ''}>
        {detail ? (
          <>
            <View style={{ gap: spacing.xs }}>
              {detail.breakdown.map((part, index) => (
                <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="small" tone="secondary">
                    {part.label}
                  </Text>
                  <Text variant="smallStrong">{signed(part.value)}</Text>
                </View>
              ))}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: spacing.sm,
                  marginTop: spacing.xs,
                }}
              >
                <Text variant="bodyStrong">Total</Text>
                <Text variant="bodyStrong" tone="primary">
                  {signed(detail.total)}
                </Text>
              </View>
            </View>

            {detail.only_trained && !detail.trained ? (
              <Text variant="small" tone="warning">
                Esta perícia só pode ser usada por quem é treinado nela.
              </Text>
            ) : null}

            {canEdit ? (
              <Text variant="caption" tone="muted">
                Para ajustar "Outros", use a coluna da lista.
              </Text>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

/**
 * Uma linha da lista: treino, nome, "outros" e total.
 *
 * O campo de "outros" mora aqui, e não numa tela à parte, porque é um número
 * que muda no meio da sessão (a poção que acabou, o bônus do bardo que caiu) e
 * não vale três toques. Ele salva ao sair do campo: um PUT por tecla digitada
 * encheria a fila de requisições e faria o total piscar a cada dígito.
 */
function SkillRow({
  skill,
  canEdit,
  isLast,
  onOpenDetail,
  onToggleTrained,
  onChangeOther,
}: {
  skill: CharacterSkill;
  canEdit: boolean;
  isLast: boolean;
  onOpenDetail: () => void;
  onToggleTrained: () => void;
  onChangeOther: (value: number) => void;
}) {
  const { colors } = useTheme();

  const [texto, setTexto] = useState(() => textoDeOutros(skill.other_bonus));
  const [focado, setFocado] = useState(false);

  /** Valor já mandado ao servidor e ainda não refletido na ficha. */
  const enviado = useRef<number | null>(null);

  // O valor também muda por fora: o servidor devolve o número normalizado e a
  // ficha se atualiza sozinha na mesa. Duas situações não podem ser
  // sobrescritas: o campo em foco (o texto sumiria debaixo dos dedos de quem
  // digita) e o intervalo entre o PUT e a resposta, quando `other_bonus` ainda
  // é o valor antigo — repor ali faria a edição recém-salva piscar de volta.
  useEffect(() => {
    if (focado) return;
    if (enviado.current !== null && enviado.current !== skill.other_bonus) return;

    enviado.current = null;
    setTexto(textoDeOutros(skill.other_bonus));
  }, [skill.other_bonus, focado]);

  const salvar = () => {
    const valor = lerOutros(texto);
    setTexto(textoDeOutros(valor));

    if (valor !== skill.other_bonus) {
      enviado.current = valor;
      onChangeOther(valor);
    }
  };

  return (
    <Pressable
      onPress={onOpenDetail}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        opacity: skill.usable ? 1 : 0.55,
      })}
    >
      {/* Marcador de treinamento: toque direto, sem abrir tela */}
      <Pressable
        disabled={!canEdit}
        onPress={onToggleTrained}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: skill.trained }}
        accessibilityLabel={`${skill.name} treinada`}
        style={{
          width: 22,
          height: 22,
          borderRadius: radius.sm,
          borderWidth: 1.5,
          borderColor: skill.trained ? colors.primary : colors.borderStrong,
          backgroundColor: skill.trained ? colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {skill.trained ? (
          <Text variant="caption" style={{ color: colors.onPrimary }}>
            ✓
          </Text>
        ) : null}
      </Pressable>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body" numberOfLines={1}>
          {skill.name}
        </Text>
        <Text variant="caption" tone="muted">
          {skill.attribute.toUpperCase()}
          {skill.only_trained ? ' · só treinada' : ''}
          {skill.armor_penalty_applies ? ' · armadura' : ''}
        </Text>
      </View>

      {canEdit ? (
        <View
          // Sem isso, o toque no campo escorrega para o Pressable da linha e
          // abre o detalhamento em vez de focar o input.
          onStartShouldSetResponder={() => true}
          style={{
            width: COLUNA_OUTROS,
            height: 36,
            justifyContent: 'center',
            borderBottomWidth: stroke.seal,
            borderBottomColor: focado ? colors.accent : colors.border,
          }}
        >
          <TextInput
            value={texto}
            onChangeText={setTexto}
            onFocus={() => setFocado(true)}
            onBlur={() => {
              setFocado(false);
              salvar();
            }}
            onSubmitEditing={salvar}
            keyboardType="numbers-and-punctuation"
            placeholder="0"
            placeholderTextColor={colors.textSubtle}
            selectTextOnFocus
            returnKeyType="done"
            accessibilityLabel={`Outros modificadores de ${skill.name}`}
            style={{ color: colors.text, fontSize: 15, textAlign: 'center', outlineStyle: 'none' } as never}
          />
        </View>
      ) : (
        <Text variant="small" tone="muted" style={{ width: COLUNA_OUTROS, textAlign: 'center' }}>
          {skill.other_bonus === 0 ? '—' : signed(skill.other_bonus)}
        </Text>
      )}

      <Text
        variant="numeric"
        style={{ fontSize: 20, width: COLUNA_TOTAL, textAlign: 'right' }}
        tone={skill.usable ? 'default' : 'muted'}
      >
        {signed(skill.total)}
      </Text>
    </Pressable>
  );
}
