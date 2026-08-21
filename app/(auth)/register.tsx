import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, router } from 'expo-router';
import { ApiError } from '@/api';
import { Button, Input, Screen, Text, ThemeToggle } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { radius, spacing, useTheme } from '@/theme';

/** Cadastro de jogador (briefing §1). */
export default function RegisterScreen() {
  const { colors } = useTheme();

  const register = useAuthStore((state) => state.register);

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmation: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof typeof form) => (value: string) =>
    setForm((previous) => ({ ...previous, [field]: value }));

  async function handleSubmit() {
    const nextErrors: Record<string, string> = {};

    if (form.name.trim().length < 2) nextErrors.name = 'Informe seu nome completo.';
    if (!form.email.includes('@')) nextErrors.email = 'Informe um e-mail válido.';
    if (form.password.length < 8) nextErrors.password = 'A senha precisa de ao menos 8 caracteres.';
    if (form.password !== form.confirmation) nextErrors.confirmation = 'As senhas não conferem.';

    setErrors(nextErrors);
    setGeneralError(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        password_confirmation: form.confirmation,
      });
      router.replace('/(app)/(tabs)/personagens');
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        setErrors({
          name: error.fieldError('name') ?? '',
          email: error.fieldError('email') ?? '',
          password: error.fieldError('password') ?? '',
        });
      } else if (error instanceof ApiError) {
        setGeneralError(error.message);
      } else {
        setGeneralError('Não foi possível criar sua conta. Tente novamente.');
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
            Criar conta
          </Text>
          <Text variant="display">Junte-se à mesa</Text>
          <Text variant="body" tone="secondary">
            Cada jogador tem a própria conta e pode ter quantos personagens quiser.
          </Text>
        </View>

        <Input
          label="Nome"
          value={form.name}
          onChangeText={update('name')}
          error={errors.name}
          autoComplete="name"
          placeholder="Como seus colegas de mesa te chamam"
        />

        <Input
          label="E-mail"
          value={form.email}
          onChangeText={update('email')}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="voce@exemplo.com"
        />

        <Input
          label="Senha"
          value={form.password}
          onChangeText={update('password')}
          error={errors.password}
          secureTextEntry
          autoComplete="new-password"
          hint="Pelo menos 8 caracteres, com letras e números."
        />

        <Input
          label="Confirmar senha"
          value={form.confirmation}
          onChangeText={update('confirmation')}
          error={errors.confirmation}
          secureTextEntry
          autoComplete="new-password"
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

        <Button label="Criar conta" onPress={handleSubmit} loading={submitting} fullWidth size="lg" />

        <View style={{ flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
          <Text variant="small" tone="muted">
            Já tem conta?
          </Text>
          <Link href="/(auth)/login">
            <Text variant="smallStrong" tone="primary">
              Entrar
            </Text>
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
