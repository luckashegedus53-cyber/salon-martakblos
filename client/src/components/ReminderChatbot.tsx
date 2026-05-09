import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Send, Bell } from "lucide-react";
import { format, isTomorrow, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

const BOT_AVATAR = "https://d2xsxph8kpxj0f.cloudfront.net/310519663491162941/4eNQWSZhGCJTohuK9aDhoq/bot-avatar-HZS3ygo2WwXb3Mxepmj5BS.webp";

type Message = {
  id: number;
  from: "bot" | "user";
  text: string;
};

function getBotGreeting(tomorrowCount: number, todayCount: number): string {
  if (tomorrowCount > 0 && todayCount > 0) {
    return `Oi! 👋 Você tem ${todayCount} lembrete${todayCount > 1 ? "s" : ""} para hoje e ${tomorrowCount} para amanhã. Posso te ajudar com algo?`;
  }
  if (tomorrowCount > 0) {
    return `Oi! 👋 Lembrete: você tem ${tomorrowCount} evento${tomorrowCount > 1 ? "s" : ""} agendado${tomorrowCount > 1 ? "s" : ""} para amanhã. Quer ver os detalhes?`;
  }
  if (todayCount > 0) {
    return `Oi! 👋 Você tem ${todayCount} lembrete${todayCount > 1 ? "s" : ""} para hoje! Quer ver os detalhes?`;
  }
  return "Oi! 👋 Sou sua assistente do salão. Nenhum lembrete urgente por agora. Como posso ajudar?";
}

export default function ReminderChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [msgId, setMsgId] = useState(1);
  const [hasGreeted, setHasGreeted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: allReminders = [] } = trpc.reminders.list.useQuery(undefined, { refetchInterval: 60000 });

  const tomorrowReminders = allReminders.filter(r => isTomorrow(new Date(r.reminderDate)) && !r.done);
  const todayReminders = allReminders.filter(r => isToday(new Date(r.reminderDate)) && !r.done);

  // Mostrar badge se houver lembretes urgentes
  const urgentCount = tomorrowReminders.length + todayReminders.length;

  // Saudação inicial ao abrir
  useEffect(() => {
    if (open && !hasGreeted) {
      const greeting = getBotGreeting(tomorrowReminders.length, todayReminders.length);
      setMessages([{ id: 0, from: "bot", text: greeting }]);
      setHasGreeted(true);
    }
  }, [open]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function addMessage(from: "bot" | "user", text: string) {
    setMessages(prev => [...prev, { id: msgId, from, text }]);
    setMsgId(prev => prev + 1);
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    addMessage("user", text);

    // Respostas simples baseadas em palavras-chave
    const lower = text.toLowerCase();
    setTimeout(() => {
      if (lower.includes("amanhã") || lower.includes("amanha")) {
        if (tomorrowReminders.length === 0) {
          addMessage("bot", "Nenhum lembrete para amanhã! 🎉 Aproveite o dia tranquilo.");
        } else {
          const list = tomorrowReminders.map(r =>
            `• ${r.title}${r.description ? ` — ${r.description}` : ""} (${format(new Date(r.reminderDate), "HH:mm", { locale: ptBR })})`
          ).join("\n");
          addMessage("bot", `Lembretes para amanhã:\n${list}`);
        }
      } else if (lower.includes("hoje")) {
        if (todayReminders.length === 0) {
          addMessage("bot", "Nenhum lembrete para hoje! ✅");
        } else {
          const list = todayReminders.map(r =>
            `• ${r.title}${r.description ? ` — ${r.description}` : ""} (${format(new Date(r.reminderDate), "HH:mm", { locale: ptBR })})`
          ).join("\n");
          addMessage("bot", `Lembretes de hoje:\n${list}`);
        }
      } else if (lower.includes("todos") || lower.includes("listar") || lower.includes("ver")) {
        const pending = allReminders.filter(r => !r.done);
        if (pending.length === 0) {
          addMessage("bot", "Nenhum lembrete pendente. Tudo em dia! 🌟");
        } else {
          const list = pending.slice(0, 5).map(r =>
            `• ${r.title} — ${format(new Date(r.reminderDate), "dd/MM 'às' HH:mm", { locale: ptBR })}`
          ).join("\n");
          addMessage("bot", `Próximos lembretes:\n${list}${pending.length > 5 ? `\n...e mais ${pending.length - 5}` : ""}`);
        }
      } else if (lower.includes("oi") || lower.includes("olá") || lower.includes("ola") || lower.includes("tudo")) {
        addMessage("bot", "Oi! 😊 Estou aqui para te lembrar dos seus compromissos. Pergunte sobre 'hoje', 'amanhã' ou 'todos' os lembretes!");
      } else if (lower.includes("obrigad")) {
        addMessage("bot", "De nada! Qualquer coisa é só chamar. 💅✨");
      } else {
        addMessage("bot", "Posso te ajudar com seus lembretes! Tente perguntar sobre 'hoje', 'amanhã' ou 'todos' os lembretes. Para criar novos, acesse a aba Lembretes no menu.");
      }
    }, 600);
  }

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full shadow-2xl overflow-hidden border-2 border-[#8B4A4A]/40 hover:scale-105 transition-transform ${open ? "hidden" : "block"}`}
        title="Assistente de Lembretes"
      >
        <img src={BOT_AVATAR} alt="Assistente" className="w-full h-full object-cover" />
        {urgentCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold border-2 border-white">
            {urgentCount}
          </span>
        )}
      </button>

      {/* Janela do chat */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 h-[480px] bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#8B4A4A] to-[#a05c5c] p-3 flex items-center gap-3">
            <img src={BOT_AVATAR} alt="Bot" className="w-10 h-10 rounded-full object-cover border-2 border-white/40 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">Assistente Kblo's</p>
              <p className="text-white/70 text-xs">Lembretes & Compromissos</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-stone-50">
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.from === "user" ? "flex-row-reverse" : ""}`}>
                {msg.from === "bot" && (
                  <img src={BOT_AVATAR} alt="Bot" className="w-7 h-7 rounded-full object-cover flex-shrink-0 self-end" />
                )}
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-line leading-relaxed ${
                    msg.from === "bot"
                      ? "bg-white text-stone-700 shadow-sm border border-stone-100 rounded-tl-sm"
                      : "bg-[#8B4A4A] text-white rounded-tr-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-stone-100 flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Digite uma mensagem..."
              className="flex-1 text-sm h-9 border-stone-200"
            />
            <Button type="submit" size="icon" className="h-9 w-9 bg-[#8B4A4A] hover:bg-[#7a3f3f] text-white flex-shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
