import { pgTable, text, timestamp, uuid, pgEnum, integer, decimal, primaryKey, boolean, jsonb } from "drizzle-orm/pg-core";


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



// --- Multi-tenant Tables ---

export const organizations = pgTable("organizations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  features: jsonb("features").$type<{
    hasLaunchDashboard?: boolean;
    launchSheetId?: string;
    launchSheetTabName?: string;
    studentsSheetId?: string;
    studentsSheetTabName?: string;
  }>(),
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
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
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

// --- Launch Leads Table ---

export const launchLeads = pgTable("launch_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id").notNull(),
  formName: text("form_name").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  whatsapp: text("whatsapp"),
  formData: jsonb("form_data"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type LaunchLead = typeof launchLeads.$inferSelect;
export type NewLaunchLead = typeof launchLeads.$inferInsert;

// --- Vendas Hotmart Table ---

export const vendasHotmart = pgTable("vendas_hotmart", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id").notNull(),
  transaction: text("transaction").notNull(),
  status: text("status").notNull(),
  paymentType: text("payment_type"),
  currency: text("currency"),
  price: decimal("price", { precision: 12, scale: 2 }),
  buyerEmail: text("buyer_email").notNull(),
  buyerName: text("buyer_name"),
  buyerPhone: text("buyer_phone"),
  productId: text("product_id"),
  productName: text("product_name"),
  productOffer: text("product_offer"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  city: text("city"),
  state: text("state"),
  sck: text("sck"),
  scr: text("scr"),
  purchaseDate: timestamp("purchase_date"),
  approvedDate: timestamp("approved_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type VendaHotmart = typeof vendasHotmart.$inferSelect;
export type NewVendaHotmart = typeof vendasHotmart.$inferInsert;

// --- Meta Integrations Table ---
// Mapeia contas de anúncio Meta → organizações no CRM
// Permite rotear webhooks do WhatsApp/Instagram para o cliente certo

export const metaIntegrations = pgTable("meta_integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: text("organization_id").notNull(),
  adAccountId: text("ad_account_id").notNull(), // ex: "act_123456789" ou "123456789"
  wabaId: text("waba_id"), // WhatsApp Business Account ID (entry[].id no webhook)
  phoneNumberId: text("phone_number_id"), // Phone Number ID (metadata.phone_number_id no webhook)
  igAccountId: text("ig_account_id"), // Instagram Account ID (entry[].id no webhook IG)
  displayPhone: text("display_phone"), // Número formatado para exibição (ex: +55 11 99999-9999)
  accountName: text("account_name"), // Nome da conta para exibição
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MetaIntegration = typeof metaIntegrations.$inferSelect;
export type NewMetaIntegration = typeof metaIntegrations.$inferInsert;
