import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Profissionais do salão
export const professionals = mysqlTable("professionals", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 30 }),
  specialty: varchar("specialty", { length: 255 }),
  // Comissão padrão do profissional (percentual, ex: 40.00 = 40%)
  defaultCommissionPct: decimal("defaultCommissionPct", { precision: 5, scale: 2 }).default("0.00"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Professional = typeof professionals.$inferSelect;
export type InsertProfessional = typeof professionals.$inferInsert;

// Serviços oferecidos pelo salão
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  durationMinutes: int("durationMinutes").default(60),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  // Comissão padrão do serviço (percentual). Se definida, tem prioridade sobre a do profissional
  defaultCommissionPct: decimal("defaultCommissionPct", { precision: 5, scale: 2 }).default("0.00"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

// Regras de comissão específicas: profissional + serviço (mais específica vence)
export const commissionRules = mysqlTable("commission_rules", {
  id: int("id").autoincrement().primaryKey(),
  professionalId: int("professionalId").notNull(),
  serviceId: int("serviceId"), // null = regra se aplica a todos os serviços deste profissional
  commissionPct: decimal("commissionPct", { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CommissionRule = typeof commissionRules.$inferSelect;
export type InsertCommissionRule = typeof commissionRules.$inferInsert;

// Agendamentos
export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientPhone: varchar("clientPhone", { length: 30 }),
  professionalId: int("professionalId").notNull(),
  serviceId: int("serviceId").notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(), // data + hora do atendimento
  timeSlot: varchar("timeSlot", { length: 5 }), // horário local do usuário ex: "13:00"
  // Valor e comissão são registrados no momento do agendamento/conclusão
  servicePrice: decimal("servicePrice", { precision: 10, scale: 2 }).notNull(),
  commissionPct: decimal("commissionPct", { precision: 5, scale: 2 }).notNull(),
  commissionValue: decimal("commissionValue", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["scheduled", "completed", "cancelled"]).default("scheduled").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;
