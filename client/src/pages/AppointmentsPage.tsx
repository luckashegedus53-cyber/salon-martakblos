import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Filter,
  List,
  Loader2,
  Percent,
  Plus,
  Scissors,
  XCircle,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const appointmentSchema = z.object({
  clientName: z.string().min(1, "Nome do cliente é obrigatório"),
  clientPhone: z.string().optional(),
  professionalId: z.string().min(1, "Selecione um profissional"),
  date: z.date().nullable().optional(),
  time: z.string().min(1, "Informe o horário"),
  notes: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

// Item de serviço no modal
interface ServiceItem {
  serviceId: string;
  price: string; // formato brasileiro ex: "150,00"
}

const STATUS_CONFIG = {
  scheduled: { label: "Agendado", className: "status-scheduled", icon: Clock },
  completed: { label: "Concluído", className: "status-completed", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", className: "status-cancelled", icon: XCircle },
};

// Horários da agenda (09:00 às 19:30, a cada 30 min)
const TIME_SLOTS = Array.from({ length: 22 }, (_, i) => {
  const totalMinutes = 9 * 60 + i * 30;
  const h = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
});

type ViewMode = "book" | "calendar" | "list";

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("book");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [filterProfessionalId, setFilterProfessionalId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showNewModal, setShowNewModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [prefilledTime, setPrefilledTime] = useState<string>("");
  // Lista de serviços do novo agendamento
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([{ serviceId: "", price: "" }]);

  const utils = trpc.useUtils();

  const { data: professionals = [] } = trpc.professionals.list.useQuery({ activeOnly: true });
  const { data: services = [] } = trpc.services.list.useQuery({ activeOnly: true });

  // startDate: primeiro dia do mês às 00:00 local → em UTC pode ser o dia anterior
  // endDate: último dia do mês às 23:59:59 local → em UTC pode ser o dia seguinte
  // Subtraímos 1 dia do start e adicionamos 1 dia ao end para garantir cobertura total
  const startDate = useMemo(() => {
    const d = startOfMonth(currentDate);
    d.setDate(d.getDate() - 1);
    return d;
  }, [currentDate]);
  const endDate = useMemo(() => {
    const d = endOfMonth(currentDate);
    d.setDate(d.getDate() + 1);
    return d;
  }, [currentDate]);

  const { data: appointments = [], isLoading } = trpc.appointments.list.useQuery({
    professionalId: filterProfessionalId !== "all" ? parseInt(filterProfessionalId) : undefined,
    startDate,
    endDate,
    status: filterStatus !== "all" ? (filterStatus as "scheduled" | "completed" | "cancelled") : undefined,
  });

  const createMutation = trpc.appointments.create.useMutation({
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      utils.appointments.list.invalidate();
      utils.financial.daily.invalidate();
      utils.financial.weekly.invalidate();
      utils.financial.summary.invalidate();
      utils.financial.commissions.invalidate();
      setShowNewModal(false);
      form.reset();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatusMutation = trpc.appointments.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      utils.appointments.list.invalidate();
      utils.financial.daily.invalidate();
      utils.financial.weekly.invalidate();
      utils.financial.summary.invalidate();
      utils.financial.commissions.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      clientName: "",
      clientPhone: "",
      professionalId: "",
      time: "09:00",
      notes: "",
    },
  });

  const onSubmit = (values: AppointmentFormValues) => {
    // Validar serviços
    const validItems = serviceItems.filter((s) => s.serviceId && s.price);
    if (validItems.length === 0) {
      toast.error("Adicione pelo menos um serviço com valor.");
      return;
    }
    for (const item of validItems) {
      const normalized = item.price.replace(/\./g, "").replace(",", ".");
      const n = parseFloat(normalized);
      if (isNaN(n) || n <= 0 || n > 999999.99) {
        toast.error("Valor do serviço inválido. Use o formato: 150,00");
        return;
      }
    }

    const baseDate = values.date ?? selectedDate ?? new Date();
    const [hours, minutes] = values.time.split(":").map(Number);
    const scheduledAt = new Date(baseDate);
    scheduledAt.setHours(0, 0, 0, 0);
    scheduledAt.setHours(hours!, minutes!, 0, 0);

    createMutation.mutate({
      clientName: values.clientName,
      clientPhone: values.clientPhone || null,
      professionalId: parseInt(values.professionalId),
      services: validItems.map((item) => ({
        serviceId: parseInt(item.serviceId),
        price: parseFloat(item.price.replace(/\./g, "").replace(",", ".")),
      })),
      scheduledAt,
      timeSlot: values.time,
      notes: values.notes || null,
    });
  };

  const openNewModal = (time?: string) => {
    form.reset({
      clientName: "",
      clientPhone: "",
      professionalId: "",
      time: time ?? "09:00",
      notes: "",
      date: selectedDate,
    });
    setServiceItems([{ serviceId: "", price: "" }]);
    if (time) setPrefilledTime(time);
    setShowNewModal(true);
  };

  // Calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Comparar datas usando timezone LOCAL do browser
  // scheduledAt é armazenado em UTC mas representa o horário local do agendamento
  // Ex: agendamento às 09:00 no Brasil (UTC-3) → salvo como 12:00 UTC
  // Ao converter de volta: new Date(scheduledAt).getFullYear() retorna o ano local correto
  const isSameDayLocal = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter((a) => isSameDayLocal(new Date(a.scheduledAt), day));

  const selectedDayAppointments = appointments
    .filter((a) => isSameDayLocal(new Date(a.scheduledAt), selectedDate))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const getProfessionalName = (id: number) =>
    professionals.find((p) => p.id === id)?.name ?? "—";
  const getServiceName = (id: number) =>
    services.find((s) => s.id === id)?.name ?? "—";

  const formatCurrency = (val: string | number) =>
    `R$ ${Number(val).toFixed(2).replace(".", ",")}`;

  // Formatar hora usando timezone LOCAL do browser
  // scheduledAt em UTC converte corretamente para hora local com getHours()
  const formatUTCTime = (date: Date | string) => {
    const d = new Date(date);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  };

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Profissionais a exibir no livro (filtro)
  const visibleProfessionals = filterProfessionalId !== "all"
    ? professionals.filter((p) => p.id === parseInt(filterProfessionalId))
    : professionals;

  // Total do dia
  const dayTotal = selectedDayAppointments
    .filter((a) => a.status !== "cancelled")
    .reduce((sum, a) => sum + Number(a.servicePrice), 0);

  // Comissão do dia
  const dayCommission = selectedDayAppointments
    .filter((a) => a.status !== "cancelled")
    .reduce((sum, a) => sum + Number(a.commissionValue), 0);

  // Comissão por profissional no dia
  const commissionByProfessional = professionals
    .map((prof) => ({
      id: prof.id,
      name: prof.name,
      specialty: prof.specialty,
      commission: selectedDayAppointments
        .filter((a) => a.professionalId === prof.id && a.status !== "cancelled")
        .reduce((sum, a) => sum + Number(a.commissionValue), 0),
      count: selectedDayAppointments
        .filter((a) => a.professionalId === prof.id && a.status !== "cancelled")
        .length,
    }))
    .filter((p) => p.count > 0);

  return (
    <div className="space-y-6 max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn("gap-2", showFilters && "bg-accent")}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
          {/* View toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "book" ? "default" : "ghost"}
              size="sm"
              className="rounded-none gap-1 text-xs px-3"
              onClick={() => setViewMode("book")}
              title="Livro de agendamentos"
            >
              <Scissors className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Livro</span>
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("calendar")}
              title="Calendário"
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("list")}
              title="Lista"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => openNewModal()} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Agendamento</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 bg-card rounded-xl border">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">Profissional:</label>
            <Select value={filterProfessionalId} onValueChange={setFilterProfessionalId}>
              <SelectTrigger className="w-44 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">Status:</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="scheduled">Agendado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterProfessionalId("all"); setFilterStatus("all"); }}
            className="text-muted-foreground"
          >
            Limpar filtros
          </Button>
        </div>
      )}

      {/* ─── BOOK VIEW (Livro de agendamentos) ─── */}
      {viewMode === "book" && (
        <div className="space-y-4">
          {/* Date navigation */}
          <div className="flex items-center justify-between bg-card rounded-xl border px-5 py-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => subDays(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="font-serif text-lg capitalize">
                {format(selectedDate, "EEEE", { locale: ptBR })}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => addDays(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Agendar button */}
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" onClick={() => openNewModal()}>
              <Plus className="h-3.5 w-3.5" />
              Agendar
            </Button>
          </div>


          {/* Book table */}
          {isLoading ? (
            <div className="flex items-center justify-center h-40 bg-card rounded-xl border">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : visibleProfessionals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-card rounded-xl border text-center">
              <Scissors className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhuma profissional cadastrada</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border shadow-sm overflow-x-auto">
              <table className="text-sm border-collapse" style={{ minWidth: `${80 + visibleProfessionals.length * 300}px`, tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  <col style={{ width: '80px' }} />
                  {visibleProfessionals.map((prof) => (
                    <Fragment key={prof.id}>
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '90px' }} />
                    </Fragment>
                  ))}
                </colgroup>
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground border-r sticky left-0 bg-muted/40 z-10">
                      HORA
                    </th>
                    {visibleProfessionals.map((prof, idx) => (
                      <th
                        key={prof.id}
                        colSpan={3}
                        className={cn(
                          "px-3 py-3 text-center font-serif font-semibold text-foreground",
                          idx < visibleProfessionals.length - 1 && "border-r"
                        )}
                      >
                        <span className="block">{prof.name}</span>
                        {prof.specialty && (
                          <span className="block text-xs font-normal text-muted-foreground font-sans">
                            {prof.specialty}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                    <th className="px-3 py-2 border-r sticky left-0 bg-muted/20 z-10" />
                    {visibleProfessionals.map((prof, idx) => (
                      <Fragment key={prof.id}>
                        <th className="px-3 py-2 text-left font-medium">
                          Cliente
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Serviço
                        </th>

                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map((slot) => {
                    const hasAny = visibleProfessionals.some((prof) =>
                      selectedDayAppointments.some((a) => {
                        // Usar timeSlot (string "HH:MM") para comparação sem problemas de timezone
                        const matchSlot = a.timeSlot ? a.timeSlot === slot : false;
                        return a.professionalId === prof.id &&
                          a.status !== "cancelled" &&
                          matchSlot;
                      })
                    );

                    return (
                      <tr
                        key={slot}
                        className={cn(
                          "border-b last:border-b-0 transition-colors",
                          hasAny ? "bg-accent/10" : "hover:bg-muted/20"
                        )}
                      >
                        {/* Hora */}
                        <td className="px-4 py-2.5 border-r">
                          <span className={cn(
                            "font-mono text-xs font-semibold",
                            hasAny ? "text-primary" : "text-muted-foreground"
                          )}>
                            {slot}
                          </span>
                        </td>

                        {/* Células por profissional */}
                        {visibleProfessionals.map((prof, profIdx) => {
                          // Priorizar agendamento ativo (scheduled/completed) sobre cancelado no mesmo slot
                          const allSameSlot = selectedDayAppointments.filter((a) => {
                            const matchSlot = a.timeSlot ? a.timeSlot === slot : false;
                            return a.professionalId === prof.id && matchSlot;
                          });
                          const appt = allSameSlot.find((a) => a.status !== "cancelled") ?? allSameSlot[0];
                          const isLastProf = profIdx === visibleProfessionals.length - 1;

                          // Célula vazia OU cancelada → exibe × e permite novo agendamento
                          if (!appt || appt.status === "cancelled") {
                            return (
                              <Fragment key={`${prof.id}-${slot}-empty`}>
                                <td
                                  colSpan={3}
                                  className={cn(
                                    "h-10 cursor-pointer group text-center align-middle select-none",
                                    !isLastProf && "border-r"
                                  )}
                                  onClick={() => openNewModal(slot)}
                                >
                                  <span className="text-sm font-bold text-muted-foreground/30 group-hover:text-primary/60 transition-colors">
                                    ×
                                  </span>
                                </td>
                              </Fragment>
                            );
                          }

                          const statusCfg = STATUS_CONFIG[appt.status];
                          return (
                            <Fragment key={`${prof.id}-${slot}-appt`}>
                              {/* Cliente */}
                              <td className="px-3 py-2 overflow-hidden">
                                <div className="flex flex-col">
                                  <span className="font-medium text-xs truncate block">
                                    {appt.clientName}
                                  </span>
                                  <span className={cn(
                                    "text-[9px] px-1 py-0.5 rounded-full w-fit mt-0.5 leading-tight",
                                    statusCfg.className
                                  )}>
                                    {statusCfg.label}
                                  </span>
                                </div>
                              </td>
                              {/* Serviço */}
                              <td className="px-3 py-2 overflow-hidden">
                                <span className="text-xs text-muted-foreground truncate block" title={getServiceName(appt.serviceId)}>
                                  {getServiceName(appt.serviceId)}
                                </span>
                              </td>
                              {/* Ações */}
                              <td className={cn(
                                "px-3 py-2",
                                !isLastProf && "border-r"
                              )}>
                                <div className="flex gap-0.5">
                                  {appt.status === "scheduled" && (
                                    <button
                                      title="Concluir"
                                      onClick={() => updateStatusMutation.mutate({ id: appt.id, status: "completed" })}
                                      className="p-0.5 rounded text-green-600 hover:bg-green-50 transition-colors"
                                    >
                                      <CheckCircle2 className="h-3 w-3" />
                                    </button>
                                  )}
                                  {(appt.status as string) !== "cancelled" && (
                                    <button
                                      title="Cancelar"
                                      onClick={() => updateStatusMutation.mutate({ id: appt.id, status: "cancelled" })}
                                      className="p-0.5 rounded text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                      <XCircle className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── CALENDAR VIEW ─── */}
      {viewMode === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(m => new Date(m.getFullYear(), m.getMonth() - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="font-serif text-xl capitalize">
                {format(currentDate, "MMMM yyyy", { locale: ptBR })}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(m => new Date(m.getFullYear(), m.getMonth() + 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 border-b">
              {weekDays.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground tracking-wide">
                  {d}
                </div>
              ))}
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  const dayAppts = getAppointmentsForDay(day);
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const todayDay = isToday(day);
                  return (
                    <div
                      key={idx}
                      onClick={() => { setSelectedDate(day); }}
                      className={cn(
                        "min-h-[80px] p-1.5 border-b border-r cursor-pointer transition-colors",
                        !isCurrentMonth && "opacity-40 bg-muted/30",
                        isSelected && "bg-accent/50",
                        !isSelected && isCurrentMonth && "hover:bg-muted/50",
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 flex items-center justify-center rounded-full text-sm mb-1 mx-auto",
                        todayDay && "bg-primary text-primary-foreground font-medium",
                        isSelected && !todayDay && "bg-accent-foreground/10 font-medium",
                      )}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {dayAppts.slice(0, 2).map((a) => (
                          <div
                            key={a.id}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded truncate font-medium",
                              a.status === "scheduled" && "bg-blue-100 text-blue-700",
                              a.status === "completed" && "bg-green-100 text-green-700",
                              a.status === "cancelled" && "bg-red-100 text-red-600 line-through opacity-70",
                            )}
                          >
                            {formatUTCTime(a.scheduledAt)} {a.clientName}
                          </div>
                        ))}
                        {dayAppts.length > 2 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            +{dayAppts.length - 2} mais
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Day detail panel */}
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h3 className="font-serif text-lg">
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedDayAppointments.length} atendimento{selectedDayAppointments.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="overflow-y-auto max-h-[500px]">
              {selectedDayAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <CalendarDays className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum agendamento neste dia</p>
                  <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => openNewModal()}>
                    <Plus className="h-3 w-3" />
                    Agendar
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {selectedDayAppointments.map((appt) => {
                    const status = STATUS_CONFIG[appt.status];
                    return (
                      <div key={appt.id} className="p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-medium text-sm">{appt.clientName}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {formatUTCTime(appt.scheduledAt)}
                            </p>
                          </div>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", status.className)}>
                            {status.label}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <p className="flex items-center gap-1.5">
                            <Scissors className="h-3 w-3 shrink-0" />
                            <span className="flex-1">{getServiceName(appt.serviceId)}</span>
                            <span className="font-semibold text-primary">
                              {formatCurrency(appt.servicePrice)}
                            </span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <span className="text-muted-foreground/60">por</span>
                            {getProfessionalName(appt.professionalId)}
                          </p>
                        </div>
                        <div className="flex gap-2 mt-3">
                          {appt.status === "scheduled" && (
                            <Button
                              size="sm" variant="outline"
                              className="flex-1 h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                              onClick={() => updateStatusMutation.mutate({ id: appt.id, status: "completed" })}
                            >
                              <CheckCircle2 className="h-3 w-3" /> Concluir
                            </Button>
                          )}
                          {appt.status !== "cancelled" && (
                            <Button
                              size="sm" variant="outline"
                              className="flex-1 h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => updateStatusMutation.mutate({ id: appt.id, status: "cancelled" })}
                            >
                              <XCircle className="h-3 w-3" /> Cancelar
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── LIST VIEW ─── */}
      {viewMode === "list" && (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-serif text-xl capitalize">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(m => new Date(m.getFullYear(), m.getMonth() - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(m => new Date(m.getFullYear(), m.getMonth() + 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhum agendamento encontrado</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[80px_1fr_1fr_100px_120px_80px] gap-0 border-b bg-muted/30 text-xs font-medium text-muted-foreground px-6 py-2">
                <span>Data/Hora</span>
                <span>Cliente</span>
                <span>Serviço</span>
                <span>Profissional</span>
                <span className="text-right">Valor</span>
                <span className="text-center">Status</span>
              </div>
              <div className="divide-y">
                {appointments
                  .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                  .map((appt) => {
                    const status = STATUS_CONFIG[appt.status];
                    return (
                      <div key={appt.id} className="grid grid-cols-[80px_1fr_1fr_100px_120px_80px] gap-0 items-center px-6 py-3 hover:bg-muted/20 transition-colors">
                        <div>
                          <p className="text-xs text-muted-foreground">{format(new Date(appt.scheduledAt), "dd/MM")}</p>
                          <p className="text-sm font-medium">{formatUTCTime(appt.scheduledAt)}</p>
                        </div>
                        <p className={cn("text-sm font-medium truncate pr-2", appt.status === "cancelled" && "line-through text-muted-foreground")}>
                          {appt.clientName}
                        </p>
                        <p className={cn("text-xs text-muted-foreground truncate pr-2", appt.status === "cancelled" && "line-through")}>
                          {getServiceName(appt.serviceId)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate pr-2">
                          {getProfessionalName(appt.professionalId)}
                        </p>
                        <p className={cn(
                          "text-sm font-semibold text-right pr-2",
                          appt.status === "cancelled" ? "line-through text-muted-foreground" : "text-primary"
                        )}>
                          {formatCurrency(appt.servicePrice)}
                        </p>
                        <div className="flex items-center justify-center gap-1">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", status.className)}>
                            {status.label}
                          </span>
                          <div className="flex gap-0.5 ml-1">
                            {appt.status === "scheduled" && (
                              <button
                                title="Concluir"
                                onClick={() => updateStatusMutation.mutate({ id: appt.id, status: "completed" })}
                                className="p-1 rounded text-green-600 hover:bg-green-50 transition-colors"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {appt.status !== "cancelled" && (
                              <button
                                title="Cancelar"
                                onClick={() => updateStatusMutation.mutate({ id: appt.id, status: "cancelled" })}
                                className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
        </div>
      )}

      {/* New Appointment Modal */}
      <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Novo Agendamento</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nome do Cliente</FormLabel>
                      <FormControl><Input placeholder="Nome completo" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientPhone"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Telefone <span className="text-muted-foreground">(opcional)</span></FormLabel>
                      <FormControl><Input placeholder="(00) 00000-0000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="professionalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profissional</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {professionals.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Bloco de múltiplos serviços */}
                <div className="col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Serviços</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setServiceItems((prev) => [...prev, { serviceId: "", price: "" }])}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Adicionar serviço
                    </Button>
                  </div>
                  {serviceItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Select
                          value={item.serviceId}
                          onValueChange={(val) => {
                            const svc = services.find((s) => String(s.id) === val);
                            setServiceItems((prev) =>
                              prev.map((s, i) =>
                                i === idx
                                  ? { ...s, serviceId: val, price: svc ? Number(svc.price).toFixed(2).replace(".", ",") : s.price }
                                  : s
                              )
                            );
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione o serviço" />
                          </SelectTrigger>
                          <SelectContent>
                            {services.map((s) => (
                              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="relative w-32">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                        <Input
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          className="pl-8 text-sm"
                          value={item.price}
                          onChange={(e) => {
                            const val = e.target.value;
                            setServiceItems((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, price: val } : s))
                            );
                          }}
                        />
                      </div>
                      {serviceItems.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive"
                          onClick={() => setServiceItems((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {serviceItems.length > 1 && (
                    <p className="text-xs text-muted-foreground text-right">
                      Total: R$ {serviceItems
                        .filter((s) => s.price)
                        .reduce((acc, s) => acc + parseFloat(s.price.replace(/\./g, "").replace(",", ".") || "0"), 0)
                        .toFixed(2).replace(".", ",")}
                    </p>
                  )}
                </div>
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "dd/MM/yyyy") : "Selecione"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value ?? undefined}
                            onSelect={field.onChange}
                            locale={ptBR}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Observações <span className="text-muted-foreground">(opcional)</span></FormLabel>
                      <FormControl><Textarea placeholder="Informações adicionais..." rows={2} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowNewModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar Agendamento
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
