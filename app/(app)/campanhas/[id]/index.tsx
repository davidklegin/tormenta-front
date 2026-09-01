import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError, campaignsApi } from '@/api';
import type { CampaignNote, NoteAttachment } from '@/api/types';
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
} from '@/hooks/useCampaigns';
import { useNextSession } from '@/hooks/useCampaignSessions';
import { useStage } from '@/hooks/useStage';
import { useCampaignChannel } from '@/realtime/useCampaignChannel';
import { useAuthStore } from '@/store/auth';
import { iconeDoAnexo } from '@/utils/arquivo';
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

  const joinPublic = useJoinPublicCampaign();

  // Permissão MASTER da plataforma — diferente de `campaign.is_master`, que é
  // o papel de mestre desta mesa.
  const isPlatformMaster = useAuthStore((estado) => estado.user?.is_master ?? false);

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
          <>
            {isPlatformMaster ? (
              <Button
                label="Mesa de Controle"
                variant="secondary"
                size="sm"
                onPress={() => router.push(`/(app)/campanhas/${campaignId}/painel?aba=mesa`)}
              />
            ) : null}
            {isMaster ? (
              <Button
                label="Painel do Mestre"
                variant="gold"
                size="sm"
                icon={<Icon name="mestre" size={16} color={colors.accentInk} />}
                onPress={() => router.push(`/(app)/campanhas/${campaignId}/painel`)}
              />
            ) : null}
          </>
        }
      />

      {/* Visitante do catálogo: lê a mesa inteira, e entra com um toque. */}
      {data.can_join ? (
        <Card title="Mesa aberta" subtitle="Você está visitando esta campanha">
          <View style={{ gap: spacing.md }}>
            <Text variant="small" tone="secondary">
              Qualquer jogador pode entrar nesta mesa. Participando, você vincula seus personagens, escreve
              nas anotações e acompanha a sessão ao vivo.
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

      {/* Quando a mesa joga abre a tela: é a pergunta que se faz ao abrir a
          campanha, e vale inclusive para o visitante do catálogo — é o dado
          que decide se entra. */}
      <ProximaSessao campaignId={campaignId} podeMarcar={isMaster} />

      {/* O palco só aparece para quem senta à mesa: é o que o servidor
          responde, e um card convidando o visitante a abrir uma tela que ele
          não pode ver seria só uma porta trancada. */}
      {data.is_member ? <PalcoDaSessao campaignId={campaignId} isPlatformMaster={isPlatformMaster} /> : null}

      {/* Anotações em destaque: é o que a mesa mais consulta entre as sessões,
          então mostra o conteúdo, e não só um botão para outro lugar. */}
      <NotasDaCampanha campaignId={campaignId} notas={notes.data?.data ?? []} carregando={notes.isLoading} />

      {/* Personagens da mesa — logo abaixo das anotações: são as duas
          coisas que a mesa abre entre uma sessão e outra. */}
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

      {/* Membros por último: é administração da mesa, consultada de vez
          em quando, e não o que se vem ver aqui. */}
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
                <Selo anexos={nota.attachments ?? []} />

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

/**
 * A próxima sessão da mesa, no alto da tela da campanha.
 *
 * Mostra a data em vez de um botão "abrir calendário" pelo mesmo motivo das
 * anotações logo abaixo: a resposta cabe em uma linha, e obrigar uma navegação
 * para ler uma linha é o tipo de coisa que faz ninguém conferir.
 */
function ProximaSessao({ campaignId, podeMarcar }: { campaignId: number; podeMarcar: boolean }) {
  const { colors } = useTheme();

  const proximas = useNextSession(campaignId);
  const sessao = proximas.data?.[0] ?? null;

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="campanhas" size={20} color={colors.textMuted} />
          <Text variant="heading" style={{ flex: 1 }}>
            Próxima sessão
          </Text>
        </View>

        {proximas.isLoading ? (
          <Loading inline label="Consultando o calendário…" />
        ) : sessao ? (
          <View style={{ gap: 2 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {sessao.title}
            </Text>
            <Text variant="small" tone="secondary">
              {quando(sessao.starts_at)}
              {sessao.location ? ` · ${sessao.location}` : ''}
            </Text>
          </View>
        ) : (
          <Text variant="small" tone="muted">
            {podeMarcar
              ? 'Nada marcado. Escolha uma data para a mesa se organizar.'
              : 'O mestre ainda não marcou a próxima sessão.'}
          </Text>
        )}

        <Button
          label={sessao ? 'Ver o calendário' : podeMarcar ? 'Marcar sessão' : 'Ver o calendário'}
          variant={sessao ? 'secondary' : 'primary'}
          onPress={() => router.push(`/(app)/campanhas/${campaignId}/calendario`)}
          fullWidth
        />
      </View>
    </Card>
  );
}

/** "Sexta-feira, 04 de setembro · 20:00" — como a mesa combina. */
function quando(iso: string): string {
  const data = new Date(iso);
  const dia = data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} · ${hora}`;
}

/**
 * O palco da sessão, visto da tela da campanha.
 *
 * Serve a dois leitores. Para o jogador é a porta de entrada: um toque e ele
 * vê no próprio aparelho o que o mestre está projetando. Para o mestre é o
 * atalho para a tela que ele deixa aberta na TV.
 *
 * Mostrar aqui o que está no ar (e não só um botão) é de propósito: quem chega
 * atrasado à mesa descobre que há algo sendo exibido sem precisar perguntar.
 */
function PalcoDaSessao({
  campaignId,
  isPlatformMaster,
}: {
  campaignId: number;
  isPlatformMaster: boolean;
}) {
  const { colors } = useTheme();

  const stage = useStage(campaignId);

  // Assinar aqui mantém o cartão em dia enquanto a tela da campanha estiver
  // aberta — é a mesma assinatura que o palco usa, e o Echo reaproveita a
  // conexão.
  useCampaignChannel(campaignId, true);

  const noAr = stage.data?.poster ?? null;

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="mestre" size={20} color={colors.textMuted} />
          <Text variant="heading" style={{ flex: 1 }}>
            Palco da sessão
          </Text>
          {noAr ? <Chip label="ao vivo" compact tone="success" /> : null}
        </View>

        <Text variant="small" tone={noAr ? 'default' : 'muted'} numberOfLines={2}>
          {noAr
            ? `${noAr.kind_label}: ${noAr.title}`
            : 'Nada sendo exibido agora. O mestre projeta imagens, textos, magias e itens aqui.'}
        </Text>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            label="Abrir o palco"
            variant={noAr ? 'primary' : 'secondary'}
            onPress={() => router.push(`/(app)/campanhas/${campaignId}/palco`)}
            style={{ flex: 1 }}
          />
          {isPlatformMaster ? (
            <Button
              label="Controlar"
              variant="ghost"
              onPress={() => router.push(`/(app)/campanhas/${campaignId}/painel?aba=mesa`)}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

/**
 * O que identifica a anotação de relance na prévia da campanha.
 *
 * A primeira imagem, quando há uma — retrato do NPC, brasão da guilda. Se o
 * único anexo for um PDF ou uma planilha, entra o ícone dele; sem anexo
 * nenhum, não entra nada e o texto ocupa a linha inteira.
 */
function Selo({ anexos }: { anexos: NoteAttachment[] }) {
  const { colors } = useTheme();

  const imagem = anexos.find((anexo) => anexo.kind === 'image');

  if (imagem) {
    return (
      <Image
        source={{ uri: imagem.url }}
        style={{ width: 44, height: 44, borderRadius: radius.sm }}
        contentFit="cover"
        transition={150}
      />
    );
  }

  const primeiro = anexos[0];

  if (!primeiro) return null;

  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Icon name={iconeDoAnexo(primeiro.kind)} size={22} color={colors.accentInk} />
    </View>
  );
}
