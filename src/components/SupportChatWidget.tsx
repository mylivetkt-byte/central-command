import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Send, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const INITIAL: Msg = {
  role: "assistant",
  content:
    "¡Hola! 👋 Soy tu asistente IA de Central. Pregúntame cómo publicar un pedido, gestionar repartidores, revisar reportes o cualquier duda del sistema.",
};

export const SupportChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([INITIAL]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("support-chat", {
        body: { messages: next.map(({ role, content }) => ({ role, content })) },
      });
      if (error) throw error;
      const content = (data as any)?.content || "No pude generar una respuesta.";
      setMessages((m) => [...m, { role: "assistant", content }]);
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "⚠️ No pude responder ahora. Verifica tu conexión o inténtalo en unos segundos.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 shadow-xl shadow-indigo-500/30 flex items-center justify-center text-white active:scale-90 transition-transform"
            aria-label="Abrir chat de soporte IA"
          >
            <Bot className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-5 right-5 z-50 w-[92vw] max-w-[380px] h-[560px] max-h-[80vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-black leading-tight">Soporte IA</p>
                  <p className="text-[10px] text-white/70">Asistente de Central</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-slate-50">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-md"
                        : "bg-white text-slate-800 border border-slate-200 rounded-bl-md"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
                    <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.15s]" />
                    <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-3 bg-white border-t border-slate-200">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Escribe tu pregunta..."
                disabled={loading}
                className="flex-1 text-sm bg-slate-50 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center disabled:opacity-30 active:scale-90 transition-transform"
              >
                <Send className="h-4 w-4 text-white" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SupportChatWidget;