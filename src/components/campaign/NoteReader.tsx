import { View } from 'react-native';
import type { CampaignNote } from '@/api/types';
import { Button, Chip, Sheet, Text } from '@/components/ui';
import { NoteAttachments } from '@/components/files';
import { spacing } from '@/theme';

/**
 * A anotação aberta em modo leitura.
 *
 * Existe porque ler e editar não são a mesma permissão. Quem escreveu a nota
 * (ou mestra a mesa) abre o formulário; todo o resto da mesa abre isto — o
 * texto inteiro, os arquivos e nada mais.
 *
 * Antes deste painel, tocar num NPC publicado pelo mestre simplesmente não
 * fazia nada para o jogador: a tela só abria o formulário, e o formulário só
 * abria para quem podia editar. O cartão mostrava três linhas do texto e o
 * resto ficava inalcançável — justamente no caso que a publicação existe para
 * resolver.
 */
export function NoteReader({
  note,
  visible,
  onClose,
}: {
  note: CampaignNote | null;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet
      visible={visible && note !== null}
      onClose={onClose}
      title={note?.title ?? ''}
      subtitle={note ? assinatura(note) : undefined}
      footer={<Button label="Fechar" variant="secondary" onPress={onClose} style={{ flex: 1 }} />}
    >
      {note ? (
        <>
          <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
            <Chip label={note.category_label} compact />
            {note.visibility === 'master_only' ? <Chip label="Somente o mestre" compact tone="gold" /> : null}
            {!note.body_revealed ? <Chip label="Não revelado" compact tone="arcane" /> : null}
          </View>

          {/* Os arquivos vêm antes do texto: é o retrato do NPC que faz a
              anotação ser reconhecida, e tocá-lo abre o visualizador de
              sempre, dentro do app. */}
          {note.attachments && note.attachments.length > 0 ? (
            <NoteAttachments attachments={note.attachments} editable={false} onChanged={() => undefined} />
          ) : null}

          {/* Velado não é vazio: dizer "não tem texto" mandaria o jogador
              embora de uma anotação que ainda vai ganhar conteúdo na mesa. */}
          {note.body_hidden ? (
            <Text variant="body" tone="muted" style={{ fontStyle: 'italic' }}>
              O mestre ainda não revelou a descrição. Nome e retrato já são seus; o resto vem quando
              você conhecer esta pessoa em jogo.
            </Text>
          ) : (
            <Text variant="body" tone="secondary" selectable>
              {note.body?.trim() ? note.body : 'Esta anotação não tem texto.'}
            </Text>
          )}
        </>
      ) : null}
    </Sheet>
  );
}

/** "NPCs · por David · 23/08/2026" — de onde veio e quando. */
function assinatura(note: CampaignNote): string {
  const partes = [note.author?.name, formatarData(note.updated_at)].filter(Boolean);

  return partes.length > 0 ? partes.join(' · ') : note.category_label;
}

function formatarData(valor: string | null): string | null {
  if (!valor) return null;

  return new Date(valor).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
