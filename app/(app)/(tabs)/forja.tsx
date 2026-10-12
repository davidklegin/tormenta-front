import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, charactersApi, forgeApi } from '@/api';
import type { ForgeItem } from '@/api/types';
import {
  Button,
  Card,
  Chip,
  DetailRow,
  EmptyState,
  ErrorState,
  HelpNote,
  Icon,
  Input,
  Loading,
  Screen,
  SegmentedControl,
  Select,
  Sheet,
  Text,
} from '@/components/ui';
import { ForgeItemForm } from '@/components/items/ForgeItemForm';
import { PageHeader } from '@/components/layout';
import { useCharacters } from '@/hooks/useCharacters';
import { useReference } from '@/hooks/useReference';
import { describeItemEffect, effectKeyNames, formatSlots, formatTibar } from '@/rules';
import { useAuthStore } from '@/store/auth';
import { spacing, useTheme } from '@/theme';
import { contemTermo, normalizar } from '@/utils/texto';

type Aba = 'meus' | 'todos';

/**
 * A Forja (pedido de 2026-10-12): onde o mestre e os jogadores criam itens que
 * dão bônus — o anel de +2 na Defesa, a espada que soma 1d6 de fogo, o cajado
 * que aumenta o dano das magias.
 *
 * O item forjado aparece no "Escolher do catálogo" do inventário de qualquer
 * ficha, e daqui mesmo dá para colocá-lo numa ficha sua. Os bônus somam
 * sozinhos enquanto o item está equipado.
 */
export default function ForgeScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((state) => state.user);
  const reference = useReference();
  const names = effectKeyNames(reference.data);

  const [aba, setAba] = useState<Aba>('meus');
  const [busca, setBusca] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ForgeItem | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);

  const forge = useQuery({ queryKey: ['forge'], queryFn: forgeApi.list });

  const lista = useMemo(() => {
    const termo = normalizar(busca.trim());
    return (forge.data ?? [])
      .filter((item) => aba === 'todos' || item.creator?.id === user?.id)
      .filter((item) => !termo || contemTermo(item.name, termo) || contemTermo(item.description ?? '', termo));
  }, [forge.data, aba, busca, user?.id]);

  const meus = (forge.data ?? []).filter((item) => item.creator?.id === user?.id).length;
  const detail = (forge.data ?? []).find((item) => item.id === detailId) ?? null;

  return (
    <Screen
      insideTabs
      refreshControl={
        <RefreshControl
          refreshing={forge.isRefetching}
          onRefresh={() => void forge.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        title="Forja"
        subtitle="Itens da mesa e os bônus que eles dão"
        actions={
          <Button
            label="Forjar item"
            size="sm"
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          />
        }
      />

      <View style={{ gap: spacing.md }}>
        <HelpNote collapsible>
          Crie o item uma vez e escolha o que ele dá: atributo, perícia, Defesa, PV, PM, deslocamento, redução de
          dano, ataque, dano das armas ou das magias. Depois, na aba Equipamento da ficha, escolha o item no
          catálogo (ou use “Colocar numa ficha” aqui) e marque como equipado — os bônus entram sozinhos.
        </HelpNote>

        <SegmentedControl
          value={aba}
          onChange={setAba}
          segments={[
            { value: 'meus', label: 'Que eu forjei', badge: meus || undefined },
            { value: 'todos', label: 'Todos', badge: forge.data?.length || undefined },
          ]}
        />

        <Input placeholder="Buscar item…" value={busca} onChangeText={setBusca} autoCorrect={false} />

        {forge.isError ? <ErrorState error={forge.error} onRetry={() => void forge.refetch()} /> : null}

        {forge.isLoading ? (
          <Loading label="Abrindo a Forja…" />
        ) : lista.length === 0 ? (
          <EmptyState
            icon="forja"
            title={busca ? 'Nenhum item com esse nome' : aba === 'meus' ? 'Você ainda não forjou nada' : 'A Forja está vazia'}
            description={busca ? undefined : 'Toque em “Forjar item” para criar o primeiro.'}
          />
        ) : (
          lista.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setDetailId(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${item.name}`}
            >
              <Card>
                <View style={{ gap: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Chip label={item.category_label} compact />
                  </View>
                  {item.effects.length > 0 ? (
                    <Text variant="small" tone="gold">
                      {item.effects.map((effect) => describeItemEffect(effect, names)).join(' · ')}
                    </Text>
                  ) : (
                    <Text variant="small" tone="muted">
                      Sem bônus
                    </Text>
                  )}
                  {aba === 'todos' && item.creator ? (
                    <Text variant="caption" tone="muted">
                      forjado por {item.creator.name}
                    </Text>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </View>

      <ForgeDetail
        item={detail}
        onClose={() => setDetailId(null)}
        onEdit={(item) => {
          setDetailId(null);
          setEditing(item);
          setFormOpen(true);
        }}
        names={names}
      />

      <ForgeItemForm
        key={editing?.id ?? 'novo'}
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        item={editing}
      />
    </Screen>
  );
}

/** O item aberto: o que ele é, o que dá, e as ações de quem pode. */
function ForgeDetail({
  item,
  onClose,
  onEdit,
  names,
}: {
  item: ForgeItem | null;
  onClose: () => void;
  onEdit: (item: ForgeItem) => void;
  names: Record<string, string>;
}) {
  const queryClient = useQueryClient();
  const characters = useCharacters();
  const [characterId, setCharacterId] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  const fechar = () => {
    setAviso(null);
    setConfirmarRemocao(false);
    onClose();
  };

  const colocar = useMutation({
    mutationFn: () => charactersApi.createItem(characterId as number, { item_id: item?.id, name: item?.name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['character', characterId] });
      const ficha = characters.data?.find((c) => c.id === characterId);
      setAviso(`${item?.name} foi para o inventário de ${ficha?.name ?? 'sua ficha'}. Marque como equipado lá para os bônus valerem.`);
    },
  });

  const remover = useMutation({
    mutationFn: () => forgeApi.remove(item?.id as number),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forge'] });
      void queryClient.invalidateQueries({ queryKey: ['reference'] });
      fechar();
    },
  });

  return (
    <Sheet visible={item !== null} onClose={fechar} title={item?.name ?? ''} subtitle={item?.category_label}>
      {item ? (
        <>
          <View style={{ gap: spacing.xs }}>
            <DetailRow label="Espaços" value={formatSlots(item.slots)} />
            <DetailRow label="Preço" value={item.price !== null ? formatTibar(item.price) : null} />
            <DetailRow
              label="Dano"
              value={item.damage ? `${item.damage}${item.critical_range ? ` · ${item.critical_range}/x${item.critical_multiplier ?? 2}` : ''}` : null}
            />
            <DetailRow label="Defesa" value={item.defense_bonus ? `+${item.defense_bonus}` : null} />
            <DetailRow label="Penalidade de armadura" value={item.armor_penalty ? String(item.armor_penalty) : null} />
            <DetailRow label="Forjado por" value={item.creator?.name ?? null} />
          </View>

          <View style={{ gap: spacing.xs }}>
            <Text variant="caption" tone="secondary" uppercase>
              O que dá (quando equipado)
            </Text>
            {item.effects.length === 0 ? (
              <Text variant="small" tone="muted">
                Nenhum bônus.
              </Text>
            ) : (
              item.effects.map((effect, index) => (
                <View key={index} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <Icon name="confirmar" size={16} />
                  <Text variant="body" tone="gold" style={{ flex: 1 }}>
                    {describeItemEffect(effect, names)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {item.description ? (
            <Text variant="body" tone="secondary">
              {item.description}
            </Text>
          ) : null}

          {(characters.data ?? []).length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Select
                label="Colocar numa ficha sua"
                value={characterId}
                options={(characters.data ?? []).map((c) => ({
                  value: c.id,
                  label: c.name,
                  description: c.class_label,
                }))}
                onChange={(value) => {
                  setCharacterId(value);
                  setAviso(null);
                }}
                placeholder="Escolher personagem"
              />
              <Button
                label="Colocar no inventário"
                variant="secondary"
                disabled={characterId === null}
                loading={colocar.isPending}
                onPress={() => colocar.mutate()}
              />
              {aviso ? (
                <Text variant="small" tone="success">
                  {aviso}
                </Text>
              ) : null}
              {colocar.isError ? (
                <Text variant="small" tone="danger">
                  {colocar.error instanceof ApiError && colocar.error.message
                    ? colocar.error.message
                    : 'Não foi possível colocar o item na ficha.'}
                </Text>
              ) : null}
            </View>
          ) : null}

          {item.can_edit ? (
            confirmarRemocao ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="small" tone="warning">
                  Apagar da Forja não tira o item de quem já o tem na ficha. Confirma?
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button label="Manter" variant="ghost" style={{ flex: 1 }} onPress={() => setConfirmarRemocao(false)} />
                  <Button
                    label="Apagar"
                    variant="danger"
                    style={{ flex: 1 }}
                    loading={remover.isPending}
                    onPress={() => remover.mutate()}
                  />
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label="Editar" variant="secondary" style={{ flex: 1 }} onPress={() => onEdit(item)} />
                <Button label="Apagar" variant="danger" style={{ flex: 1 }} onPress={() => setConfirmarRemocao(true)} />
              </View>
            )
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}
