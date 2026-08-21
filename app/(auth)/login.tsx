import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, router } from 'expo-router';
import { ApiError } from '@/api';
import { Button, Input, Screen, Text, ThemeToggle } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { radius, spacing, useTheme } from '@/theme';

/** Login (briefing §1). */
export default function LoginScreen() {
  const { colors } = useTheme();

  const login = useAuthStore((state) => state.login);
  const apiUrl = useAuthStore((state) => state.apiUrl);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  async function handleSubmit() {
    // Validação no cliente, além da do servidor (briefing §30).
    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = 'Informe seu e-mail.';
    if (!password) nextErrors.password = 'Informe sua senha.';

    setErrors(nextErrors);
    setGeneralError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(app)/(tabs)/personagens');
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        setErrors({
          email: error.fieldError('email') ?? '',
          password: error.fieldError('password') ?? '',
        });
      } else if (error instanceof ApiError) {
        setGeneralError(error.message);
      } else {
        setGeneralError('Não foi possível entrar. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentStyle={{ maxWidth: 460, justifyContent: 'center', flexGrow: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <ThemeToggle />
        </View>
        <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
          <Text variant="caption" tone="primary" uppercase>
            Tormenta20
          </Text>
          <Text variant="display">Sua mesa, na palma da mão</Text>
          <Text variant="body" tone="secondary">
            Entre para acessar suas fichas e campanhas.
          </Text>
        </View>

        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="voce@exemplo.com"
        />

        <Input
          label="Senha"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          placeholder="••••••••"
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />

        {generalError ? (
          <View
            style={{
              backgroundColor: colors.dangerFill,
              borderRadius: radius.md,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.danger,
            }}
          >
            <Text variant="small" tone="danger">
              {generalError}
            </Text>
          </View>
        ) : null}

        <Button label="Entrar" onPress={handleSubmit} loading={submitting} fullWidth size="lg" />

        <View style={{ gap: spacing.md, alignItems: 'center', marginTop: spacing.sm }}>
          <Link href="/(auth)/forgot-password">
            <Text variant="small" tone="secondary">
              Esqueci minha senha
            </Text>
          </Link>

          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Text variant="small" tone="muted">
              Ainda não tem conta?
            </Text>
            <Link href="/(auth)/register">
              <Text variant="smallStrong" tone="primary">
                Criar conta
              </Text>
            </Link>
          </View>
        </View>

        {/* O endereço do servidor é editável: o mesmo APK serve para
            desenvolvimento local, túnel temporário ou produção. */}
        <View style={{ marginTop: spacing.xl, alignItems: 'center', gap: spacing.xs }}>
          <Text variant="caption" tone="muted" uppercase>
            Servidor
          </Text>
          <Link href="/(auth)/servidor">
            <Text variant="small" tone="secondary" numberOfLines={1}>
              {apiUrl}
            </Text>
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
