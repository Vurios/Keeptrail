import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors, spacing, borderRadius, typography } from "./src/theme/tokens";
import { CameraScreen } from "./src/screens/CameraScreen";
import { QueueScreen } from "./src/screens/QueueScreen";
import { PassportMobileScreen } from "./src/screens/PassportMobileScreen";

type TabScreen = "camera" | "queue" | "passports";

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabScreen>("camera");

  return (
    <View style={styles.appContainer}>
      <StatusBar style="light" />

      {/* Screen Render */}
      <View style={styles.screenContent}>
        {currentTab === "camera" && (
          <CameraScreen onNavigateToQueue={() => setCurrentTab("queue")} />
        )}
        {currentTab === "queue" && <QueueScreen onBackToCamera={() => setCurrentTab("camera")} />}
        {currentTab === "passports" && <PassportMobileScreen />}
      </View>

      {/* Bottom Thumb Navigation Bar */}
      <SafeAreaView style={styles.bottomNavContainer}>
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={[styles.navTab, currentTab === "camera" && styles.navTabActive]}
            onPress={() => setCurrentTab("camera")}
            accessibilityLabel="Camera Capture Tab"
          >
            <Text style={[styles.navIcon, currentTab === "camera" && styles.navIconActive]}>
              📷
            </Text>
            <Text style={[styles.navLabel, currentTab === "camera" && styles.navLabelActive]}>
              Capture
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, currentTab === "queue" && styles.navTabActive]}
            onPress={() => setCurrentTab("queue")}
            accessibilityLabel="Sync Queue Tab"
          >
            <Text style={[styles.navIcon, currentTab === "queue" && styles.navIconActive]}>📦</Text>
            <Text style={[styles.navLabel, currentTab === "queue" && styles.navLabelActive]}>
              Sync Queue
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, currentTab === "passports" && styles.navTabActive]}
            onPress={() => setCurrentTab("passports")}
            accessibilityLabel="Passports Tab"
          >
            <Text style={[styles.navIcon, currentTab === "passports" && styles.navIconActive]}>
              🛡
            </Text>
            <Text style={[styles.navLabel, currentTab === "passports" && styles.navLabelActive]}>
              Passports
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  screenContent: {
    flex: 1,
  },
  bottomNavContainer: {
    backgroundColor: colors.brand.card,
    borderTopWidth: 1,
    borderTopColor: colors.brand.border,
  },
  bottomNav: {
    flexDirection: "row",
    height: 56,
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: spacing.md,
  },
  navTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    height: "100%",
  },
  navTabActive: {
    backgroundColor: colors.brand.surfaceAlt,
  },
  navIcon: {
    fontSize: 16,
    opacity: 0.6,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.brand.textMuted,
    marginTop: 2,
  },
  navLabelActive: {
    color: colors.brand.primary,
    fontWeight: "800",
  },
});
