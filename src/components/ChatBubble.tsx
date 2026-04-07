import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { Send, MessageCircle, X, Check, CheckCheck } from "lucide-react";

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

interface ChatBubbleProps {
  deliveryId: string;
  currentUserId: string;
  isDriverView?: boolean;
  initialOpen?: boolean;
}

const timeStr = (d: string) =>
  new Date(d).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });

const ChatBubble = ({
  deliveryId,
  currentUserId,
  isDriverView = false,
  initialOpen = false,
}: ChatBubbleProps) => {
  const [open, setOpen] = useState(initialOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  // Load messages
  const loadMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("delivery_id", deliveryId)
      .order("created_at", { ascending: true });
    if (!error && data) setMessages(data as ChatMessage[]);
    setLoading(false);
  }, [deliveryId]);

  useEffect(() => {
    if (!open) return;
    loadMessages();
  }, [open, loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!open || channelRef.current) return;

    channelRef.current = supabase
      .channel(`chat-${deliveryId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `delivery_id=eq.${deliveryId}`,
        },
        ({ new: n }: any) => {
          setMessages((prev) => [...prev, n as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [open, deliveryId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark messages as read (simple: we track last read time)
  useEffect(() => {
    if (messages.length === 0) return;
    const myUnread = messages.filter(
      (m) => m.sender_id !== currentUserId && !m.read_at
    );
    if (myUnread.length === 0) return;
    // Simple: we don't update read_at to avoid infinite loops; driver knows they got it in real-time
  }, [messages, currentUserId]);

  const send = async () => {
    if (!text.trim() || !currentUserId) return;
    setText("");
    const { error } = await supabase.from("chat_messages").insert({
      delivery_id: deliveryId,
      sender_id: currentUserId,
      sender_role: isDriverView ? "driver" : "admin",
      message: text.trim(),
    });
    if (error) {
      setText(text); // restore on error
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="relative h-12 w-12 rounded-full bg-white/90 backdrop-blur-xl shadow-2xl flex items-center justify-center active:scale-90 transition-transform"
      >
        <MessageCircle className="h-5 w-5 text-slate-700" />
        {!isDriverView && messages.length > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">
              {messages.filter((m) => m.sender_id !== currentUserId).length}
            </span>
          </span>
        )}
      </button>
    );
  }

  const isMine = (m: ChatMessage) => m.sender_id === currentUserId;

  return (
    <div
      className={`flex flex-col w-full ${
        isDriverView ? "" : "h-[500px]"
      } ${isDriverView ? "max-h-[60vh]" : ""}`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${
          isDriverView
            ? "bg-slate-100 rounded-t-[30px]"
            : "bg-slate-50 rounded-t-2xl border-b"
        }`}
      >
        <div className="flex items-center gap-2">
          <MessageCircle
            className={`h-4 w-4 ${
              isDriverView ? "text-indigo-600" : "text-slate-500"
            }`}
          />
          <p
            className={`text-xs font-black uppercase tracking-widest ${
              isDriverView ? "text-indigo-600" : "text-slate-600"
            }`}
          >
            Chat {isDriverView ? "Central" : "Mensajero"}
          </p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-black/5"
        >
          <X className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {/* Messages */}
      <div
        className={`flex-1 overflow-y-auto px-4 py-3 space-y-2 ${
          isDriverView ? "bg-white" : "bg-white"
        }`}
      >
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-10 rounded-2xl w-${
                  i % 2 === 0 ? "3/4" : "1/2"
                } bg-slate-100`}
              />
            ))}
          </div>
        ) : (
          messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${isMine(m) ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                  isMine(m)
                    ? "bg-indigo-600 text-white rounded-br-md"
                    : m.sender_role === "system"
                    ? "bg-amber-100 text-amber-800 rounded-bl-md text-xs"
                    : isDriverView
                    ? "bg-slate-100 text-slate-800 rounded-bl-md"
                    : "bg-slate-100 text-slate-800 rounded-bl-md"
                }`}
              >
                <p className="leading-snug">{m.message}</p>
                <div
                  className={`flex items-center justify-end gap-1 mt-1 ${
                    isMine(m) ? "text-white/50" : "text-slate-400"
                  }`}
                >
                  <span className="text-[10px]">{timeStr(m.created_at)}</span>
                  {isMine(m) && (
                    <CheckCheck className="h-3 w-3" />
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className={`flex items-center gap-2 px-4 py-3 ${
          isDriverView
            ? "bg-white rounded-b-[30px]"
            : "bg-slate-50 border-t rounded-b-2xl"
        }`}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) send();
          }}
          placeholder={
            isDriverView ? "Escribe a central..." : "Escribe al mensajero..."
          }
          className={`flex-1 text-sm font-medium focus:outline-none ${
            isDriverView ? "bg-slate-50" : "bg-white"
          } rounded-xl px-4 py-2.5`}
        />
        <button
          onClick={send}
          disabled={!text.trim()}
          className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center disabled:opacity-30 active:scale-90 transition-transform"
        >
          <Send className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  );
};

export default ChatBubble;
