import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { CampaignSession, SessionStatus } from '@/api/types';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Input,
  Loading,
  Screen,
  Select,
  Sheet,
  Text,
} from '@/components/ui';
import { PageHeader } from '@/components/layout';
import { MonthCalendar, chaveDoDia } from '@/components/campaign/MonthCalendar';
import { useCampaign } from '@/hooks/useCampaigns';
import { useCampaignSessions, useSessionMutations } from '@/hooks/useCampaignSessions';
import { useCampaignChannel } from '@/realtime/useCampaignChannel';
import { radius, spacing, stroke, useResponsive, useTheme } from '@/theme';

const STATUS: { value: SessionStatus; label: string }[] = [
  { value: 'scheduled', label: 'Marcada' },
  { value: 'done', label: 'Realizada' },
  { value: 'canceled', label: 'Cancelada' },
];

/**
 * Calendário da campanha: quando a mesa joga.
 *
 * A pergunta que toda mesa repete no grupo de mensagens — "sexta que vem tá de
 * pé?" — passa a ter um lugar onde a resposta fica, e onde todo mundo pode
 * conferir sem perguntar de novo.
 *
 * O mês é a unidade da tela porque é a unidade em que uma mesa se organiza. O
 * dia escolhido abre a lista abaixo da grade; sem nada escolhido, a lista
 * mostra o mês inteiro, que é o que responde "quando jogamos este mês?".
 */
export default function CampaignCalendarScreen() {
  const { colors } = useTheme();
  const { isDesktop } = useResponsive();

  const params = useLocalSearchParams<{ id: string }>();
  const campaignId = Number(params.id);

  const campaign = useCampaign(campaignId);

  // Marcar é de quem senta à mesa, e não só do mestre: quem sabe se dá para
  // jogar na sexta é o grupo. Mexer no que já está marcado continua sendo de
  // quem marcou (e do mestre) — o servidor responde isso por linha, em
  // `can_edit`, e a lista abaixo obedece a ele.
  const podeMarcar = campaign.data?.is_member ?? false;

  const [mes, setMes] = useState(() => new Date());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [editando, setEditando] = useState<CampaignSession | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  const intervalo = useMemo(() => limitesDoMes(mes), [mes]);
  const sessoes = useCampaignSessions(campaignId, intervalo.de, intervalo.ate);

  // Uma sessão marcada por outro aparelho aparece sem recarregar a tela.
  useCampaignChannel(campaignId, campaign.data?.is_member ?? false);

  const lista = sessoes.data ?? [];

  const diasComSessao = useMemo(
    () => new Set(lista.map((sessao) => chaveDoDia(new Date(sessao.starts_at)))),
    [lista]
  );

  const visiveis = useMemo(() => {
    if (diaSelecionado) {
      return lista.filter((sessao) => chaveDoDia(new Date(sessao.starts_at)) === diaSelecionado);
    }

    // A consulta traz uma semana a mais de cada lado, para os dias vizinhos da
    // grade também receberem marcador. A lista, porém, promete "este mês" —
    // então ela filtra o que a grade precisa mostrar e ela não.
    return lista.filter((sessao) => {
      const data = new Date(sessao.starts_at);

      return data.getMonth() === mes.getMonth() && data.getFullYear() === mes.getFullYear();
    });
  }, [lista, diaSelecionado, mes]);

  const abrirNova = () => {
    setEditando(null);
    setFormAberto(true);
  };

  return (
    <Screen>
      <PageHeader
        title="Calendário"
        subtitle={campaign.data?.name}
        back
        actions={
          podeMarcar ? <Button label="Marcar no calendário" size="sm" onPress={abrirNova} /> : undefined
        }
      />

      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.lg, alignItems: 'flex-start' }}>
        <View style={{ width: isDesktop ? 420 : '100%' }}>
          <Card>
            <MonthCalendar
              mes={mes}
              diasComSessao={diasComSessao}
              diaSelecionado={diaSelecionado}
              onSelecionarDia={(dia) => setDiaSelecionado(dia === diaSelecionado ? null : dia)}
              onTrocarMes={(passo) => {
                setMes((atual) => new Date(atual.getFullYear(), atual.getMonth() + passo, 1));
                setDiaSelecionado(null);
              }}
            />
          </Card>
        </View>

        <View style={{ flex: 1, gap: spacing.sm, width: isDesktop ? undefined : '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="caption" tone="secondary" uppercase style={{ flex: 1 }}>
              {diaSelecionado ? `Sessões de ${porExtenso(diaSelecionado)}` : 'Sessões deste mês'}
            </Text>
            {diaSelecionado ? (
              <Pressable onPress={() => setDiaSelecionado(null)} hitSlop={8}>
                <Text variant="caption" tone="primary">
                  ver o mês
                </Text>
              </Pressable>
            ) : null}
          </View>

          {sessoes.isLoading ? (
            <Loading inline label="Carregando o calendário…" />
          ) : visiveis.length === 0 ? (
            <EmptyState
              icon="campanhas"
              title={diaSelecionado ? 'Nada marcado neste dia' : 'Nenhuma sessão neste mês'}
              description={
                podeMarcar
                  ? 'Marque a próxima sessão — ou qualquer coisa que a mesa precise saber.'
                  : 'Ninguém marcou nada para este mês.'
              }
              actionLabel={podeMarcar ? 'Marcar no calendário' : undefined}
              onAction={podeMarcar ? abrirNova : undefined}
            />
          ) : (
            visiveis.map((sessao) => (
              <Pressable
                key={sessao.id}
                onPress={() => {
                  if (!sessao.can_edit) return;
                  setEditando(sessao);
                  setFormAberto(true);
                }}
                style={({ pressed }) => ({
                  backgroundColor: pressed && sessao.can_edit ? colors.surfaceHover : colors.surface,
                  borderRadius: radius.lg,
                  borderWidth: stroke.hairline,
                  borderColor: sessao.status === 'canceled' ? colors.border : colors.primary,
                  borderLeftWidth: 3,
                  padding: spacing.lg,
                  gap: spacing.xs,
                  // A cancelada continua na lista, apagada: a mesa precisa
                  // saber que aquela sexta caiu, e não que ela nunca existiu.
                  opacity: sessao.status === 'canceled' ? 0.6 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                    {sessao.title}
                  </Text>
                  {sessao.status !== 'scheduled' ? (
                    <Chip
                      label={sessao.status_label}
                      compact
                      tone={sessao.status === 'canceled' ? 'danger' : 'success'}
                    />
                  ) : null}
                </View>

                <Text variant="small" tone="secondary">
                  {dataPorExtenso(sessao.starts_at)}
                  {sessao.duration_minutes ? ` · ${duracao(sessao.duration_minutes)}` : ''}
                </Text>

                {/* Quem marcou. Com a mesa inteira escrevendo no calendário,
                    "quem foi que pôs isso aqui?" vira uma pergunta real — e a
                    resposta também diz de relance o que é editável por quem. */}
                {sessao.created_by ? (
                  <Text variant="caption" tone="muted">
                    Marcada por {sessao.created_by.nickname || sessao.created_by.name}
                    {sessao.can_edit ? '' : ' · só quem marcou remarca'}
                  </Text>
                ) : null}

                {sessao.location ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Icon name="campanhas" size={13} color={colors.textMuted} />
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {sessao.location}
                    </Text>
                  </View>
                ) : null}

                {sessao.notes ? (
                  <Text variant="small" tone="muted" numberOfLines={2}>
                    {sessao.notes}
                  </Text>
                ) : null}
              </Pressable>
            ))
          )}
        </View>
      </View>

      <SessionForm
        key={editando?.id ?? `nova-${diaSelecionado ?? 'mes'}`}
        visible={formAberto}
        onClose={() => setFormAberto(false)}
        campaignId={campaignId}
        session={editando}
        diaPadrao={diaSelecionado ?? chaveDoDia(new Date())}
      />
    </Screen>
  );
}

function SessionForm({
  visible,
  onClose,
  campaignId,
  session,
  diaPadrao,
}: {
  visible: boolean;
  onClose: () => void;
  campaignId: number;
  session: CampaignSession | null;
  diaPadrao: string;
}) {
  const { create, update, remove } = useSessionMutations(campaignId);

  const inicial = session ? new Date(session.starts_at) : null;

  const [titulo, setTitulo] = useState(session?.title ?? '');
  const [data, setData] = useState(inicial ? formatarDataBR(inicial) : formatarDataBR(deChave(diaPadrao)));
  const [hora, setHora] = useState(inicial ? formatarHora(inicial) : '20:00');
  const [duracaoHoras, setDuracaoHoras] = useState(
    session?.duration_minutes ? String(session.duration_minutes / 60) : ''
  );
  const [local, setLocal] = useState(session?.location ?? '');
  const [notas, setNotas] = useState(session?.notes ?? '');
  const [status, setStatus] = useState<SessionStatus>(session?.status ?? 'scheduled');
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    const quando = montarData(data, hora);

    if (!quando) {
      setErro('Confira a data e a hora — use 04/09/2026 e 20:00.');

      return;
    }

    const payload = {
      title: titulo.trim() || 'Sessão',
      // ISO com o fuso do aparelho: o servidor guarda em UTC e devolve com
      // offset, então a mesa toda vê o mesmo instante no horário de cada um.
      starts_at: quando.toISOString(),
      duration_minutes: duracaoHoras.trim() ? Math.round(Number(duracaoHoras.replace(',', '.')) * 60) : null,
      location: local.trim() || null,
      notes: notas.trim() || null,
      status,
    };

    if (session) {
      await update.mutateAsync({ id: session.id, ...payload });
    } else {
      await create.mutateAsync(payload);
    }

    onClose();
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={session ? 'Editar' : 'Marcar no calendário'}
      footer={
        <>
          <Button label="Cancelar" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
          <Button
            label="Salvar"
            onPress={() => void salvar()}
            loading={create.isPending || update.isPending}
            style={{ flex: 1 }}
          />
        </>
      }
    >
      <Input
        label="Título"
        value={titulo}
        onChangeText={setTitulo}
        placeholder="Sessão 12: A Caverna Rubra"
      />
      <Text variant="caption" tone="muted">
        Serve para a sessão e para o resto: o jantar antes de jogar, a semana em
        que você não pode, o aniversário do grupo.
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1.4 }}>
          <Input label="Data" value={data} onChangeText={setData} placeholder="04/09/2026" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Hora" value={hora} onChangeText={setHora} placeholder="20:00" />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Horas"
            value={duracaoHoras}
            onChangeText={setDuracaoHoras}
            placeholder="4"
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <Input label="Onde" value={local} onChangeText={setLocal} placeholder="Discord, casa do David…" />

      <Input label="Observações" value={notas} onChangeText={setNotas} multiline />

      {session ? (
        <Select
          label="Situação"
          value={status}
          options={STATUS}
          onChange={(valor) => setStatus((valor as SessionStatus) ?? 'scheduled')}
          searchable={false}
        />
      ) : null}

      {erro ? (
        <Text variant="small" tone="danger">
          {erro}
        </Text>
      ) : null}

      {session ? (
        <Button
          label="Remover do calendário"
          variant="ghost"
          loading={remove.isPending}
          onPress={async () => {
            await remove.mutateAsync(session.id);
            onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}

// ------------------------------------------------------------------ datas

function limitesDoMes(mes: Date): { de: string; ate: string } {
  const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 23, 59, 59);

  // A grade mostra alguns dias dos meses vizinhos; o intervalo os inclui para
  // o marcador não sumir na virada da semana.
  primeiro.setDate(primeiro.getDate() - 7);
  ultimo.setDate(ultimo.getDate() + 7);

  return { de: primeiro.toISOString(), ate: ultimo.toISOString() };
}

function deChave(chave: string): Date {
  const [ano, mes, dia] = chave.split('-').map(Number);

  return new Date(ano ?? 2026, (mes ?? 1) - 1, dia ?? 1);
}

function formatarDataBR(data: Date): string {
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatarHora(data: Date): string {
  return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** "04/09/2026" + "20:00" → Date no fuso do aparelho. */
function montarData(data: string, hora: string): Date | null {
  const partesData = data.trim().split(/[/\-.]/).map(Number);
  const partesHora = hora.trim().split(':').map(Number);

  if (partesData.length !== 3 || partesData.some(Number.isNaN)) return null;
  if (partesHora.length < 2 || partesHora.some(Number.isNaN)) return null;

  const [dia, mes, ano] = partesData as [number, number, number];
  const [h, m] = partesHora as [number, number];

  const resultado = new Date(ano, mes - 1, dia, h, m);

  return Number.isNaN(resultado.getTime()) ? null : resultado;
}

function porExtenso(chave: string): string {
  return deChave(chave).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

function dataPorExtenso(iso: string): string {
  const data = new Date(iso);
  const dia = data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} · ${formatarHora(data)}`;
}

function duracao(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (horas === 0) return `${resto}min`;

  return resto === 0 ? `${horas}h` : `${horas}h${resto}`;
}
