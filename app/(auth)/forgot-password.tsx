import { useState } from 'react';
import { View } from 'react-native';
import { Link } from 'expo-router';
import { ApiError, authApi } from '@/api';
import { Button, Input, Screen, Text, ThemeToggle } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

/** Recuperação de senha (briefing §1). */
export default function ForgotPasswordScreen() {
  const { colors } = useTheme();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email.includes('@')) {
      setError('Informe um e-mail válido.');

      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar as instruções.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen contentStyle={{ maxWidth: 460, justifyContent: 'center', flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <ThemeToggle />
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">Recuperar senha</Text>
        <Text variant="body" tone="secondary">
          Enviaremos um link de redefinição para o e-mail cadastrado.
        </Text>
      </View>

      {sent ? (
        <View
          style={{
            backgroundColor: colors.successFill,
            borderRadius: radius.md,
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.success,
            gap: spacing.sm,
          }}
        >
          <Text variant="subheading" tone="success">
            Verifique seu e-mail
          </Text>
          <Text variant="small" tone="secondary">
            Se houver uma conta com {email}, as instruções de recuperação já estão a caminho.
          </Text>
        </View>
      ) : (
        <>
          <Input
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            error={error ?? undefined}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="voce@exemplo.com"
            onSubmitEditing={handleSubmit}
          />
          <Button label="Enviar instruções" onPress={handleSubmit} loading={submitting} fullWidth />
        </>
      )}

      <Link href="/(auth)/login" style={{ alignSelf: 'center' }}>
        <Text variant="small" tone="secondary">
          Voltar para o login
        </Text>
      </Link>
    </Screen>
  );
}
