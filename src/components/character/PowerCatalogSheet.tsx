import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { charactersApi, powersApi } from '@/api';
import type { CatalogPower, CatalogPowerDetail, CatalogPowerEffect, Character } from '@/api/types';
import { Button, Chip, Icon, Input, Loading, SegmentedControl, Sheet, Text } from '@/components/ui';
import { usePowerCatalog, usePowerCatalogFilters } from '@/hooks/usePowerCatalog';
import { radius, spacing, tones, useTheme } from '@/theme';

/**
 * Biblioteca de poderes: escolher um poder pronto em vez de digitar a ficha.
 *
 * O jogador marca quantos quiser e confirma uma vez só — mandar um POST por
 * poder deixaria a ficha pela metade se a conexão caísse no meio, e escolher
 * poder é justamente o momento em que se pega vários (ao criar o personagem,
 * ao subir de nível).
 *
 * São mais de setecentos poderes espalhados por treze grupos, então a tela
 * abre com os atalhos que cortam para o que este personagem pode pegar: os
 * poderes da raça dele e os concedidos pela divindade dele. Sem isso, achar
 * "Coragem Total" no meio dos concedidos seria rolagem cega.
 *
 * Poderes que o personagem já tem aparecem marcados e desabilitados.
 */
export function PowerCatalogSheet({
  visible,
  onClose,
  character,
  onImported,
}: {
  visible: boolean;
  onClose: () => void;
  character: Character;
  onImported: (added: number) => void;
}) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const filtros = usePowerCatalogFilters();

  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState<string>('todos');
  const [recorte, setRecorte] = useState<'nenhum' | 'raca' | 'deus'>('nenhum');
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [aberto, setAberto] = useState<number | null>(null);

  const catalogo = usePowerCatalog({
    q: busca || undefined,
    subtype: grupo === 'todos' ? undefined : grupo,
    race: recorte === 'raca' ? (character.race?.name ?? undefined) : undefined,
    deity: recorte === 'deus' ? (character.deity?.name ?? undefined) : undefined,
  });

  // O jogador pode ter digitado o mesmo poder à mão; só os que vieram da
  // biblioteca têm power_id, e são esses que dá para reconhecer com certeza.
  const jaTem = useMemo(
    () => new Set(character.powers.map((p) => p.power_id).filter((id): id is number => id !== null)),
    [character.powers]
  );

  const importar = useMutation({
    mutationFn: () => charactersApi.importPowers(character.id, selecionados),
    onSuccess: (resultado) => {
      void queryClient.invalidateQueries({ queryKey: ['character', character.id] });
      setSelecionados([]);
      onImported(resultado.added);
      onClose();
    },
  });

  const alternar = (id: number) =>
    setSelecionados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));

  const alternarRecorte = (qual: 'raca' | 'deus') =>
    setRecorte((atual) => (atual === qual ? 'nenhum' : qual));

  const limparFiltros = () => {
    setBusca('');
    setGrupo('todos');
    setRecorte('nenhum');
  };

  const temFiltro = busca !== '' || grupo !== 'todos' || recorte !== 'nenhum';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Biblioteca de poderes"
      subtitle={
        filtros.data ? `${filtros.data.total} poderes do livro base e das publicações seguintes` : undefined
      }
      footer={
        <>
          <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label={selecionados.length > 0 ? `Adicionar ${selecionados.length}` : 'Adicionar'}
            onPress={() => importar.mutate()}
            disabled={selecionados.length === 0}
            loading={importar.isPending}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Input
        placeholder="Buscar por nome ou pré-requisito…"
        value={busca}
        onChangeText={setBusca}
        autoCorrect={false}
      />

      {character.race || character.deity ? (
        <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
          {character.race ? (
            <Chip
              label={`Da raça ${character.race.name}`}
              tone="primary"
              selected={recorte === 'raca'}
              onPress={() => alternarRecorte('raca')}
            />
          ) : null}
          {character.deity ? (
            <Chip
              label={`Concedidos por ${character.deity.name}`}
              tone="gold"
              selected={recorte === 'deus'}
              onPress={() => alternarRecorte('deus')}
            />
          ) : null}
        </View>
      ) : null}

      <SegmentedControl
        scrollable
        value={grupo}
        onChange={setGrupo}
        segments={[
          { value: 'todos', label: 'Todos' },
          ...(filtros.data?.subtypes ?? []).map((s) => ({ value: s.value, label: s.label, badge: s.total })),
        ]}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
          {catalogo.isLoading
            ? 'Buscando…'
            : `${catalogo.total} encontrado${catalogo.total === 1 ? '' : 's'}`}
        </Text>
        {temFiltro ? <Chip label="Limpar filtros" compact onPress={limparFiltros} /> : null}
      </View>

      {catalogo.isLoading ? (
        <Loading />
      ) : catalogo.powers.length === 0 ? (
        <Text variant="small" tone="muted">
          Nenhum poder com esses filtros.
        </Text>
      ) : (
        <View
          style={{ borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}
        >
          {catalogo.powers.map((poder, index) => (
            <LinhaDoPoder
              key={poder.id}
              power={poder}
              selected={selecionados.includes(poder.id)}
              known={jaTem.has(poder.id)}
              expanded={aberto === poder.id}
              last={index === catalogo.powers.length - 1}
              onToggle={() => alternar(poder.id)}
              onExpand={() => setAberto((atual) => (atual === poder.id ? null : poder.id))}
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
          Não deu para adicionar os poderes. Tente de novo.
        </Text>
      ) : null}
    </Sheet>
  );
}

/**
 * Um poder da lista.
 *
 * O pré-requisito fica à vista porque é ele que responde "eu posso pegar
 * este?", a pergunta que se faz a cada linha; deixá-lo só no detalhe obrigaria
 * a abrir um por um. A descrição, essa sim, só é baixada quando o jogador
 * pede — são setecentos poderes e a lista carrega cinquenta por vez.
 */
function LinhaDoPoder({
  power,
  selected,
  known,
  expanded,
  last,
  onToggle,
  onExpand,
}: {
  power: CatalogPower;
  selected: boolean;
  known: boolean;
  expanded: boolean;
  last: boolean;
  onToggle: () => void;
  onExpand: () => void;
}) {
  const { colors } = useTheme();
  const arcano = tones(colors).arcane;
  const marcado = known || selected;

  const concede = [...power.deities, ...power.races].join(', ');
  const legenda = [known ? 'Já na ficha' : null, power.subtype, concede || null].filter(Boolean).join(' · ');

  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: selected ? colors.surfaceHover : 'transparent',
          opacity: known ? 0.55 : 1,
        }}
      >
        <Pressable
          onPress={known ? undefined : onToggle}
          disabled={known}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: marcado, disabled: known }}
          accessibilityLabel={`${power.name}${power.requirements ? `, pré-requisito ${power.requirements}` : ''}`}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingVertical: spacing.md,
            paddingLeft: spacing.lg,
            backgroundColor: pressed ? colors.surfaceHover : 'transparent',
          })}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: marcado ? arcano.border : colors.borderStrong,
              backgroundColor: marcado ? arcano.solid : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {marcado ? <Icon name="confirmar" size={14} color={arcano.onSolid} /> : null}
          </View>

          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="body" numberOfLines={1}>
              {power.name}
            </Text>
            {legenda ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {legenda}
              </Text>
            ) : null}
            {power.requirements ? (
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                Pré-requisito: {power.requirements}
              </Text>
            ) : null}

            {/* O que o poder faria na ficha. Dizer aqui que o condicional
                entra desligado — e que o parametrizável ainda vai perguntar
                um número — evita o jogador achar que a conta já mudou. */}
            {power.effects.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: 2 }}>
                {power.effects.map((efeito, i) => (
                  <Chip
                    key={`${efeito.target}-${i}`}
                    label={rotuloDoEfeito(efeito)}
                    compact
                    tone={efeito.conditional || efeito.parametric ? 'neutral' : 'success'}
                  />
                ))}
              </View>
            ) : null}
          </View>

          {power.mp_cost ? <Chip label={power.mp_cost} compact tone="arcane" /> : null}
        </Pressable>

        <Pressable
          onPress={onExpand}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={
            expanded ? `Fechar descrição de ${power.name}` : `Ler descrição de ${power.name}`
          }
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

      {expanded ? <DescricaoDoPoder id={power.id} /> : null}
    </View>
  );
}

/** A descrição, buscada só quando o jogador abre aquela linha. */
function DescricaoDoPoder({ id }: { id: number }) {
  const { colors } = useTheme();

  const detalhe = useQuery<CatalogPowerDetail>({
    queryKey: ['powers', 'detail', id],
    queryFn: () => powersApi.show(id),
    staleTime: Infinity,
  });

  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        gap: spacing.xs,
        backgroundColor: colors.surfaceHover,
      }}
    >
      {detalhe.isPending ? (
        <Loading />
      ) : detalhe.isError ? (
        <Text variant="small" tone="danger">
          Não deu para carregar a descrição.
        </Text>
      ) : (
        <>
          <Text variant="small" tone="secondary">
            {detalhe.data.description}
          </Text>
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

/**
 * O rótulo do bônus na biblioteca, antes de o poder entrar em qualquer ficha.
 *
 * O condicional avisa que depende de situação; o parametrizável avisa que o
 * número é do personagem — a linhagem dracônica soma PV, mas quantos é o
 * Carisma de quem a pegou, e a ficha vai perguntar.
 */
function rotuloDoEfeito(efeito: CatalogPowerEffect): string {
  if (efeito.parametric) return `${efeito.text} (você define)`;

  return efeito.conditional ? `${efeito.text} (se…)` : efeito.text;
}
