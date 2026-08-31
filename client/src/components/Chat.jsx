import { useState, useRef, useEffect } from "react";
import { Send, MessageCircle, Loader2 } from "lucide-react";
import { sendChatMessage } from "../lib/api";

export default function Chat({ context }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const reply = await sendChatMessage({ messages: nextMessages, context });
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: `⚠️ ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#12141b] p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-400">
        <MessageCircle size={16} /> Уточняющие вопросы диагносту
      </h2>

      <div className="mt-4 flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">
            Спросите, например: «Можно ли ехать на СТО своим ходом?» или «Что проверить в первую очередь?»
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-blue-500/20 text-blue-100"
                : "mr-auto bg-white/5 text-gray-200"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && (
          <div className="mr-auto flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Диагност печатает...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ваш вопрос..."
          className="flex-1 rounded-lg border border-white/10 bg-[#0b0d12] px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-3.5 py-2 text-white transition hover:bg-blue-500 disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
