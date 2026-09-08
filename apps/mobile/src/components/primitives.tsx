/**
 * Shared UI primitives.
 *
 * Every screen previously re-declared its own button, chip, card, field and
 * empty state, which is why four "identical" empty states drifted apart and the
 * type scale grew to seventeen sizes. Screens compose these instead.
 */

import React, { useMemo, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeContext";
import { Icon, type IconName } from "./Icon";

// --- Text --------------------------------------------------------------------

type TextRole = keyof ReturnType<typeof useTheme>["typography"];

interface AppTextProps {
  role?: TextRole;
  tone?: "primary" | "secondary" | "muted" | "accent" | "onPrimary" | "danger";
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** Caps runaway growth at large system font sizes inside fixed rows. */
  maxFontSizeMultiplier?: number;
  accessibilityLabel?: string;
}

export function AppText({
  role = "body",
  tone = "primary",
  children,
  style,
  numberOfLines,
  maxFontSizeMultiplier,
  accessibilityLabel,
}: AppTextProps) {
  const { typography, colors } = useTheme();
  const toneColor = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    accent: colors.accent,
    onPrimary: colors.onPrimary,
    danger: colors.status.danger.text,
  }[tone];

  return (
    <Text
      style={[typography[role] as TextStyle, { color: toneColor }, style]}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Text>
  );
}

/**
 * A monetary figure. Always tabular so amounts line up down a column, and
 * always accompanied by its currency — an amount without one is meaningless
 * in a vault that segregates currencies.
 */
export function Money({
  formatted,
  size = "row",
  tone = "primary",
}: {
  formatted: string;
  size?: "row" | "headline";
  tone?: "primary" | "accent" | "muted";
}) {
  const { numeric, colors } = useTheme();
  const color = {
    primary: colors.textPrimary,
    accent: colors.accent,
    muted: colors.textMuted,
  }[tone];

  return (
    <Text
      style={[
        (size === "headline" ? numeric.amountLarge : numeric.amount) as unknown as TextStyle,
        { color },
      ]}
      maxFontSizeMultiplier={1.4}
    >
      {formatted}
    </Text>
  );
}

// --- Buttons -----------------------------------------------------------------

type ButtonVariant = "filled" | "tonal" | "outlined" | "text" | "danger";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = "filled",
  icon,
  disabled = false,
  busy = false,
  fullWidth = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const inactive = disabled || busy;

  const surface = {
    filled: colors.primary,
    tonal: colors.primaryContainer,
    outlined: "transparent",
    text: "transparent",
    danger: colors.status.danger.bg,
  }[variant];

  const label_ = {
    filled: colors.onPrimary,
    tonal: colors.onPrimaryContainer,
    outlined: colors.primary,
    text: colors.primary,
    danger: colors.status.danger.text,
  }[variant];

  const borderColor = {
    filled: "transparent",
    tonal: "transparent",
    outlined: colors.outline,
    text: "transparent",
    danger: colors.status.danger.border,
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      android_ripple={inactive ? undefined : { color: colors.scrim, borderless: false }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      style={({ pressed }) => [
        {
          minHeight: spacing.touch,
          paddingHorizontal: variant === "text" ? spacing.sm : spacing.gutter,
          borderRadius: radius.control,
          backgroundColor: surface,
          borderWidth: variant === "outlined" || variant === "danger" ? 1 : 0,
          borderColor,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={label_} />
      ) : icon ? (
        <Icon name={icon} size={18} color={label_} />
      ) : null}
      <Text
        style={[typography.smallStrong as TextStyle, { color: label_ }]}
        maxFontSizeMultiplier={1.5}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Square icon-only control. Always 48dp regardless of the glyph size. */
export function IconButton({
  icon,
  onPress,
  label,
  tone = "secondary",
  disabled = false,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  tone?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  const { colors, spacing, radius } = useTheme();
  const color = {
    primary: colors.primary,
    secondary: colors.textSecondary,
    danger: colors.status.danger.text,
  }[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      android_ripple={{ color: colors.scrim, borderless: true, radius: spacing.touch / 2 }}
      style={({ pressed }) => ({
        width: spacing.touch,
        height: spacing.touch,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={22} color={color} />
    </Pressable>
  );
}

// --- Chips -------------------------------------------------------------------

export function Chip({
  label,
  selected,
  onPress,
  count,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  count?: number;
  icon?: IconName;
}) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      android_ripple={{ color: colors.scrim }}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={{
        minHeight: 40,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.outline,
        backgroundColor: selected ? colors.primaryContainer : "transparent",
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
      }}
    >
      {icon ? (
        <Icon
          name={icon}
          size={15}
          color={selected ? colors.onPrimaryContainer : colors.textSecondary}
        />
      ) : null}
      <Text
        style={[
          typography.smallStrong as TextStyle,
          { color: selected ? colors.onPrimaryContainer : colors.textSecondary },
        ]}
        maxFontSizeMultiplier={1.4}
      >
        {count === undefined ? label : `${label} ${count}`}
      </Text>
    </Pressable>
  );
}

/** Non-interactive status marker. */
export function StatusBadge({
  label,
  tone,
  icon,
}: {
  label: string;
  tone: keyof ReturnType<typeof useTheme>["colors"]["status"];
  icon?: IconName;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const set = colors.status[tone];

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: radius.full,
        backgroundColor: set.bg,
        borderWidth: 1,
        borderColor: set.border,
      }}
    >
      {icon ? <Icon name={icon} size={13} color={set.text} /> : null}
      <Text
        style={[typography.label as TextStyle, { color: set.text }]}
        maxFontSizeMultiplier={1.3}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

// --- Containers --------------------------------------------------------------

export function Card({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  padded = true,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, radius } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: padded ? spacing.lg : 0,
    overflow: "hidden",
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: colors.scrim }}
      style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

/**
 * A labelled section. The label is the only uppercase text in the app, which is
 * what makes it read as structure rather than emphasis.
 */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ marginTop: spacing.section }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: spacing.md,
          minHeight: 24,
        }}
      >
        <AppText role="label" tone="muted">
          {title.toUpperCase()}
        </AppText>
        {action}
      </View>
      {children}
    </View>
  );
}

/**
 * Empty states carry the reason the space is empty and exactly one way out.
 * The generic centred icon-title-subtitle block is deliberately not the shape
 * here: the copy is left-aligned with the content it replaces so the eye does
 * not have to re-centre.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
}) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View
      style={{
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: colors.divider,
        borderStyle: "dashed",
        backgroundColor: "transparent",
        padding: spacing.gutter,
        gap: spacing.sm,
      }}
    >
      <Icon name={icon} size={26} color={colors.textMuted} />
      <AppText role="heading">{title}</AppText>
      <AppText role="small" tone="secondary">
        {body}
      </AppText>
      {action ? (
        <View style={{ marginTop: spacing.sm }}>
          <Button
            label={action.label}
            onPress={action.onPress}
            icon={action.icon}
            variant="tonal"
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * An advisory panel. Used for facts the user needs in place — where the vault
 * lives, what a backup does and does not do — never for decoration.
 */
export function Notice({
  tone = "neutral",
  icon,
  title,
  body,
  action,
}: {
  tone?: keyof ReturnType<typeof useTheme>["colors"]["status"];
  icon: IconName;
  title?: string;
  body: string;
  action?: ReactNode;
}) {
  const { colors, spacing, radius } = useTheme();
  const set = colors.status[tone];

  return (
    <View
      style={{
        flexDirection: "row",
        gap: spacing.md,
        padding: spacing.lg,
        borderRadius: radius.control,
        backgroundColor: set.bg,
        borderWidth: 1,
        borderColor: set.border,
      }}
    >
      <Icon name={icon} size={18} color={set.text} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        {title ? (
          <Text style={{ color: set.text, fontSize: 14, lineHeight: 20, fontWeight: "600" }}>
            {title}
          </Text>
        ) : null}
        <Text style={{ color: set.text, fontSize: 14, lineHeight: 20 }}>{body}</Text>
        {action}
      </View>
    </View>
  );
}

// --- Form fields -------------------------------------------------------------

interface FieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  multiline?: boolean;
}

export function Field({ label, hint, error, required, multiline, ...inputProps }: FieldProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText role="smallStrong" tone="secondary">
        {required ? `${label} *` : label}
      </AppText>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        accessibilityHint={hint}
        style={[
          typography.body as TextStyle,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: error ? colors.status.danger.border : colors.outline,
            borderRadius: radius.control,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
            // minHeight rather than height, so the field grows with the system
            // font size instead of clipping its own text.
            minHeight: multiline ? 96 : spacing.touch,
            textAlignVertical: multiline ? "top" : "center",
          },
        ]}
      />
      {error ? (
        <AppText role="small" tone="danger">
          {error}
        </AppText>
      ) : hint ? (
        <AppText role="small" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * A fixed set of options rendered as chips. Replaces free-text entry wherever
 * the value belongs to a known set — a mistyped currency code silently forks a
 * user's totals, so the field simply does not allow one.
 */
export function OptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  hint?: string;
}) {
  const { spacing } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText role="smallStrong" tone="secondary">
        {label}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
      >
        {options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={option.value === value}
            onPress={() => onChange(option.value)}
          />
        ))}
      </ScrollView>
      {hint ? (
        <AppText role="small" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * Free-text tags with suggestions from tags already in use.
 *
 * Suggestions matter more than they look: without them every user invents
 * "warranty", "Warranty" and "warranties" and the tag list stops being useful.
 * The vault de-duplicates case-insensitively, and offering the existing
 * spelling first is what keeps that from being surprising.
 */
export function TagEditor({
  tags,
  onChange,
  suggestions,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const [draft, setDraft] = React.useState("");

  const lowerCurrent = tags.map((tag) => tag.toLowerCase());
  const unused = suggestions.filter((tag) => !lowerCurrent.includes(tag.toLowerCase())).slice(0, 8);

  const add = (value: string) => {
    const tag = value.trim();
    if (!tag) return;
    if (lowerCurrent.includes(tag.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...tags, tag]);
    setDraft("");
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText role="smallStrong" tone="secondary">
        Tags
      </AppText>

      {tags.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {tags.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => onChange(tags.filter((t) => t !== tag))}
              accessibilityRole="button"
              accessibilityLabel={`Remove tag ${tag}`}
              android_ripple={{ color: colors.scrim }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                minHeight: 40,
                paddingHorizontal: spacing.md,
                borderRadius: radius.full,
                backgroundColor: colors.primaryContainer,
              }}
            >
              <Text
                style={[typography.smallStrong as TextStyle, { color: colors.onPrimaryContainer }]}
              >
                {tag}
              </Text>
              <Icon name="close" size={14} color={colors.onPrimaryContainer} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => add(draft)}
          placeholder="Add a tag"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Add a tag"
          returnKeyType="done"
          autoCapitalize="none"
          style={[
            typography.body as TextStyle,
            {
              flex: 1,
              color: colors.textPrimary,
              backgroundColor: colors.surface,
              borderWidth: 1.5,
              borderColor: colors.outline,
              borderRadius: radius.control,
              paddingHorizontal: spacing.md,
              minHeight: spacing.touch,
            },
          ]}
        />
        <Button label="Add" variant="tonal" onPress={() => add(draft)} disabled={!draft.trim()} />
      </View>

      {unused.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          <AppText role="small" tone="muted">
            Already used
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {unused.map((tag) => (
              <Chip key={tag} label={tag} selected={false} onPress={() => add(tag)} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// --- Screen scaffolding ------------------------------------------------------

/**
 * Top app bar. Applies the status-bar inset itself, because the app draws
 * edge-to-edge and nothing else in the tree does it.
 */
export function AppBar({
  title,
  subtitle,
  onBack,
  actions,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        backgroundColor: colors.background,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
      }}
    >
      <View
        style={{
          minHeight: 56,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: onBack ? spacing.sm : spacing.gutter,
          paddingVertical: spacing.sm,
          gap: spacing.sm,
        }}
      >
        {onBack ? <IconButton icon="back" label="Go back" onPress={onBack} /> : null}
        <View style={{ flex: 1 }}>
          <AppText role="title" numberOfLines={1} maxFontSizeMultiplier={1.4}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText role="small" tone="secondary" numberOfLines={2}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {actions ? (
          <View style={{ flexDirection: "row", alignItems: "center" }}>{actions}</View>
        ) : null}
      </View>
    </View>
  );
}

/** Horizontal rule at hairline width, so it reads as a seam rather than a line. */
export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider }} />;
}

/**
 * Standard content padding for a scrolling screen: screen gutters plus enough
 * bottom room to clear the tab bar, the FAB, and the system navigation inset.
 */
export function useContentInsets(extraBottom = 0) {
  const insets = useSafeAreaInsets();
  const { spacing } = useTheme();
  return useMemo(
    () => ({
      paddingHorizontal: spacing.gutter,
      paddingTop: spacing.lg,
      paddingBottom: insets.bottom + spacing.xxxl + spacing.xxl + extraBottom,
    }),
    [insets.bottom, spacing, extraBottom],
  );
}
