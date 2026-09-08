import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ReceiptRecord } from "@katibay/shared";

import { VaultProvider } from "./src/vault-context";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { SnackbarProvider } from "./src/components/SnackbarContext";
import { Icon } from "./src/components/Icon";
import { TabBar, type TabKey } from "./src/navigation/TabBar";
import { HomeScreen } from "./src/screens/HomeScreen";
import { ReceiptsScreen } from "./src/screens/ReceiptsScreen";
import { CollectionsScreen } from "./src/screens/CollectionsScreen";
import { RemindersScreen } from "./src/screens/RemindersScreen";
import { StorageBackupScreen } from "./src/screens/StorageBackupScreen";
import { AskKeeptrailScreen } from "./src/screens/AskKeeptrailScreen";
import { CaptureModal } from "./src/screens/CaptureModal";
import { OnboardingModal } from "./src/screens/OnboardingModal";
import { VaultFailureScreen, VaultLoadingScreen } from "./src/screens/VaultBootScreens";
import { haptics } from "./src/utils/haptics";

const ONBOARDING_KEY = "keeptrail.onboarding.completedVersion";
/** Bump to re-show onboarding after a change users need to see. */
const ONBOARDING_VERSION = "1";

type Overlay = "none" | "ask" | "vault";

function MainApp() {
  const { colors, spacing, elevation, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<TabKey>("home");
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [resumeDraftId, setResumeDraftId] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [receiptsFilter, setReceiptsFilter] = useState<{
    collectionId?: string;
    reviewOnly?: boolean;
    unfiledOnly?: boolean;
    focusReceiptId?: string;
  }>({});

  // Onboarding is shown on first run, and the completion flag is stored so it
  // does not reappear. Previously it could only be reached by tapping a header
  // button, so nobody saw the screen that explains a backup password can never
  // be recovered.
  const onboardingChecked = useRef(false);
  useEffect(() => {
    if (onboardingChecked.current) return;
    onboardingChecked.current = true;
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((completed) => {
        if (completed !== ONBOARDING_VERSION) setOnboardingOpen(true);
      })
      .catch(() => setOnboardingOpen(true));
  }, []);

  const closeOnboarding = useCallback(() => {
    setOnboardingOpen(false);
    AsyncStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION).catch(() => undefined);
  }, []);

  const openTab = useCallback((next: TabKey) => {
    haptics.tap();
    setOverlay("none");
    setTab(next);
  }, []);

  const openReceipt = useCallback((receipt: ReceiptRecord) => {
    haptics.tap();
    setOverlay("none");
    setReceiptsFilter({ focusReceiptId: receipt.id });
    setTab("receipts");
  }, []);

  const openReviewQueue = useCallback(() => {
    haptics.tap();
    setReceiptsFilter({ reviewOnly: true });
    setTab("receipts");
  }, []);

  const openCollection = useCallback((collectionId: string) => {
    haptics.tap();
    setReceiptsFilter({ collectionId });
    setTab("receipts");
  }, []);

  const openUnfiled = useCallback(() => {
    haptics.tap();
    setReceiptsFilter({ unfiledOnly: true });
    setTab("receipts");
  }, []);

  // Hardware and gesture Back. Without this, Back inside an overlay closed the
  // whole app, and Back on any tab other than Home exited rather than returning
  // to the start destination.
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (overlay !== "none") {
        setOverlay("none");
        return true;
      }
      if (tab !== "home") {
        setTab("home");
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [overlay, tab]);

  const showChrome = overlay === "none";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? "light" : "dark"} />

      <View style={{ flex: 1 }}>
        {overlay === "ask" ? (
          <AskKeeptrailScreen onBack={() => setOverlay("none")} onOpenReceipt={openReceipt} />
        ) : overlay === "vault" ? (
          <StorageBackupScreen
            onBack={() => setOverlay("none")}
            onOpenAsk={() => setOverlay("ask")}
          />
        ) : (
          <>
            {tab === "home" && (
              <HomeScreen
                onOpenReceipt={openReceipt}
                onOpenAsk={() => {
                  haptics.tap();
                  setOverlay("ask");
                }}
                onOpenVault={() => {
                  haptics.tap();
                  setOverlay("vault");
                }}
                onOpenGuide={() => setOnboardingOpen(true)}
                onOpenReviewQueue={openReviewQueue}
                onOpenCollection={openCollection}
                onOpenAllReceipts={() => {
                  setReceiptsFilter({});
                  openTab("receipts");
                }}
                onStartCapture={() => {
                  haptics.tap();
                  setCaptureOpen(true);
                }}
                onResumeDraft={(draftId) => {
                  haptics.tap();
                  setResumeDraftId(draftId);
                  setCaptureOpen(true);
                }}
              />
            )}
            {tab === "receipts" && (
              <ReceiptsScreen
                initialFilter={receiptsFilter}
                onFilterConsumed={() => setReceiptsFilter({})}
                onStartCapture={() => {
                  haptics.tap();
                  setCaptureOpen(true);
                }}
              />
            )}
            {tab === "collections" && (
              <CollectionsScreen onOpenCollection={openCollection} onOpenUnfiled={openUnfiled} />
            )}
            {tab === "reminders" && <RemindersScreen onOpenReceipt={openReceipt} />}
          </>
        )}
      </View>

      {showChrome && (
        <>
          {/* One FAB, one primary action: capture. Positioned above the real
              navigation inset rather than a fixed 28dp guess. */}
          <Pressable
            onPress={() => {
              haptics.tap();
              setCaptureOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Add a receipt"
            accessibilityHint="Scan a sample receipt, import one, or type the details yourself"
            android_ripple={{ color: colors.scrim, borderless: false }}
            style={({ pressed }) => ({
              position: "absolute",
              right: spacing.gutter + insets.right,
              bottom: insets.bottom + spacing.xxxl + spacing.xl,
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              elevation: elevation.fab,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Icon name="add" size={26} color={colors.onPrimary} />
          </Pressable>

          <TabBar current={tab} onChange={openTab} />
        </>
      )}

      <CaptureModal
        visible={captureOpen}
        resumeDraftId={resumeDraftId}
        onClose={() => {
          setCaptureOpen(false);
          setResumeDraftId(null);
        }}
      />

      <OnboardingModal
        visible={onboardingOpen}
        onClose={closeOnboarding}
        onStartCapture={() => {
          closeOnboarding();
          setCaptureOpen(true);
        }}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <VaultProvider
          renderLoading={() => <VaultLoadingScreen />}
          renderFailure={(message) => <VaultFailureScreen message={message} />}
        >
          <SnackbarProvider>
            <MainApp />
          </SnackbarProvider>
        </VaultProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
