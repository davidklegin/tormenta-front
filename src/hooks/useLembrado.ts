import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Um estado que sobrevive ao fechar da tela — e do app.
 *
 * Para as escolhas pequenas de arrumação da tela: a fila de iniciativa
 * recolhida, um painel que o mestre prefere fechado. São preferências do
 * aparelho, não da campanha, e refazê-las a cada abertura é um imposto por
 * sessão — o mesmo motivo pelo qual o marcador de vitais guarda onde foi
 * largado.
 *
 * A escrita é solta (sem `await`): ninguém espera o disco para ver a tela
 * mudar, e uma gravação perdida custa, no pior caso, refazer a escolha.
 *
 * O valor guardado só chega no segundo quadro — o armazenamento é assíncrono.
 * Por isso o padrão precisa ser o estado inofensivo: a fila nasce aberta e
 * recolhe sozinha um instante depois, e não o contrário, que faria a ordem de
 * combate piscar fora da tela toda vez que o tabuleiro abrisse.
 */
export function useLembrado<T>(chave: string, padrao: T): [T, (valor: T) => void] {
  const [valor, setValor] = useState<T>(padrao);

  /* O que a pessoa fez ganha do que estava no disco: a leitura pode chegar
     depois de o primeiro toque já ter mudado o estado. */
  const mexido = useRef(false);

  useEffect(() => {
    let vivo = true;

    void AsyncStorage.getItem(chave)
      .then((bruto) => {
        if (!vivo || mexido.current || bruto === null) return;

        setValor(JSON.parse(bruto) as T);
      })
      .catch(() => {
        // Armazenamento indisponível ou conteúdo corrompido: fica o padrão.
      });

    return () => {
      vivo = false;
    };
  }, [chave]);

  return [
    valor,
    (novo: T) => {
      mexido.current = true;
      setValor(novo);
      void AsyncStorage.setItem(chave, JSON.stringify(novo)).catch(() => {});
    },
  ];
}
