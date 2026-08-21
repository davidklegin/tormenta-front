import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { ApiError } from '@/api';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  Screen,
  Sheet,
  Text,
} from '@/components/ui';
import { PageHeader, ResponsiveGrid } from '@/components/layout';
import { useCampaigns, useCreateCampaign, useJoinCampaign } from '@/hooks/useCampaigns';
import { spacing, useTheme } from '@/theme';

/** Campanhas do jogador — como jogador e como mestre (briefing §16). */
export default function CampaignsScreen() {
  const { colors } = useTheme();

  const campaigns = useCampaigns();
  const createCampaign = useCreateCampaign();
  const joinCampaign = useJoinCampaign();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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

  if (campaigns.isLoading) {
    return (
      <Screen insideTabs>
        <Loading label="Carregando campanhas…" />
      </Screen>
    );
  }

  const list = campaigns.data ?? [];

  return (
    <Screen
      insideTabs
      refreshControl={
        <RefreshControl
          refreshing={campaigns.isRefetching}
          onRefresh={() => void campaigns.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHeader
        title="Campanhas"
        subtitle="Mesas das quais você participa"
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

      {campaigns.isError ? (
        <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} />
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          icon="campanhas"
          title="Nenhuma campanha ainda"
          description="Crie uma mesa para mestrar ou entre em uma com o código que o mestre te passou."
          actionLabel="Criar campanha"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <ResponsiveGrid columns={{ phone: 1, tablet: 2, desktop: 3 }}>
          {list.map((campaign) => (
            <Card
              key={campaign.id}
              accentColor={campaign.is_master ? colors.accentInk : undefined}
              onPress={() => router.push(`/(app)/campanhas/${campaign.id}`)}
            >
              <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                    {campaign.name}
                  </Text>
                  <Chip
                    label={campaign.is_master ? 'Mestre' : 'Jogador'}
                    tone={campaign.is_master ? 'gold' : 'neutral'}
                    compact
                  />
                </View>

                {campaign.description ? (
                  <Text variant="small" tone="secondary" numberOfLines={2}>
                    {campaign.description}
                  </Text>
                ) : null}

                <Text variant="small" tone="muted">
                  {campaign.characters_count ?? 0} personagem(ns) · {campaign.members_count ?? 0} membro(s)
                </Text>

                {campaign.is_master ? (
                  <Button
                    label="Painel do Mestre"
                    variant="gold"
                    size="sm"
                    onPress={() => router.push(`/(app)/campanhas/${campaign.id}/painel`)}
                  />
                ) : null}
              </View>
            </Card>
          ))}
        </ResponsiveGrid>
      )}

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
        {formError ? (
          <Text variant="small" tone="danger">
            {formError}
          </Text>
        ) : null}
      </Sheet>
    </Screen>
  );
}
