/**
 * Ask Keeptrail.
 *
 * This build ships no neural model, so the engine runs its deterministic path
 * and the screen says which mode it is in — permitted by blueprint §5, which
 * requires the Basic Helper be labelled honestly and never marketed as a
 * generative chatbot.
 *
 * Two copy changes matter as much as the styling. The opening line no longer
 * claims "I am your local assistant" over a keyword router, and the loading
 * state no longer says "Analyzing" with a sparkle. Both described a model that
 * is not there.
 *
 * Numbers on this screen come from `calculateReceiptTotals` over the whole
 * matching set, rendered as a structured card — never parsed out of generated
 * text.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
  type ListRenderItemInfo,
  type TextStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AssistantResponse, ReceiptRecord } from "@katibay/shared";

import { useTheme } from "../theme/ThemeContext";
import { useLocalVault } from "../vault-context";
import {
  AppBar,
  AppText,
  Button,
  Card,
  Chip,
  IconButton,
  Money,
  Notice,
  StatusBadge,
} from "../components/primitives";
import { Icon } from "../components/Icon";
import { haptics } from "../utils/haptics";

const STARTER_QUESTIONS = [
  "What have I recorded so far?",
  "Which receipts still need an amount?",
  "What deadlines are coming up?",
  "How do I back up my receipts?",
];

interface AskKeeptrailScreenProps {
  onBack: () => void;
  onOpenReceipt: (receipt: ReceiptRecord) => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  meta?: AssistantResponse;
  error?: { message: string; prompt: string };
}

const INTRO: ChatMessage = {
  id: "intro",
  sender: "assistant",
  // Says what it does, and what it is not.
  text: "I can look through the receipts saved on this phone, add up what you have recorded, and explain how the app works.\n\nI am a rule-based helper, not a chatbot — I answer a fixed set of questions and every total is calculated by the app, not written by a language model.",
};

export function AskKeeptrailScreen({ onBack, onOpenReceipt }: AskKeeptrailScreenProps) {
  const { colors, spacing, radius, typography, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { queryAssistant, vault, receipts } = useLocalVault();

  const [messages, setMessages] = useState<ChatMessage[]>([INTRO]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: !reduceMotion }));
  }, [reduceMotion]);

  const send = useCallback(
    async (raw?: string) => {
      const prompt = (raw ?? input).trim();
      if (!prompt || busy) return;

      haptics.tap();
      setMessages((current) => [
        ...current,
        { id: `user_${Date.now()}`, sender: "user", text: prompt },
      ]);
      setInput("");
      setBusy(true);
      scrollToEnd();

      try {
        const response = await queryAssistant(prompt);
        haptics.success();
        setMessages((current) => [
          ...current,
          {
            id: `assistant_${Date.now()}`,
            sender: "assistant",
            text: response.answer,
            meta: response,
          },
        ]);
      } catch (error) {
        haptics.error();
        setMessages((current) => [
          ...current,
          {
            id: `error_${Date.now()}`,
            sender: "assistant",
            text: "",
            error: {
              message: error instanceof Error ? error.message : String(error),
              prompt,
            },
          },
        ]);
      } finally {
        setBusy(false);
        scrollToEnd();
      }
    },
    [input, busy, queryAssistant, scrollToEnd],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChatMessage>) => {
      if (item.sender === "user") {
        return (
          <View style={{ alignItems: "flex-end", marginBottom: spacing.md }}>
            <View
              style={{
                maxWidth: "85%",
                backgroundColor: colors.primaryContainer,
                borderRadius: radius.card,
                borderTopRightRadius: radius.sm,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
              }}
            >
              <AppText
                role="body"
                style={{ color: colors.onPrimaryContainer }}
                accessibilityLabel={`You asked: ${item.text}`}
              >
                {item.text}
              </AppText>
            </View>
          </View>
        );
      }

      if (item.error) {
        return (
          <View style={{ marginBottom: spacing.md }}>
            <Notice
              tone="danger"
              icon="error"
              title="That question could not be answered"
              body={item.error.message}
              action={
                <View style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}>
                  <Button
                    label="Try again"
                    variant="tonal"
                    icon="retry"
                    onPress={() => send(item.error!.prompt)}
                  />
                </View>
              }
            />
          </View>
        );
      }

      const card = item.meta?.calculation_card;
      const sources = item.meta?.source_record_ids ?? [];

      return (
        <View style={{ marginBottom: spacing.md, gap: spacing.sm, maxWidth: "95%" }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.card,
              borderTopLeftRadius: radius.sm,
              borderWidth: 1,
              borderColor: colors.divider,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
            }}
          >
            <AppText role="body" accessibilityLabel={`Keeptrail answered: ${item.text}`}>
              {item.text}
            </AppText>
          </View>

          {/* The number is rendered from the structured result, so what the
              user reads is the value the app computed. */}
          {card ? (
            <Card>
              <AppText role="label" tone="muted">
                {card.title.toUpperCase()}
              </AppText>
              <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                <Money formatted={card.total_formatted} size="headline" tone="accent" />
                <AppText role="small" tone="secondary">
                  {card.count} record{card.count === 1 ? "" : "s"} · {card.currency}
                </AppText>
                {card.breakdown_notes.map((note) => (
                  <AppText key={note} role="small" tone="muted">
                    {note}
                  </AppText>
                ))}
              </View>
              <View style={{ marginTop: spacing.md }}>
                <AppText role="small" tone="muted">
                  Calculated by the app from your saved records.
                </AppText>
              </View>
            </Card>
          ) : null}

          {sources.length > 0 ? (
            <View style={{ gap: spacing.xs }}>
              <AppText role="label" tone="muted">
                RECEIPTS USED
              </AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {sources.slice(0, 6).map((id) => {
                  // Every referenced id is resolved against the vault before it
                  // is shown, so an unknown id renders nothing rather than a
                  // dead chip.
                  const receipt = vault.getReceipt(id);
                  if (!receipt) return null;
                  return (
                    <Chip
                      key={id}
                      label={receipt.merchant ?? receipt.title}
                      selected={false}
                      onPress={() => onOpenReceipt(receipt)}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      );
    },
    [colors, spacing, radius, send, vault, onOpenReceipt],
  );

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const modeLabel = useMemo(
    () => messages.find((m) => m.meta)?.meta?.model_label ?? "Basic Helper",
    [messages],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppBar
        title="Ask Keeptrail"
        subtitle={`${modeLabel} · runs entirely on this phone`}
        onBack={onBack}
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.gutter, paddingBottom: spacing.xl }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={9}
          removeClippedSubviews
          onContentSizeChange={scrollToEnd}
          ListHeaderComponent={
            receipts.length === 0 ? (
              <View style={{ marginBottom: spacing.md }}>
                <Notice
                  tone="neutral"
                  icon="info"
                  body="You have no saved receipts yet, so there is nothing for me to search. I can still answer questions about how the app works."
                />
              </View>
            ) : null
          }
          ListFooterComponent={
            busy ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.sm,
                  paddingVertical: spacing.md,
                }}
                accessibilityLiveRegion="polite"
              >
                <ActivityIndicator size="small" color={colors.primary} />
                <AppText role="small" tone="secondary">
                  Searching your saved records…
                </AppText>
              </View>
            ) : null
          }
        />

        {messages.length <= 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: spacing.sm,
              paddingHorizontal: spacing.gutter,
              paddingBottom: spacing.md,
            }}
          >
            {STARTER_QUESTIONS.map((question) => (
              <Chip
                key={question}
                label={question}
                selected={false}
                onPress={() => send(question)}
              />
            ))}
          </ScrollView>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            gap: spacing.sm,
            paddingHorizontal: spacing.gutter,
            paddingTop: spacing.sm,
            paddingBottom: spacing.lg + insets.bottom,
            borderTopWidth: 1,
            borderTopColor: colors.divider,
            backgroundColor: colors.surface,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your receipts"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Ask a question about your receipts"
            multiline
            onSubmitEditing={() => send()}
            style={[
              typography.body as TextStyle,
              {
                flex: 1,
                color: colors.textPrimary,
                borderWidth: 1.5,
                borderColor: colors.outline,
                borderRadius: radius.control,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                minHeight: spacing.touch,
                maxHeight: typography.body.lineHeight * 5,
              },
            ]}
          />
          <IconButton
            icon="send"
            tone="primary"
            label="Send question"
            onPress={() => send()}
            disabled={busy || input.trim().length === 0}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
