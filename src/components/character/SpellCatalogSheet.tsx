import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { charactersApi, spellsApi } from '@/api';
import type { CatalogSpell, CatalogSpellDetail } from '@/api/types';
import { Button, Chip, DetailRow, Icon, Input, Loading, SegmentedControl, Sheet, Text } from '@/components/ui';
import { useSpellCatalog, useSpellCatalogFilters } from '@/hooks/useSpellCatalog';
import { radius, spacing, tones, useTheme } from '@/theme';

/**
 * Grimório: escolher magias prontas da biblioteca em vez de digitar a ficha.
 *
 * O jogador marca quantas quiser e confirma uma vez só — mandar um POST por
 * magia deixaria a ficha pela metade se a conexão caísse no meio, e escolher
 * magias é justamente o momento em que se pega várias de uma vez (ao subir de
 * nível, ao criar o personagem).
 *
 * Magias que o personagem já conhece aparecem marcadas e desabilitadas, para
 * o jogador não precisar lembrar o que já tem enquanto navega por 275 magias.
 */
export function SpellCatalogSheet({
  visible,
  onClose,
  characterId,
  knownSpellIds,
  onImported,
}: {
  visible: boolean;
  onClose: () => void;
  characterId: number;
  /** ids da biblioteca que o personagem já conhece. */
  knownSpellIds: number[];
  onImported: (added: number) => void;
}) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const filtros = useSpellCatalogFilters();

  const [busca, setBusca] = useState('');
  const [circulo, setCirculo] = useState<string>('todos');
  const [selecionadas, setSelecionadas] = useState<number[]>([]);
  const [aberta, setAberta] = useState<number | null>(null);

  const catalogo = useSpellCatalog({
    q: busca || undefined,
    circle: circulo === 'todos' ? undefined : Number(circulo),
  });

  const conhecidas = useMemo(() => new Set(knownSpellIds), [knownSpellIds]);

  const importar = useMutation({
    mutationFn: () => charactersApi.importSpells(characterId, selecionadas),
    onSuccess: (resultado) => {
      void queryClient.invalidateQueries({ queryKey: ['character', characterId] });
      setSelecionadas([]);
      onImported(resultado.added);
      onClose();
    },
  });

  const alternar = (id: number) =>
    setSelecionadas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));

  const limparFiltros = () => {
    setBusca('');
    setCirculo('todos');
  };

  const temFiltro = busca !== '' || circulo !== 'todos';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Grimório"
      subtitle={
        filtros.data ? `${filtros.data.total} magias do livro base e das publicações seguintes` : undefined
      }
      footer={
        <>
          <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={selecionadas.length > 0 ? `Adicionar ${selecionadas.length}` : 'Adicionar'}
            onPress={() => importar.mutate()}
            disabled={selecionadas.length === 0}
            loading={importar.isPending}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Input placeholder="Buscar magia…" value={busca} onChangeText={setBusca} autoCorrect={false} />

      <SegmentedControl
        scrollable
        value={circulo}
        onChange={setCirculo}
        segments={[
          { value: 'todos', label: 'Todos' },
          ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}º` })),
        ]}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
          {catalogo.isLoading ? 'Buscando…' : `${catalogo.total} encontrada${catalogo.total === 1 ? '' : 's'}`}
        </Text>
        {temFiltro ? <Chip label="Limpar filtros" compact onPress={limparFiltros} /> : null}
      </View>

      {catalogo.isLoading ? (
        <Loading />
      ) : catalogo.spells.length === 0 ? (
        <Text variant="small" tone="muted">
          Nenhuma magia com esses filtros.
        </Text>
      ) : (
        <View style={{ borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
          {catalogo.spells.map((magia, index) => (
            <LinhaDaMagia
              key={magia.id}
              spell={magia}
              selected={selecionadas.includes(magia.id)}
              known={conhecidas.has(magia.id)}
              expanded={aberta === magia.id}
              last={index === catalogo.spells.length - 1}
              onToggle={() => alternar(magia.id)}
              onExpand={() => setAberta((atual) => (atual === magia.id ? null : magia.id))}
            />
          ))}
        </View>
      )}

      {catalogo.hasNextPage ? (
        <Button
          label="Carregar mais"
          variant="secondary"
          onPress={() => void catalogo.fetchNextPage()}
          loading={catalogo.isFetchingNextPage}
        />
      ) : null}

      {importar.isError ? (
        <Text variant="small" tone="danger">
          Não deu para adicionar as magias. Tente de novo.
        </Text>
      ) : null}
    </Sheet>
  );
}

/**
 * Uma magia da lista.
 *
 * O "i" abre a ficha completa ali mesmo, para o jogador decidir se quer a
 * magia sem sair do grimório. A descrição só é baixada quando pedida — a lista
 * carrega cinquenta magias por vez e vem sem ela.
 */
function LinhaDaMagia({
  spell,
  selected,
  known,
  expanded,
  last,
  onToggle,
  onExpand,
}: {
  spell: CatalogSpell;
  selected: boolean;
  known: boolean;
  expanded: boolean;
  last: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  const { colors } = useTheme();
  const arcano = tones(colors).arcane;
  const marcada = known || selected;

  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: selected ? colors.surfaceHover : 'transparent',
        }}
      >
        <Pressable
          onPress={known ? undefined : onToggle}
          disabled={known}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: marcada, disabled: known }}
          accessibilityLabel={`${spell.name}, ${spell.header}, ${spell.mp_cost} pontos de mana`}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.md,
            paddingLeft: spacing.lg,
            backgroundColor: pressed ? colors.surfaceHover : 'transparent',
            opacity: known ? 0.55 : 1,
          })}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: marcada ? arcano.border : colors.borderStrong,
              backgroundColor: marcada ? arcano.solid : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {marcada ? <Icon name="confirmar" size={14} color={arcano.onSolid} /> : null}
          </View>

          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="body" numberOfLines={1}>
              {spell.name}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {known ? 'Já conhecida · ' : ''}
              {spell.header}
              {spell.execution ? ` · ${spell.execution}` : ''}
              {spell.range_text ? ` · ${spell.range_text}` : ''}
            </Text>
          </View>

          <Chip label={`${spell.mp_cost} PM`} compact tone="arcane" />
        </Pressable>

        {/* Fora do Pressable da seleção e sem o esmaecido: ler a magia que já
            se conhece também é útil. */}
        <Pressable
          onPress={onExpand}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? `Fechar ficha de ${spell.name}` : `Ler ficha de ${spell.name}`}
          hitSlop={spacing.sm}
          style={({ pressed }) => ({
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon name={expanded ? 'expandir' : 'info'} size={18} color={colors.textMuted} />
        </Pressable>
      </View>

      {expanded ? <FichaDaMagia id={spell.id} /> : null}
    </View>
  );
}

/** A ficha completa, buscada só quando o jogador abre aquela linha. */
function FichaDaMagia({ id }: { id: number }) {
  const { colors } = useTheme();

  const detalhe = useQuery<CatalogSpellDetail>({
    queryKey: ['spells', 'detail', id],
    queryFn: () => spellsApi.show(id),
    staleTime: Infinity,
  });

  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        gap: spacing.sm,
        backgroundColor: colors.surfaceHover,
      }}
    >
      {detalhe.isPending ? (
        <Loading />
      ) : detalhe.isError ? (
        <Text variant="small" tone="danger">
          Não deu para carregar a magia.
        </Text>
      ) : (
        <>
          <View style={{ gap: spacing.xs }}>
            <DetailRow label="Execução" value={detalhe.data.execution} />
            <DetailRow label="Alcance" value={detalhe.data.range_text} />
            <DetailRow label="Alvo" value={detalhe.data.target} />
            <DetailRow label="Área" value={detalhe.data.area} />
            <DetailRow label="Efeito" value={detalhe.data.effect} />
            <DetailRow label="Duração" value={detalhe.data.duration} />
            <DetailRow label="Resistência" value={detalhe.data.resistance} />
          </View>

          {detalhe.data.description ? (
            <Text variant="small" tone="secondary">
              {detalhe.data.description}
            </Text>
          ) : null}

          {detalhe.data.enhancements.length > 0 ? (
            <View style={{ gap: spacing.xs }}>
              <Text variant="caption" tone="secondary" uppercase>
                Aprimoramentos
              </Text>
              {detalhe.data.enhancements.map((aprimoramento, index) => (
                <Text key={index} variant="small" tone="secondary">
                  <Text variant="smallStrong" tone="arcane">
                    {aprimoramento.cost}
                  </Text>{' '}
                  {aprimoramento.text}
                </Text>
              ))}
            </View>
          ) : null}

          {detalhe.data.source ? (
            <Text variant="caption" tone="muted">
              {detalhe.data.source}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}
