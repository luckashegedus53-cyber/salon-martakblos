import { and, between, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  appointments,
  commissionRules,
  InsertAppointment,
  InsertCommissionRule,
  InsertProfessional,
  InsertService,
  InsertUser,
  professionals,
  services,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0];
}

export async function createLocalUser(data: {
  username: string;
  passwordHash: string;
  name: string;
  role: "admin" | "user";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // openId único para usuários locais
  const openId = `local:${data.username}`;
  await db.insert(users).values({
    openId,
    username: data.username,
    passwordHash: data.passwordHash,
    name: data.name,
    role: data.role,
    loginMethod: "local",
    lastSignedIn: new Date(),
  }).onDuplicateKeyUpdate({
    set: {
      passwordHash: data.passwordHash,
      name: data.name,
      role: data.role,
    },
  });
  return getUserByUsername(data.username);
}

// ─── Professionals ────────────────────────────────────────────────────────────

export async function getProfessionals(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(professionals).where(eq(professionals.active, true)).orderBy(professionals.id);
  }
  return db.select().from(professionals).orderBy(professionals.id);
}

export async function getProfessionalById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(professionals).where(eq(professionals.id, id)).limit(1);
  return result[0];
}

export async function createProfessional(data: InsertProfessional) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(professionals).values(data);
  return result[0];
}

export async function updateProfessional(id: number, data: Partial<InsertProfessional>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(professionals).set(data).where(eq(professionals.id, id));
}

export async function deleteProfessional(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(professionals).set({ active: false }).where(eq(professionals.id, id));
}

// ─── Services ─────────────────────────────────────────────────────────────────

export async function getServices(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  if (activeOnly) {
    return db.select().from(services).where(eq(services.active, true)).orderBy(services.name);
  }
  return db.select().from(services).orderBy(services.name);
}

export async function getServiceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(services).where(eq(services.id, id)).limit(1);
  return result[0];
}

export async function createService(data: InsertService) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(services).values(data);
}

export async function updateService(id: number, data: Partial<InsertService>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(services).set(data).where(eq(services.id, id));
}

export async function deleteService(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(services).set({ active: false }).where(eq(services.id, id));
}

// ─── Commission Rules ─────────────────────────────────────────────────────────

export async function getCommissionRules(professionalId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (professionalId !== undefined) {
    return db
      .select()
      .from(commissionRules)
      .where(eq(commissionRules.professionalId, professionalId));
  }
  return db.select().from(commissionRules);
}

export async function upsertCommissionRule(data: InsertCommissionRule) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // If serviceId is null, it's a general rule for the professional
  const profCondition = data.professionalId != null
    ? eq(commissionRules.professionalId, data.professionalId)
    : isNull(commissionRules.professionalId);
  const existing = await db
    .select()
    .from(commissionRules)
    .where(
      and(
        profCondition,
        data.serviceId != null
          ? eq(commissionRules.serviceId, data.serviceId)
          : isNull(commissionRules.serviceId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(commissionRules)
      .set({ commissionPct: data.commissionPct })
      .where(eq(commissionRules.id, existing[0]!.id));
  } else {
    await db.insert(commissionRules).values(data);
  }
}

export async function deleteCommissionRule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(commissionRules).where(eq(commissionRules.id, id));
}

/**
 * Resolve commission percentage for a given professional + service.
 * Priority: specific rule (prof+service) > general rule (prof only) > service default > professional default
 */
export async function resolveCommissionPct(professionalId: number, serviceId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  // 1. Specific rule for this professional + service
  const specific = await db
    .select()
    .from(commissionRules)
    .where(
      and(
        eq(commissionRules.professionalId, professionalId),
        eq(commissionRules.serviceId, serviceId)
      )
    )
    .limit(1);
  if (specific.length > 0) return Number(specific[0]!.commissionPct);

  // 2. General rule for this professional (serviceId IS NULL)
  const general = await db
    .select()
    .from(commissionRules)
    .where(
      and(
        eq(commissionRules.professionalId, professionalId),
        isNull(commissionRules.serviceId)
      )
    )
    .limit(1);
  if (general.length > 0) return Number(general[0]!.commissionPct);

  // 3. Service default commission
  const svc = await db.select().from(services).where(eq(services.id, serviceId)).limit(1);
  if (svc.length > 0 && Number(svc[0]!.defaultCommissionPct) > 0) {
    return Number(svc[0]!.defaultCommissionPct);
  }

  // 4. Professional default commission
  const prof = await db.select().from(professionals).where(eq(professionals.id, professionalId)).limit(1);
  if (prof.length > 0) return Number(prof[0]!.defaultCommissionPct);

  return 0;
}

// ─── Appointments ─────────────────────────────────────────────────────────────

export async function getAppointments(filters?: {
  professionalId?: number;
  startDate?: Date;
  endDate?: Date;
  status?: "scheduled" | "completed" | "cancelled";
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (filters?.professionalId) {
    conditions.push(eq(appointments.professionalId, filters.professionalId));
  }
  if (filters?.startDate && filters?.endDate) {
    conditions.push(between(appointments.scheduledAt, filters.startDate, filters.endDate));
  } else if (filters?.startDate) {
    conditions.push(gte(appointments.scheduledAt, filters.startDate));
  } else if (filters?.endDate) {
    conditions.push(lte(appointments.scheduledAt, filters.endDate));
  }
  if (filters?.status) {
    conditions.push(eq(appointments.status, filters.status));
  }

  const rows = conditions.length > 0
    ? await db.select().from(appointments).where(and(...conditions)).orderBy(appointments.scheduledAt)
    : await db.select().from(appointments).orderBy(appointments.scheduledAt);

  return rows;
}

export async function getAppointmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  return result[0];
}

export async function createAppointment(data: InsertAppointment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(appointments).values(data);
}

export async function updateAppointmentStatus(
  id: number,
  status: "scheduled" | "completed" | "cancelled"
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(appointments).set({ status }).where(eq(appointments.id, id));
}

export async function updateAppointment(id: number, data: Partial<InsertAppointment>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  // Never allow deletion — only status changes
  const { ...safeData } = data;
  await db.update(appointments).set(safeData).where(eq(appointments.id, id));
}

// ─── Financial Dashboard ──────────────────────────────────────────────────────

export interface FinancialSummary {
  totalRevenue: number;
  totalCommission: number;
  appointmentCount: number;
  byProfessional: {
    professionalId: number;
    professionalName: string;
    revenue: number;
    commission: number;
    count: number;
  }[];
}

export async function getAllProfessionalsWithCommissions(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];

  // Buscar todas as profissionais
  const allProfs = await db.select().from(professionals).orderBy(professionals.name);

  // Buscar atendimentos concluídos no período
  const rows = await db
    .select({
      professionalId: appointments.professionalId,
      servicePrice: appointments.servicePrice,
      commissionValue: appointments.commissionValue,
    })
    .from(appointments)
    .where(
      and(
        between(appointments.scheduledAt, startDate, endDate),
        eq(appointments.status, "completed")
      )
    );

  // Agrupar por profissional
  const byProf: Record<number, { revenue: number; commission: number; count: number }> = {};
  for (const row of rows) {
    const profId = row.professionalId;
    if (!byProf[profId]) byProf[profId] = { revenue: 0, commission: 0, count: 0 };
    byProf[profId]!.revenue += Number(row.servicePrice);
    byProf[profId]!.commission += Number(row.commissionValue);
    byProf[profId]!.count += 1;
  }

  // Retornar todas as profissionais, mesmo as com zero atendimentos
  return allProfs.map((prof) => ({
    professionalId: prof.id,
    professionalName: prof.name,
    specialty: prof.specialty ?? "",
    revenue: byProf[prof.id]?.revenue ?? 0,
    commission: byProf[prof.id]?.commission ?? 0,
    count: byProf[prof.id]?.count ?? 0,
  }));
}

export async function getFinancialSummary(startDate: Date, endDate: Date): Promise<FinancialSummary> {
  const db = await getDb();
  if (!db) {
    return { totalRevenue: 0, totalCommission: 0, appointmentCount: 0, byProfessional: [] };
  }

  const rows = await db
    .select({
      id: appointments.id,
      professionalId: appointments.professionalId,
      servicePrice: appointments.servicePrice,
      commissionValue: appointments.commissionValue,
      status: appointments.status,
      professionalName: professionals.name,
    })
    .from(appointments)
    .leftJoin(professionals, eq(appointments.professionalId, professionals.id))
    .where(
      and(
        between(appointments.scheduledAt, startDate, endDate),
        eq(appointments.status, "completed")
      )
    );

  let totalRevenue = 0;
  let totalCommission = 0;
  const byProf: Record<number, { professionalId: number; professionalName: string; revenue: number; commission: number; count: number }> = {};

  for (const row of rows) {
    const price = Number(row.servicePrice);
    const commission = Number(row.commissionValue);
    totalRevenue += price;
    totalCommission += commission;

    const profId = row.professionalId;
    if (!byProf[profId]) {
      byProf[profId] = {
        professionalId: profId,
        professionalName: row.professionalName ?? "Desconhecido",
        revenue: 0,
        commission: 0,
        count: 0,
      };
    }
    byProf[profId]!.revenue += price;
    byProf[profId]!.commission += commission;
    byProf[profId]!.count += 1;
  }

  return {
    totalRevenue,
    totalCommission,
    appointmentCount: rows.length,
    byProfessional: Object.values(byProf),
  };
}
