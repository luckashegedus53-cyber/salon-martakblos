import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const ruleSchema = z.object({
  professionalId: z.string().min(1, "Selecione um profissional"),
  serviceId: z.string().optional(),
  commissionPct: z.string().min(1, "Informe o percentual"),
});

type RuleFormValues = z.infer<typeof ruleSchema>;

export default function CommissionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [showModal, setShowModal] = useState(false);
  const [filterProfId, setFilterProfId] = useState<string>("all");

  const utils = trpc.useUtils();
  const { data: professionals = [] } = trpc.professionals.list.useQuery({ activeOnly: true });
  const { data: services = [] } = trpc.services.list.useQuery({ activeOnly: true });
  const { data: rules = [], isLoading } = trpc.commission.list.useQuery({
    professionalId: filterProfId !== "all" ? parseInt(filterProfId) : undefined,
  });

  const upsertMutation = trpc.commission.upsert.useMutation({
    onSuccess: () => {
      toast.success("Regra de comissão salva!");
      utils.commission.list.invalidate();
      setShowModal(false);
      form.reset();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.commission.delete.useMutation({
    onSuccess: () => {
      toast.success("Regra removida.");
      utils.commission.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      professionalId: "",
      serviceId: "",
      commissionPct: "",
    },
  });

  const onSubmit = (values: RuleFormValues) => {
    upsertMutation.mutate({
      professionalId: parseInt(values.professionalId),
      serviceId: values.serviceId ? parseInt(values.serviceId) : null,
      commissionPct: values.commissionPct,
    });
  };

  const getProfessionalName = (id: number) =>
    professionals.find((p) => p.id === id)?.name ?? "—";
  const getServiceName = (id: number | null) =>
    id ? (services.find((s) => s.id === id)?.name ?? "—") : null;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-serif">Acesso Restrito</h2>
        <p className="text-muted-foreground mt-2">Esta área é exclusiva para administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif">Regras de Comissão</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure comissões específicas por profissional e serviço
          </p>
        </div>
        <Button onClick={() => { form.reset(); setShowModal(true); }} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Regra
        </Button>
      </div>

      {/* Priority explanation */}
      <div className="bg-accent/50 rounded-xl p-4 border border-accent">
        <h3 className="text-sm font-medium mb-2">Hierarquia de Comissões</h3>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>1. <strong>Regra específica</strong> (profissional + serviço) — maior prioridade</p>
          <p>2. <strong>Regra geral</strong> da profissional (todos os serviços)</p>
          <p>3. <strong>Comissão padrão</strong> do serviço</p>
          <p>4. <strong>Comissão padrão</strong> da profissional — menor prioridade</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground">Filtrar por profissional:</label>
        <Select value={filterProfId} onValueChange={setFilterProfId}>
          <SelectTrigger className="w-48 h-8 text-sm">
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

      {/* Rules list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-xl border text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-serif text-xl mb-2">Nenhuma regra configurada</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Crie regras específicas para sobrescrever as comissões padrão
          </p>
          <Button onClick={() => { form.reset(); setShowModal(true); }} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Criar Regra
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Profissional</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Serviço</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Comissão</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rules.map((rule) => {
                const serviceName = getServiceName(rule.serviceId);
                return (
                  <tr key={rule.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                          style={{ background: "oklch(0.58 0.09 25 / 0.1)", color: "oklch(0.58 0.09 25)" }}
                        >
                          {getProfessionalName(rule.professionalId).charAt(0)}
                        </div>
                        <span className="text-sm font-medium">{getProfessionalName(rule.professionalId)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-muted-foreground">
                        {serviceName ?? <em className="text-muted-foreground/60">Todos os serviços</em>}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm font-semibold" style={{ color: "oklch(0.58 0.09 25)" }}>
                        {Number(rule.commissionPct).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rule.serviceId ? "status-scheduled" : "status-completed"}`}>
                        {rule.serviceId ? "Específica" : "Geral"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate({ id: rule.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Nova Regra de Comissão</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="professionalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profissional</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a profissional" />
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
                    <FormLabel>Serviço <span className="text-muted-foreground">(deixe em branco para regra geral)</span></FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os serviços (regra geral)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="all_services">Todos os serviços (regra geral)</SelectItem>
                        {services.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="commissionPct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Percentual de Comissão</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          placeholder="Ex: 40"
                          {...field}
                          className="pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar Regra
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
