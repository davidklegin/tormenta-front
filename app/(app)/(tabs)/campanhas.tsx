import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { ApiError } from '@/api';
import type { Campaign } from '@/api/types';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  Screen,
  SegmentedControl,
  Sheet,
  Text,
} from '@/components/ui';
import { PageHeader, ResponsiveGrid } from '@/components/layout';
import {
  useCampaigns,
  useCreateCampaign,
  useJoinCampaign,
  useJoinPublicCampaign,
  usePublicCampaigns,
} from '@/hooks/useCampaigns';
import { spacing, useTheme } from '@/theme';

type Aba = 'minhas' | 'explorar';

/**
 * Campanhas: as minhas e as de todo mundo (briefing §16).
 *
 * As mesas são públicas por padrão, então a tela tem duas listas. "Minhas" é
 * onde se joga; "Explorar" é o catálogo aberto, de onde se entra numa mesa com
 * um toque, sem depender de o mestre passar código.
 */
export default function CampaignsScreen() {
  const { colors } = useTheme();

  const [aba, setAba] = useState<Aba>('minhas');
  const [busca, setBusca] = useState('');

  const campaigns = useCampaigns();
  const catalogo = usePublicCampaigns(aba === 'explorar' ? busca.trim() : '');
  const createCampaign = useCreateCampaign();
  const joinCampaign = useJoinCampaign();
  const joinPublic = useJoinPublicCampaign();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const lista = aba === 'minhas' ? campaigns : catalogo;

  async function handleCreate() {
    if (name.trim().length < 2) {
      setFormError('Informe o nome da campanha.');

      return;
    }

    setFormError(null);
    try {
      const campaign = await createCampaign.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setCreateOpen(false);
      setName('');
      setDescription('');
      router.push(`/(app)/campanhas/${campaign.id}`);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Não foi possível criar a campanha.');
    }
  }

  async function handleJoin() {
    if (code.trim().length !== 8) {
      setFormError('O código de convite tem 8 caracteres.');

      return;
    }

    setFormError(null);
    try {
      const result = await joinCampaign.mutateAsync(code.trim().toUpperCase());
      setJoinOpen(false);
      setCode('');
      router.push(`/(app)/campanhas/${result.campaign.id}`);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? (error.fieldError('code') ?? error.message)
          : 'Não foi possível entrar na campanha.'
      );
    }
  }

  return (
    <Screen
      insideTabs
      refreshControl={
        <RefreshControl
          refreshing={lista.isRefetching}
          onRefresh={() => void lista.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        title="Campanhas"
        subtitle={aba === 'minhas' ? 'Mesas das quais você participa' : 'Mesas abertas de toda a comunidade'}
        actions={
          <>
            <Button
              label="Entrar com código"
              variant="secondary"
              size="sm"
              onPress={() => setJoinOpen(true)}
            />
            <Button label="Criar campanha" size="sm" onPress={() => setCreateOpen(true)} />
          </>
        }
      />

      <SegmentedControl
        value={aba}
        onChange={setAba}
        segments={[
          { value: 'minhas', label: 'Minhas', badge: campaigns.data?.length || undefined },
          { value: 'explorar', label: 'Explorar' },
        ]}
      />

      {aba === 'explorar' ? (
        <Input
          placeholder="Buscar mesa pelo nome…"
          value={busca}
          onChangeText={setBusca}
          autoCorrect={false}
        />
      ) : null}

      {lista.isError ? <ErrorState error={lista.error} onRetry={() => void lista.refetch()} /> : null}

      {lista.isLoading ? (
        <Loading label={aba === 'minhas' ? 'Carregando campanhas…' : 'Procurando mesas…'} />
      ) : (lista.data ?? []).length === 0 ? (
        <ListaVazia aba={aba} busca={busca} onCriar={() => setCreateOpen(true)} onExplorar={() => setAba('explorar')} />
      ) : (
        <ResponsiveGrid columns={{ phone: 1, tablet: 2, desktop: 3 }}>
          {(lista.data ?? []).map((campaign) => (
            <CampanhaCard
              key={campaign.id}
              campaign={campaign}
              entrando={joinPublic.isPending && joinPublic.variables === campaign.id}
              onEntrar={() => {
                joinPublic.mutate(campaign.id, {
                  onSuccess: () => router.push(`/(app)/campanhas/${campaign.id}`),
                });
              }}
            />
          ))}
        </ResponsiveGrid>
      )}

      {aba === 'explorar' && (catalogo.data ?? []).length > 0 ? (
        <Text variant="caption" tone="muted">
          O catálogo mostra as mesas com movimento mais recente. Para achar outra, busque pelo nome.
        </Text>
      ) : null}

      <Sheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nova campanha"
        subtitle="Você será o mestre desta mesa"
        footer={
          <>
            <Button
              label="Cancelar"
              variant="ghost"
              onPress={() => setCreateOpen(false)}
              style={{ flex: 1 }}
            />
            <Button
              label="Criar"
              onPress={handleCreate}
              loading={createCampaign.isPending}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <Input label="Nome" value={name} onChangeText={setName} placeholder="Coração de Rubi" />
        <Input
          label="Descrição"
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Do que se trata a campanha?"
        />
        <Text variant="small" tone="muted">
          A mesa nasce pública: aparece em Explorar e qualquer jogador pode entrar. Você fecha quando
          quiser, na tela da campanha.
        </Text>
        {formError ? (
          <Text variant="small" tone="danger">
            {formError}
          </Text>
        ) : null}
      </Sheet>

      <Sheet
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Entrar em uma campanha"
        subtitle="Peça o código de 8 caracteres ao mestre"
        footer={
          <>
            <Button label="Cancelar" variant="ghost" onPress={() => setJoinOpen(false)} style={{ flex: 1 }} />
            <Button
              label="Entrar"
              onPress={handleJoin}
              loading={joinCampaign.isPending}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <Input
          label="Código de convite"
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          placeholder="ABCD1234"
        />
        <Text variant="small" tone="muted">
          O código é o caminho para as mesas fechadas. As públicas você acha em Explorar.
        </Text>
        {formError ? (
          <Text variant="small" tone="danger">
            {formError}
          </Text>
        ) : null}
      </Sheet>
    </Screen>
  );
}

/**
 * Card de campanha nas duas listas.
 *
 * O que muda entre elas é o rodapé: na minha mesa, o atalho do Painel do
 * Mestre; no catálogo, o botão de entrar — ou a marca de que já participo.
 */
function CampanhaCard({
  campaign,
  entrando,
  onEntrar,
}: {
  campaign: Campaign;
  entrando: boolean;
  onEntrar: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Card
      accentColor={campaign.is_master ? colors.accentInk : undefined}
      onPress={() => router.push(`/(app)/campanhas/${campaign.id}`)}
    >
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="heading" numberOfLines={1} style={{ flex: 1 }}>
            {campaign.name}
          </Text>
          {campaign.is_member ? (
            <Chip
              label={campaign.is_master ? 'Mestre' : 'Jogador'}
              tone={campaign.is_master ? 'gold' : 'neutral'}
              compact
            />
          ) : (
            <Chip label="Aberta" tone="neutral" compact />
          )}
        </View>

        {campaign.description ? (
          <Text variant="small" tone="secondary" numberOfLines={2}>
            {campaign.description}
          </Text>
        ) : null}

        <Text variant="small" tone="muted">
          {campaign.master?.name ? `Mestre: ${campaign.master.name} · ` : ''}
          {campaign.characters_count ?? 0} personagem(ns) · {campaign.members_count ?? 0} membro(s)
        </Text>

        {campaign.is_master ? (
          <Button
            label="Painel do Mestre"
            variant="gold"
            size="sm"
            onPress={() => router.push(`/(app)/campanhas/${campaign.id}/painel`)}
          />
        ) : campaign.can_join ? (
          <Button label="Participar" variant="secondary" size="sm" onPress={onEntrar} loading={entrando} />
        ) : null}
      </View>
    </Card>
  );
}

function ListaVazia({
  aba,
  busca,
  onCriar,
  onExplorar,
}: {
  aba: Aba;
  busca: string;
  onCriar: () => void;
  onExplorar: () => void;
}) {
  if (aba === 'explorar') {
    return (
      <EmptyState
        icon="campanhas"
        title={busca.trim() ? 'Nenhuma mesa com esse nome' : 'Nenhuma mesa aberta ainda'}
        description={
          busca.trim()
            ? 'Tente outro termo — a busca procura no nome e na descrição da campanha.'
            : 'Crie a primeira mesa pública e ela aparecerá aqui para todo mundo.'
        }
        actionLabel="Criar campanha"
        onAction={onCriar}
      />
    );
  }

  return (
    <EmptyState
      icon="campanhas"
      title="Nenhuma campanha ainda"
      description="Crie uma mesa para mestrar ou entre em uma das mesas abertas da comunidade."
      actionLabel="Explorar mesas"
      onAction={onExplorar}
    />
  );
}
