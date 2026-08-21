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
  useJoinPublicCampaign,
  useCampaignCatalog,
} from '@/hooks/useCampaigns';
import { spacing, useTheme } from '@/theme';

type Aba = 'minhas' | 'todas';

/**
 * Campanhas: as minhas e as de todo mundo (briefing §16).
 *
 * As mesas são abertas a todos, então a tela tem duas listas. "Minhas" é onde
 * se joga; "Todas" é a base inteira — de qualquer uma delas se entra com um
 * toque. A visibilidade só decide quem se anuncia no catálogo.
 */
export default function CampaignsScreen() {
  const { colors } = useTheme();

  const [aba, setAba] = useState<Aba>('minhas');
  const [busca, setBusca] = useState('');

  const campaigns = useCampaigns();
  const catalogo = useCampaignCatalog(aba === 'todas' ? busca.trim() : '');
  const createCampaign = useCreateCampaign();
  const joinPublic = useJoinPublicCampaign();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
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
        subtitle={aba === 'minhas' ? 'Mesas das quais você participa' : 'Todas as mesas da comunidade'}
        actions={<Button label="Criar campanha" size="sm" onPress={() => setCreateOpen(true)} />}
      />

      <SegmentedControl
        value={aba}
        onChange={setAba}
        segments={[
          { value: 'minhas', label: 'Minhas', badge: campaigns.data?.length || undefined },
          { value: 'todas', label: 'Todas' },
        ]}
      />

      {aba === 'todas' ? (
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
        <ListaVazia aba={aba} busca={busca} onCriar={() => setCreateOpen(true)} onExplorar={() => setAba('todas')} />
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

      {aba === 'todas' && (catalogo.data ?? []).length > 0 ? (
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
          A mesa nasce pública e qualquer jogador entra com um toque. Você pode tirá-la do catálogo
          quando quiser, na tela da campanha — aí ela só chega a quem você mandar o link ou o código.
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
            <Chip
              label={campaign.visibility === 'private' ? 'Fora do catálogo' : 'Aberta'}
              tone="neutral"
              compact
            />
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
  if (aba === 'todas') {
    return (
      <EmptyState
        icon="campanhas"
        title={busca.trim() ? 'Nenhuma mesa com esse nome' : 'Nenhuma mesa ainda'}
        description={
          busca.trim()
            ? 'Tente outro termo — a busca procura no nome e na descrição da campanha.'
            : 'Crie a primeira mesa e ela aparecerá aqui para todo mundo.'
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
      actionLabel="Ver todas as mesas"
      onAction={onExplorar}
    />
  );
}
