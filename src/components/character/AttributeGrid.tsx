import { View } from 'react-native';
import { AttributeBlock } from '@/components/ui';
import type { CharacterAttribute } from '@/api/types';
import { signed } from '@/rules';
import { spacing } from '@/theme';

/**
 * Os seis atributos (livro base, p. 17).
 *
 * Em Tormenta20 o atributo já é o modificador, então mostramos o valor com
 * sinal — é assim que ele entra em toda rolagem. As camadas (racial, bônus,
 * temporário) aparecem embaixo quando existem, para o jogador entender de onde
 * vem o número.
 *
 * Cada atributo é um losango: a figura da ficha do livro, e a que separa os
 * seis números de tudo o mais que a tela mostra. Um modificador temporário em
 * vigor troca a borda para o azul arcano e engrossa o traço — o jogador precisa
 * saber, de relance, que aquele valor não é o da ficha.
 */
export function AttributeGrid({ attributes }: { attributes: CharacterAttribute[] }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.space2,
        justifyContent: 'center',
      }}
    >
      {attributes.map((attribute) => {
        const extras = [
          attribute.racial !== 0 ? `raça ${signed(attribute.racial)}` : null,
          attribute.bonus !== 0 ? `bônus ${signed(attribute.bonus)}` : null,
          attribute.temp !== 0 ? `temp ${signed(attribute.temp)}` : null,
        ].filter(Boolean);

        return (
          <AttributeBlock
            key={attribute.key}
            abbreviation={attribute.abbreviation}
            value={signed(attribute.total)}
            detail={extras.length > 0 ? extras.join(' · ') : undefined}
            highlighted={attribute.temp !== 0}
          />
        );
      })}
    </View>
  );
}
