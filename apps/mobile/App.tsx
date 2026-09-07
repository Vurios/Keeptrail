import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { VaultProvider } from "./src/vault-context";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { ToastProvider } from "./src/components/ToastContext";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ReceiptsScreen } from "./src/screens/ReceiptsScreen";
import { CollectionsScreen } from "./src/screens/CollectionsScreen";
import { RemindersScreen } from "./src/screens/RemindersScreen";
import { StorageBackupScreen } from "./src/screens/StorageBackupScreen";
import { AskKeeptrailScreen } from "./src/screens/AskKeeptrailScreen";
import { CaptureModal } from "./src/screens/CaptureModal";
import { OnboardingModal } from "./src/screens/OnboardingModal";
import { ReceiptRecord } from "@katibay/shared";
import { haptics } from "./src/utils/haptics";

type MainTab = "home" | "receipts" | "collections" | "reminders";
type ActiveOverlay = "none" | "storage_backup" | "ask_keeptrail";

function MainApp() {
  const { colors, spacing, borderRadius, typography, isDark } = useTheme();
  const [currentTab, setCurrentTab] = useState<MainTab>("home");
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>("none");
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const handleOpenReceiptFromAnywhere = (receipt: ReceiptRecord) => {
    haptics.tap();
    setSelectedReceipt(receipt);
    setCurrentTab("receipts");
    setActiveOverlay("none");
  };

  const handleTabChange = (tab: MainTab) => {
    if (tab !== currentTab) {
      haptics.tap();
      setCurrentTab(tab);
    }
  };

  return (
    <View style={[styles.appContainer, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* Primary Screen Content */}
      <View style={styles.screenContent}>
        {activeOverlay === "storage_backup" ? (
          <StorageBackupScreen onBack={() => setActiveOverlay("none")} />
        ) : activeOverlay === "ask_keeptrail" ? (
          <AskKeeptrailScreen
            onBack={() => setActiveOverlay("none")}
            onOpenReceipt={handleOpenReceiptFromAnywhere}
          />
        ) : (
          <>
            {currentTab === "home" && (
              <HomeScreen
                onOpenReceipt={handleOpenReceiptFromAnywhere}
                onOpenAskKeeptrail={() => {
                  haptics.tap();
                  setActiveOverlay("ask_keeptrail");
                }}
                onOpenStorageBackup={() => {
                  haptics.tap();
                  setActiveOverlay("storage_backup");
                }}
                onOpenOnboarding={() => {
                  haptics.tap();
                  setIsOnboardingOpen(true);
                }}
                onNavigateToTab={(tab) => handleTabChange(tab)}
              />
            )}
            {currentTab === "receipts" && (
              <ReceiptsScreen
                selectedReceipt={selectedReceipt}
                onClearSelectedReceipt={() => setSelectedReceipt(null)}
              />
            )}
            {currentTab === "collections" && (
              <CollectionsScreen onOpenReceipt={handleOpenReceiptFromAnywhere} />
            )}
            {currentTab === "reminders" && <RemindersScreen />}
          </>
        )}
      </View>

      {/* Bottom Navigation Bar */}
      {activeOverlay === "none" && (
        <SafeAreaView
          style={[
            styles.bottomNavContainer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          <View style={styles.bottomNav} accessibilityRole="tablist">
            {/* Tab 1: Home */}
            <TouchableOpacity
              style={[
                styles.navTab,
                currentTab === "home" && [styles.navTabActive, { borderTopColor: colors.primary }],
              ]}
              onPress={() => handleTabChange("home")}
              accessibilityRole="tab"
              accessibilityLabel="Home Tab"
              accessibilityState={{ selected: currentTab === "home" }}
              activeOpacity={0.7}
            >
              <Text style={[styles.navIcon, currentTab === "home" && styles.navIconActive]}>
                🏠
              </Text>
              <Text
                style={[
                  styles.navLabel,
                  { color: currentTab === "home" ? colors.primary : colors.textSecondary },
                  currentTab === "home" && styles.navLabelActive,
                ]}
              >
                Home
              </Text>
            </TouchableOpacity>

            {/* Tab 2: Receipts */}
            <TouchableOpacity
              style={[
                styles.navTab,
                currentTab === "receipts" && [
                  styles.navTabActive,
                  { borderTopColor: colors.primary },
                ],
              ]}
              onPress={() => handleTabChange("receipts")}
              accessibilityRole="tab"
              accessibilityLabel="Receipts Tab"
              accessibilityState={{ selected: currentTab === "receipts" }}
              activeOpacity={0.7}
            >
              <Text style={[styles.navIcon, currentTab === "receipts" && styles.navIconActive]}>
                🧾
              </Text>
              <Text
                style={[
                  styles.navLabel,
                  { color: currentTab === "receipts" ? colors.primary : colors.textSecondary },
                  currentTab === "receipts" && styles.navLabelActive,
                ]}
              >
                Receipts
              </Text>
            </TouchableOpacity>

            {/* Center Spacer for Floating Button */}
            <View style={styles.navCenterSpacer} pointerEvents="none" />

            {/* Tab 3: Collections */}
            <TouchableOpacity
              style={[
                styles.navTab,
                currentTab === "collections" && [
                  styles.navTabActive,
                  { borderTopColor: colors.primary },
                ],
              ]}
              onPress={() => handleTabChange("collections")}
              accessibilityRole="tab"
              accessibilityLabel="Collections Tab"
              accessibilityState={{ selected: currentTab === "collections" }}
              activeOpacity={0.7}
            >
              <Text style={[styles.navIcon, currentTab === "collections" && styles.navIconActive]}>
                📁
              </Text>
              <Text
                style={[
                  styles.navLabel,
                  { color: currentTab === "collections" ? colors.primary : colors.textSecondary },
                  currentTab === "collections" && styles.navLabelActive,
                ]}
              >
                Collections
              </Text>
            </TouchableOpacity>

            {/* Tab 4: Reminders */}
            <TouchableOpacity
              style={[
                styles.navTab,
                currentTab === "reminders" && [
                  styles.navTabActive,
                  { borderTopColor: colors.primary },
                ],
              ]}
              onPress={() => handleTabChange("reminders")}
              accessibilityRole="tab"
              accessibilityLabel="Reminders Tab"
              accessibilityState={{ selected: currentTab === "reminders" }}
              activeOpacity={0.7}
            >
              <Text style={[styles.navIcon, currentTab === "reminders" && styles.navIconActive]}>
                ⏰
              </Text>
              <Text
                style={[
                  styles.navLabel,
                  { color: currentTab === "reminders" ? colors.primary : colors.textSecondary },
                  currentTab === "reminders" && styles.navLabelActive,
                ]}
              >
                Reminders
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      {/* Floating Action Button for Quick Capture (layered on top) */}
      {activeOverlay === "none" && (
        <TouchableOpacity
          style={[
            styles.floatingCaptureBtn,
            {
              backgroundColor: colors.primary,
              shadowColor: isDark ? "#000" : "#146B55",
            },
          ]}
          onPress={() => {
            haptics.tap();
            setIsCaptureModalOpen(true);
          }}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Capture or Add Receipt"
          accessibilityHint="Opens options to photograph a receipt, import a screenshot, or enter details manually"
        >
          <Text style={[styles.floatingCaptureIcon, { color: colors.primaryFg }]}>+</Text>
        </TouchableOpacity>
      )}

      {/* Capture Modal */}
      <CaptureModal visible={isCaptureModalOpen} onClose={() => setIsCaptureModalOpen(false)} />

      {/* Onboarding & First-Run Guide Modal */}
      <OnboardingModal
        visible={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onOpenSampleReceipt={() => {
          setIsOnboardingOpen(false);
          setCurrentTab("receipts");
        }}
      />
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <VaultProvider>
        <ToastProvider>
          <MainApp />
        </ToastProvider>
      </VaultProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
  },
  floatingCaptureBtn: {
    position: "absolute",
    bottom: Platform.OS === "android" ? 28 : 34,
    alignSelf: "center",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  floatingCaptureIcon: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "600",
  },
  bottomNavContainer: {
    borderTopWidth: 1,
  },
  bottomNav: {
    flexDirection: "row",
    height: 64,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  navCenterSpacer: {
    width: 64,
  },
  navTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    height: "100%",
    minHeight: 48,
  },
  navTabActive: {
    borderTopWidth: 2.5,
  },
  navIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  navLabelActive: {
    fontWeight: "700",
  },
});
