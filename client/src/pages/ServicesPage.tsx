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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, Edit2, Loader2, Plus, Scissors } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const serviceSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  durationMinutes: z.coerce.number().min(1).default(60),
  price: z.string().min(1, "Valor é obrigatório"),
  defaultCommissionPct: z.string().optional().default("0"),
});

type ServiceFormInput = z.input<typeof serviceSchema>;
type ServiceFormValues = z.output<typeof serviceSchema>;

export default function ServicesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: services = [], isLoading } = trpc.services.list.useQuery({ activeOnly: false });

  const createMutation = trpc.services.create.useMutation({
    onSuccess: () => {
      toast.success("Serviço cadastrado!");
      utils.services.list.invalidate();
      setShowModal(false);
      form.reset();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.services.update.useMutation({
    onSuccess: () => {
      toast.success("Serviço atualizado!");
      utils.services.list.invalidate();
      setShowModal(false);
      setEditingId(null);
      form.reset();
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivateMutation = trpc.services.deactivate.useMutation({
    onSuccess: () => {
      toast.success("Serviço desativado.");
      utils.services.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const form = useForm<ServiceFormInput, unknown, ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: "",
      description: "",
      durationMinutes: 60,
      price: "",
      defaultCommissionPct: "0",
    },
  });

  const openCreate = () => {
    form.reset({ name: "", description: "", durationMinutes: undefined, price: "", defaultCommissionPct: "0" });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (s: (typeof services)[0]) => {
    form.reset({
      name: s.name,
      description: s.description ?? "",
      durationMinutes: s.durationMinutes ?? 60,
      price: String(s.price),
      defaultCommissionPct: String(s.defaultCommissionPct ?? "0"),
    });
    setEditingId(s.id);
    setShowModal(true);
  };

  const onSubmit = (values: ServiceFormValues) => {
    const data = {
      name: values.name,
      description: values.description || null,
      durationMinutes: values.durationMinutes,
      price: values.price,
      defaultCommissionPct: values.defaultCommissionPct || "0",
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Scissors className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-serif">Acesso Restrito</h2>
        <p className="text-muted-foreground mt-2">Esta área é exclusiva para administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif">Serviços</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie os serviços oferecidos</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Serviço
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-xl border text-center">
          <Scissors className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-serif text-xl mb-2">Nenhum serviço cadastrado</h3>
          <p className="text-muted-foreground text-sm mb-6">Adicione os serviços do seu salão</p>
          <Button onClick={openCreate} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Cadastrar Serviço
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Serviço</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Duração</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Comissão</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {services.map((s) => (
                <tr key={s.id} className={`hover:bg-muted/20 transition-colors ${!s.active ? "opacity-50" : ""}`}>
                  <td className="px-6 py-4">
                    <p className="font-medium text-sm">{s.name}</p>
                    {s.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{s.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {s.durationMinutes} min
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-sm font-medium">
                      R$ {Number(s.price).toFixed(2).replace(".", ",")}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right hidden sm:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {Number(s.defaultCommissionPct ?? 0).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.active ? "status-completed" : "status-cancelled"}`}>
                      {s.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      {s.active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground"
                          onClick={() => deactivateMutation.mutate({ id: s.id })}
                        >
                          Desativar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {editingId ? "Editar Serviço" : "Novo Serviço"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Serviço</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Corte Feminino" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição <span className="text-muted-foreground">(opcional)</span></FormLabel>
                    <FormControl>
                      <Textarea placeholder="Detalhes do serviço..." rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor (R$)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                          <Input type="number" min="0" step="0.01" placeholder="0,00" {...field} className="pl-9" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duração (min)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" placeholder="60" {...field} value={String(field.value ?? '')} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="defaultCommissionPct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comissão Padrão do Serviço (%)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type="number" min="0" max="100" step="0.5" placeholder="0" {...field} className="pr-8" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                      </div>
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Se definida, tem prioridade sobre a comissão padrão da profissional
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingId ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
