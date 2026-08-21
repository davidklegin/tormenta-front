import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

/** Telas públicas. Quem já tem sessão vai direto para a área logada. */
export default function AuthLayout() {
  const { colors } = useTheme();

  const status = useAuthStore((state) => state.status);

  if (status === 'authenticated') {
    return <Redirect href="/(app)/(tabs)/personagens" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
