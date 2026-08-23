import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { stageApi } from '@/api';
import type { NoteAttachment, StageFact, StageItem, StageItemKind } from '@/api/types';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Loading,
  Screen,
  SegmentedControl,
  Select,
  Sheet,
  Text,
} from '@/components/ui';
import { PageHeader } from '@/components/layout';
import {
  AttachmentStrip,
  NoteAttachments,
  buildAttachmentForm,
  type PendingAttachment,
} from '@/components/files';
import { FactsEditor } from '@/components/stage';
import { useCampaign } from '@/hooks/useCampaigns';
import { stageKeys, useStageControls, useStageItemMutations, useStageItems } from '@/hooks/useStage';
import { useAuthStore } from '@/store/auth';
import { radius, spacing, stroke, useTheme } from '@/theme';

const TIPOS: { value: StageItemKind; label: string }[] = [
  { value: 'npc', label: 'NPC' },
  { value: 'place', label: 'Lugar' },
  { value: 'image', label: 'Imagem' },
  { value: 'handout', label: 'Documento' },
  { value: 'text', label: 'Texto' },
];

/**
 * Acervo do Mestre: o material da sessão, preparado antes dela.
 *
 * Tudo aqui nasce invisível. Um NPC cadastrado com retrato, ficha e a
 * motivação secreta dele fica guardado até o mestre tocar em "Exibir" — e
 * mesmo então só a parte pública vai ao palco.
 *
 * A tela existe separada das anotações da campanha de propósito: anotação é
 * memória compartilhada da mesa, e uma caixa de "não mostrar ainda" no meio
 * dela seria uma surpresa estragada por um clique errado.
 */
export default function StageLibraryScreen() {
  const { colors } = useTheme();

  const params = useLocalSearchParams<{ id: string }>();
  const campaignId = Number(params.id);

  const isPlatformMaster = useAuthStore((estado) => estado.user?.is_master ?? false);

  const campaign = useCampaign(campaignId);
  const [kind, setKind] = useState<string>('todos');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<StageItem | null>(null);

  const itens = useStageItems(
    campaignId,
    { q: query || undefined, kind: kind === 'todos' ? undefined : (kind as StageItemKind) },
    isPlatformMaster
  );

  const { remove } = useStageItemMutations(campaignId);
  const { show } = useStageControls(campaignId);

  // A tela some inteira para quem não é MASTER — o servidor recusaria a
  // listagem de qualquer forma, e mostrar o esqueleto de uma tela vazia só
  // anunciaria que existe algo aqui.
  if (!isPlatformMaster) {
    return (
      <Screen>
        <PageHeader title="Acervo do Mestre" back />
        <EmptyState
          icon="mestre"
          title="Área restrita"
          description="O acervo é do mestre da plataforma. O palco da sessão, esse você acompanha pela tela da campanha."
        />
      </Screen>
    );
  }

  const lista = itens.data ?? [];

  return (
    <Screen>
      <PageHeader
        title="Acervo do Mestre"
        subtitle={campaign.data?.name}
        back
        actions={
          <>
            <Button
              label="Mesa de controle"
              variant="gold"
              size="sm"
              icon={<Icon name="mestre" size={16} color={colors.accentInk} />}
              onPress={() => router.push(`/(app)/campanhas/${campaignId}/controle`)}
            />
            <Button
              label="Nova peça"
              size="sm"
              onPress={() => {
                setEditando(null);
                setFormOpen(true);
              }}
            />
          </>
        }
      />

      <Input placeholder="Buscar no acervo…" value={query} onChangeText={setQuery} autoCorrect={false} />

      <SegmentedControl
        scrollable
        value={kind}
        onChange={setKind}
        segments={[{ value: 'todos', label: 'Todos' }, ...TIPOS]}
      />

      {itens.isError ? (
        <ErrorState error={itens.error} onRetry={() => void itens.refetch()} />
      ) : itens.isLoading ? (
        <Loading inline label="Abrindo o acervo…" />
      ) : lista.length === 0 ? (
        <EmptyState
          icon="mestre"
          title="Acervo vazio"
          description="Cadastre NPCs, mapas, cartas e textos de leitura. Nada disso aparece para os jogadores até você exibir."
          actionLabel="Cadastrar a primeira peça"
          onAction={() => {
            setEditando(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {lista.map((peca) => (
            <Pressable
              key={peca.id}
              onPress={() => {
                setEditando(peca);
                setFormOpen(true);
              }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                borderRadius: radius.lg,
                borderWidth: stroke.hairline,
                borderColor: colors.border,
                padding: spacing.lg,
                gap: spacing.xs,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {peca.title}
                </Text>
                <Chip label={peca.kind_label} compact tone="gold" />
              </View>

              {peca.subtitle ? (
                <Text variant="small" tone="secondary" numberOfLines={1}>
                  {peca.subtitle}
                </Text>
              ) : null}

              {peca.attachments && peca.attachments.length > 0 ? (
                <AttachmentStrip attachments={peca.attachments} />
              ) : null}

              {peca.body ? (
                <Text variant="small" tone="secondary" numberOfLines={2}>
                  {peca.body}
                </Text>
              ) : null}

              {peca.secret_notes ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Icon name="mestre" size={13} color={colors.textSubtle} />
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    Tem anotação secreta — nunca vai ao palco
                  </Text>
                </View>
              ) : null}

              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.sm,
                  alignItems: 'center',
                  marginTop: spacing.xs,
                }}
              >
                <Button
                  label="Exibir agora"
                  size="sm"
                  variant="secondary"
                  loading={show.isPending && show.variables?.source === 'stage_item' && show.variables.id === peca.id}
                  onPress={() => show.mutate({ source: 'stage_item', id: peca.id })}
                />

                <View style={{ flex: 1 }} />

                <Pressable
                  onPress={() => remove.mutate(peca.id)}
                  hitSlop={8}
                  accessibilityLabel={`Excluir ${peca.title}`}
                >
                  <Text variant="small" tone="muted">
                    excluir
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <StageItemForm
        key={editando?.id ?? `nova-${kind}`}
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        campaignId={campaignId}
        /* A versão recém-carregada, e não a que abriu o formulário: anexar um
           arquivo recarrega a lista, e é dali que sai a tira de anexos. */
        item={editando ? (lista.find((peca) => peca.id === editando.id) ?? editando) : null}
        defaultKind={kind === 'todos' ? 'npc' : (kind as StageItemKind)}
      />
    </Screen>
  );
}

function StageItemForm({
  visible,
  onClose,
  campaignId,
  item,
  defaultKind = 'npc',
}: {
  visible: boolean;
  onClose: () => void;
  campaignId: number;
  item: StageItem | null;
  defaultKind?: StageItemKind;
}) {
  const { create, update } = useStageItemMutations(campaignId);
  const queryClient = useQueryClient();

  const [kind, setKind] = useState<StageItemKind>(item?.kind ?? defaultKind);
  const [title, setTitle] = useState(item?.title ?? '');
  const [subtitle, setSubtitle] = useState(item?.subtitle ?? '');
  const [body, setBody] = useState(item?.body ?? '');
  const [secretNotes, setSecretNotes] = useState(item?.secret_notes ?? '');
  const [facts, setFacts] = useState<StageFact[]>(item?.facts ?? []);

  // Arquivos escolhidos antes de a peça existir — sobem depois do create.
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // Se o create passou mas um upload falhou, a peça já existe: um segundo
  // "Salvar" precisa editá-la e retentar os arquivos, nunca criar outra.
  const criada = useRef<StageItem | null>(null);
  const [salvando, setSalvando] = useState(false);

  const alvo = item ?? criada.current;

  const invalidar = () => void queryClient.invalidateQueries({ queryKey: stageKeys.items(campaignId) });

  function fechar() {
    criada.current = null;
    setPending([]);
    setAttachmentError(null);
    onClose();
  }

  async function handleSave() {
    setSalvando(true);

    try {
      await salvar();
    } finally {
      setSalvando(false);
    }
  }

  async function salvar() {
    const payload = {
      kind,
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      body: body.trim() || null,
      secret_notes: secretNotes.trim() || null,
      // Linha em branco não vira dado: o mestre adiciona três e preenche duas.
      facts: facts.filter((linha) => linha.label.trim() !== ''),
    };

    const salva = alvo ? await update.mutateAsync({ id: alvo.id, ...payload }) : await create.mutateAsync(payload);

    if (!item) criada.current = salva;

    if (pending.length > 0) {
      const restantes: PendingAttachment[] = [];
      const enviados: NoteAttachment[] = [];

      for (const arquivo of pending) {
        try {
          enviados.push(await stageApi.addAttachment(campaignId, salva.id, await buildAttachmentForm(arquivo)));
        } catch {
          restantes.push(arquivo);
        }
      }

      if (criada.current) {
        criada.current = {
          ...criada.current,
          attachments: [...(criada.current.attachments ?? []), ...enviados],
        };
      }

      setPending(restantes);
      invalidar();

      if (restantes.length > 0) {
        setAttachmentError('A peça foi salva, mas não conseguimos enviar todos os arquivos. Tente salvar de novo.');

        return;
      }
    }

    fechar();
  }

  return (
    <Sheet
      visible={visible}
      onClose={fechar}
      title={item ? 'Editar peça' : 'Nova peça do acervo'}
      subtitle="Nada disto aparece para os jogadores até você exibir"
      footer={
        <>
          <Button label="Cancelar" variant="ghost" onPress={fechar} style={{ flex: 1 }} />
          <Button
            label="Salvar"
            onPress={handleSave}
            loading={salvando || create.isPending || update.isPending}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Select
        label="Tipo"
        value={kind}
        options={TIPOS}
        onChange={(valor) => setKind((valor as StageItemKind) ?? 'npc')}
        searchable={false}
      />

      <Input label="Título" value={title} onChangeText={setTitle} placeholder="Gorack Misuk" />

      <Input
        label="Subtítulo"
        value={subtitle}
        onChangeText={setSubtitle}
        placeholder="Chefe goblin da Caverna Rubra"
      />

      <Input
        label="Texto exibido"
        value={body}
        onChangeText={setBody}
        multiline
        hint="Vai para a tela dos jogadores quando você exibir esta peça."
      />

      <FactsEditor facts={facts} onChange={setFacts} />

      <View style={{ gap: spacing.sm }}>
        <Text variant="smallStrong" tone="secondary">
          Arquivos
        </Text>

        {/* Sem peça salva ainda, as escolhas ficam em espera e sobem junto
            com o "Salvar" — cadastrar um NPC começa pelo retrato. */}
        <NoteAttachments
          attachments={alvo?.attachments ?? []}
          editable
          onUpload={alvo ? (form) => stageApi.addAttachment(campaignId, alvo.id, form) : undefined}
          onRemove={alvo ? (anexo) => stageApi.removeAttachment(campaignId, alvo.id, anexo.id) : undefined}
          onChanged={invalidar}
          pending={pending}
          onPendingChange={setPending}
        />

        {attachmentError ? (
          <Text variant="small" tone="danger">
            {attachmentError}
          </Text>
        ) : null}
      </View>

      <Input
        label="Anotações secretas"
        value={secretNotes}
        onChangeText={setSecretNotes}
        multiline
        hint="Só você lê. O servidor não manda este campo ao palco em nenhuma hipótese."
      />
    </Sheet>
  );
}
