import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { DEFAULT_API_URL } from '@/api';
import { Button, Card, Input, Screen, Text, ThemeToggle } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { spacing } from '@/theme';

/**
 * Endereço do servidor.
 *
 * Deixar isso configurável no app instalado é deliberado: a mesma instalação
 * atende o servidor de casa, um túnel temporário para jogar fora e a produção,
 * sem precisar gerar um novo pacote a cada mudança de endereço.
 */
export default function ServerScreen() {
  const apiUrl = useAuthStore((state) => state.apiUrl);
  const changeApiUrl = useAuthStore((state) => state.changeApiUrl);

  const [url, setUrl] = useState(apiUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const clean = url.trim();

    if (clean && !/^https?:\/\//i.test(clean)) {
      setError('O endereço precisa começar com http:// ou https://');

      return;
    }

    setSaving(true);
    setError(null);
    try {
      await changeApiUrl(clean);
      router.replace('/(auth)/login');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen contentStyle={{ maxWidth: 520, justifyContent: 'center', flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <ThemeToggle />
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">Servidor</Text>
        <Text variant="body" tone="secondary">
          Endereço da API do Laravel que este aplicativo deve usar.
        </Text>
      </View>

      <Input
        label="URL da API"
        value={url}
        onChangeText={setUrl}
        error={error ?? undefined}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="https://seu-servidor.com"
        hint={`Padrão desta versão: ${DEFAULT_API_URL}`}
      />

      <Card title="Como descobrir o endereço">
        <View style={{ gap: spacing.sm }}>
          <Text variant="small" tone="secondary">
            • Mesmo computador (navegador): http://localhost:8010
          </Text>
          <Text variant="small" tone="secondary">
            • Emulador Android: http://10.0.2.2:8010
          </Text>
          <Text variant="small" tone="secondary">
            • Celular na mesma rede: http://IP-DO-COMPUTADOR:8010
          </Text>
          <Text variant="small" tone="secondary">
            • Fora de casa, por túnel: a URL https fornecida pelo ngrok
          </Text>
        </View>
      </Card>

      <Button label="Salvar e voltar" onPress={handleSave} loading={saving} fullWidth />
      <Button label="Cancelar" variant="ghost" onPress={() => router.back()} fullWidth />
    </Screen>
  );
}
