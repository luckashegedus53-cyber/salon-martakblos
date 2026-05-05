import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
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
import { trpc } from "@/lib/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { Edit2, Loader2, Mail, Phone, Plus, Scissors, UserX } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useLocation } from "wouter";

const professionalSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  specialty: z.string().optional(),
  defaultCommissionPct: z.string().optional().default("0"),
});

type ProfessionalFormInput = z.input<typeof professionalSchema>;
type ProfessionalFormValues = z.output<typeof professionalSchema>;

export default function ProfessionalsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: professionals = [], isLoading } = trpc.professionals.list.useQuery({ activeOnly: false });

  const createMutation = trpc.professionals.create.useMutation({
    onSuccess: () => {
      toast.success("Profissional cadastrado!");
      utils.professionals.list.invalidate();
      setShowModal(false);
      form.reset();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.professionals.update.useMutation({
    onSuccess: () => {
      toast.success("Profissional atualizado!");
      utils.professionals.list.invalidate();
      setShowModal(false);
      setEditingId(null);
      form.reset();
    },
    onError: (err) => toast.error(err.message),
  });

  const deactivateMutation = trpc.professionals.deactivate.useMutation({
    onSuccess: () => {
      toast.success("Profissional desativado.");
      utils.professionals.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const form = useForm<ProfessionalFormInput, unknown, ProfessionalFormValues>({
    resolver: zodResolver(professionalSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      specialty: "",
      defaultCommissionPct: "0",
    },
  });

  const openCreate = () => {
    form.reset({ name: "", email: "", phone: "", specialty: "", defaultCommissionPct: "0" });
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (p: (typeof professionals)[0]) => {
    form.reset({
      name: p.name,
      email: p.email ?? "",
      phone: p.phone ?? "",
      specialty: p.specialty ?? "",
      defaultCommissionPct: String(p.defaultCommissionPct ?? "0"),
    });
    setEditingId(p.id);
    setShowModal(true);
  };

  const onSubmit = (values: ProfessionalFormInput) => {
    const data = {
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
      specialty: values.specialty || null,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif">Profissionais</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie a equipe do salão
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Profissional
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : professionals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-xl border text-center">
          <Scissors className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="font-serif text-xl mb-2">Nenhum profissional cadastrado</h3>
          <p className="text-muted-foreground text-sm mb-6">Adicione os membros da sua equipe</p>
          <Button onClick={openCreate} variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Cadastrar Profissional
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {professionals.map((p) => (
            <div
              key={p.id}
              className={`bg-card rounded-xl border p-5 transition-all card-hover ${!p.active ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
                    style={{
                      background: "oklch(0.58 0.09 25 / 0.12)",
                      color: "oklch(0.58 0.09 25)",
                    }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{p.name}</h3>
                    {p.specialty && (
                      <p className="text-xs text-muted-foreground">{p.specialty}</p>
                    )}
                  </div>
                </div>
                <Badge
                  variant={p.active ? "default" : "secondary"}
                  className="text-[10px] shrink-0"
                  style={p.active ? { background: "oklch(0.58 0.09 25 / 0.1)", color: "oklch(0.58 0.09 25)", border: "none" } : {}}
                >
                  {p.active ? "Ativa" : "Inativa"}
                </Badge>
              </div>

              <div className="space-y-1.5 mb-4">
                {p.email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Mail className="h-3 w-3 shrink-0" />
                    {p.email}
                  </p>
                )}
                {p.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Phone className="h-3 w-3 shrink-0" />
                    {p.phone}
                  </p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{ background: "oklch(0.58 0.09 25 / 0.08)", color: "oklch(0.58 0.09 25)" }}>
                    Comissão padrão: {Number(p.defaultCommissionPct ?? 0).toFixed(0)}%
                  </span>
                </p>
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 h-8 text-xs"
                  onClick={() => openEdit(p)}
                >
                  <Edit2 className="h-3 w-3" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-xs text-muted-foreground"
                  onClick={() => setLocation("/commissions")}
                >
                  Comissões
                </Button>
                {p.active && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deactivateMutation.mutate({ id: p.id })}
                    title="Desativar"
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {editingId ? "Editar Profissional" : "Novo Profissional"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome da profissional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidade <span className="text-muted-foreground">(opcional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Colorista, Manicure..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone</FormLabel>
                      <FormControl>
                        <Input placeholder="(00) 00000-0000" {...field} />
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
                    <FormLabel>Comissão Padrão (%)</FormLabel>
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
                    <p className="text-xs text-muted-foreground">
                      Pode ser sobrescrita por regras específicas de serviço
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
                  {editingId ? "Salvar Alterações" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
