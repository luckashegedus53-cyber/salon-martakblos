import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Bell, Plus, Trash2, CheckCircle2, Clock, CalendarDays, Edit2 } from "lucide-react";
import { format, isTomorrow, isToday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

const BOT_AVATAR = "https://d2xsxph8kpxj0f.cloudfront.net/310519663491162941/4eNQWSZhGCJTohuK9aDhoq/bot-avatar-HZS3ygo2WwXb3Mxepmj5BS.webp";

function getReminderStatus(date: Date, done: boolean) {
  if (done) return { label: "Concluído", color: "bg-green-100 text-green-700 border-green-200" };
  if (isPast(date) && !isToday(date)) return { label: "Vencido", color: "bg-red-100 text-red-700 border-red-200" };
  if (isToday(date)) return { label: "Hoje!", color: "bg-amber-100 text-amber-700 border-amber-200" };
  if (isTomorrow(date)) return { label: "Amanhã", color: "bg-blue-100 text-blue-700 border-blue-200" };
  return { label: "Agendado", color: "bg-stone-100 text-stone-600 border-stone-200" };
}

export default function RemindersPage() {
  const utils = trpc.useUtils();
  const { data: reminders = [], isLoading } = trpc.reminders.list.useQuery();
  const createMutation = trpc.reminders.create.useMutation({
    onSuccess: () => { utils.reminders.list.invalidate(); setOpenCreate(false); resetForm(); },
  });
  const updateMutation = trpc.reminders.update.useMutation({
    onSuccess: () => { utils.reminders.list.invalidate(); setEditId(null); },
  });
  const deleteMutation = trpc.reminders.delete.useMutation({
    onSuccess: () => utils.reminders.list.invalidate(),
  });

  const [openCreate, setOpenCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDate, setEditDate] = useState("");

  function resetForm() { setTitle(""); setDescription(""); setReminderDate(""); }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !reminderDate) return;
    createMutation.mutate({ title: title.trim(), description: description.trim() || undefined, reminderDate: new Date(reminderDate).toISOString() });
  }

  function startEdit(r: { id: number; title: string; description: string | null; reminderDate: Date; done: boolean }) {
    setEditId(r.id);
    setEditTitle(r.title);
    setEditDescription(r.description ?? "");
    // format datetime-local
    const d = new Date(r.reminderDate);
    const pad = (n: number) => String(n).padStart(2, "0");
    setEditDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId || !editTitle.trim() || !editDate) return;
    updateMutation.mutate({ id: editId, title: editTitle.trim(), description: editDescription.trim() || undefined, reminderDate: new Date(editDate).toISOString() });
  }

  const tomorrowReminders = reminders.filter(r => isTomorrow(new Date(r.reminderDate)) && !r.done);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={BOT_AVATAR} alt="Assistente" className="w-12 h-12 rounded-full object-cover border-2 border-[#8B4A4A]/30 shadow" />
          <div>
            <h1 className="text-2xl font-serif text-stone-800">Lembretes</h1>
            <p className="text-sm text-stone-500">Gerencie seus lembretes — a assistente avisa 1 dia antes</p>
          </div>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="bg-[#8B4A4A] hover:bg-[#7a3f3f] text-white gap-2">
              <Plus className="w-4 h-4" /> Novo Lembrete
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif text-stone-800">Novo Lembrete</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-1">
                <Label>Título *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Comprar produtos para coloração" required />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes opcionais..." rows={3} />
              </div>
              <div className="space-y-1">
                <Label>Data e Hora *</Label>
                <Input type="datetime-local" value={reminderDate} onChange={e => setReminderDate(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full bg-[#8B4A4A] hover:bg-[#7a3f3f] text-white" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Salvando..." : "Salvar Lembrete"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alert: lembretes de amanhã */}
      {tomorrowReminders.length > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 flex gap-3 items-start">
            <img src={BOT_AVATAR} alt="Bot" className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-blue-200" />
            <div>
              <p className="font-semibold text-blue-800 text-sm">Oi! Tenho {tomorrowReminders.length} lembrete{tomorrowReminders.length > 1 ? "s" : ""} para amanhã:</p>
              <ul className="mt-1 space-y-1">
                {tomorrowReminders.map(r => (
                  <li key={r.id} className="text-blue-700 text-sm flex items-center gap-1">
                    <Bell className="w-3 h-3" /> <strong>{r.title}</strong>
                    {r.description && <span className="text-blue-500"> — {r.description}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de lembretes */}
      {isLoading ? (
        <div className="text-center text-stone-400 py-12">Carregando...</div>
      ) : reminders.length === 0 ? (
        <Card className="border-dashed border-stone-200">
          <CardContent className="py-16 flex flex-col items-center gap-3 text-stone-400">
            <CalendarDays className="w-12 h-12 opacity-30" />
            <p className="text-sm">Nenhum lembrete cadastrado ainda.</p>
            <p className="text-xs">Clique em "Novo Lembrete" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reminders.map(r => {
            const date = new Date(r.reminderDate);
            const status = getReminderStatus(date, r.done);
            const isEditing = editId === r.id;
            return (
              <Card key={r.id} className={`transition-all ${r.done ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  {isEditing ? (
                    <form onSubmit={handleEdit} className="space-y-3">
                      <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} required />
                      <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2} />
                      <Input type="datetime-local" value={editDate} onChange={e => setEditDate(e.target.value)} required />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" className="bg-[#8B4A4A] hover:bg-[#7a3f3f] text-white" disabled={updateMutation.isPending}>Salvar</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditId(null)}>Cancelar</Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <button
                          onClick={() => updateMutation.mutate({ id: r.id, done: !r.done })}
                          className="mt-0.5 flex-shrink-0 text-stone-400 hover:text-green-600 transition-colors"
                          title={r.done ? "Marcar como pendente" : "Marcar como concluído"}
                        >
                          <CheckCircle2 className={`w-5 h-5 ${r.done ? "text-green-500" : ""}`} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-stone-800 ${r.done ? "line-through text-stone-400" : ""}`}>{r.title}</p>
                          {r.description && <p className="text-sm text-stone-500 mt-0.5">{r.description}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            <Clock className="w-3 h-3 text-stone-400" />
                            <span className="text-xs text-stone-500">
                              {format(date, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${status.color}`}>{status.label}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="icon" variant="ghost" className="w-8 h-8 text-stone-400 hover:text-stone-700" onClick={() => startEdit(r as any)}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="w-8 h-8 text-stone-400 hover:text-red-600" onClick={() => deleteMutation.mutate({ id: r.id })}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
