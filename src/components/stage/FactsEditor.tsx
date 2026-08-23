import { Pressable, View } from 'react-native';
import type { StageFact } from '@/api/types';
import { Button, Icon, Input, Text } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

/**
 * As linhas de ficha de uma peça do acervo.
 *
 * Rótulo livre em vez de campos fixos: um NPC quer ND, PV e Defesa; um
 * documento antigo quer "Autor" e "Ano"; um lugar quer "População". Fixar
 * colunas obrigaria a inventar uma tabela por tipo de peça — e ainda assim
 * faltaria a linha que aquele NPC específico precisa.
 *
 * O que sai daqui vai para o cartaz do palco em blocos grandes, então vale a
 * regra da tela projetada: pouca linha, valor curto.
 */
export function FactsEditor({
  facts,
  onChange,
  max = 12,
}: {
  facts: StageFact[];
  onChange: (facts: StageFact[]) => void;
  max?: number;
}) {
  const { colors } = useTheme();

  const alterar = (indice: number, campo: keyof StageFact, valor: string) => {
    onChange(facts.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)));
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="smallStrong" tone="secondary">
        Dados
      </Text>

      {facts.map((linha, indice) => (
        <View key={indice} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Input
              placeholder="ND"
              value={linha.label}
              onChangeText={(valor) => alterar(indice, 'label', valor)}
              autoCorrect={false}
            />
          </View>
          <View style={{ flex: 1.4 }}>
            <Input
              placeholder="3"
              value={linha.value}
              onChangeText={(valor) => alterar(indice, 'value', valor)}
            />
          </View>
          <Pressable
            onPress={() => onChange(facts.filter((_, i) => i !== indice))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Remover a linha ${linha.label || indice + 1}`}
            style={{ padding: spacing.sm }}
          >
            <Icon name="excluir" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}

      {facts.length < max ? (
        <Button
          label="Adicionar dado"
          variant="ghost"
          size="sm"
          icon={<Icon name="adicionar" size={14} color={colors.primaryInk} />}
          onPress={() => onChange([...facts, { label: '', value: '' }])}
        />
      ) : null}
    </View>
  );
}
