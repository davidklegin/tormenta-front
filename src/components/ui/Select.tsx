import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { radius, spacing, stroke, useTheme } from '@/theme';
import { contemTermo, normalizar } from '@/utils/texto';
import { Icon } from './Icon';
import { Input } from './Input';
import { Sheet } from './Sheet';
import { Text } from './Text';

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  description?: string;
};

export type SelectProps<T extends string | number> = {
  label?: string;
  value: T | null | undefined;
  options: SelectOption<T>[];
  onChange: (value: T | null) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  searchable?: boolean;
  clearable?: boolean;
  disabled?: boolean;
};

/**
 * Seletor com busca.
 *
 * Implementado sobre o Sheet em vez de um Picker nativo porque as listas do
 * app são longas (35 origens, 20 deuses, 56 itens) e precisam de busca nas três
 * plataformas com o mesmo comportamento.
 */
export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecione…',
  error,
  hint,
  searchable = true,
  clearable = false,
  disabled = false,
}: SelectProps<T>) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const term = normalizar(query.trim());
    if (!term) return options;

    return options.filter(
      (option) => contemTermo(option.label, term) || contemTermo(option.description, term)
    );
  }, [options, query]);

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text variant="smallStrong" tone="secondary">
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => !disabled && setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${selected?.label ?? placeholder}` : placeholder}
        style={{
          minHeight: 46,
          backgroundColor: 'transparent',
          borderBottomWidth: stroke.seal,
          borderBottomColor: error ? colors.danger : colors.border,
          borderRadius: radius.none,
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Text variant="body" tone={selected ? 'default' : 'muted'} numberOfLines={1} style={{ flex: 1 }}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon name="expandir" size={18} color={colors.textSubtle} />
      </Pressable>

      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      ) : null}

      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? 'Selecione'}>
        {searchable ? (
          <Input placeholder="Buscar…" value={query} onChangeText={setQuery} autoCorrect={false} />
        ) : null}

        {clearable ? (
          <Pressable
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
            style={{ paddingVertical: spacing.md }}
          >
            <Text variant="body" tone="muted">
              Nenhum
            </Text>
          </Pressable>
        ) : null}

        <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
          {filtered.length === 0 ? (
            <Text variant="small" tone="muted" style={{ paddingVertical: spacing.lg }}>
              Nenhum resultado para “{query}”.
            </Text>
          ) : (
            filtered.map((option) => {
              const isSelected = option.value === value;

              return (
                <Pressable
                  key={String(option.value)}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                    setQuery('');
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: isSelected
                      ? colors.primaryFill
                      : pressed
                        ? colors.surfaceHover
                        : 'transparent',
                    gap: 2,
                  })}
                >
                  <Text variant="body" tone={isSelected ? 'primary' : 'default'}>
                    {option.label}
                  </Text>
                  {option.description ? (
                    <Text variant="small" tone="muted">
                      {option.description}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </Sheet>
    </View>
  );
}
