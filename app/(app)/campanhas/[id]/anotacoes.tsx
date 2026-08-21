import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import type { CampaignNote, NoteCategory } from '@/api/types';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Loading,
  Screen,
  SegmentedControl,
  Select,
  Sheet,
  Text,
} from '@/components/ui';
import { PageHeader } from '@/components/layout';
import { NoteImages } from '@/components/campaign/NoteImages';
import { useCampaign, useCampaignNoteMutations, useCampaignNotes } from '@/hooks/useCampaigns';
import { useCampaignChannel } from '@/realtime/useCampaignChannel';
import { NOTE_CATEGORY_LABELS } from '@/rules';
import { radius, spacing, useTheme } from '@/theme';

const CATEGORIES = Object.entries(NOTE_CATEGORY_LABELS) as [NoteCategory, string][];

/**
 * Anotações compartilhadas da campanha (briefing §18).
 *
 * Todos os membros veem as mesmas notas; o mestre pode marcar uma como privada.
 * Mudanças feitas por outros aparecem sozinhas, pelo canal da campanha.
 */
export default function CampaignNotesScreen() {
  const { colors } = useTheme();

  const params = useLocalSearchParams<{ id: string }>();
  const campaignId = Number(params.id);

  const campaign = useCampaign(campaignId);
  const [category, setCategory] = useState<string>('todas');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignNote | null>(null);

  const notes = useCampaignNotes(campaignId, {
    q: query || undefined,
    category: category === 'todas' ? undefined : (category as NoteCategory),
  });

  const { remove } = useCampaignNoteMutations(campaignId);

  const isMaster = campaign.data?.is_master ?? false;
  // Visitante de mesa pública lê as anotações, mas não escreve nelas nem
  // assina o canal da sessão — o servidor recusaria os dois.
  const isMember = campaign.data?.is_member ?? false;

  // Notas criadas ou editadas por outros membros chegam sem recarregar a tela.
  useCampaignChannel(campaignId, isMember);

  return (
    <Screen>
      <PageHeader
        title="Anotações da campanha"
        subtitle={campaign.data?.name}
        back
        actions={
          isMember ? (
            <Button
              label="Nova anotação"
              size="sm"
              onPress={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            />
          ) : undefined
        }
      />

      <Input placeholder="Buscar…" value={query} onChangeText={setQuery} autoCorrect={false} />

      <SegmentedControl
        scrollable
        value={category}
        onChange={setCategory}
        segments={[
          { value: 'todas', label: 'Todas' },
          ...CATEGORIES.map(([value, label]) => ({ value, label })),
        ]}
      />

      {notes.isLoading ? (
        <Loading inline label="Carregando anotações…" />
      ) : (notes.data?.data ?? []).length === 0 ? (
        <EmptyState
          icon="anotacoes"
          title="Nenhuma anotação"
          description={
            isMember
              ? 'Registre NPCs, lugares, missões e pistas para toda a mesa consultar.'
              : 'Esta mesa ainda não publicou anotações. Participe da campanha para escrever nela.'
          }
          actionLabel={isMember ? 'Criar a primeira' : undefined}
          onAction={
            isMember
              ? () => {
                  setEditing(null);
                  setFormOpen(true);
                }
              : undefined
          }
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {(notes.data?.data ?? []).map((note) => (
            <Pressable
              key={note.id}
              onPress={() => {
                if (!note.can_edit) return;
                setEditing(note);
                setFormOpen(true);
              }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: note.visibility === 'master_only' ? colors.accentInk : colors.border,
                padding: spacing.lg,
                gap: spacing.xs,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {note.title}
                </Text>
                <Chip label={note.category_label} compact />
                {note.visibility === 'master_only' ? <Chip label="Mestre" compact tone="gold" /> : null}
              </View>

              {note.images && note.images.length > 0 ? (
                <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs }}>
                  {note.images.slice(0, 4).map((imagem) => (
                    <Image
                      key={imagem.id}
                      source={{ uri: imagem.url }}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                      contentFit="cover"
                      transition={150}
                    />
                  ))}
                  {note.images.length > 4 ? (
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: radius.sm,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.surfaceAlt,
                      }}
                    >
                      <Text variant="caption" tone="muted">
                        +{note.images.length - 4}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {note.body ? (
                <Text variant="small" tone="secondary" numberOfLines={3}>
                  {note.body}
                </Text>
              ) : null}

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text variant="caption" tone="muted">
                  {note.author?.name ?? '—'} · {formatDate(note.updated_at)}
                </Text>
                {note.can_edit ? (
                  <Pressable
                    onPress={() => remove.mutate(note.id)}
                    hitSlop={8}
                    accessibilityLabel="Excluir anotação"
                  >
                    <Text variant="small" tone="muted">
                      excluir
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <NoteForm
        key={editing?.id ?? `nova-${category}`}
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        campaignId={campaignId}
        note={editing}
        isMaster={isMaster}
        /* Criando com um filtro ativo, a categoria já vem escolhida — quem
           está em "Missões" quase sempre quer criar uma missão. */
        defaultCategory={category === 'todas' ? 'outros' : (category as NoteCategory)}
      />
    </Screen>
  );
}

function NoteForm({
  visible,
  onClose,
  campaignId,
  note,
  isMaster,
  defaultCategory = 'outros',
}: {
  visible: boolean;
  onClose: () => void;
  campaignId: number;
  note: CampaignNote | null;
  isMaster: boolean;
  defaultCategory?: NoteCategory;
}) {
  const { colors } = useTheme();

  const { create, update } = useCampaignNoteMutations(campaignId);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [category, setCategory] = useState<NoteCategory>(note?.category ?? defaultCategory);
  const [masterOnly, setMasterOnly] = useState(note?.visibility === 'master_only');

  async function handleSave() {
    const payload = {
      title: title.trim(),
      body: body.trim(),
      category,
      visibility: masterOnly && isMaster ? 'master_only' : 'campaign',
    };

    if (note) {
      await update.mutateAsync({ id: note.id, ...payload });
    } else {
      await create.mutateAsync(payload);
    }

    onClose();
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={note ? 'Editar anotação' : 'Nova anotação'}
      footer={
        <>
          <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label="Salvar"
            onPress={handleSave}
            loading={create.isPending || update.isPending}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Input label="Título" value={title} onChangeText={setTitle} placeholder="A taverna do Porco Sortudo" />

      <Select
        label="Categoria"
        value={category}
        options={CATEGORIES.map(([value, label]) => ({ value, label }))}
        onChange={(value) => setCategory((value as NoteCategory) ?? 'outros')}
        searchable={false}
      />

      <Input label="Texto" value={body} onChangeText={setBody} multiline />

      {note ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="smallStrong" tone="secondary">
            Imagens
          </Text>
          <NoteImages
            campaignId={campaignId}
            noteId={note.id}
            images={note.images ?? []}
            editable={note.can_edit}
            onChanged={() => void queryClient.invalidateQueries({ queryKey: ['campaign-notes', campaignId] })}
          />
        </View>
      ) : (
        <Text variant="small" tone="muted">
          Salve a anotação para poder anexar imagens — o retrato do NPC, o mapa do lugar.
        </Text>
      )}

      {isMaster ? (
        <Pressable
          onPress={() => setMasterOnly((value) => !value)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: masterOnly }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: radius.sm,
              borderWidth: 1.5,
              borderColor: masterOnly ? colors.accentInk : colors.borderStrong,
              backgroundColor: masterOnly ? colors.accentInk : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {masterOnly ? (
              <Text variant="caption" style={{ color: colors.onPrimary }}>
                ✓
              </Text>
            ) : null}
          </View>
          <Text variant="body">Visível apenas para o mestre</Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '—';

  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
