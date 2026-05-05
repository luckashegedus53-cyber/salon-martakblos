import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createAppointment,
  createProfessional,
  createService,
  deleteCommissionRule,
  deleteProfessional,
  deleteService,
  getAppointmentById,
  getAppointments,
  getCommissionRules,
  getFinancialSummary,
  getProfessionalById,
  getProfessionals,
  getServiceById,
  getServices,
  resolveCommissionPct,
  updateAppointment,
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
        serviceId: z.number(),
        scheduledAt: z.date(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      const service = await getServiceById(input.serviceId);
      if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Serviço não encontrado." });

      const commissionPct = await resolveCommissionPct(input.professionalId, input.serviceId);
      const servicePrice = Number(service.price);
      const commissionValue = (servicePrice * commissionPct) / 100;

      await createAppointment({
        ...input,
        servicePrice: String(servicePrice),
        commissionPct: String(commissionPct),
        commissionValue: String(commissionValue.toFixed(2)),
      });

      return { success: true };
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["scheduled", "completed", "cancelled"]),
      })
    )
    .mutation(({ input }) => updateAppointmentStatus(input.id, input.status)),

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
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return getFinancialSummary(start, end);
  }),

  weekly: adminProcedure.query(() => {
    const now = new Date();
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return getFinancialSummary(start, end);
  }),

  monthly: adminProcedure.query(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return getFinancialSummary(start, end);
  }),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  professionals: professionalsRouter,
  services: servicesRouter,
  commission: commissionRouter,
  appointments: appointmentsRouter,
  financial: financialRouter,
});

export type AppRouter = typeof appRouter;
