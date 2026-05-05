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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  addDays,
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isSameMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  List,
  Loader2,
  Phone,
  Plus,
  Scissors,
  User,
  XCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";

const appointmentSchema = z.object({
  clientName: z.string().min(1, "Nome do cliente é obrigatório"),
  clientPhone: z.string().optional(),
  professionalId: z.string().min(1, "Selecione um profissional"),
  serviceId: z.string().min(1, "Selecione um serviço"),
  date: z.date().nullable().optional(),
  time: z.string().min(1, "Informe o horário"),
  notes: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

const STATUS_CONFIG = {
  scheduled: { label: "Agendado", className: "status-scheduled", icon: Clock },
  completed: { label: "Concluído", className: "status-completed", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", className: "status-cancelled", icon: XCircle },
};

type ViewMode = "calendar" | "list";

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [filterProfessionalId, setFilterProfessionalId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const utils = trpc.useUtils();

  // Fetch data
  const { data: professionals = [] } = trpc.professionals.list.useQuery({ activeOnly: true });
  const { data: services = [] } = trpc.services.list.useQuery({ activeOnly: true });

  const startDate = startOfMonth(currentMonth);
  const endDate = endOfMonth(currentMonth);

  const { data: appointments = [], isLoading } = trpc.appointments.list.useQuery({
    professionalId: filterProfessionalId !== "all" ? parseInt(filterProfessionalId) : undefined,
    startDate,
    endDate,
    status: filterStatus !== "all" ? (filterStatus as "scheduled" | "completed" | "cancelled") : undefined,
  });

  // Mutations
  const createMutation = trpc.appointments.create.useMutation({
    onSuccess: () => {
      toast.success("Agendamento criado com sucesso!");
      utils.appointments.list.invalidate();
      setShowNewModal(false);
      form.reset();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatusMutation = trpc.appointments.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado!");
      utils.appointments.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      clientName: "",
      clientPhone: "",
      professionalId: "",
      serviceId: "",
      time: "09:00",
      notes: "",
    },
  });

  const onSubmit = (values: AppointmentFormValues) => {
    const baseDate = values.date ?? selectedDate ?? new Date();
    const [hours, minutes] = values.time.split(":").map(Number);
    const scheduledAt = new Date(baseDate);
    scheduledAt.setHours(hours!, minutes!, 0, 0);

    createMutation.mutate({
      clientName: values.clientName,
      clientPhone: values.clientPhone || null,
      professionalId: parseInt(values.professionalId),
      serviceId: parseInt(values.serviceId),
      scheduledAt,
      notes: values.notes || null,
    });
  };

  // Calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter((a) => isSameDay(new Date(a.scheduledAt), day));

  const selectedDayAppointments = selectedDate
    ? appointments.filter((a) => isSameDay(new Date(a.scheduledAt), selectedDate))
    : [];

  const getProfessionalName = (id: number) =>
    professionals.find((p) => p.id === id)?.name ?? "—";
  const getServiceName = (id: number) =>
    services.find((s) => s.id === id)?.name ?? "—";
  const getServicePrice = (id: number) =>
    services.find((s) => s.id === id)?.price ?? "0";

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={cn("gap-2", showFilters && "bg-accent")}
          >
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("calendar")}
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setShowNewModal(true)} className="gap-2">
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

      {viewMode === "calendar" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-card rounded-xl border shadow-sm overflow-hidden">
            {/* Month navigation */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="font-serif text-xl capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Week days header */}
            <div className="grid grid-cols-7 border-b">
              {weekDays.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground tracking-wide">
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  const dayAppts = getAppointmentsForDay(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const todayDay = isToday(day);

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDate(day)}
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
                            {format(new Date(a.scheduledAt), "HH:mm")} {a.clientName}
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
                {selectedDate
                  ? format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })
                  : "Selecione um dia"}
              </h3>
              {selectedDate && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedDayAppointments.length} atendimento{selectedDayAppointments.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <div className="overflow-y-auto max-h-[500px]">
              {selectedDayAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <CalendarDays className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum agendamento neste dia</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-2"
                    onClick={() => { form.setValue("date", selectedDate!); setShowNewModal(true); }}
                  >
                    <Plus className="h-3 w-3" />
                    Agendar
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {selectedDayAppointments
                    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                    .map((appt) => {
                      const status = STATUS_CONFIG[appt.status];
                      return (
                        <div key={appt.id} className="p-4 hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="font-medium text-sm">{appt.clientName}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" />
                                {format(new Date(appt.scheduledAt), "HH:mm")}
                              </p>
                            </div>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", status.className)}>
                              {status.label}
                            </span>
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <p className="flex items-center gap-1.5">
                              <Scissors className="h-3 w-3 shrink-0" />
                              {getServiceName(appt.serviceId)}
                              <span className="ml-auto font-medium text-foreground">
                                R$ {Number(appt.servicePrice).toFixed(2).replace(".", ",")}
                              </span>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <User className="h-3 w-3 shrink-0" />
                              {getProfessionalName(appt.professionalId)}
                            </p>
                            {appt.clientPhone && (
                              <p className="flex items-center gap-1.5">
                                <Phone className="h-3 w-3 shrink-0" />
                                {appt.clientPhone}
                              </p>
                            )}
                          </div>
                          {appt.status === "scheduled" && (
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50"
                                onClick={() => updateStatusMutation.mutate({ id: appt.id, status: "completed" })}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Concluir
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => updateStatusMutation.mutate({ id: appt.id, status: "cancelled" })}
                              >
                                <XCircle className="h-3 w-3" />
                                Cancelar
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* List view */
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-serif text-xl">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}>
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
            <div className="divide-y">
              {appointments
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                .map((appt) => {
                  const status = STATUS_CONFIG[appt.status];
                  return (
                    <div key={appt.id} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors">
                      <div className="text-center min-w-[48px]">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(appt.scheduledAt), "dd/MM")}
                        </p>
                        <p className="text-sm font-medium">
                          {format(new Date(appt.scheduledAt), "HH:mm")}
                        </p>
                      </div>
                      <Separator orientation="vertical" className="h-10" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{appt.clientName}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {getServiceName(appt.serviceId)} · {getProfessionalName(appt.professionalId)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">
                          R$ {Number(appt.servicePrice).toFixed(2).replace(".", ",")}
                        </p>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", status.className)}>
                          {status.label}
                        </span>
                      </div>
                      {appt.status === "scheduled" && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600 hover:bg-green-50"
                            onClick={() => updateStatusMutation.mutate({ id: appt.id, status: "completed" })}
                            title="Concluir"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-500 hover:bg-red-50"
                            onClick={() => updateStatusMutation.mutate({ id: appt.id, status: "cancelled" })}
                            title="Cancelar"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
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
                      <FormControl>
                        <Input placeholder="Nome completo" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
                      </FormControl>
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
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
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
                <FormField
                  control={form.control}
                  name="serviceId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serviço</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {services.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.name} — R$ {Number(s.price).toFixed(2).replace(".", ",")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Textarea placeholder="Informações adicionais..." rows={2} {...field} />
                      </FormControl>
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
