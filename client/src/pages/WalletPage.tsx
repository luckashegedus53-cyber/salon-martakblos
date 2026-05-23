import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  ChevronLeft,
  ChevronRight,
  Wallet,
  Scissors,
  TrendingUp,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { useState, useMemo } from "react";

const ACCENT = "oklch(0.58 0.09 25)";
const ACCENT_LIGHT = "oklch(0.58 0.09 25 / 0.12)";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dayLabel(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return `${names[dt.getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

export default function WalletPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedProfId, setSelectedProfId] = useState<number | undefined>(undefined);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Para admin: listar profissionais
  const { data: professionals = [] } = trpc.wallet.listProfessionals.useQuery(undefined, {
    enabled: isAdmin,
  });

  const queryInput = useMemo(() => ({
    professionalId: isAdmin ? selectedProfId : undefined,
    weekOffset,
  }), [isAdmin, selectedProfId, weekOffset]);

  const { data, isLoading, error } = trpc.wallet.weeklyWallet.useQuery(queryInput, {
    enabled: !isAdmin || selectedProfId !== undefined,
  });

  const wallet = data?.type === "wallet" ? data : null;

  // Dia selecionado padrão: hoje
  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);

  const activeDay = selectedDay ?? todayStr;
  const dayAppts = wallet?.byDay?.[activeDay] ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: ACCENT_LIGHT }}
          >
            <Wallet className="h-5 w-5" style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="text-2xl font-serif">
              {isAdmin && wallet ? `Carteira — ${wallet.profName}` : "Minha Carteira"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Serviços e comissões da semana
            </p>
          </div>
        </div>

        {/* Admin: seletor de profissional */}
        {isAdmin && (
          <Select
            value={selectedProfId ? String(selectedProfId) : ""}
            onValueChange={(v) => { setSelectedProfId(Number(v)); setSelectedDay(null); }}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Selecione a profissional" />
            </SelectTrigger>
            <SelectContent>
              {professionals.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Sem profissional selecionada (admin) */}
      {isAdmin && !selectedProfId && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Wallet className="h-14 w-14 mb-4" style={{ color: ACCENT, opacity: 0.3 }} />
          <h2 className="text-xl font-serif mb-2">Selecione uma profissional</h2>
          <p className="text-muted-foreground text-sm">
            Escolha a profissional acima para ver a carteira semanal dela.
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (isAdmin ? !!selectedProfId : true) && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: ACCENT }} />
        </div>
      )}

      {/* Erro: profissional não vinculada */}
      {error && !isAdmin && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Wallet className="h-14 w-14 mb-4 text-muted-foreground/30" />
          <h2 className="text-xl font-serif mb-2">Carteira não disponível</h2>
          <p className="text-muted-foreground text-sm">
            Seu usuário ainda não está vinculado a uma profissional. Fale com a administração.
          </p>
        </div>
      )}

      {wallet && (
        <>
          {/* Navegação de semana */}
          <div className="flex items-center justify-between bg-card border rounded-xl px-4 py-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => { setWeekOffset((w) => w - 1); setSelectedDay(null); }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-medium">
                {dayLabel(wallet.weekStart).replace(/^[A-Za-zÁ-ú]+ /, "")} –{" "}
                {dayLabel(wallet.weekEnd).replace(/^[A-Za-zÁ-ú]+ /, "")}
              </p>
              {weekOffset === 0 && (
                <span className="text-xs" style={{ color: ACCENT }}>Semana atual</span>
              )}
              {weekOffset < 0 && (
                <span className="text-xs text-muted-foreground">
                  {Math.abs(weekOffset)} semana{Math.abs(weekOffset) > 1 ? "s" : ""} atrás
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => { setWeekOffset((w) => w + 1); setSelectedDay(null); }}
              disabled={weekOffset >= 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border shadow-sm">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: ACCENT_LIGHT }}>
                    <Scissors className="h-4 w-4" style={{ color: ACCENT }} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Atendimentos</p>
                    <p className="text-2xl font-semibold leading-tight">{wallet.totalCount}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.55 0.12 150 / 0.12)" }}>
                    <TrendingUp className="h-4 w-4" style={{ color: "oklch(0.45 0.12 150)" }} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Faturamento</p>
                    <p className="text-2xl font-semibold leading-tight">{fmt(wallet.totalPrice)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm" style={{ borderColor: "oklch(0.58 0.09 25 / 0.3)" }}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: ACCENT_LIGHT }}>
                    <Wallet className="h-4 w-4" style={{ color: ACCENT }} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide" style={{ color: ACCENT }}>Comissão</p>
                    <p className="text-2xl font-bold leading-tight" style={{ color: ACCENT }}>
                      {fmt(wallet.totalComm)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Calendário semanal */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <CalendarDays className="h-4 w-4" style={{ color: ACCENT }} />
                Calendário da Semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {wallet.weekDays.map((wd) => {
                  const isActive = wd.date === activeDay;
                  const hasAppts = wd.count > 0;
                  return (
                    <button
                      key={wd.date}
                      onClick={() => setSelectedDay(wd.date)}
                      className={`rounded-xl p-2 text-center transition-all border ${
                        isActive
                          ? "shadow-sm"
                          : "hover:bg-muted/50 border-transparent"
                      }`}
                      style={isActive ? {
                        background: ACCENT_LIGHT,
                        borderColor: "oklch(0.58 0.09 25 / 0.3)",
                      } : {}}
                    >
                      <p className={`text-[11px] font-medium mb-1 ${isActive ? "" : "text-muted-foreground"}`}
                        style={isActive ? { color: ACCENT } : {}}>
                        {wd.label.split(" ")[0]}
                      </p>
                      <p className={`text-sm font-semibold ${isActive ? "" : ""}`}
                        style={isActive ? { color: ACCENT } : {}}>
                        {wd.label.split(" ")[1]?.split("/")[0]}
                      </p>
                      {hasAppts ? (
                        <div className="mt-1.5 space-y-0.5">
                          <div
                            className="text-[10px] font-medium px-1 py-0.5 rounded-full"
                            style={{
                              background: isActive ? "oklch(0.58 0.09 25 / 0.2)" : "oklch(0.58 0.09 25 / 0.1)",
                              color: ACCENT,
                            }}
                          >
                            {wd.count} atend.
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {fmt(wd.comm)}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1.5 h-8" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Lista de atendimentos do dia selecionado */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">
                  Atendimentos — {dayLabel(activeDay)}
                </CardTitle>
                {dayAppts.length > 0 && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">{dayAppts.length} serviço{dayAppts.length > 1 ? "s" : ""}</span>
                    <span className="font-semibold" style={{ color: ACCENT }}>
                      {fmt(dayAppts.reduce((s, a) => s + a.comm, 0))} de comissão
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {dayAppts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CalendarDays className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p className="text-muted-foreground text-sm">Nenhum atendimento neste dia</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dayAppts.map((appt, idx) => (
                    <div
                      key={appt.id}
                      className="flex items-center justify-between rounded-lg px-4 py-3 border transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                          style={{ background: ACCENT_LIGHT, color: ACCENT }}
                        >
                          {String(idx + 1).padStart(2, "0")}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{appt.svc}</span>
                            <span className="text-xs text-muted-foreground">{appt.time}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{appt.client}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold" style={{ color: ACCENT }}>
                          {fmt(appt.comm)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {fmt(appt.price)} × {appt.pct.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Total do dia */}
                  <div
                    className="flex items-center justify-between rounded-lg px-4 py-3 mt-2"
                    style={{ background: ACCENT_LIGHT }}
                  >
                    <span className="text-sm font-semibold" style={{ color: ACCENT }}>
                      Total do dia
                    </span>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: ACCENT }}>
                        {fmt(dayAppts.reduce((s, a) => s + a.comm, 0))}
                      </p>
                      <p className="text-xs" style={{ color: ACCENT, opacity: 0.7 }}>
                        de {fmt(dayAppts.reduce((s, a) => s + a.price, 0))}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumo completo da semana */}
          {wallet.totalCount > 0 && (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium">Todos os Atendimentos da Semana</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left pb-2 text-xs text-muted-foreground uppercase tracking-wide font-medium">Dia</th>
                        <th className="text-left pb-2 text-xs text-muted-foreground uppercase tracking-wide font-medium">Hora</th>
                        <th className="text-left pb-2 text-xs text-muted-foreground uppercase tracking-wide font-medium">Serviço</th>
                        <th className="text-right pb-2 text-xs text-muted-foreground uppercase tracking-wide font-medium">Valor</th>
                        <th className="text-right pb-2 text-xs text-muted-foreground uppercase tracking-wide font-medium">Comissão</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {wallet.weekDays.flatMap((wd) =>
                        (wallet.byDay[wd.date] ?? []).map((appt) => (
                          <tr key={appt.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2.5 text-muted-foreground text-xs">{wd.label}</td>
                            <td className="py-2.5 text-muted-foreground text-xs">{appt.time}</td>
                            <td className="py-2.5">
                              <div>
                                <span className="font-medium">{appt.svc}</span>
                                <span className="text-xs text-muted-foreground ml-2">{appt.client}</span>
                              </div>
                            </td>
                            <td className="py-2.5 text-right text-muted-foreground">{fmt(appt.price)}</td>
                            <td className="py-2.5 text-right font-semibold" style={{ color: ACCENT }}>
                              {fmt(appt.comm)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2">
                        <td colSpan={3} className="pt-3 font-semibold text-sm">Total da semana</td>
                        <td className="pt-3 text-right font-semibold">{fmt(wallet.totalPrice)}</td>
                        <td className="pt-3 text-right font-bold text-base" style={{ color: ACCENT }}>
                          {fmt(wallet.totalComm)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
