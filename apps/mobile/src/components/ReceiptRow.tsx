/**
 * One receipt in a list.
 *
 * Memoised and given stable styles, because the previous inline row allocated
 * five style arrays per render and re-rendered every visible row on every
 * keystroke in the filter box.
 *
 * The row reads left to right as merchant, then why it was kept, then when —
 * with the amount held right on the tabular baseline so a column of records
 * scans like a statement.
 */

import React, { memo } from "react";
import { View } from "react-native";
import { formatMoney, type ReceiptRecord } from "@katibay/shared";
import { useTheme } from "../theme/ThemeContext";
import { AppText, Card, Money, StatusBadge } from "./primitives";
import { Icon } from "./Icon";
import { formatDate } from "../utils/dates";

interface ReceiptRowProps {
  receipt: ReceiptRecord;
  onPress: (receipt: ReceiptRecord) => void;
  /** Shows Restore/Delete affordances instead of the review badge. */
  trashed?: boolean;
  hasAttachment?: boolean;
}

function ReceiptRowComponent({ receipt, onPress, trashed, hasAttachment }: ReceiptRowProps) {
  const { colors, spacing } = useTheme();

  const amount = formatMoney(receipt.total_minor_units, receipt.currency);
  const unknownAmount = receipt.total_minor_units === null;
  const title = receipt.merchant?.trim() || receipt.title?.trim() || "Untitled receipt";

  return (
    <Card
      onPress={() => onPress(receipt)}
      accessibilityLabel={`${title}, ${unknownAmount ? "amount unknown" : amount}, ${formatDate(
        receipt.transaction_date,
      )}`}
      accessibilityHint="Opens the receipt to view or edit its details"
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <AppText role="bodyStrong" numberOfLines={1}>
            {title}
          </AppText>

          {receipt.purpose ? (
            <AppText role="small" tone="secondary" numberOfLines={1}>
              {receipt.purpose}
            </AppText>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              marginTop: spacing.xxs,
            }}
          >
            <AppText role="small" tone="muted">
              {formatDate(receipt.transaction_date)}
            </AppText>
            {hasAttachment ? (
              <Icon
                name="attachment"
                size={14}
                color={colors.textMuted}
                label="Has an attachment"
              />
            ) : null}
          </View>
        </View>

        <View style={{ alignItems: "flex-end", gap: spacing.sm }}>
          {unknownAmount ? (
            <AppText role="small" tone="muted">
              Amount unknown
            </AppText>
          ) : (
            <Money formatted={amount} />
          )}

          {trashed ? (
            <StatusBadge label="In trash" tone="danger" icon="trash" />
          ) : receipt.review_status === "unreviewed" ? (
            <StatusBadge label="Needs review" tone="warning" icon="needsReview" />
          ) : receipt.review_status === "needs_attention" ? (
            <StatusBadge label="Check this" tone="danger" icon="warning" />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

export const ReceiptRow = memo(ReceiptRowComponent);
