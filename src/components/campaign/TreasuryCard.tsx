import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ApiError } from '@/api';
import type { CampaignTreasuryEntry } from '@/api/types';
import { Button, Card, Icon, Input, Sheet, Text } from '@/components/ui';
import { useTreasury, useTreasuryMutations } from '@/hooks/useTreasury';
import { formatTibar } from '@/rules';
import { spacing, useTheme } from '@/theme';

type Operacao = 'guardar' | 'retirar';

/** Quantas movimentações aparecem antes do "ver mais". */
const RECENTES = 4;

/**
 * O cofre do grupo.
 *
 * Pedido de 2026-10-10: "para todos verem a mesma quantia que temos guardados,
 * e caso a gente ganhe dinheiro, aumente para todo mundo". É um saldo por
 * campanha, separado do dinheiro de cada ficha — o tesouro da masmorra entra
 * aqui, e quem quer gastar a sua parte retira.
 *
 * Qualquer um da mesa guarda e retira; o histórico diz quem fez o quê, que é a
 * primeira pergunta diante de um número que mudou. Desfazer uma linha é de quem
 * a lançou e do mestre (o servidor responde `can_delete`).
 *
 * Some sozinho quando o servidor recusa (quem não senta à mesa leva 403): um
 * cartão de erro na ficha de outra mesa só atrapalharia.
 */
export function TreasuryCard({ campaignId }: { campaignId: number }) {
  const { colors } = useTheme();

  const cofre = useTreasury(campaignId);
  const { move, undo } = useTreasuryMutations(campaignId);

  const [operacao, setOperacao] = useState<Operacao | null>(null);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [verTudo, setVerTudo] = useState(false);

  if (cofre.isError || (!cofre.data && !cofre.isLoading)) return null;

  const saldo = Number(cofre.data?.balance ?? 0);
  const movimentacoes = cofre.data?.entries ?? [];
  const visiveis = verTudo ? movimentacoes : movimentacoes.slice(0, RECENTES);

  const abrir = (qual: Operacao) => {
    move.reset();
    setValor('');
    setMotivo('');
    setOperacao(qual);
  };

  const quantia = Number.parseFloat(valor.replace(/\./g, '').replace(',', '.'));
  const quantiaValida = Number.isFinite(quantia) && quantia > 0;

  const confirmar = () => {
    if (!operacao || !quantiaValida) return;

    move.mutate(
      {
        amount: operacao === 'guardar' ? quantia : -quantia,
        description: motivo.trim() || null,
      },
      { onSuccess: () => setOperacao(null) }
    );
  };

  const erro =
    move.error instanceof ApiError
      ? (move.error.fieldError('amount') ?? move.error.message)
      : move.isError
        ? 'Não foi possível lançar. Tente de novo.'
        : null;

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name="dinheiro" size={20} color={colors.textMuted} />
          <Text variant="heading" style={{ flex: 1 }}>
            Cofre do grupo
          </Text>
        </View>

        <View>
          <Text variant="title" tone="gold">
            {cofre.isLoading ? '…' : formatTibar(saldo)}
          </Text>
          <Text variant="caption" tone="muted">
            O mesmo valor para toda a mesa. O dinheiro de cada ficha continua sendo de cada um.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            label="Guardar"
            size="sm"
            variant="gold"
            icon={<Icon name="mais" size={16} color={colors.accentInk} />}
            onPress={() => abrir('guardar')}
            style={{ flex: 1 }}
          />
          <Button
            label="Retirar"
            size="sm"
            variant="secondary"
            icon={<Icon name="menos" size={16} color={colors.text} />}
            onPress={() => abrir('retirar')}
            disabled={saldo <= 0}
            style={{ flex: 1 }}
          />
        </View>

        {movimentacoes.length > 0 ? (
          <View style={{ gap: spacing.xs }}>
            {visiveis.map((mov) => (
              <Movimentacao
                key={mov.id}
                mov={mov}
                desfazendo={undo.isPending && undo.variables === mov.id}
                onDesfazer={() => undo.mutate(mov.id)}
              />
            ))}

            {movimentacoes.length > RECENTES ? (
              <Pressable onPress={() => setVerTudo((v) => !v)} accessibilityRole="button" hitSlop={6}>
                <Text variant="caption" tone="secondary">
                  {verTudo ? 'Ver menos' : `Ver as ${movimentacoes.length} últimas`}
                </Text>
              </Pressable>
            ) : null}

            {undo.isError ? (
              <Text variant="caption" tone="danger">
                {undo.error instanceof ApiError ? undo.error.message : 'Não foi possível desfazer.'}
              </Text>
            ) : null}
          </View>
        ) : cofre.data ? (
          <Text variant="small" tone="muted">
            Nada guardado ainda. Quando o grupo achar um tesouro, alguém lança aqui e o valor aparece para
            todos.
          </Text>
        ) : null}
      </View>

      <Sheet
        visible={operacao !== null}
        onClose={() => setOperacao(null)}
        title={operacao === 'retirar' ? 'Retirar do cofre' : 'Guardar no cofre'}
        subtitle={`No cofre agora: ${formatTibar(saldo)}`}
        footer={
          <>
            <Button label="Cancelar" variant="ghost" onPress={() => setOperacao(null)} style={{ flex: 1 }} />
            <Button
              label={operacao === 'retirar' ? 'Retirar' : 'Guardar'}
              onPress={confirmar}
              loading={move.isPending}
              disabled={!quantiaValida}
              style={{ flex: 1 }}
            />
          </>
        }
      >
        {erro ? (
          <Text variant="small" tone="danger">
            {erro}
          </Text>
        ) : null}

        <Input
          label="Tibares (T$)"
          value={valor}
          onChangeText={setValor}
          keyboardType="decimal-pad"
          hint="TC vale T$ 0,1 e TO vale T$ 10."
        />

        <Input
          label={operacao === 'retirar' ? 'Para quê? (opcional)' : 'De onde veio? (opcional)'}
          value={motivo}
          onChangeText={setMotivo}
          maxLength={160}
          placeholder={operacao === 'retirar' ? 'Ex.: quartos na estalagem' : 'Ex.: baú do chefe goblin'}
        />
      </Sheet>
    </Card>
  );
}

function Movimentacao({
  mov,
  desfazendo,
  onDesfazer,
}: {
  mov: CampaignTreasuryEntry;
  desfazendo: boolean;
  onDesfazer: () => void;
}) {
  const { colors } = useTheme();

  const valor = Number(mov.amount);
  const entrada = valor > 0;

  const quando = mov.created_at
    ? new Date(mov.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, opacity: desfazendo ? 0.5 : 1 }}>
      <Text variant="smallStrong" tone={entrada ? 'success' : 'danger'} style={{ minWidth: 84 }}>
        {entrada ? '+' : '−'}
        {formatTibar(Math.abs(valor))}
      </Text>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="small" numberOfLines={1}>
          {mov.description || (entrada ? 'Guardado' : 'Retirado')}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {[mov.user?.name, quando].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {mov.can_delete ? (
        <Pressable
          onPress={onDesfazer}
          disabled={desfazendo}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Desfazer este lançamento"
        >
          <Icon name="remover" size={16} color={colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}
