import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subDays, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  Users,
  Wallet,
  Percent,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-3"
      style={
        accent
          ? {
              background: "linear-gradient(135deg, oklch(0.58 0.09 25) 0%, oklch(0.48 0.07 25) 100%)",
              border: "none",
              color: "white",
            }
          : { background: "white" }
      }
    >
      <div className="flex items-center justify-between">
        <p className={`text-xs font-medium uppercase tracking-wider ${accent ? "text-white/70" : "text-muted-foreground"}`}>
          {label}
        </p>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: accent ? "rgba(255,255,255,0.15)" : "oklch(0.58 0.09 25 / 0.08)",
          }}
        >
          <Icon className="h-4 w-4" style={{ color: accent ? "white" : "oklch(0.58 0.09 25)" }} />
        </div>
      </div>
      <div>
        <p className={`text-2xl font-serif font-medium ${accent ? "text-white" : "text-foreground"}`}>
          {value}
        </p>
        {sub && (
          <p className={`text-xs mt-1 ${accent ? "text-white/60" : "text-muted-foreground"}`}>{sub}</p>
        )}
      </div>
    </div>
  );
}

function ProfessionalCommissionTable({
  data,
}: {
  data: { professionalId: number; professionalName: string; revenue: number; commission: number; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Nenhum atendimento concluído no período
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Profissional</th>
            <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Atendimentos</th>
            <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Faturamento</th>
            <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Comissão</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data
            .sort((a, b) => b.commission - a.commission)
            .map((row) => (
              <tr key={row.professionalId} className="hover:bg-muted/20 transition-colors">
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                      style={{ background: "oklch(0.58 0.09 25 / 0.1)", color: "oklch(0.58 0.09 25)" }}
                    >
                      {row.professionalName.charAt(0)}
                    </div>
                    <span className="text-sm font-medium">{row.professionalName}</span>
                  </div>
                </td>
                <td className="py-3 text-right text-sm text-muted-foreground">{row.count}</td>
                <td className="py-3 text-right text-sm font-medium">{fmt(row.revenue)}</td>
                <td className="py-3 text-right">
                  <span className="text-sm font-semibold" style={{ color: "oklch(0.58 0.09 25)" }}>
                    {fmt(row.commission)}
                  </span>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [, setLocation] = useLocation();
  const [monthOffset, setMonthOffset] = useState(0);

  // Redirecionar profissionais para a agenda automaticamente
  useEffect(() => {
    if (user && !isAdmin) {
      setLocation("/");
    }
  }, [user, isAdmin, setLocation]);

  const currentMonth = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);

  const [commissionPeriod, setCommissionPeriod] = useState<"today" | "week" | "month" | "custom">("today");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [customEnd, setCustomEnd] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });

  const commissionStart = useMemo(() => {
    if (commissionPeriod === "today") return startOfDay(new Date());
    if (commissionPeriod === "week") return startOfWeek(new Date(), { weekStartsOn: 0 });
    if (commissionPeriod === "month") return startOfMonth(new Date());
    return customStart;
  }, [commissionPeriod, customStart]);

  const commissionEnd = useMemo(() => {
    if (commissionPeriod === "today") return endOfDay(new Date());
    if (commissionPeriod === "week") return endOfWeek(new Date(), { weekStartsOn: 0 });
    if (commissionPeriod === "month") return endOfMonth(new Date());
    return customEnd;
  }, [commissionPeriod, customEnd]);

  const { data: daily, isLoading: dailyLoading } = trpc.financial.daily.useQuery(undefined, { enabled: isAdmin });
  const { data: weekly, isLoading: weeklyLoading } = trpc.financial.weekly.useQuery(undefined, { enabled: isAdmin });
  const { data: monthly, isLoading: monthlyLoading } = trpc.financial.summary.useQuery(
    { startDate: monthStart, endDate: monthEnd },
    { enabled: isAdmin }
  );
  const { data: commissionsData, isLoading: commissionsLoading } = trpc.financial.commissions.useQuery(
    { startDate: commissionStart, endDate: commissionEnd },
    { enabled: isAdmin }
  );

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-serif">Acesso Restrito</h2>
        <p className="text-muted-foreground mt-2">O painel financeiro é exclusivo para administradores.</p>
      </div>
    );
  }

  const barData = monthly?.byProfessional.map((p) => ({
    name: p.professionalName.split(" ")[0],
    faturamento: p.revenue,
    comissao: p.commission,
  })) ?? [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif">Dashboard Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão consolidada do desempenho do salão
        </p>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="h-10">
          <TabsTrigger value="daily" className="gap-2 text-sm">
            <CalendarDays className="h-3.5 w-3.5" />
            Hoje
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-2 text-sm">
            <TrendingUp className="h-3.5 w-3.5" />
            Semana
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2 text-sm">
            <BarChart3 className="h-3.5 w-3.5" />
            Mês
          </TabsTrigger>
          <TabsTrigger value="commissions" className="gap-2 text-sm">
            <Percent className="h-3.5 w-3.5" />
            Comissões
          </TabsTrigger>
        </TabsList>

        {/* ── DAILY ── */}
        <TabsContent value="daily" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h2>
          </div>
          {dailyLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  label="Faturamento do Dia"
                  value={fmt(daily?.totalRevenue ?? 0)}
                  sub={`${daily?.appointmentCount ?? 0} atendimentos`}
                  icon={Wallet}
                  accent
                />
                <StatCard
                  label="Comissão Total"
                  value={fmt(daily?.totalCommission ?? 0)}
                  sub="Soma das comissões"
                  icon={TrendingUp}
                />
                <StatCard
                  label="Profissionais Ativas"
                  value={String(daily?.byProfessional.length ?? 0)}
                  sub="Com atendimentos hoje"
                  icon={Users}
                />
              </div>

              {(daily?.byProfessional.length ?? 0) > 0 && (
                <div className="bg-card rounded-xl border p-5">
                  <h3 className="font-serif text-lg mb-4">Comissão por Profissional — Hoje</h3>
                  <ProfessionalCommissionTable data={daily?.byProfessional ?? []} />
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── WEEKLY ── */}
        <TabsContent value="weekly" className="mt-6 space-y-6">
          <div>
            <h2 className="font-serif text-xl">Esta Semana</h2>
            <p className="text-sm text-muted-foreground">
              {format(startOfWeek(new Date(), { weekStartsOn: 0 }), "d 'de' MMM", { locale: ptBR })} —{" "}
              {format(endOfWeek(new Date(), { weekStartsOn: 0 }), "d 'de' MMM", { locale: ptBR })}
            </p>
          </div>
          {weeklyLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  label="Faturamento da Semana"
                  value={fmt(weekly?.totalRevenue ?? 0)}
                  sub={`${weekly?.appointmentCount ?? 0} atendimentos`}
                  icon={Wallet}
                  accent
                />
                <StatCard
                  label="Comissão Total"
                  value={fmt(weekly?.totalCommission ?? 0)}
                  sub="Soma das comissões"
                  icon={TrendingUp}
                />
                <StatCard
                  label="Profissionais"
                  value={String(weekly?.byProfessional.length ?? 0)}
                  sub="Com atendimentos"
                  icon={Users}
                />
              </div>

              {(weekly?.byProfessional.length ?? 0) > 0 && (
                <div className="bg-card rounded-xl border p-5">
                  <h3 className="font-serif text-lg mb-4">Comissão por Profissional — Semana</h3>
                  <ProfessionalCommissionTable data={weekly?.byProfessional ?? []} />
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ── MONTHLY ── */}
        <TabsContent value="monthly" className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl capitalize">
                {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </h2>
              <p className="text-sm text-muted-foreground">Resumo mensal</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => setMonthOffset((o) => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMonthOffset(0)}
                disabled={monthOffset === 0}
                className="text-xs"
              >
                Mês atual
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMonthOffset((o) => o + 1)}
                disabled={monthOffset >= 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {monthlyLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  label="Faturamento do Mês"
                  value={fmt(monthly?.totalRevenue ?? 0)}
                  sub={`${monthly?.appointmentCount ?? 0} atendimentos`}
                  icon={Wallet}
                  accent
                />
                <StatCard
                  label="Comissão Total"
                  value={fmt(monthly?.totalCommission ?? 0)}
                  sub="A pagar às profissionais"
                  icon={TrendingUp}
                />
                <StatCard
                  label="Lucro Líquido"
                  value={fmt((monthly?.totalRevenue ?? 0) - (monthly?.totalCommission ?? 0))}
                  sub="Faturamento − Comissões"
                  icon={BarChart3}
                />
              </div>

              {/* Chart */}
              {barData.length > 0 && (
                <div className="bg-card rounded-xl border p-5">
                  <h3 className="font-serif text-lg mb-5">Faturamento vs. Comissão por Profissional</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} barGap={4} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.88 0.01 60)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "oklch(0.52 0.015 60)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "oklch(0.52 0.015 60)" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        formatter={(v: number) => fmt(v)}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid oklch(0.88 0.01 60)",
                          fontSize: "12px",
                        }}
                      />
                      <Bar dataKey="faturamento" name="Faturamento" fill="oklch(0.58 0.09 25)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="comissao" name="Comissão" fill="oklch(0.58 0.09 25 / 0.3)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Commission summary for payment */}
              <div className="bg-card rounded-xl border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-lg">Resumo de Comissões para Pagamento</h3>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-md">
                    {format(currentMonth, "MMM/yyyy", { locale: ptBR })}
                  </span>
                </div>
                <ProfessionalCommissionTable data={monthly?.byProfessional ?? []} />
                {(monthly?.byProfessional.length ?? 0) > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total a pagar</span>
                      <span className="text-lg font-serif font-medium" style={{ color: "oklch(0.58 0.09 25)" }}>
                        {fmt(monthly?.totalCommission ?? 0)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* ── COMMISSIONS ── */}
        <TabsContent value="commissions" className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl">Comissões por Profissional</h2>
              <p className="text-sm text-muted-foreground">Resumo de comissões de todas as profissionais</p>
            </div>
            {/* Filtro de período */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setCommissionPeriod("today")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  commissionPeriod === "today"
                    ? "text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                style={commissionPeriod === "today" ? { background: "oklch(0.58 0.09 25)" } : {}}
              >
                Hoje
              </button>
              <button
                onClick={() => setCommissionPeriod("week")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  commissionPeriod === "week"
                    ? "text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                style={commissionPeriod === "week" ? { background: "oklch(0.58 0.09 25)" } : {}}
              >
                Esta Semana
              </button>
              <button
                onClick={() => setCommissionPeriod("month")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  commissionPeriod === "month"
                    ? "text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                style={commissionPeriod === "month" ? { background: "oklch(0.58 0.09 25)" } : {}}
              >
                Este Mês
              </button>
              <button
                onClick={() => setCommissionPeriod("custom")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  commissionPeriod === "custom"
                    ? "text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                style={commissionPeriod === "custom" ? { background: "oklch(0.58 0.09 25)" } : {}}
              >
                Período
              </button>
            </div>
          </div>

          {/* Seletor de datas customizado */}
          {commissionPeriod === "custom" && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">De:</label>
                <input
                  type="date"
                  className="border rounded-lg px-3 py-1.5 text-sm bg-background"
                  value={format(customStart, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const d = new Date(e.target.value + "T00:00:00");
                    setCustomStart(d);
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Até:</label>
                <input
                  type="date"
                  className="border rounded-lg px-3 py-1.5 text-sm bg-background"
                  value={format(customEnd, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const d = new Date(e.target.value + "T23:59:59");
                    setCustomEnd(d);
                  }}
                />
              </div>
            </div>
          )}

          {commissionsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Cards de totais */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  label="Total de Comissões"
                  value={fmt((commissionsData ?? []).reduce((s, p) => s + p.commission, 0))}
                  sub="Soma de todas as profissionais"
                  icon={Percent}
                  accent
                />
                <StatCard
                  label="Faturamento Total"
                  value={fmt((commissionsData ?? []).reduce((s, p) => s + p.revenue, 0))}
                  sub="Atendimentos concluídos"
                  icon={Wallet}
                />
                <StatCard
                  label="Atendimentos"
                  value={String((commissionsData ?? []).reduce((s, p) => s + p.count, 0))}
                  sub="No período selecionado"
                  icon={Users}
                />
              </div>

              {/* Tabela de todas as profissionais */}
              <div className="bg-card rounded-xl border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-lg">Comissões por Profissional</h3>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-md">
                    {commissionPeriod === "today" ? format(new Date(), "dd/MM/yyyy") : commissionPeriod === "week" ? "Esta semana" : commissionPeriod === "month" ? format(new Date(), "MMM/yyyy", { locale: ptBR }) : `${format(commissionStart, "dd/MM")} – ${format(commissionEnd, "dd/MM/yyyy")}`}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Profissional</th>
                        <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Especialidade</th>
                        <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Atendimentos</th>
                        <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Faturamento</th>
                        <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Comissão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(commissionsData ?? []).map((prof) => (
                        <tr key={prof.professionalId} className="hover:bg-muted/20 transition-colors">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                                style={{ background: "oklch(0.58 0.09 25 / 0.1)", color: "oklch(0.58 0.09 25)" }}
                              >
                                {prof.professionalName.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium">{prof.professionalName}</span>
                            </div>
                          </td>
                          <td className="py-3 text-sm text-muted-foreground">{prof.specialty || "—"}</td>
                          <td className="py-3 text-right text-sm text-muted-foreground">{prof.count}</td>
                          <td className="py-3 text-right text-sm font-medium">{fmt(prof.revenue)}</td>
                          <td className="py-3 text-right">
                            <span
                              className="text-sm font-bold px-2 py-0.5 rounded-md"
                              style={{
                                background: prof.commission > 0 ? "oklch(0.58 0.09 25 / 0.1)" : "transparent",
                                color: prof.commission > 0 ? "oklch(0.58 0.09 25)" : "oklch(0.52 0.015 60)",
                              }}
                            >
                              {fmt(prof.commission)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {(commissionsData ?? []).length > 0 && (
                      <tfoot>
                        <tr className="border-t-2">
                          <td colSpan={2} className="py-3 text-sm font-semibold">Total</td>
                          <td className="py-3 text-right text-sm font-semibold">
                            {(commissionsData ?? []).reduce((s, p) => s + p.count, 0)}
                          </td>
                          <td className="py-3 text-right text-sm font-semibold">
                            {fmt((commissionsData ?? []).reduce((s, p) => s + p.revenue, 0))}
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-sm font-bold" style={{ color: "oklch(0.58 0.09 25)" }}>
                              {fmt((commissionsData ?? []).reduce((s, p) => s + p.commission, 0))}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
