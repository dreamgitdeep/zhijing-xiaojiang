import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  uuid,
  boolean,
  integer,
  bigserial,
  jsonb,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    role: text("role").notNull().default("student"),
    name: text("name"),
    student_no: text("student_no"),
    class_name: text("class_name"),
    contact_email: text("contact_email"),
    class_code: text("class_code"),
    account: text("account"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_profiles_class").on(table.class_name)]
);

export const classes = pgTable("classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  invite_code: text("invite_code").notNull().unique(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plants = pgTable(
  "plants",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    latin: text("latin"),
    category: text("category"),
    layer: text("layer"),
    is_warning: boolean("is_warning").notNull().default(false),
    restriction: text("restriction"),
    data: jsonb("data").notNull(),
    sort_order: integer("sort_order").notNull().default(0),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updated_by: uuid("updated_by"),
  },
  (table) => [
    index("idx_plants_layer").on(table.layer),
    index("idx_plants_category").on(table.category),
    index("idx_plants_warning").on(table.is_warning),
    index("idx_plants_updated_at").on(table.updated_at),
    index("idx_plants_data_tags").on(table.data),
  ]
);

export const mastery = pgTable(
  "mastery",
  {
    user_id: uuid("user_id").notNull(),
    plant_id: text("plant_id").notNull(),
    mastered: boolean("mastered").notNull().default(false),
    best_score: integer("best_score").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    manual: boolean("manual").notNull().default(false),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.user_id, table.plant_id] }),
    index("idx_mastery_user").on(table.user_id),
    index("idx_mastery_plant").on(table.plant_id),
  ]
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    user_id: uuid("user_id").notNull(),
    plant_id: text("plant_id").notNull(),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    answers: jsonb("answers"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_attempts_user").on(table.user_id, table.created_at),
    index("idx_attempts_plant").on(table.plant_id),
  ]
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    user_id: uuid("user_id").notNull(),
    plant_id: text("plant_id"),
    role: text("role").notNull(),
    content: text("content").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_chat_user").on(table.user_id, table.created_at),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").notNull(),
    sender_id: uuid("sender_id"),
    type: text("type").notNull().default("design_reminder"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    task_id: text("task_id"),
    link: text("link"),
    read_at: timestamp("read_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_notifications_user_created").on(table.user_id, table.created_at),
  ]
);
