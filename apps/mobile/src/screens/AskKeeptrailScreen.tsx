import React, { useState, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useLocalVault } from "../vault-context";
import { AssistantResponse, ReceiptRecord } from "@katibay/shared";
import { Skeleton } from "../components/Skeleton";
import { haptics } from "../utils/haptics";

interface AskKeeptrailScreenProps {
  onBack: () => void;
  onOpenReceipt: (receipt: ReceiptRecord) => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  responseMeta?: AssistantResponse;
  isError?: boolean;
  failedPrompt?: string;
}

export const AskKeeptrailScreen: React.FC<AskKeeptrailScreenProps> = ({
  onBack,
  onOpenReceipt,
}) => {
  const { colors, spacing, borderRadius, typography, isDark } = useTheme();
  const { queryAssistant, receipts } = useLocalVault();
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg_intro",
      sender: "assistant",
      text: "Hello! I am your local Keeptrail assistant. I can search your saved receipts, summarize your spending with exact totals, and track your return or reimbursement deadlines.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const STARTER_QUESTIONS = [
    "What did I spend?",
    "Which receipts need review?",
    "Any upcoming deadlines?",
    "How do I back up my receipts?",
  ];

  const handleSendPrompt = async (promptToSend?: string) => {
    const prompt = (promptToSend || inputText).trim();
    if (!prompt || isLoading) return;

    haptics.tap();
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: prompt,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const resp = await queryAssistant(prompt);
      haptics.success();
      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: "assistant",
        text: resp.answer,
        responseMeta: resp,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      haptics.error();
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `asst_err_${Date.now()}`,
          sender: "assistant",
          text: `Could not complete local query: ${msg}`,
          isError: true,
          failedPrompt: prompt,
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleRetry = (prompt: string) => {
    handleSendPrompt(prompt);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => {
              haptics.tap();
              onBack();
            }}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.backBtnText, { color: colors.primary }]}>‹ Back</Text>
          </TouchableOpacity>
          <View style={styles.titleCol}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Ask Keeptrail</Text>
            <View
              style={[
                styles.modeBadge,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.modeBadgeText, { color: colors.primary }]}>
                Basic Helper • Deterministic Local Engine
              </Text>
            </View>
          </View>
          <View style={{ width: 54 }} />
        </View>

        {/* Privacy Assurance Pill */}
        <View
          style={[
            styles.privacyPill,
            {
              backgroundColor: colors.surfaceAlt,
              borderColor: colors.status.success.border,
            },
          ]}
        >
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={[styles.privacyText, { color: colors.status.success.text }]}>
            100% on-device. No receipts are sent to the cloud or used to train AI.
          </Text>
        </View>

        {/* Message Thread */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.sender === "user"
                  ? [styles.userBubble, { backgroundColor: colors.primary }]
                  : [
                      styles.assistantBubble,
                      {
                        backgroundColor: colors.surface,
                        borderColor: msg.isError ? colors.status.danger.border : colors.border,
                      },
                    ],
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  msg.sender === "user"
                    ? [styles.userText, { color: colors.primaryFg }]
                    : [
                        styles.assistantText,
                        { color: msg.isError ? colors.status.danger.text : colors.textPrimary },
                      ],
                ]}
              >
                {msg.text}
              </Text>

              {/* Retry button for failed queries */}
              {msg.isError && msg.failedPrompt && (
                <TouchableOpacity
                  style={[
                    styles.retryBtn,
                    {
                      backgroundColor: colors.status.danger.bg,
                      borderColor: colors.status.danger.border,
                    },
                  ]}
                  onPress={() => handleRetry(msg.failedPrompt!)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.retryBtnText, { color: colors.status.danger.text }]}>
                    ↻ Try Again
                  </Text>
                </TouchableOpacity>
              )}

              {/* Calculation Card if present */}
              {msg.responseMeta?.calculation_card && (
                <View
                  style={[
                    styles.calcCard,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.calcCardTitle, { color: colors.textSecondary }]}>
                    {msg.responseMeta.calculation_card.title}
                  </Text>
                  <Text style={[styles.calcCardTotal, { color: colors.primary }]}>
                    {msg.responseMeta.calculation_card.total_formatted}
                  </Text>
                  <View style={styles.calcBreakdown}>
                    {msg.responseMeta.calculation_card.breakdown_notes.map(
                      (note: string, idx: number) => (
                        <Text key={idx} style={[styles.calcNote, { color: colors.textSecondary }]}>
                          • {note}
                        </Text>
                      ),
                    )}
                  </View>
                </View>
              )}

              {/* Source chips */}
              {msg.responseMeta?.source_record_ids &&
                msg.responseMeta.source_record_ids.length > 0 && (
                  <View style={styles.sourcesContainer}>
                    <Text style={[styles.sourcesLabel, { color: colors.textSecondary }]}>
                      Sources:
                    </Text>
                    <View style={styles.sourcesRow}>
                      {msg.responseMeta.source_record_ids.slice(0, 3).map((rId: string) => {
                        const rec = receipts.find((r) => r.id === rId);
                        if (!rec) return null;
                        return (
                          <TouchableOpacity
                            key={rId}
                            style={[
                              styles.sourceChip,
                              {
                                backgroundColor: colors.surface,
                                borderColor: colors.border,
                              },
                            ]}
                            onPress={() => onOpenReceipt(rec)}
                            accessibilityRole="button"
                            accessibilityLabel={`View source receipt: ${rec.merchant || rec.title}`}
                          >
                            <Text
                              style={[styles.sourceChipText, { color: colors.primary }]}
                              numberOfLines={1}
                            >
                              📄 {rec.merchant || rec.title}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
            </View>
          ))}

          {/* Informative Skeleton Loading Placeholder */}
          {isLoading && (
            <View
              style={[
                styles.messageBubble,
                styles.assistantBubble,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.loadingLabel, { color: colors.textSecondary }]}>
                ✨ Analyzing on-device vault records...
              </Text>
              <Skeleton width="90%" height={14} style={{ marginBottom: 6 }} />
              <Skeleton width="70%" height={14} style={{ marginBottom: 6 }} />
              <Skeleton width="40%" height={14} />
            </View>
          )}
        </ScrollView>

        {/* Starter Chips */}
        <View
          style={[
            styles.startersContainer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {STARTER_QUESTIONS.map((q, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.starterChip,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleSendPrompt(q)}
                accessibilityRole="button"
                accessibilityLabel={`Ask: ${q}`}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={[styles.starterChipText, { color: colors.primary }]}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Query Input Box */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          <TextInput
            style={[
              styles.inputField,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            placeholder="Ask about your receipts..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSendPrompt()}
            returnKeyType="send"
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              {
                backgroundColor: colors.primary,
                opacity: !inputText.trim() || isLoading ? 0.45 : 1,
              },
            ]}
            onPress={() => handleSendPrompt()}
            disabled={!inputText.trim() || isLoading}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <Text style={[styles.sendBtnText, { color: colors.primaryFg }]}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  backBtn: {
    minWidth: 54,
    minHeight: 44,
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  titleCol: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  modeBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  privacyPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  privacyIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  privacyText: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    padding: 16,
    paddingBottom: 20,
    gap: 12,
  },
  messageBubble: {
    maxWidth: "84%",
    padding: 14,
    borderRadius: 16,
  },
  userBubble: {
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    fontWeight: "500",
  },
  assistantText: {
    fontWeight: "400",
  },
  retryBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  loadingLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  calcCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  calcCardTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  calcCardTotal: {
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  calcBreakdown: {
    marginTop: 6,
    gap: 2,
  },
  calcNote: {
    fontSize: 11,
    lineHeight: 15,
  },
  sourcesContainer: {
    marginTop: 8,
  },
  sourcesLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  sourcesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  sourceChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 180,
  },
  sourceChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  startersContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  starterChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    minHeight: 34,
    justifyContent: "center",
  },
  starterChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  inputBar: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  inputField: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnText: {
    fontSize: 20,
    fontWeight: "800",
  },
});
