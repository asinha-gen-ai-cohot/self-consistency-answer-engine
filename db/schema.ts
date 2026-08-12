import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const rateLimitWindows = sqliteTable("rate_limit_windows", {
  clientKey: text("client_key").primaryKey(),
  runId: text("run_id").notNull(),
  windowStartedAt: integer("window_started_at").notNull(),
});

export const rateLimitCalls = sqliteTable(
  "rate_limit_calls",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: text("run_id").notNull(),
    step: text("step").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [uniqueIndex("idx_rate_limit_calls_run_step").on(table.runId, table.step)],
);
