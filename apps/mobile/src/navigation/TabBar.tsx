/**
 * Bottom navigation.
 *
 * Four destinations, sized and padded against the real navigation-bar inset.
 * The app draws edge-to-edge, and `SafeAreaView` from react-native applies no
 * padding on Android, so the previous bar sat underneath the system gesture
 * handle with its labels occluded.
 */

import React from "react";
import { Pressable, Text, View, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeContext";
import { Icon, type IconName } from "../components/Icon";

export type TabKey = "home" | "receipts" | "collections" | "reminders";

interface TabDefinition {
  key: TabKey;
  label: string;
  icon: IconName;
  activeIcon: IconName;
  hint: string;
}

/**
 * The four primary destinations the blueprint mandates. Collections is one of
 * them, so it is a tab rather than a filter buried inside Receipts.
 *
 * Vault (storage and backup) is deliberately not a tab: it is a settings
 * surface, reached from the Home app bar and from the backup reminder itself.
 */
export const TABS: TabDefinition[] = [
  {
    key: "home",
    label: "Home",
    icon: "home",
    activeIcon: "homeActive",
    hint: "Search, review queue and recent receipts",
  },
  {
    key: "receipts",
    label: "Receipts",
    icon: "receipts",
    activeIcon: "receiptsActive",
    hint: "Every saved receipt, filtered by collection or review state",
  },
  {
    key: "collections",
    label: "Collections",
    icon: "collection",
    activeIcon: "collectionOpen",
    hint: "Receipts grouped by what they are for",
  },
  {
    key: "reminders",
    label: "Reminders",
    icon: "reminders",
    activeIcon: "remindersActive",
    hint: "Return windows, refunds and reimbursement deadlines",
  },
];

export function TabBar({
  current,
  onChange,
}: {
  current: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const { colors, spacing, radius, typography } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.divider,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      {TABS.map((tab) => {
        const selected = tab.key === current;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityHint={tab.hint}
            accessibilityState={{ selected }}
            android_ripple={{ color: colors.scrim }}
            style={{
              flex: 1,
              minHeight: spacing.navBar,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: spacing.sm,
              gap: spacing.xxs,
            }}
          >
            <View
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.xxs,
                borderRadius: radius.full,
                backgroundColor: selected ? colors.primaryContainer : "transparent",
              }}
            >
              <Icon
                name={selected ? tab.activeIcon : tab.icon}
                size={22}
                color={selected ? colors.onPrimaryContainer : colors.textSecondary}
              />
            </View>
            <Text
              style={[
                // `caption` rather than `label`: same 12/16 metrics without the
                // uppercase tracking, so the tab name is not a seventh type step
                // invented at the call site.
                typography.caption as TextStyle,
                { color: selected ? colors.textPrimary : colors.textSecondary },
              ]}
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
