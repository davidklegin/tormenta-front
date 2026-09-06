import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { ApiError, authApi } from '@/api';
import { Button, Card, Chip, Input, Screen, Text } from '@/components/ui';
import { PushNotificationButton } from '@/components/ui/PushNotificationButton';
import { PageHeader } from '@/components/layout';
import { closeRealtime } from '@/realtime/useCampaignChannel';
import { useAuthStore } from '@/store/auth';
import { spacing } from '@/theme';

/** Perfil do jogador e configurações da conta (briefing §1). */
export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const apiUrl = useAuthStore((state) => state.apiUrl);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  const [name, setName] = useState(user?.name ?? '');
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const updated = await authApi.updateProfile({
        name: name.trim(),
        nickname: nickname.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      setUser(updated);
      setProfileMessage('Perfil atualizado.');
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : 'Não foi possível salvar.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (password !== confirmation) {
      setPasswordError('As senhas não conferem.');

      return;
    }

    setSavingPassword(true);
    setPasswordError(null);
    setPasswordMessage(null);

    try {
      await authApi.updatePassword({
        current_password: currentPassword,
        password,
        password_confirmation: confirmation,
      });
      setPasswordMessage('Senha alterada. As outras sessões foram encerradas.');
      setCurrentPassword('');
      setPassword('');
      setConfirmation('');
    } catch (error) {
      setPasswordError(
        error instanceof ApiError
          ? (error.fieldError('current_password') ?? error.fieldError('password') ?? error.message)
          : 'Não foi possível alterar a senha.'
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleLogout() {
    closeRealtime();
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <Screen insideTabs contentStyle={{ maxWidth: 720 }}>
      <PageHeader
        title="Perfil"
        subtitle={user?.email ?? undefined}
        actions={user?.is_master ? <Chip label="MASTER" tone="gold" /> : undefined}
      />

      {/* A permissão MASTER é global e silenciosa: sem este aviso, o usuário
          veria botões de mestre em mesas alheias sem entender por quê. */}
      {user?.is_master ? (
        <Card title="Permissão MASTER">
          <Text variant="small" tone="secondary">
            Sua conta administra a plataforma inteira: você abre, edita e exclui qualquer campanha e
            qualquer ficha, enxerga o Painel do Mestre e as anotações privadas de todas as mesas.
          </Text>
        </Card>
      ) : null}

      <PushNotificationButton />

      <Card title="Seus dados">
        <View style={{ gap: spacing.md }}>
          <Input label="Nome" value={name} onChangeText={setName} />
          <Input
            label="Apelido"
            value={nickname}
            onChangeText={setNickname}
            hint="Como aparece para os colegas de mesa."
          />
          <Input label="Sobre você" value={bio} onChangeText={setBio} multiline />

          {profileMessage ? (
            <Text variant="small" tone="success">
              {profileMessage}
            </Text>
          ) : null}
          {profileError ? (
            <Text variant="small" tone="danger">
              {profileError}
            </Text>
          ) : null}

          <Button label="Salvar alterações" onPress={handleSaveProfile} loading={savingProfile} />
        </View>
      </Card>

      <Card title="Alterar senha">
        <View style={{ gap: spacing.md }}>
          <Input
            label="Senha atual"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />
          <Input label="Nova senha" value={password} onChangeText={setPassword} secureTextEntry />
          <Input
            label="Confirmar nova senha"
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
          />

          {passwordMessage ? (
            <Text variant="small" tone="success">
              {passwordMessage}
            </Text>
          ) : null}
          {passwordError ? (
            <Text variant="small" tone="danger">
              {passwordError}
            </Text>
          ) : null}

          <Button
            label="Alterar senha"
            variant="secondary"
            onPress={handleChangePassword}
            loading={savingPassword}
          />
        </View>
      </Card>

      <Card title="Servidor" subtitle="Endereço da API usada por este aplicativo">
        <View style={{ gap: spacing.md }}>
          <Text variant="small" tone="secondary" numberOfLines={2}>
            {apiUrl}
          </Text>
          <Text variant="small" tone="muted">
            Trocar o servidor encerra a sessão atual, já que o token pertence ao servidor anterior.
          </Text>
          <Button
            label="Alterar servidor"
            variant="secondary"
            onPress={() => router.push('/(auth)/servidor')}
          />
        </View>
      </Card>

      <Button label="Sair da conta" variant="danger" onPress={handleLogout} fullWidth />
    </Screen>
  );
}
