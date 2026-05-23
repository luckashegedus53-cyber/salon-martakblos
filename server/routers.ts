import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import {
  createAppointment,
  createAppointmentWithServices,
  createLocalUser,
  createProfessional,
  createService,
  deleteCommissionRule,
  deleteProfessional,
  deleteService,
  getAppointmentById,
  getAppointmentServices,
  getAppointmentServicesForMany,
  getAppointments,
  getCommissionRules,
  getAllProfessionalsWithCommissions,
  getDailyAppointmentsWithDetails,
  getFinancialSummary,
  getProfessionalById,
  getProfessionals,
  getServiceById,
  getServices,
  getUserByUsername,
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  getTomorrowReminders,
  createAccessLog,
  getLastAccessPerUser,
  replaceAppointmentServices,
  resolveCommissionPct,
  updateAppointment,
  updateAppointmentCommission,
  updateAppointmentServicePrice,
  updateAppointmentStatus,
  updateProfessional,
  updateService,
  upsertCommissionRule,
} from "./db";

// Admin-only middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito ao administrador." });
  }
  return next({ ctx });
});

// ─── Professionals Router ─────────────────────────────────────────────────────
const professionalsRouter = router({
  list: protectedProcedure
    .input(z.object({ activeOnly: z.boolean().optional().default(true) }))
    .query(({ input }) => getProfessionals(input.activeOnly)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getProfessionalById(input.id)),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email().optional().nullable(),
        phone: z.string().optional().nullable(),
        specialty: z.string().optional().nullable(),
        defaultCommissionPct: z.string().optional().default("0.00"),
      })
    )
    .mutation(({ input }) => createProfessional(input)),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional().nullable(),
        phone: z.string().optional().nullable(),
        specialty: z.string().optional().nullable(),
        defaultCommissionPct: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateProfessional(id, data);
    }),

  deactivate: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteProfessional(input.id)),
});

// ─── Services Router ──────────────────────────────────────────────────────────
const servicesRouter = router({
  list: protectedProcedure
    .input(z.object({ activeOnly: z.boolean().optional().default(true) }))
    .query(({ input }) => getServices(input.activeOnly)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getServiceById(input.id)),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional().nullable(),
        durationMinutes: z.number().optional().default(60),
        price: z.string(),
        defaultCommissionPct: z.string().optional().default("0.00"),
      })
    )
    .mutation(({ input }) => createService(input)),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        durationMinutes: z.number().optional(),
        price: z.string().optional(),
        defaultCommissionPct: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...data } = input;
      return updateService(id, data);
    }),

  deactivate: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteService(input.id)),
});

// ─── Commission Rules Router ──────────────────────────────────────────────────
const commissionRouter = router({
  list: adminProcedure
    .input(z.object({ professionalId: z.number().optional() }))
    .query(({ input }) => getCommissionRules(input.professionalId)),

  upsert: adminProcedure
    .input(
      z.object({
        professionalId: z.number(),
        serviceId: z.number().optional().nullable(),
        commissionPct: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Salva a regra
      await upsertCommissionRule(input);
      // Recalcula agendamentos existentes afetados pela regra
      const db = await import('./db');
      const pct = Number(input.commissionPct);
      // Buscar agendamentos do profissional (não cancelados)
      const appts = await db.getAppointments({
        professionalId: input.professionalId,
      });
      let recalculated = 0;
      for (const appt of appts) {
        if (appt.status === 'cancelled') continue;
        // Se a regra é específica por serviço, recalcular apenas os desse serviço
        if (input.serviceId != null && appt.serviceId !== input.serviceId) continue;
        // Recalcular com o novo percentual
        const newPct = await resolveCommissionPct(input.professionalId, appt.serviceId);
        const newValue = Math.round(Number(appt.servicePrice) * newPct / 100 * 100) / 100;
        await db.updateAppointmentCommission(appt.id, newPct, newValue);
        recalculated++;
      }
      return { success: true, recalculated };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteCommissionRule(input.id)),

  resolve: protectedProcedure
    .input(z.object({ professionalId: z.number(), serviceId: z.number() }))
    .query(({ input }) => resolveCommissionPct(input.professionalId, input.serviceId)),
});

// ─── Appointments Router ──────────────────────────────────────────────────────
const appointmentsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        professionalId: z.number().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
      })
    )
    .query(({ input }) => getAppointments(input)),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getAppointmentById(input.id)),

  create: protectedProcedure
    .input(
      z.object({
        clientName: z.string().min(1),
        clientPhone: z.string().optional().nullable(),
        professionalId: z.number(),
        // Suporte a múltiplos serviços
        services: z.array(
          z.object({
            serviceId: z.number(),
            price: z.number().min(0).max(999999.99), // valor editável por serviço (0 permitido para Almoço, Fechado, etc)
          })
        ).min(1),
        scheduledAt: z.date(),
        timeSlot: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      // Resolver comissões e nomes para cada serviço
      const svcItems = [];
      let totalPrice = 0;
      let totalCommission = 0;
      let avgCommissionPct = 0;
      const primaryServiceId = input.services[0]!.serviceId;

      for (const svcInput of input.services) {
        const service = await getServiceById(svcInput.serviceId);
        if (!service) throw new TRPCError({ code: "NOT_FOUND", message: `Serviço ${svcInput.serviceId} não encontrado.` });
        const commissionPct = await resolveCommissionPct(input.professionalId, svcInput.serviceId);
        const commissionValue = Math.round((svcInput.price * commissionPct) / 100 * 100) / 100;
        totalPrice += svcInput.price;
        totalCommission += commissionValue;
        svcItems.push({
          serviceId: svcInput.serviceId,
          serviceName: service.name,
          price: String(Math.round(svcInput.price * 100) / 100),
          commissionPct: String(commissionPct),
          commissionValue: String(commissionValue),
          appointmentId: 0, // será sobrescrito
        });
      }
      avgCommissionPct = totalPrice > 0 ? (totalCommission / totalPrice) * 100 : 0;
      const servicesLabel = svcItems.map((s) => s.serviceName).join(" + ");
      await createAppointmentWithServices(
        {
          clientName: input.clientName,
          clientPhone: input.clientPhone ?? null,
          professionalId: input.professionalId,
          serviceId: primaryServiceId,
          scheduledAt: input.scheduledAt,
          timeSlot: input.timeSlot ?? null,
          notes: input.notes ?? null,
          servicePrice: String(Math.round(totalPrice * 100) / 100),
          commissionPct: String(Math.round(avgCommissionPct * 100) / 100),
          commissionValue: String(Math.round(totalCommission * 100) / 100),
        },
        svcItems
      );
      return { success: true, servicesLabel };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["scheduled", "completed", "cancelled"]),
      })
    )
    .mutation(({ input }) => updateAppointmentStatus(input.id, input.status)),

  // Retorna os serviços filhos de um agendamento (múltiplos serviços)
  getServices: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getAppointmentServices(input.id)),

  updateServicePrice: adminProcedure
    .input(
      z.object({
        id: z.number(),
        servicePrice: z.number().min(0).max(999999.99),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await getAppointmentById(input.id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Agendamento não encontrado." });
      const commissionPct = Number(existing.commissionPct);
      await updateAppointmentServicePrice(input.id, input.servicePrice, commissionPct);
      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        clientName: z.string().min(1).optional(),
        clientPhone: z.string().optional().nullable(),
        professionalId: z.number().optional(),
        serviceId: z.number().optional(),
        scheduledAt: z.date().optional(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      // Recalculate commission if service or professional changed
      if (data.serviceId || data.professionalId) {
        const existing = await getAppointmentById(id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

        const professionalId = data.professionalId ?? existing.professionalId;
        const serviceId = data.serviceId ?? existing.serviceId;
        const service = await getServiceById(serviceId);
        if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Serviço não encontrado." });

        const commissionPct = await resolveCommissionPct(professionalId, serviceId);
        const servicePrice = Number(service.price);
        const commissionValue = Math.round(servicePrice * commissionPct / 100 * 100) / 100;
        await updateAppointment(id, {
          ...data,
          servicePrice: String(servicePrice),
          commissionPct: String(commissionPct),
          commissionValue: String(commissionValue),
        });
      } else {
        await updateAppointment(id, data);
      }
      return { success: true };
    }),
});

// ─── Financial Router (Admin only) ───────────────────────────────────────────
const financialRouter = router({
  summary: adminProcedure
    .input(z.object({ startDate: z.date(), endDate: z.date() }))
    .query(({ input }) => getFinancialSummary(input.startDate, input.endDate)),

  daily: adminProcedure.query(() => {
    // Usar UTC-3 (horário de Brasília) para calcular o dia atual
    const nowUTC = new Date();
    const BRT_OFFSET = -3 * 60 * 60 * 1000; // UTC-3 em ms
    const nowBRT = new Date(nowUTC.getTime() + BRT_OFFSET);
    const y = nowBRT.getUTCFullYear(), mo = nowBRT.getUTCMonth(), d = nowBRT.getUTCDate();
    // start = início do dia BRT em UTC
    const start = new Date(Date.UTC(y, mo, d, 3, 0, 0)); // 00:00 BRT = 03:00 UTC
    const end = new Date(Date.UTC(y, mo, d + 1, 2, 59, 59)); // 23:59 BRT = 02:59 UTC do dia seguinte
    return getFinancialSummary(start, end);
  }),
  weekly: adminProcedure.query(() => {
    const nowUTC = new Date();
    const BRT_OFFSET = -3 * 60 * 60 * 1000;
    const nowBRT = new Date(nowUTC.getTime() + BRT_OFFSET);
    const day = nowBRT.getUTCDay();
    const y = nowBRT.getUTCFullYear(), mo = nowBRT.getUTCMonth(), d = nowBRT.getUTCDate();
    const startDay = d - day;
    const start = new Date(Date.UTC(y, mo, startDay, 3, 0, 0));
    const end = new Date(Date.UTC(y, mo, startDay + 7, 2, 59, 59));
    return getFinancialSummary(start, end);
  }),
  monthly: adminProcedure.query(() => {
    const nowUTC = new Date();
    const BRT_OFFSET = -3 * 60 * 60 * 1000;
    const nowBRT = new Date(nowUTC.getTime() + BRT_OFFSET);
    const y = nowBRT.getUTCFullYear(), mo = nowBRT.getUTCMonth();
    const start = new Date(Date.UTC(y, mo, 1, 3, 0, 0));
    const end = new Date(Date.UTC(y, mo + 1, 1, 2, 59, 59));
    return getFinancialSummary(start, end);
  }),

  commissions: adminProcedure
    .input(z.object({ startDate: z.date(), endDate: z.date() }))
    .query(({ input }) => getAllProfessionalsWithCommissions(input.startDate, input.endDate)),

  dailyAppointments: adminProcedure.query(() => {
    const nowUTC = new Date();
    const BRT_OFFSET = -3 * 60 * 60 * 1000;
    const nowBRT = new Date(nowUTC.getTime() + BRT_OFFSET);
    const y = nowBRT.getUTCFullYear(), mo = nowBRT.getUTCMonth(), d = nowBRT.getUTCDate();
    const start = new Date(Date.UTC(y, mo, d, 3, 0, 0)); // 00:00 BRT = 03:00 UTC
    const end = new Date(Date.UTC(y, mo, d + 1, 2, 59, 59)); // 23:59 BRT
    return getDailyAppointmentsWithDetails(start, end);
  }),
});

// ─── Auth Router (login próprio com usuário + senha) ────────────────────────────
const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),

  login: publicProcedure
    .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserByUsername(input.username.toLowerCase().trim());
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos." });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos." });
      }
      // Criar sessão JWT reutilizando o sdk existente
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name || user.username || "",
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      // Registrar log de acesso
      const ip = (ctx.req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || ctx.req.socket?.remoteAddress || "unknown";
      const userAgent = ctx.req.headers["user-agent"] || "";
      createAccessLog({ userId: user.id, userName: user.username || user.name || "", role: user.role, ip, userAgent }).catch(() => {});
      return { success: true, user: { id: user.id, name: user.name, role: user.role } };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

// ─── Reminders Router ───────────────────────────────────────────────────────
const remindersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return getReminders();
  }),
  tomorrow: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return getTomorrowReminders();
  }),
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      reminderDate: z.string(), // ISO string
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await createReminder({
        title: input.title,
        description: input.description,
        reminderDate: new Date(input.reminderDate),
      });
      return { success: true };
    }),
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      reminderDate: z.string().optional(),
      done: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await updateReminder(input.id, {
        title: input.title,
        description: input.description,
        reminderDate: input.reminderDate ? new Date(input.reminderDate) : undefined,
        done: input.done,
      });
      return { success: true };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      await deleteReminder(input.id);
      return { success: true };
    }),
});

// ─── Logs Router ───────────────────────────────────────────────────────────
const logsRouter = router({
  lastAccess: adminProcedure.query(async () => {
    return getLastAccessPerUser();
  }),
});

// ─── Setup Router (endpoint temporário para inicializar produção) ─────────────────
const setupRouter = router({
  initProd: publicProcedure
    .input(z.object({ secret: z.string() }))
    .mutation(async ({ input }) => {
      if (input.secret !== "KBLOS_SETUP_2026") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Invalid secret" });
      }
      const mysql = await import("mysql2/promise");
      const conn = await mysql.default.createConnection(process.env.DATABASE_URL!);
      const results: string[] = [];
      try {
        // Criar tabela access_logs se não existir
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS access_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            userId INT NOT NULL,
            userName VARCHAR(100) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'user',
            ip VARCHAR(50),
            userAgent TEXT,
            createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_userId (userId),
            INDEX idx_createdAt (createdAt)
          )
        `);
        results.push("access_logs table: OK");

        // Upsert de todos os usuários
        const usersToCreate = [
          { username: "admin", password: "MR1313", name: "Administrador", role: "admin" },
          { username: "marta", password: "marta", name: "Marta", role: "user" },
          { username: "bia", password: "bia", name: "Bia", role: "user" },
          { username: "glei", password: "glei", name: "Glei", role: "user" },
          { username: "janaina", password: "janaina", name: "Janaina", role: "user" },
          { username: "maysa", password: "maysa", name: "Maysa", role: "user" },
          { username: "viviane", password: "viviane", name: "Viviane", role: "user" },
        ];
        for (const u of usersToCreate) {
          const hash = await bcrypt.hash(u.password, 10);
          const openId = `local:${u.username}`;
          await conn.execute(
            `INSERT INTO users (openId, username, passwordHash, name, role, loginMethod, lastSignedIn)
             VALUES (?, ?, ?, ?, ?, 'local', NOW())
             ON DUPLICATE KEY UPDATE passwordHash=VALUES(passwordHash), name=VALUES(name), role=VALUES(role)`,
            [openId, u.username, hash, u.name, u.role]
          );
          results.push(`user ${u.username}: OK`);
        }

        // Adicionar serviços especiais se não existirem
        const specialServices = [
          { name: 'Outros', description: 'Serviço genérico', duration: 30, price: 0.00, commission: 50.00 },
          { name: 'Almoço', description: 'Pausa para almoço', duration: 60, price: 0.00, commission: 0.00 },
          { name: 'Fechado', description: 'Horário fechado/bloqueado', duration: 30, price: 0.00, commission: 0.00 },
          { name: 'Maquiagem', description: 'Maquiagem', duration: 60, price: 0.00, commission: 50.00 },
          { name: 'Avaliação', description: 'Avaliação', duration: 30, price: 0.00, commission: 0.00 },
          { name: 'Penteado', description: 'Penteado', duration: 60, price: 0.00, commission: 50.00 },
        ];
        for (const svc of specialServices) {
          await conn.execute(
            `INSERT INTO services (name, description, durationMinutes, price, defaultCommissionPct, active)
             SELECT ?, ?, ?, ?, ?, 1
             FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM services WHERE name=?)`,
            [svc.name, svc.description, svc.duration, svc.price, svc.commission, svc.name]
          );
          results.push(`service ${svc.name}: OK`);
        }

        return { success: true, results };
      } finally {
        await conn.end();
      }
    }),

  recalcAllCommissions: publicProcedure
    .input(z.object({ secret: z.string() }))
    .mutation(async ({ input }) => {
      if (input.secret !== 'KBLOS_SETUP_2026') throw new TRPCError({ code: 'FORBIDDEN' });
      if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
      const mysql = await import('mysql2/promise');
      const conn = await mysql.createConnection(process.env.DATABASE_URL);
      try {
        // Buscar todos os agendamentos não cancelados
        const [appts] = await conn.execute(
          `SELECT id, professionalId, serviceId, servicePrice FROM appointments WHERE status != 'cancelled'`
        ) as [Array<{id: number; professionalId: number; serviceId: number; servicePrice: string}>, unknown];

        // Buscar regras de comissão (global por serviço, sem profissional específico)
        const [rules] = await conn.execute(
          `SELECT professionalId, serviceId, commissionPct FROM commission_rules`
        ) as [Array<{professionalId: number|null; serviceId: number|null; commissionPct: string}>, unknown];

        // Buscar serviços com defaultCommissionPct
        const [svcs] = await conn.execute(
          `SELECT id, defaultCommissionPct FROM services`
        ) as [Array<{id: number; defaultCommissionPct: string}>, unknown];

        // Buscar profissionais com defaultCommissionPct
        const [profs] = await conn.execute(
          `SELECT id, defaultCommissionPct FROM professionals`
        ) as [Array<{id: number; defaultCommissionPct: string}>, unknown];

        // Mapas para lookup rápido
        const specificRule = new Map<string, number>();
        const generalProfRule = new Map<number, number>();
        const globalSvcRule = new Map<number, number>();
        for (const r of rules) {
          if (r.professionalId != null && r.serviceId != null) {
            specificRule.set(`${r.professionalId}:${r.serviceId}`, Number(r.commissionPct));
          } else if (r.professionalId != null && r.serviceId == null) {
            generalProfRule.set(r.professionalId, Number(r.commissionPct));
          } else if (r.professionalId == null && r.serviceId != null) {
            globalSvcRule.set(r.serviceId, Number(r.commissionPct));
          }
        }
        const svcDefault = new Map(svcs.map(s => [s.id, Number(s.defaultCommissionPct)]));
        const profDefault = new Map(profs.map(p => [p.id, Number(p.defaultCommissionPct)]));

        const resolveCommission = (profId: number, svcId: number): number => {
          if (specificRule.has(`${profId}:${svcId}`)) return specificRule.get(`${profId}:${svcId}`)!;
          if (generalProfRule.has(profId)) return generalProfRule.get(profId)!;
          if (globalSvcRule.has(svcId)) return globalSvcRule.get(svcId)!;
          if (svcDefault.has(svcId) && svcDefault.get(svcId)! > 0) return svcDefault.get(svcId)!;
          return profDefault.get(profId) ?? 0;
        };

        let updated = 0;
        let skipped = 0;
        for (const appt of appts) {
          const price = Number(appt.servicePrice);
          const pct = resolveCommission(appt.professionalId, appt.serviceId);
          const commValue = Math.round(price * pct / 100 * 100) / 100;
          await conn.execute(
            `UPDATE appointments SET commissionPct=?, commissionValue=? WHERE id=?`,
            [pct, commValue, appt.id]
          );
          updated++;
        }

        return { success: true, updated, skipped };
      } finally {
        await conn.end();
      }
    }),

  // Define comissão padrão de um profissional por nome e recalcula agendamentos
  setProfCommission: publicProcedure
    .input(z.object({ secret: z.string(), profName: z.string(), pct: z.number() }))
    .mutation(async ({ input }) => {
      if (input.secret !== 'KBLOS_SETUP_2026') throw new TRPCError({ code: 'FORBIDDEN' });
      if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
      const mysql = await import('mysql2/promise');
      const conn = await mysql.createConnection(process.env.DATABASE_URL);
      try {
        // Atualizar defaultCommissionPct do profissional
        await conn.execute(
          `UPDATE professionals SET defaultCommissionPct=? WHERE name=?`,
          [input.pct.toFixed(2), input.profName]
        );
        // Buscar o ID do profissional
        const [rows] = await conn.execute(
          `SELECT id FROM professionals WHERE name=?`, [input.profName]
        ) as [Array<{id: number}>, unknown];
        if (!rows.length) return { success: false, message: 'Profissional não encontrado' };
        const profId = rows[0].id;
        // Remover regras de comissão específicas desse profissional (para usar o padrão)
        await conn.execute(`DELETE FROM commission_rules WHERE professionalId=?`, [profId]);
        // Recalcular todos os agendamentos desse profissional
        const [appts] = await conn.execute(
          `SELECT id, servicePrice FROM appointments WHERE professionalId=? AND status != 'cancelled'`,
          [profId]
        ) as [Array<{id: number; servicePrice: string}>, unknown];
        let updated = 0;
        for (const appt of appts) {
          const price = Number(appt.servicePrice);
          const commValue = parseFloat((price * input.pct / 100).toFixed(2));
          await conn.execute(
            `UPDATE appointments SET commissionPct=?, commissionValue=? WHERE id=?`,
            [input.pct.toFixed(2), commValue.toFixed(2), appt.id]
          );
          updated++;
        }
        return { success: true, profId, updated, pct: input.pct };
      } finally {
        await conn.end();
      }
    }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  professionals: professionalsRouter,
  services: servicesRouter,
  commission: commissionRouter,
  appointments: appointmentsRouter,
  financial: financialRouter,
  reminders: remindersRouter,
  logs: logsRouter,
  setup: setupRouter,
});

export type AppRouter = typeof appRouter;
