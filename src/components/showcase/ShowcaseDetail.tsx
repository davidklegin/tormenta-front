import { View } from 'react-native';
import type { ShowcaseEvent } from '@/api/types';
import { Chip, DetailRow, Text } from '@/components/ui';
import { formatSlots, formatTibar, powerEffectCounts } from '@/rules';
import { radius, spacing, useTheme } from '@/theme';

/**
 * O item exibido, montado do jeito que a ficha o mostra (briefing §21).
 *
 * O conteúdo vem inteiro no evento, então este componente não busca nada — é o
 * que permite abrir o painel na hora, sobre qualquer tela, para quem talvez
 * nem conheça o personagem de origem.
 *
 * O `switch` é sobre a união discriminada de `ShowcaseEvent`: quando um quinto
 * tipo de item entrar no "Exibir aos outros", o TypeScript aponta este arquivo
 * antes de o painel chegar vazio a alguém.
 */
export function ShowcaseDetail({ evento }: { evento: ShowcaseEvent }) {
  switch (evento.kind) {
    case 'power':
      return <CorpoPoder poder={evento.payload} />;
    case 'spell':
      return <CorpoMagia magia={evento.payload} />;
    case 'item':
      return <CorpoItem item={evento.payload} />;
    case 'class_ability':
      return <CorpoHabilidade habilidade={evento.payload} />;
  }
}

/**
 * Subtítulo do painel: o que é, e de quem veio.
 *
 * A atribuição nunca sai — quem recebe foi interrompido no meio de outra coisa
 * e precisa saber quem está mostrando aquilo. Na magia, o lugar do tipo é
 * ocupado pelo cabeçalho do livro ("Arcana 3, Evocação"), que diz mais do que
 * a palavra "Magia" e já é como a página se apresenta.
 */
export function subtituloDaExibicao(evento: ShowcaseEvent): string {
  const oQueE = evento.kind === 'spell' ? evento.payload.header : evento.kind_label;
  const quem = evento.actor.nickname || evento.actor.name;

  return `${oQueE} · exibido por ${quem}`;
}

function CorpoPoder({ poder }: { poder: Extract<ShowcaseEvent, { kind: 'power' }>['payload'] }) {
  return (
    <>
      <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
        <Chip label={poder.type_label} compact tone="arcane" />
        {poder.mp_cost ? <Chip label={poder.mp_cost} compact tone="primary" /> : null}
        {poder.source ? <Chip label={poder.source} compact /> : null}
      </View>

      {poder.requirements ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" tone="secondary" uppercase>
            Pré-requisitos
          </Text>
          <Text variant="small" tone="secondary">
            {poder.requirements}
          </Text>
        </View>
      ) : null}

      {/* Os efeitos vêm sem interruptor: aqui eles descrevem o poder de quem
          exibiu, e ligar ou desligar é decisão do dono da ficha. */}
      {poder.effects.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" tone="secondary" uppercase>
            Na ficha
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
            {poder.effects.map((efeito) => (
              <Chip
                key={efeito.index}
                label={efeito.text ?? ''}
                compact
                tone={powerEffectCounts(efeito) ? 'success' : 'neutral'}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Text variant="body" tone="secondary">
        {poder.description || 'Sem descrição.'}
      </Text>
    </>
  );
}

function CorpoMagia({ magia }: { magia: Extract<ShowcaseEvent, { kind: 'spell' }>['payload'] }) {
  const { colors } = useTheme();

  return (
    <>
      <View style={{ gap: spacing.xs }}>
        <DetailRow label="Execução" value={magia.execution} />
        <DetailRow label="Alcance" value={magia.range_text} />
        <DetailRow label="Alvo" value={magia.target} />
        <DetailRow label="Área" value={magia.area} />
        <DetailRow label="Efeito" value={magia.effect} />
        <DetailRow label="Duração" value={magia.duration} />
        <DetailRow label="Resistência" value={magia.resistance} />
        <DetailRow label="Custo" value={`${magia.mp_cost} PM`} />
      </View>

      {magia.description ? (
        <Text variant="body" tone="secondary">
          {magia.description}
        </Text>
      ) : null}

      {magia.enhancements.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" tone="secondary" uppercase>
            Aprimoramentos
          </Text>
          {magia.enhancements.map((aprimoramento, indice) => (
            <View
              key={indice}
              style={{
                backgroundColor: colors.surfaceAlt,
                borderRadius: radius.md,
                padding: spacing.md,
                gap: 2,
              }}
            >
              <Text variant="smallStrong" tone="arcane">
                {aprimoramento.cost}
              </Text>
              <Text variant="small" tone="secondary">
                {aprimoramento.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

function CorpoItem({ item }: { item: Extract<ShowcaseEvent, { kind: 'item' }>['payload'] }) {
  return (
    <>
      <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
        <Chip label={item.category_label} compact tone="gold" />
        {item.quantity > 1 ? <Chip label={`×${item.quantity}`} compact /> : null}
        {item.equipped ? <Chip label="equipado" compact tone="success" /> : null}
      </View>

      <View style={{ gap: spacing.xs }}>
        <DetailRow label="Espaços" value={formatSlots(item.total_slots)} />
        <DetailRow label="Preço" value={item.price !== null ? formatTibar(item.price) : null} />
        <DetailRow
          label="Defesa"
          value={item.defense_bonus ? `+${item.defense_bonus}` : null}
        />
        <DetailRow
          label="Penalidade de armadura"
          value={item.armor_penalty ? String(item.armor_penalty) : null}
        />
        <DetailRow label="Peso da armadura" value={item.armor_weight} />
      </View>

      <Text variant="body" tone="secondary">
        {item.description || 'Sem descrição.'}
      </Text>
    </>
  );
}

function CorpoHabilidade({
  habilidade,
}: {
  habilidade: Extract<ShowcaseEvent, { kind: 'class_ability' }>['payload'];
}) {
  return (
    <>
      <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
        <Chip label={`${habilidade.level_acquired}º nível`} compact tone="gold" />
        {habilidade.mp_cost ? <Chip label={habilidade.mp_cost} compact tone="primary" /> : null}
      </View>

      <Text variant="body" tone="secondary">
        {habilidade.description || 'Sem descrição.'}
      </Text>
    </>
  );
}
