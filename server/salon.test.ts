import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Helper para criar contexto de admin
function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@salao.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// Helper para criar contexto de profissional (role: user)
function createProfessionalContext(): TrpcContext {
  return {
    user: {
      id: 2,
      openId: "professional-user",
      email: "pro@salao.com",
      name: "Profissional",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

// Helper para criar contexto sem autenticação
function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("retorna o usuário autenticado", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).not.toBeNull();
    expect(user?.role).toBe("admin");
  });

  it("retorna null para usuário não autenticado", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});

describe("financial (dashboard) - controle de acesso", () => {
  it("admin pode acessar o dashboard financeiro", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    // Não deve lançar erro de FORBIDDEN
    await expect(caller.financial.daily()).resolves.toBeDefined();
  });

  it("profissional NÃO pode acessar o dashboard financeiro", async () => {
    const ctx = createProfessionalContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.financial.daily()).rejects.toThrow();
  });

  it("usuário não autenticado NÃO pode acessar o dashboard", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.financial.daily()).rejects.toThrow();
  });
});

describe("professionals - controle de acesso", () => {
  it("admin pode listar profissionais", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.professionals.list({ activeOnly: true })).resolves.toBeDefined();
  });

  it("profissional pode listar profissionais (para agenda)", async () => {
    const ctx = createProfessionalContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.professionals.list({ activeOnly: true })).resolves.toBeDefined();
  });

  it("profissional NÃO pode criar profissional", async () => {
    const ctx = createProfessionalContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.professionals.create({
        name: "Teste",
        email: "teste@test.com",
        phone: null,
        specialty: null,
        defaultCommissionPct: "0",
      })
    ).rejects.toThrow();
  });
});

describe("services - controle de acesso", () => {
  it("qualquer usuário autenticado pode listar serviços", async () => {
    const ctx = createProfessionalContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.services.list({ activeOnly: true })).resolves.toBeInstanceOf(Array);
  });

  it("profissional NÃO pode criar serviço", async () => {
    const ctx = createProfessionalContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.services.create({
        name: "Teste",
        description: null,
        durationMinutes: 60,
        price: "50.00",
        defaultCommissionPct: "0",
      })
    ).rejects.toThrow();
  });
});

describe("appointments - controle de acesso", () => {
  it("qualquer usuário autenticado pode listar agendamentos", async () => {
    const ctx = createProfessionalContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.appointments.list({})
    ).resolves.toBeDefined();
  });

  it("usuário não autenticado NÃO pode listar agendamentos", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.appointments.list({})
    ).rejects.toThrow();
  });
});

describe("commission - controle de acesso", () => {
  it("admin pode listar regras de comissão", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.commission.list({ professionalId: undefined })).resolves.toBeDefined();
  });

  it("profissional NÃO pode listar regras de comissão", async () => {
    const ctx = createProfessionalContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.commission.list({ professionalId: undefined })).rejects.toThrow();
  });
});
