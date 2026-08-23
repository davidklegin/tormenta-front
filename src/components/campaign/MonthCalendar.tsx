import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, Text } from '@/components/ui';
import { radius, spacing, stroke, useTheme } from '@/theme';

const DIAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Grade de um mês.
 *
 * Escrita à mão, sem biblioteca de calendário: o que a tela precisa é sete
 * colunas, um marcador por dia com sessão e a navegação entre meses. Uma
 * dependência para isso traria escolhas de estilo e de idioma que teriam de
 * ser desfeitas uma a uma.
 *
 * As contas de data são todas em horário LOCAL. É o certo aqui: o dia em que a
 * sessão cai é o dia de quem está olhando o calendário — a mesma sessão pode
 * ser sexta à noite para um jogador e sábado de manhã para outro, e cada um
 * deve vê-la no dia em que ela acontece para ele.
 */
export function MonthCalendar({
  mes,
  diasComSessao,
  diaSelecionado,
  onSelecionarDia,
  onTrocarMes,
}: {
  /** Qualquer data dentro do mês exibido. */
  mes: Date;
  /** Chaves 'AAAA-MM-DD' que devem receber marcador. */
  diasComSessao: Set<string>;
  diaSelecionado: string | null;
  onSelecionarDia: (dia: string) => void;
  onTrocarMes: (passo: -1 | 1) => void;
}) {
  const { colors } = useTheme();

  const semanas = useMemo(() => montarSemanas(mes), [mes]);
  const hoje = chaveDoDia(new Date());

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Seta rotulo="Mês anterior" icone="voltar" onPress={() => onTrocarMes(-1)} />

        <Text variant="subheading" style={{ flex: 1 }} center>
          {nomeDoMes(mes)}
        </Text>

        <Seta rotulo="Próximo mês" icone="expandir" onPress={() => onTrocarMes(1)} />
      </View>

      <View style={{ flexDirection: 'row' }}>
        {DIAS_DA_SEMANA.map((dia, indice) => (
          <View key={indice} style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="caption" tone="muted">
              {dia}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.xxs }}>
        {semanas.map((semana, indice) => (
          <View key={indice} style={{ flexDirection: 'row', gap: spacing.xxs }}>
            {semana.map((data) => {
              const chave = chaveDoDia(data);
              const doMes = data.getMonth() === mes.getMonth();
              const temSessao = diasComSessao.has(chave);
              const selecionado = chave === diaSelecionado;
              const ehHoje = chave === hoje;

              return (
                <Pressable
                  key={chave}
                  onPress={() => onSelecionarDia(chave)}
                  accessibilityRole="button"
                  accessibilityLabel={`${data.getDate()} de ${nomeDoMes(data)}${temSessao ? ', com sessão' : ''}`}
                  style={({ pressed }) => ({
                    flex: 1,
                    aspectRatio: 1,
                    maxHeight: 56,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    borderRadius: radius.md,
                    borderWidth: selecionado || ehHoje ? stroke.hairline : 0,
                    borderColor: selecionado ? colors.primary : colors.border,
                    backgroundColor: selecionado
                      ? colors.primaryFill
                      : pressed
                        ? colors.surfaceHover
                        : temSessao
                          ? colors.surfaceAlt
                          : 'transparent',
                  })}
                >
                  <Text
                    variant={temSessao ? 'smallStrong' : 'small'}
                    // Os dias de fora do mês continuam clicáveis, mas apagados:
                    // servem para não deixar buracos na grade e para marcar uma
                    // sessão na virada sem trocar de mês antes.
                    tone={!doMes ? 'muted' : selecionado ? 'primary' : 'default'}
                  >
                    {data.getDate()}
                  </Text>

                  {/* O marcador é o que se lê de relance: "onde a mesa joga
                      neste mês" tem que ser visível sem contar números. */}
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      backgroundColor: temSessao ? colors.primary : 'transparent',
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function Seta({
  rotulo,
  icone,
  onPress,
}: {
  rotulo: string;
  icone: 'voltar' | 'expandir';
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={{ padding: spacing.xs }}
    >
      {/* A seta de avançar é a de voltar girada: uma peça a menos no mapa de
          ícones. O giro fica no contêiner porque o Icon expõe só nome, tamanho
          e cor — e é bom que exponha. */}
      <View style={icone === 'expandir' ? { transform: [{ rotate: '-90deg' }] } : undefined}>
        <Icon name={icone} size={20} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

/** As seis semanas que cobrem o mês, começando no domingo. */
function montarSemanas(mes: Date): Date[][] {
  const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const inicio = new Date(primeiro);
  inicio.setDate(primeiro.getDate() - primeiro.getDay());

  const semanas: Date[][] = [];

  for (let semana = 0; semana < 6; semana++) {
    const dias: Date[] = [];

    for (let dia = 0; dia < 7; dia++) {
      const data = new Date(inicio);
      data.setDate(inicio.getDate() + semana * 7 + dia);
      dias.push(data);
    }

    // A sexta semana só existe quando o mês precisa dela — sem isto, todo mês
    // ganharia uma faixa vazia no rodapé.
    if (semana === 5 && dias[0]?.getMonth() !== mes.getMonth()) break;

    semanas.push(dias);
  }

  return semanas;
}

/** 'AAAA-MM-DD' no fuso local — a chave que casa dia e sessão. */
export function chaveDoDia(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');

  return `${data.getFullYear()}-${mes}-${dia}`;
}

export function nomeDoMes(data: Date): string {
  const nome = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return nome.charAt(0).toUpperCase() + nome.slice(1);
}
