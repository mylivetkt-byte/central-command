import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, X } from "lucide-react";

interface Msg {
  id: string;
  role: "customer" | "driver";
  mine: boolean;
  message: string;
  created_at: string;
}

interface Props {
  orderId: string;
  driverName?: string | null;
  disabled?: boolean;
}

const time = (d: string) =>
  new Date(d).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

export default function CustomerChatPanel({ orderId, driverName, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const base = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `${base}/functions/v1/public-tracking?order_id=${encodeURIComponent(orderId)}&chat=1`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      const json = await res.json();
      const list: Msg[] = json?.messages || [];
      setMessages(list);
      if (!open) {
        // count new driver messages since last snapshot
        const driverCount = list.filter((m) => m.role === "driver").length;
        const prev = lastCountRef.current;
        if (driverCount > prev) setUnread((u) => u + (driverCount - prev));
        lastCountRef.current = driverCount;
      } else {
        lastCountRef.current = list.filter((m) => m.role === "driver").length;
      }
    } catch {}
  }, [orderId, open, base, key]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, [load]);

  useEffect(() => {
    if (open) { setUnread(0); bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }
  }, [open, messages.length]);

  const send = async () => {
    const msg = text.trim();
    if (!msg || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch(`${base}/functions/v1/public-tracking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ order_id: orderId, message: msg }),
      });
      if (!res.ok) setText(msg);
      else load();
    } catch {
      setText(msg);
    } finally {
      setSending(false);
    }
  };

  if (disabled) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[1100] h-14 w-14 rounded-full bg-indigo-600 shadow-2xl flex items-center justify-center active:scale-90 transition-transform"
          aria-label="Abrir chat"
        >
          <MessageCircle className="h-6 w-6 text-white" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">{unread}</span>
            </span>
          )}
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="fixed bottom-6 right-6 left-6 sm:left-auto sm:w-[380px] z-[1100] flex flex-col h-[70vh] max-h-[560px] bg-white rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.6)] overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 bg-indigo-600">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Chat</p>
                <p className="text-sm font-black text-white">
                  {driverName || "Mensajero"}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/10"
              >
                <X className="h-5 w-5 text-white" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-slate-50">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-10">
                  <MessageCircle className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-xs font-medium">Escribe al mensajero</p>
                  <p className="text-[10px] opacity-70 mt-1">Responderá tan pronto pueda</p>
                </div>
              ) : (
                messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${m.mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                        m.mine
                          ? "bg-indigo-600 text-white rounded-br-md"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-md"
                      }`}
                    >
                      <p className="leading-snug whitespace-pre-wrap break-words">{m.message}</p>
                      <p className={`text-[10px] mt-1 text-right ${m.mine ? "text-white/60" : "text-slate-400"}`}>
                        {time(m.created_at)}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <div className="flex items-center gap-2 p-3 border-t bg-white">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                maxLength={500}
                placeholder="Escribe un mensaje..."
                className="flex-1 bg-slate-50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={send}
                disabled={!text.trim() || sending}
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
}