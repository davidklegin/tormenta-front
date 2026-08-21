import { useState } from 'react';
import { View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { ApiError, authApi } from '@/api';
import { Button, Input, Screen, Text, ThemeToggle } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Redefinição de senha.
 *
 * Alcançada pelo link do e-mail, que abre o app pelo deep link
 * `tormenta20://reset-password?token=…&email=…` ou a versão web equivalente.
 */
export default function ResetPasswordScreen() {
  const { colors } = useTheme();

  const params = useLocalSearchParams<{ token?: string; email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    const nextErrors: Record<string, string> = {};
    if (!params.token) nextErrors.token = 'Link inválido ou expirado.';
    if (!email.includes('@')) nextErrors.email = 'Informe um e-mail válido.';
    if (password.length < 8) nextErrors.password = 'A senha precisa de ao menos 8 caracteres.';
    if (password !== confirmation) nextErrors.confirmation = 'As senhas não conferem.';

    setErrors(nextErrors);
    setGeneralError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await authApi.resetPassword({
        token: params.token as string,
        email: email.trim().toLowerCase(),
        password,
        password_confirmation: confirmation,
      });
      setDone(true);
    } catch (error) {
      setGeneralError(error instanceof ApiError ? error.message : 'Não foi possível redefinir a senha.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Screen contentStyle={{ maxWidth: 460, justifyContent: 'center', flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <ThemeToggle />
        </View>
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
            Senha redefinida
          </Text>
          <Text variant="small" tone="secondary">
            Você já pode entrar com a nova senha.
          </Text>
        </View>
        <Button label="Ir para o login" onPress={() => router.replace('/(auth)/login')} fullWidth />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ maxWidth: 460, justifyContent: 'center', flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <ThemeToggle />
      </View>
      <Text variant="title">Nova senha</Text>

      {errors.token ? (
        <Text variant="small" tone="danger">
          {errors.token}
        </Text>
      ) : null}

      <Input
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Input
        label="Nova senha"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
      />
      <Input
        label="Confirmar nova senha"
        value={confirmation}
        onChangeText={setConfirmation}
        error={errors.confirmation}
        secureTextEntry
        onSubmitEditing={handleSubmit}
      />

      {generalError ? (
        <Text variant="small" tone="danger">
          {generalError}
        </Text>
      ) : null}

      <Button label="Redefinir senha" onPress={handleSubmit} loading={submitting} fullWidth />

      <Link href="/(auth)/login" style={{ alignSelf: 'center' }}>
        <Text variant="small" tone="secondary">
          Voltar para o login
        </Text>
      </Link>
    </Screen>
  );
}
