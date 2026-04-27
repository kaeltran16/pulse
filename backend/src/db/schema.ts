import { sqliteTable, integer, text, primaryKey, index } from "drizzle-orm/sqlite-core";

export const imapAccounts = sqliteTable("imap_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  emailAddress: text("email_address").notNull().unique(),
  credentialsCiphertext: text("credentials_ciphertext").notNull(),
  senderAllowlist: text("sender_allowlist").notNull().default("[]"),
  pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(300),
  status: text("status").notNull().default("active"),
  lastPolledAt: integer("last_polled_at"),
  lastError: text("last_error"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const syncedEntries = sqliteTable(
  "synced_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => imapAccounts.id, { onDelete: "cascade" }),
    imapUid: integer("imap_uid").notNull(),
    contentHash: text("content_hash").notNull(),
    cents: integer("cents").notNull(),
    currency: text("currency").notNull(),
    merchant: text("merchant"),
    category: text("category"),
    occurredAt: integer("occurred_at").notNull(),
    recurring: integer("recurring").notNull().default(0),
    rawParseResponse: text("raw_parse_response").notNull(),
    emailSubject: text("email_subject"),
    emailFrom: text("email_from"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    accountCreated: index("idx_synced_entries_account_created").on(t.accountId, t.id),
    accountMerchantOccurred: index("idx_synced_entries_account_merchant_occurred").on(
      t.accountId,
      t.merchant,
      t.occurredAt,
    ),
  }),
);

export const imapUids = sqliteTable(
  "imap_uids",
  {
    accountId: integer("account_id")
      .notNull()
      .references(() => imapAccounts.id, { onDelete: "cascade" }),
    uid: integer("uid").notNull(),
    firstSeenAt: integer("first_seen_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.accountId, t.uid] }),
  }),
);

export type ImapAccount = typeof imapAccounts.$inferSelect;
export type NewImapAccount = typeof imapAccounts.$inferInsert;
export type SyncedEntry = typeof syncedEntries.$inferSelect;
export type NewSyncedEntry = typeof syncedEntries.$inferInsert;
export type ImapUid = typeof imapUids.$inferSelect;
export type NewImapUid = typeof imapUids.$inferInsert;
