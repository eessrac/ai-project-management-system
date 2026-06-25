/**
 * AIProjectAssistant bileşeni
 *
 * Bu bileşen, proje detay sayfasında kullanılan yapay zekâ destekli sohbet asistanını oluşturur.
 * Kullanıcı, bu asistan üzerinden proje görevleri, sprint durumu, geciken işler,
 * risk analizi ve ekip iş yükü hakkında soru sorabilir.
 *
 * Bileşen açılır/kapanır bir sohbet penceresi şeklinde çalışır.
 * Kullanıcının yazdığı mesajlar backend tarafındaki AI chat endpointine gönderilir.
 * Backend, proje verilerini analiz ederek yapay zekâ cevabını döndürür.
 */

import { useState } from "react";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";

/**
 * Backend API adresi.
 * Ortam değişkeni tanımlıysa VITE_API_URL kullanılır.
 * Tanımlı değilse localhost:5000 varsayılan olarak alınır.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function AIProjectAssistant({ projectId }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Merhaba, ben AI Proje Asistanın. Bu proje hakkında görevler, sprintler, riskler ve iş yüküyle ilgili sorular sorabilirsin.",
    },
  ]);

  /**
   * Kullanıcının hızlıca soru sorabilmesi için hazır soru seçenekleri.
   * Bu sorulara tıklandığında inputa yazmadan doğrudan AI'a gönderilir.
   */
  const quickQuestions = [
    "Bu projede en riskli görev hangisi?",
    "Geciken görevleri özetle.",
    "Sprint durumunu analiz et.",
    "Ekip iş yükü nasıl?",
  ];

  /**
   * Kullanıcının mesajını veya hazır sorulardan seçilen metni backend'e gönderir.
   *
   * Mesaj boşsa veya sistem zaten cevap bekliyorsa işlem yapılmaz.
   * Kullanıcı mesajı önce sohbet ekranına eklenir.
   * Daha sonra ilgili proje ID'si ile AI chat API'sine POST isteği atılır.
   * Başarılı cevap gelirse asistan mesajı olarak ekrana yazdırılır.
   * Hata oluşursa hata mesajı yine asistan cevabı gibi gösterilir.
   */

  async function sendMessage(customMessage) {
    const text = (customMessage || message).trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setMessage("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${API_URL}/projects/${projectId}/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "AI cevap üretirken hata oluştu.");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "Cevap üretilemedi.",
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err.message || "Bir hata oluştu.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Ekranda önce sağ altta sabit duran yuvarlak AI butonu gösterilir.
   * Kullanıcı bu butona tıkladığında sohbet penceresi açılır.
   * Sohbet penceresinde hazır sorular, mesaj geçmişi, yüklenme durumu
   * ve yeni mesaj gönderme alanı bulunur.
   */
  
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg transition hover:bg-violet-700"
      >
        <MessageCircle size={24} />
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[560px] w-[380px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#111827]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-violet-600 px-4 py-3 text-white dark:border-slate-700">
            <div>
              <div className="font-semibold">AI Proje Asistanı</div>
              <div className="text-xs text-violet-100">
                Görev, sprint, risk ve iş yükü analizi
              </div>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 hover:bg-white/15"
            >
              <X size={20} />
            </button>
          </div>

          <div className="border-b border-slate-200 p-3 dark:border-slate-700">
            <div className="grid grid-cols-1 gap-2">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, index) => (
              <div
                key={index}
                className={`flex gap-2 ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {m.role === "assistant" && (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    <Bot size={16} />
                  </div>
                )}

                <div
                  className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-violet-600 text-white"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  }`}
                >
                  {m.content}
                </div>

                {m.role === "user" && (
                  <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    <User size={16} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                  <Bot size={16} />
                </div>
                <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Analiz ediliyor...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-3 dark:border-slate-700">
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                placeholder="Projeyle ilgili soru sor..."
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />

              <button
                onClick={() => sendMessage()}
                disabled={loading || !message.trim()}
                className="rounded-xl bg-violet-600 px-3 py-2 text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}