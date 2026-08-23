import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { stageApi } from '@/api';
import type { NoteAttachment, StageFact, StageItem, StageItemKind } from '@/api/types';
import { Button, Input, Select, Sheet, Text } from '@/components/ui';
import { NoteAttachments, buildAttachmentForm, type PendingAttachment } from '@/components/files';
import { stageKeys, useStageItemMutations } from '@/hooks/useStage';
import { spacing } from '@/theme';
import { FactsEditor } from './FactsEditor';

export const STAGE_ITEM_KINDS: { value: StageItemKind; label: string }[] = [
  { value: 'npc', label: 'NPC' },
  { value: 'place', label: 'Lugar' },
  { value: 'image', label: 'Imagem' },
  { value: 'handout', label: 'Documento' },
  { value: 'text', label: 'Texto' },
];

/**
 * Cadastro de uma peça do acervo.
 *
 * Vive fora da tela porque cadastrar e exibir acontecem no mesmo lugar: a mesa
 * de controle abre este formulário sem sair da lista de onde o mestre está
 * exibindo. Durante a sessão, "criar o NPC que os jogadores acabaram de
 * inventar um motivo para conhecer" não pode custar uma navegação.
 */
export function StageItemForm({
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
        options={STAGE_ITEM_KINDS}
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
