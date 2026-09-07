import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors, spacing, borderRadius, typography } from "./src/theme/tokens";
import { VaultProvider } from "./src/vault-context";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ReceiptsScreen } from "./src/screens/ReceiptsScreen";
import { CollectionsScreen } from "./src/screens/CollectionsScreen";
import { RemindersScreen } from "./src/screens/RemindersScreen";
import { StorageBackupScreen } from "./src/screens/StorageBackupScreen";
import { AskKeeptrailScreen } from "./src/screens/AskKeeptrailScreen";
import { CaptureModal } from "./src/screens/CaptureModal";
import { OnboardingModal } from "./src/screens/OnboardingModal";
import { ReceiptRecord } from "@katibay/shared";

type MainTab = "home" | "receipts" | "collections" | "reminders";
type ActiveOverlay = "none" | "storage_backup" | "ask_keeptrail";

function MainApp() {
  const [currentTab, setCurrentTab] = useState<MainTab>("home");
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>("none");
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(null);
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const handleOpenReceiptFromAnywhere = (receipt: ReceiptRecord) => {
    setSelectedReceipt(receipt);
    setCurrentTab("receipts");
    setActiveOverlay("none");
  };

  return (
    <View style={styles.appContainer}>
      <StatusBar style="dark" />

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
                onOpenAskKeeptrail={() => setActiveOverlay("ask_keeptrail")}
                onOpenStorageBackup={() => setActiveOverlay("storage_backup")}
                onOpenOnboarding={() => setIsOnboardingOpen(true)}
                onNavigateToTab={(tab) => setCurrentTab(tab)}
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

      {/* Floating Action Button for Quick Capture */}
      {activeOverlay === "none" && (
        <TouchableOpacity
          style={styles.floatingCaptureBtn}
          onPress={() => setIsCaptureModalOpen(true)}
          activeOpacity={0.85}
          accessibilityLabel="Capture or Add Receipt"
        >
          <Text style={styles.floatingCaptureIcon}>+</Text>
        </TouchableOpacity>
      )}

      {/* Bottom Navigation Bar */}
      {activeOverlay === "none" && (
        <SafeAreaView style={styles.bottomNavContainer}>
          <View style={styles.bottomNav}>
            {/* Tab 1: Home */}
            <TouchableOpacity
              style={[styles.navTab, currentTab === "home" && styles.navTabActive]}
              onPress={() => setCurrentTab("home")}
              accessibilityLabel="Home Tab"
            >
              <Text style={[styles.navIcon, currentTab === "home" && styles.navIconActive]}>
                🏠
              </Text>
              <Text style={[styles.navLabel, currentTab === "home" && styles.navLabelActive]}>
                Home
              </Text>
            </TouchableOpacity>

            {/* Tab 2: Receipts */}
            <TouchableOpacity
              style={[styles.navTab, currentTab === "receipts" && styles.navTabActive]}
              onPress={() => setCurrentTab("receipts")}
              accessibilityLabel="Receipts Tab"
            >
              <Text style={[styles.navIcon, currentTab === "receipts" && styles.navIconActive]}>
                🧾
              </Text>
              <Text style={[styles.navLabel, currentTab === "receipts" && styles.navLabelActive]}>
                Receipts
              </Text>
            </TouchableOpacity>

            {/* Center Spacer for Floating Button */}
            <View style={styles.navCenterSpacer} />

            {/* Tab 3: Collections */}
            <TouchableOpacity
              style={[styles.navTab, currentTab === "collections" && styles.navTabActive]}
              onPress={() => setCurrentTab("collections")}
              accessibilityLabel="Collections Tab"
            >
              <Text style={[styles.navIcon, currentTab === "collections" && styles.navIconActive]}>
                📁
              </Text>
              <Text
                style={[styles.navLabel, currentTab === "collections" && styles.navLabelActive]}
              >
                Collections
              </Text>
            </TouchableOpacity>

            {/* Tab 4: Reminders */}
            <TouchableOpacity
              style={[styles.navTab, currentTab === "reminders" && styles.navTabActive]}
              onPress={() => setCurrentTab("reminders")}
              accessibilityLabel="Reminders Tab"
            >
              <Text style={[styles.navIcon, currentTab === "reminders" && styles.navIconActive]}>
                ⏰
              </Text>
              <Text style={[styles.navLabel, currentTab === "reminders" && styles.navLabelActive]}>
                Reminders
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
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
    <VaultProvider>
      <MainApp />
    </VaultProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: colors.brand.background,
  },
  screenContent: {
    flex: 1,
  },
  floatingCaptureBtn: {
    position: "absolute",
    bottom: 34,
    alignSelf: "center",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.brand.primary,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  floatingCaptureIcon: {
    fontSize: 32,
    color: colors.brand.primaryFg,
    lineHeight: 36,
    fontWeight: "600",
  },
  bottomNavContainer: {
    backgroundColor: colors.brand.surface,
    borderTopWidth: 1,
    borderTopColor: colors.brand.border,
  },
  bottomNav: {
    flexDirection: "row",
    height: 64,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
  },
  navCenterSpacer: {
    width: 64,
  },
  navTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
    height: "100%",
  },
  navTabActive: {
    borderTopWidth: 2,
    borderTopColor: colors.brand.primary,
  },
  navIcon: {
    fontSize: 20,
    opacity: 0.5,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  navLabelActive: {
    color: colors.brand.primary,
    fontWeight: "700",
  },
});
