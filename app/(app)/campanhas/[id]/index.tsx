import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, campaignsApi } from '@/api';
import type { CampaignNote } from '@/api/types';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Loading,
  Screen,
  SegmentedControl,
  Sheet,
  Text,
} from '@/components/ui';
import { CharacterCard } from '@/components/character/CharacterCard';
import { PageHeader, ResponsiveGrid } from '@/components/layout';
import {
  useCampaign,
  useCampaignCharacters,
  useCampaignMembers,
  useCampaignNotes,
  useJoinPublicCampaign,
  useUpdateCampaign,
} from '@/hooks/useCampaigns';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Tela da campanha: membros, personagens e atalhos (briefing §16 e §17).
 *
 * A mesma tela serve a três olhares — o mestre, o jogador da mesa e o
 * visitante que chegou pelo catálogo. O visitante lê tudo o que é público e
 * tem um único botão a mais: participar.
 */
export default function CampaignScreen() {
  const { colors } = useTheme();

  const params = useLocalSearchParams<{ id: string }>();
  const campaignId = Number(params.id);
  const queryClient = useQueryClient();

  const campaign = useCampaign(campaignId);
  const members = useCampaignMembers(campaignId);
  const characters = useCampaignCharacters(campaignId);
  const notes = useCampaignNotes(campaignId);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);

  const invite = useMutation({
    mutationFn: (value: string) => campaignsApi.invite(campaignId, value),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign-members', campaignId] });
      setInviteOpen(false);
      setEmail('');
    },
    onError: (error) => {
      setInviteError(
        error instanceof ApiError
          ? (error.fieldError('email') ?? error.message)
          : 'Não foi possível convidar.'
      );
    },
  });

  const removeMember = useMutation({
    mutationFn: (memberId: number) => campaignsApi.removeMember(campaignId, memberId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign-members', campaignId] });
      void queryClient.invalidateQueries({ queryKey: ['campaign-characters', campaignId] });
    },
  });

  const regenerate = useMutation({
    mutationFn: () => campaignsApi.regenerateInviteCode(campaignId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
    },
  });

  const joinPublic = useJoinPublicCampaign();
  const updateCampaign = useUpdateCampaign(campaignId);

  if (campaign.isLoading) {
    return (
      <Screen>
        <Loading label="Carregando campanha…" />
      </Screen>
    );
  }

  if (campaign.isError || !campaign.data) {
    return (
      <Screen>
        <PageHeader title="Campanha" back />
        <ErrorState error={campaign.error} onRetry={() => void campaign.refetch()} />
      </Screen>
    );
  }

  const data = campaign.data;
  const isMaster = data.is_master;

  return (
    <Screen>
      <PageHeader
        title={data.name}
        subtitle={data.description ?? undefined}
        back
        actions={
          isMaster ? (
            <Button
              label="Painel do Mestre"
              variant="gold"
              size="sm"
              icon={<Icon name="mestre" size={16} color={colors.accentInk} />}
              onPress={() => router.push(`/(app)/campanhas/${campaignId}/painel`)}
            />
          ) : undefined
        }
      />

      {/* Visitante do catálogo: lê a mesa inteira, e entra com um toque. */}
      {data.can_join ? (
        <Card title="Mesa aberta" subtitle="Você está visitando esta campanha">
          <View style={{ gap: spacing.md }}>
            <Text variant="small" tone="secondary">
              Qualquer jogador pode entrar nesta mesa. Participando, você vincula seus personagens,
              escreve nas anotações e acompanha a sessão ao vivo.
            </Text>
            <Button
              label="Participar da campanha"
              onPress={() => joinPublic.mutate(campaignId)}
              loading={joinPublic.isPending}
              fullWidth
            />
          </View>
        </Card>
      ) : null}

      {/* Anotações em destaque: é o que a mesa mais consulta entre as sessões,
          então mostra o conteúdo, e não só um botão para outro lugar. */}
      <NotasDaCampanha campaignId={campaignId} notas={notes.data?.data ?? []} carregando={notes.isLoading} />

      {/* Visibilidade: quem decide se a mesa fica no catálogo é o mestre */}
      {isMaster ? (
        <Card title="Visibilidade" subtitle="Quem enxerga esta campanha">
          <View style={{ gap: spacing.md }}>
            <SegmentedControl
              value={data.visibility}
              onChange={(visibility) => updateCampaign.mutate({ visibility })}
              segments={[
                { value: 'public', label: 'Pública' },
                { value: 'private', label: 'Privada' },
              ]}
            />
            <Text variant="caption" tone="muted">
              {data.visibility === 'public'
                ? 'A mesa aparece em Explorar e qualquer jogador pode entrar sem código. O Painel do Mestre e as anotações marcadas "somente o mestre" continuam só seus.'
                : 'Só os membros veem esta campanha. Para entrar, é preciso o código de convite.'}
            </Text>
          </View>
        </Card>
      ) : null}

      {/* Código de convite: só o mestre vê */}
      {isMaster && data.invite_code ? (
        <Card title="Convite" subtitle="Compartilhe este código com seus jogadores">
          <View style={{ gap: spacing.md }}>
            <View
              style={{
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.accentInk,
                paddingVertical: spacing.md,
                alignItems: 'center',
              }}
            >
              <Text variant="numeric" tone="gold" style={{ letterSpacing: 4 }}>
                {data.invite_code}
              </Text>
            </View>
            <Button
              label="Gerar novo código"
              variant="ghost"
              size="sm"
              onPress={() => regenerate.mutate()}
              loading={regenerate.isPending}
            />
            <Text variant="caption" tone="muted">
              Gerar um novo código invalida os convites já distribuídos.
            </Text>
          </View>
        </Card>
      ) : null}

      {/* Membros */}
      <Card
        title="Membros"
        right={
          isMaster ? (
            <Button label="Convidar" size="sm" variant="secondary" onPress={() => setInviteOpen(true)} />
          ) : undefined
        }
      >
        <View style={{ gap: spacing.sm }}>
          {(members.data ?? []).map((member) => (
            <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="body" numberOfLines={1}>
                  {member.user?.name ?? '—'}
                </Text>
                {member.status === 'invited' ? (
                  <Text variant="caption" tone="warning">
                    convite pendente
                  </Text>
                ) : null}
              </View>

              <Chip label={member.role_label} tone={member.role === 'master' ? 'gold' : 'neutral'} compact />

              {isMaster && member.role !== 'master' ? (
                <Pressable
                  onPress={() => removeMember.mutate(member.id)}
                  hitSlop={8}
                  accessibilityLabel={`Remover ${member.user?.name ?? 'membro'}`}
                >
                  <Icon name="remover" size={18} color={colors.textSubtle} />
                </Pressable>
              ) : null}
            </View>
          ))}

          {(members.data ?? []).length === 0 ? (
            <Text variant="small" tone="muted">
              Nenhum membro ainda.
            </Text>
          ) : null}
        </View>
      </Card>

      {/* Personagens da mesa */}
      <View style={{ gap: spacing.sm }}>
        <Text variant="caption" tone="secondary" uppercase>
          Personagens na campanha
        </Text>

        {(characters.data ?? []).length === 0 ? (
          <EmptyState
            icon="personagens"
            title="Nenhum personagem vinculado"
            description="Os jogadores vinculam seus personagens a esta campanha pela ficha."
          />
        ) : (
          <ResponsiveGrid columns={{ phone: 1, tablet: 2, desktop: 3 }}>
            {(characters.data ?? []).map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                onPress={() => router.push(`/(app)/personagens/${character.id}`)}
              />
            ))}
          </ResponsiveGrid>
        )}
      </View>

      <Sheet
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Convidar jogador"
        subtitle="Informe o e-mail de quem já tem conta"
        footer={
          <>
            <Button
              label="Cancelar"
              variant="ghost"
              onPress={() => setInviteOpen(false)}
              style={{ flex: 1 }}
            />
            <Button
              label="Convidar"
              onPress={() => invite.mutate(email.trim().toLowerCase())}
              loading={invite.isPending}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          error={inviteError ?? undefined}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text variant="small" tone="muted">
          Quem ainda não tem conta pode entrar pelo código de convite.
        </Text>
      </Sheet>
    </Screen>
  );
}

/**
 * Bloco de anotações na tela da campanha.
 *
 * Fica logo abaixo do cabeçalho porque é o que a mesa mais consulta entre uma
 * sessão e outra — quem era aquele NPC, o que ficou pendente. Mostrar as
 * últimas ali economiza uma navegação; o botão leva ao resto.
 */
function NotasDaCampanha({
  campaignId,
  notas,
  carregando,
}: {
  campaignId: number;
  notas: CampaignNote[];
  carregando: boolean;
}) {
  const { colors } = useTheme();

  const recentes = notas.slice(0, 3);

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="anotacoes" size={20} color={colors.textMuted} />
          <Text variant="heading" style={{ flex: 1 }}>
            Anotações da campanha
          </Text>
          {notas.length > 0 ? <Chip label={String(notas.length)} compact /> : null}
        </View>

        {carregando ? (
          <Loading inline label="Carregando anotações…" />
        ) : recentes.length === 0 ? (
          <Text variant="small" tone="muted">
            Nada anotado ainda. Registre NPCs, lugares, missões e pistas para toda a mesa consultar.
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {recentes.map((nota) => (
              <Pressable
                key={nota.id}
                onPress={() => router.push(`/(app)/campanhas/${campaignId}/anotacoes`)}
                accessibilityRole="button"
                accessibilityLabel={`Abrir anotação ${nota.title}`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed ? colors.surfaceHover : colors.surfaceAlt,
                })}
              >
                {nota.images && nota.images[0] ? (
                  <Image
                    source={{ uri: nota.images[0].url }}
                    style={{ width: 44, height: 44, borderRadius: radius.sm }}
                    contentFit="cover"
                    transition={150}
                  />
                ) : null}

                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {nota.title}
                  </Text>
                  {nota.body ? (
                    <Text variant="small" tone="muted" numberOfLines={1}>
                      {nota.body}
                    </Text>
                  ) : null}
                </View>

                <Chip label={nota.category_label} compact />
              </Pressable>
            ))}
          </View>
        )}

        <Button
          label={notas.length > 0 ? 'Ver todas as anotações' : 'Criar a primeira anotação'}
          onPress={() => router.push(`/(app)/campanhas/${campaignId}/anotacoes`)}
          fullWidth
        />
      </View>
    </Card>
  );
}
