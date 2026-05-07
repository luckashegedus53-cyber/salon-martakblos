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
  replaceAppointmentServices,
  resolveCommissionPct,
  updateAppointment,
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
    .mutation(({ input }) => upsertCommissionRule(input)),

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
            price: z.number().positive().max(999999.99), // valor editável por serviço
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
        const commissionValue = (svcInput.price * commissionPct) / 100;
        totalPrice += svcInput.price;
        totalCommission += commissionValue;
        svcItems.push({
          serviceId: svcInput.serviceId,
          serviceName: service.name,
          price: String(svcInput.price.toFixed(2)),
          commissionPct: String(commissionPct.toFixed(2)),
          commissionValue: String(commissionValue.toFixed(2)),
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
          servicePrice: String(totalPrice.toFixed(2)),
          commissionPct: String(avgCommissionPct.toFixed(2)),
          commissionValue: String(totalCommission.toFixed(2)),
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
        servicePrice: z.number().positive().max(999999.99),
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
        const commissionValue = (servicePrice * commissionPct) / 100;

        await updateAppointment(id, {
          ...data,
          servicePrice: String(servicePrice),
          commissionPct: String(commissionPct),
          commissionValue: String(commissionValue.toFixed(2)),
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
      return { success: true, user: { id: user.id, name: user.name, role: user.role } };
    }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
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
});

export type AppRouter = typeof appRouter;
