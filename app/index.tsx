import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth';

/** Direciona para a área logada ou para o login, conforme a sessão. */
export default function Index() {
  const status = useAuthStore((state) => state.status);

  if (status === 'authenticated') {
    return <Redirect href="/(app)/(tabs)/personagens" />;
  }

  return <Redirect href="/(auth)/login" />;
}
