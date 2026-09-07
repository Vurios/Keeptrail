import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from "react-native";
import { colors, spacing, borderRadius, typography } from "../theme/tokens";
import { useLocalVault } from "../vault-context";
import { AssistantResponse, ReceiptRecord } from "@katibay/shared";

interface AskKeeptrailScreenProps {
  onBack: () => void;
  onOpenReceipt: (receipt: ReceiptRecord) => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  responseMeta?: AssistantResponse;
}

export const AskKeeptrailScreen: React.FC<AskKeeptrailScreenProps> = ({
  onBack,
  onOpenReceipt,
}) => {
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

  const STARTER_QUESTIONS = [
    "What did I spend?",
    "Which receipts need review?",
    "Any upcoming deadlines?",
    "How do I back up my receipts?",
  ];

  const handleSendPrompt = async (promptToSend?: string) => {
    const prompt = (promptToSend || inputText).trim();
    if (!prompt || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: "user",
      text: prompt,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsLoading(true);

    try {
      const resp = await queryAssistant(prompt);
      const assistantMsg: ChatMessage = {
        id: `asst_${Date.now()}`,
        sender: "assistant",
        text: resp.answer,
        responseMeta: resp,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `asst_err_${Date.now()}`,
          sender: "assistant",
          text: `Error processing request: ${msg}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹ Back</Text>
          </TouchableOpacity>
          <View style={styles.titleCol}>
            <Text style={styles.headerTitle}>Ask Keeptrail</Text>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>
                Basic Helper • Deterministic Local Engine
              </Text>
            </View>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* Privacy Assurance Pill */}
        <View style={styles.privacyPill}>
          <Text style={styles.privacyIcon}>🔒</Text>
          <Text style={styles.privacyText}>
            100% on-device. No receipts are sent to the cloud or used to train AI.
          </Text>
        </View>

        {/* Message Thread */}
        <ScrollView
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
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  msg.sender === "user" ? styles.userText : styles.assistantText,
                ]}
              >
                {msg.text}
              </Text>

              {/* Calculation Card if present */}
              {msg.responseMeta?.calculation_card && (
                <View style={styles.calcCard}>
                  <Text style={styles.calcCardTitle}>
                    {msg.responseMeta.calculation_card.title}
                  </Text>
                  <Text style={styles.calcCardTotal}>
                    {msg.responseMeta.calculation_card.total_formatted}
                  </Text>
                  <View style={styles.calcBreakdown}>
                    {msg.responseMeta.calculation_card.breakdown_notes.map(
                      (note: string, idx: number) => (
                        <Text key={idx} style={styles.calcNote}>
                          • {note}
                        </Text>
                      )
                    )}
                  </View>
                </View>
              )}

              {/* Source chips */}
              {msg.responseMeta?.source_record_ids &&
                msg.responseMeta.source_record_ids.length > 0 && (
                  <View style={styles.sourcesContainer}>
                    <Text style={styles.sourcesLabel}>Sources:</Text>
                    <View style={styles.sourcesRow}>
                      {msg.responseMeta.source_record_ids.slice(0, 3).map((rId: string) => {
                        const rec = receipts.find((r) => r.id === rId);
                        if (!rec) return null;
                        return (
                          <TouchableOpacity
                            key={rId}
                            style={styles.sourceChip}
                            onPress={() => onOpenReceipt(rec)}
                          >
                            <Text style={styles.sourceChipText} numberOfLines={1}>
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

          {isLoading && (
            <View style={[styles.messageBubble, styles.assistantBubble]}>
              <Text style={styles.assistantText}>
                Analyzing local records...
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Starter Chips */}
        <View style={styles.startersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {STARTER_QUESTIONS.map((q, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.starterChip}
                onPress={() => handleSendPrompt(q)}
              >
                <Text style={styles.starterChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Query Input Box */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.inputField}
            placeholder="Ask about your receipts..."
            placeholderTextColor={colors.brand.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSendPrompt()}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              !inputText.trim() && styles.sendBtnDisabled,
            ]}
            onPress={() => handleSendPrompt()}
            disabled={!inputText.trim() || isLoading}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.brand.background,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  backBtn: {
    paddingVertical: 4,
  },
  backBtnText: {
    ...typography.bodyBold,
    color: colors.brand.primary,
  },
  titleCol: {
    alignItems: "center",
  },
  headerTitle: {
    ...typography.sectionTitle,
    color: colors.brand.textPrimary,
  },
  modeBadge: {
    backgroundColor: colors.brand.surfaceAlt,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
    marginTop: 2,
  },
  modeBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: "700",
    color: colors.brand.primary,
  },
  privacyPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.brand.border,
  },
  privacyIcon: {
    fontSize: 12,
    marginRight: 6,
  },
  privacyText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    flex: 1,
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    padding: spacing.lg,
    paddingBottom: spacing.lg,
  },
  messageBubble: {
    padding: spacing.md,
    borderRadius: borderRadius.card,
    marginBottom: spacing.md,
    maxWidth: "88%",
  },
  userBubble: {
    backgroundColor: colors.brand.primary,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: colors.brand.surface,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.brand.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    ...typography.body,
    lineHeight: 22,
  },
  userText: {
    color: colors.brand.primaryFg,
  },
  assistantText: {
    color: colors.brand.textPrimary,
  },
  calcCard: {
    backgroundColor: colors.brand.surfaceAlt,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.status.success.border,
  },
  calcCardTitle: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  calcCardTotal: {
    ...typography.sectionTitle,
    color: colors.brand.primary,
    marginTop: 2,
  },
  calcBreakdown: {
    marginTop: 6,
  },
  calcNote: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    marginTop: 2,
  },
  sourcesContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  sourcesLabel: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: "600",
    marginBottom: 4,
  },
  sourcesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  sourceChip: {
    backgroundColor: colors.brand.background,
    borderWidth: 1,
    borderColor: colors.brand.border,
    borderRadius: borderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  sourceChipText: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: "600",
  },
  startersContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  starterChip: {
    backgroundColor: colors.brand.surface,
    borderRadius: borderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.brand.border,
    marginRight: spacing.sm,
  },
  starterChipText: {
    ...typography.caption,
    color: colors.brand.textSecondary,
    fontWeight: "600",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.brand.surface,
    borderTopWidth: 1,
    borderTopColor: colors.brand.border,
  },
  inputField: {
    flex: 1,
    backgroundColor: colors.brand.background,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.lg,
    height: 44,
    ...typography.body,
    color: colors.brand.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand.primary,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  sendBtnDisabled: {
    backgroundColor: colors.brand.border,
  },
  sendBtnText: {
    fontSize: 20,
    color: colors.brand.primaryFg,
    fontWeight: "700",
  },
});
