import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { charactersApi } from '@/api';
import type { CatalogSpell } from '@/api/types';
import { Button, Chip, Icon, Input, Loading, SegmentedControl, Sheet, Text } from '@/components/ui';
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
              last={index === catalogo.spells.length - 1}
              onPress={() => alternar(magia.id)}
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

function LinhaDaMagia({
  spell,
  selected,
  known,
  last,
  onPress,
}: {
  spell: CatalogSpell;
  selected: boolean;
  known: boolean;
  last: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const arcano = tones(colors).arcane;
  const marcada = known || selected;

  return (
    <Pressable
      onPress={known ? undefined : onPress}
      disabled={known}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada, disabled: known }}
      accessibilityLabel={`${spell.name}, ${spell.header}, ${spell.mp_cost} pontos de mana`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
        backgroundColor: selected ? colors.surfaceHover : pressed ? colors.surfaceHover : 'transparent',
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
  );
}
