import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { charactersApi } from '@/api';
import type { Character, CharacterNote, NoteAttachment } from '@/api/types';
import { Button, Card, EmptyState, Input, Loading, Sheet, Text, Icon } from '@/components/ui';
import { SheetScreen } from '@/components/character/SheetScreen';
import {
  AttachmentStrip,
  NoteAttachments,
  buildAttachmentForm,
  type PendingAttachment,
} from '@/components/files';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Aba Anotações (briefing §15).
 *
 * São privadas do dono do personagem: nem os colegas de mesa nem o mestre têm
 * acesso — a API responde 403 para qualquer outro usuário.
 */
export default function CharacterNotesScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const characterId = Number(params.id);

  return (
    <SheetScreen characterId={characterId}>
      {(character) => <NotesContent characterId={characterId} character={character} />}
    </SheetScreen>
  );
}

function NotesContent({ characterId, character }: { characterId: number; character: Character }) {
  const { colors } = useTheme();

  const queryClient = useQueryClient();
  const isOwner = character.permissions.can_view_private_notes;

  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CharacterNote | null>(null);

  const notes = useQuery({
    queryKey: ['character', characterId, 'notes', query],
    queryFn: () => charactersApi.notes(characterId, query || undefined),
    enabled: isOwner,
  });

  const removeNote = useMutation({
    mutationFn: (id: number) => charactersApi.removeNote(characterId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['character', characterId, 'notes'] });
    },
  });

  if (!isOwner) {
    return (
      <EmptyState
        icon="anotacoes"
        title="Anotações privadas"
        description="As anotações pessoais pertencem exclusivamente ao jogador dono do personagem."
      />
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Input placeholder="Buscar nas anotações…" value={query} onChangeText={setQuery} autoCorrect={false} />

      <Button
        label="Nova anotação"
        onPress={() => {
          setEditing(null);
          setFormOpen(true);
        }}
      />

      {notes.isLoading ? (
        <Loading inline label="Carregando anotações…" />
      ) : (notes.data ?? []).length === 0 ? (
        <EmptyState
          icon="anotacoes"
          title="Nenhuma anotação"
          description="Registre pistas, ideias e lembretes que só você precisa ver."
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {(notes.data ?? []).map((note) => (
            <Pressable
              key={note.id}
              onPress={() => {
                setEditing(note);
                setFormOpen(true);
              }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.lg,
                gap: spacing.xs,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {note.pinned ? (
                  <Text variant="small" tone="gold">
                    ★
                  </Text>
                ) : null}
                <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                  {note.title}
                </Text>
                <Pressable
                  onPress={() => removeNote.mutate(note.id)}
                  hitSlop={8}
                  accessibilityLabel="Excluir anotação"
                >
                  <Icon name="remover" size={18} color={colors.textSubtle} />
                </Pressable>
              </View>

              {note.body ? (
                <Text variant="small" tone="secondary" numberOfLines={3}>
                  {note.body}
                </Text>
              ) : null}

              <AttachmentStrip attachments={note.attachments ?? []} size={48} />

              <Text variant="small" tone="muted">
                Atualizada em {formatDate(note.updated_at)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <NoteForm
        key={editing?.id ?? 'nova'}
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        characterId={characterId}
        /* A versão recém-carregada, e não a que abriu o formulário: anexar um
           arquivo recarrega a lista, e é dali que sai o que o visualizador
           mostra. */
        note={editing ? ((notes.data ?? []).find((n) => n.id === editing.id) ?? editing) : null}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ['character', characterId, 'notes'] })}
      />
    </View>
  );
}

function NoteForm({
  visible,
  onClose,
  characterId,
  note,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  characterId: number;
  note: CharacterNote | null;
  onSaved: () => void;
}) {
  const { colors } = useTheme();

  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [pinned, setPinned] = useState(note?.pinned ?? false);

  // Arquivos escolhidos antes de a anotação existir — sobem depois do create.
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  // Se o create passou mas um upload falhou, a anotação já existe: um segundo
  // "Salvar" precisa editá-la e retentar os arquivos, nunca criar outra.
  const criada = useRef<CharacterNote | null>(null);
  const alvo = note ?? criada.current;

  /** Sair descarta o que ainda não subiu — e desfaz o vínculo com o que foi criado. */
  function fechar() {
    criada.current = null;
    setPending([]);
    setAttachmentError(null);
    onClose();
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = { title: title.trim(), body: body.trim(), pinned };

      const salva = alvo
        ? await charactersApi.updateNote(characterId, alvo.id, payload)
        : await charactersApi.createNote(characterId, payload);

      if (!note) criada.current = salva;

      if (pending.length === 0) return true;

      const restantes: PendingAttachment[] = [];
      const enviados: NoteAttachment[] = [];

      for (const arquivo of pending) {
        try {
          enviados.push(
            await charactersApi.addNoteAttachment(characterId, salva.id, await buildAttachmentForm(arquivo))
          );
        } catch {
          restantes.push(arquivo);
        }
      }

      // A nota que acabou de nascer não conhece os anexos dela: sem isto, um
      // envio parcial esconderia da lista o que já subiu.
      if (criada.current) {
        criada.current = {
          ...criada.current,
          attachments: [...(criada.current.attachments ?? []), ...enviados],
        };
      }

      setPending(restantes);

      return restantes.length === 0;
    },
    onSuccess: (completo) => {
      onSaved();

      if (completo) {
        fechar();

        return;
      }

      setAttachmentError(
        'A anotação foi salva, mas não conseguimos enviar todos os arquivos. Tente salvar de novo.'
      );
    },
  });

  return (
    <Sheet
      visible={visible}
      onClose={fechar}
      title={note ? 'Editar anotação' : 'Nova anotação'}
      footer={
        <>
          <Button label="Cancelar" variant="ghost" onPress={fechar} style={{ flex: 1 }} />
          <Button label="Salvar" onPress={() => save.mutate()} loading={save.isPending} style={{ flex: 1 }} />
        </>
      }
    >
      <Input label="Título" value={title} onChangeText={setTitle} placeholder="O que aconteceu na sessão" />
      <Input label="Texto" value={body} onChangeText={setBody} multiline />

      <View style={{ gap: spacing.sm }}>
        <Text variant="smallStrong" tone="secondary">
          Arquivos
        </Text>

        {/* Sem anotação salva ainda, as escolhas ficam em espera e sobem junto
            com o "Salvar". */}
        <NoteAttachments
          attachments={alvo?.attachments ?? []}
          editable
          onUpload={alvo ? (form) => charactersApi.addNoteAttachment(characterId, alvo.id, form) : undefined}
          onRemove={
            alvo ? (anexo) => charactersApi.removeNoteAttachment(characterId, alvo.id, anexo.id) : undefined
          }
          onChanged={onSaved}
          pending={pending}
          onPendingChange={setPending}
        />

        {attachmentError ? (
          <Text variant="small" tone="danger">
            {attachmentError}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={() => setPinned((value) => !value)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: pinned }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: radius.sm,
            borderWidth: 1.5,
            borderColor: pinned ? colors.accentInk : colors.borderStrong,
            backgroundColor: pinned ? colors.accentInk : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {pinned ? (
            <Text variant="caption" style={{ color: colors.onPrimary }}>
              ★
            </Text>
          ) : null}
        </View>
        <Text variant="body">Fixar no topo</Text>
      </Pressable>
    </Sheet>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '—';

  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
