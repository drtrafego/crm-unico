import { pgTable, text, timestamp, uuid, pgEnum, integer, decimal, primaryKey, boolean } from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";

// --- Auth Tables ---

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (verificationToken) => ({
    compositePk: primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  })
);

// --- Multi-tenant Tables ---

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()), // Changed to text to match potential legacy or generic use
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const members = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").notNull(), // Removed FK strict constraint for flexibility
  role: text("role").$type<'owner' | 'admin' | 'editor' | 'viewer'>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  organizationId: text("organization_id").notNull(),
  role: text("role").$type<'admin' | 'editor' | 'viewer'>().default('viewer').notNull(),
  status: text("status").$type<'pending' | 'accepted'>().default('pending').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leadHistory = pgTable("lead_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }).notNull(),
  action: text("action").notNull(), // 'create', 'move', 'update'
  fromColumn: text("from_column"),
  toColumn: text("to_column"),
  userId: text("user_id"), // Optional, as system actions (webhooks) might not have a user
  details: text("details"), // JSON string or text description
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Existing Tables Refactored ---

export const columns = pgTable("columns", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  order: integer("order").notNull().default(0),
  organizationId: text("organization_id").notNull(), // Reverted to text, removed FK
  color: text("color"),
});

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  company: text("company"),
  email: text("email"),
  whatsapp: text("whatsapp"),
  campaignSource: text("campaign_source"),
  status: text("status").notNull(),
  columnId: uuid("column_id").references(() => columns.id),
  position: integer("position").default(0).notNull(),
  organizationId: text("organization_id").notNull(), // Reverted to text, removed FK
  notes: text("notes"),
  value: decimal("value", { precision: 10, scale: 2 }),
  followUpDate: timestamp("follow_up_date"),
  followUpNote: text("follow_up_note"),
  firstContactAt: timestamp("first_contact_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  pagePath: text("page_path"),
});

export const settings = pgTable("settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id").notNull().unique(), // Reverted to text, removed FK
  companyName: text("company_name"),
  email: text("email"),
  viewMode: text("view_mode").default('kanban'),
});

export type Organization = typeof organizations.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Column = typeof columns.$inferSelect;
export type Settings = typeof settings.$inferSelect;

