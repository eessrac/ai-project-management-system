import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { useTheme } from "../context/ThemeContext";
import {
  getProjectChatMessages,
  sendProjectChatMessage,
  getProjectMembers,
  getToken,
} from "../api";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

// JWT içerisindeki kullanıcı bilgilerini çözümler.
function parseJwt(token) {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// Mesaj gönderim tarihini okunabilir formata dönüştürür.
function formatMessageTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Kullanıcı adından profil avatarında gösterilecek baş harfleri oluşturur.
function getInitials(nameOrEmail) {
  if (!nameOrEmail) return "?";

  const parts = String(nameOrEmail).trim().split(" ").filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return String(nameOrEmail).slice(0, 2).toUpperCase();
}

// Mesaj içerisindeki etiketlenen kullanıcıları tıklanabilir hale getirir.
function renderMessageWithMentions(text, members, navigate, isDark) {
  if (!text) return null;

  const parts = text.split(/(@[a-zA-Z0-9_.çğıöşüÇĞİÖŞÜ]+)/g);

  return parts.map((part, index) => {
    if (part.startsWith("@")) {
      const username = part.slice(1).toLowerCase();

      const matchedUser = members.find((m) =>
        (m.email || "").split("@")[0].toLowerCase().includes(username)
      );

      if (matchedUser) {
        return (
          <span
            key={index}
            onClick={() => navigate(`/users/${matchedUser.id}`)}
            style={{
              color: isDark ? "#93c5fd" : "#2563eb",
              fontWeight: 700,
              background: isDark ? "#1e3a8a55" : "#eff6ff",
              borderRadius: 8,
              padding: "2px 6px",
              cursor: "pointer",
            }}
          >
            {part}
          </span>
        );
      }

      return (
        <span key={index} style={{ color: isDark ? "#93c5fd" : "#2563eb" }}>
          {part}
        </span>
      );
    }

    return <span key={index}>{part}</span>;
  });
}

// Kullanıcının yazdığı etiket metnini tespit eder.
function getMentionQuery(text, cursorPos) {
  const beforeCursor = text.slice(0, cursorPos);
  const match = beforeCursor.match(/@([a-zA-Z0-9_.çğıöşüÇĞİÖŞÜ]*)$/);
  return match ? match[1] : null;
}

export default function ProjectChat({ projectId }) {
  const { isDark } = useTheme();

  const token = getToken();
  const decoded = useMemo(() => parseJwt(token), [token]);
  const currentUserId = decoded?.userId || null;

  const navigate = useNavigate();
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const [typingUserIds, setTypingUserIds] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  const C = {
    cardBg: isDark ? "#111827" : "#ffffff",
    innerBg: isDark ? "#0f172a" : "#fafafa",
    chipBg: isDark ? "#1f2937" : "#fafafa",
    border: isDark ? "#374151" : "#ddd",
    softBorder: isDark ? "#334155" : "#eee",
    text: isDark ? "#f9fafb" : "#111827",
    muted: isDark ? "#9ca3af" : "#666",
    inputBg: isDark ? "#1f2937" : "#ffffff",
    messageOtherBg: isDark ? "#1f2937" : "#ffffff",
    messageOtherText: isDark ? "#f3f4f6" : "#111827",
    messageMineBg: isDark ? "#020617" : "#111111",
    messageMineBorder: isDark ? "#334155" : "#111111",
    green: "#22c55e",
    offline: isDark ? "#64748b" : "#cbd5e1",
  };

  // Projeye ait sohbet mesajlarını yükler.
  async function loadMessages() {
    try {
      setLoading(true);
      setError("");

      const data = await getProjectChatMessages(projectId);
      setMessages(data.messages || []);
    } catch (e) {
      console.error("loadMessages:", e);
      setError(e?.message || "Mesajlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  // Projedeki ekip üyelerini yükler.
  async function loadMembers() {
    try {
      const data = await getProjectMembers(projectId);
      setMembers(data.members || []);
    } catch (e) {
      console.error("loadMembers:", e);
    }
  }

  // Socket bağlantısını başlatır ve gerçek zamanlı mesajlaşmayı yönetir.
  useEffect(() => {
    if (!projectId || !token) return;

    loadMessages();
    loadMembers();

    const socket = io(SOCKET_URL, {
      auth: { token },
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("SOCKET CONNECTED");
      socket.emit("join-project-room", { projectId });
    });

    socket.on("connect_error", (err) => {
      console.error("SOCKET CONNECT ERROR:", err?.message || err);
    });

    socket.on("project-chat:new-message", (newMessage) => {
      setMessages((prev) => {
        const exists = prev.some((msg) => msg.id === newMessage.id);
        if (exists) return prev;
        return [...prev, newMessage];
      });
    });

    socket.on("project-chat:typing", ({ userId }) => {
      if (!userId || String(userId) === String(currentUserId)) return;

      setTypingUserIds((prev) => {
        const exists = prev.includes(String(userId));
        return exists ? prev : [...prev, String(userId)];
      });
    });

    socket.on("project-chat:typing-stop", ({ userId }) => {
      if (!userId) return;

      setTypingUserIds((prev) =>
        prev.filter((id) => String(id) !== String(userId))
      );
    });

    socket.on("project:online-users", ({ onlineUserIds = [] }) => {
      setOnlineUserIds(onlineUserIds.map(String));
    });

    return () => {
      socket.emit("project-chat:typing-stop", { projectId });
      socket.emit("leave-project-room", { projectId });
      socket.disconnect();
    };
  }, [projectId, token, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUserIds]);

  const filteredMembers = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();

    if (!q) {
      return members.slice(0, 5);
    }

    return members
      .filter((m) => {
        const fullName = String(m.full_name || "").toLowerCase();
        const emailName = String(m.email || "").split("@")[0].toLowerCase();

        return fullName.includes(q) || emailName.includes(q);
      })
      .slice(0, 5);
  }, [members, mentionQuery]);

  const typingUsers = useMemo(() => {
    return members.filter((m) => typingUserIds.includes(String(m.id)));
  }, [members, typingUserIds]);

  const onlineCount = onlineUserIds.length;

  // Yazılan mesajı diğer kullanıcılara "yazıyor" bilgisi olarak gönderir.
  function emitTyping() {
    if (!socketRef.current) return;

    socketRef.current.emit("project-chat:typing", { projectId });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("project-chat:typing-stop", { projectId });
    }, 1200);
  }

  // Mesaj giriş alanındaki değişiklikleri yönetir ve etiket önerilerini açar.
  function handleTextChange(e) {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart ?? value.length;

    setText(value);
    emitTyping();

    const query = getMentionQuery(value, cursorPos);

    if (query !== null) {
      setMentionOpen(true);
      setMentionQuery(query);
      setSelectedMentionIndex(0);
    } else {
      setMentionOpen(false);
      setMentionQuery("");
    }
  }

  // Seçilen kullanıcı etiketini mesaj alanına ekler.
  function insertMention(member) {
    if (!inputRef.current) return;

    const input = inputRef.current;
    const cursorPos = input.selectionStart ?? text.length;
    const beforeCursor = text.slice(0, cursorPos);
    const afterCursor = text.slice(cursorPos);

    const replacedBefore = beforeCursor.replace(
      /@([a-zA-Z0-9_.çğıöşüÇĞİÖŞÜ]*)$/,
      `@${(member.email || "").split("@")[0]} `
    );

    const nextValue = replacedBefore + afterCursor;

    setText(nextValue);
    setMentionOpen(false);
    setMentionQuery("");

    requestAnimationFrame(() => {
      input.focus();
      const newPos = replacedBefore.length;
      input.setSelectionRange(newPos, newPos);
    });
  }

  // Yazılan mesajı projedeki diğer kullanıcılara gönderir.
  async function handleSend() {
    const message = text.trim();
    if (!message || sending) return;

    try {
      setSending(true);
      setError("");

      const data = await sendProjectChatMessage(projectId, message);
      const newMessage = data.chat_message;

      setMessages((prev) => {
        const exists = prev.some((msg) => msg.id === newMessage.id);
        if (exists) return prev;
        return [...prev, newMessage];
      });

      setText("");
      setMentionOpen(false);
      setMentionQuery("");
      socketRef.current?.emit("project-chat:typing-stop", { projectId });
    } catch (e) {
      console.error("handleSend:", e);
      setError(e?.message || "Mesaj gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  // Klavye kısayollarını yönetir (Enter, yön tuşları vb.).
  function handleKeyDown(e) {
    if (mentionOpen && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev + 1 >= filteredMembers.length ? 0 : prev + 1
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex((prev) =>
          prev - 1 < 0 ? filteredMembers.length - 1 : prev - 1
        );
        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        insertMention(filteredMembers[selectedMentionIndex]);
        return;
      }

      if (e.key === "Escape") {
        setMentionOpen(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function isOnline(userId) {
    return onlineUserIds.includes(String(userId));
  }

  return (
    <div
      style={{
        height: 600,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: 16,
        marginTop: 0,
        background: C.cardBg,
        color: C.text,
        boxShadow: isDark
          ? "0 18px 45px rgba(0,0,0,0.28)"
          : "0 10px 25px rgba(15,23,42,0.06)",
        transition: "background 0.2s ease, border-color 0.2s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0, color: C.text }}>Proje Sohbeti</h3>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12, color: C.muted }}>
            Takım içi sohbet
          </span>
          <span style={{ fontSize: 12, color: C.muted }}>
            {messages.length} mesaj
          </span>
          <span
            style={{
              fontSize: 12,
              color: isDark ? "#4ade80" : "#166534",
              fontWeight: 700,
            }}
          >
            Online: {onlineCount}
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        {members.map((member) => (
          <div
            key={member.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: `1px solid ${C.softBorder}`,
              borderRadius: 999,
              padding: "6px 10px",
              background: C.chipBg,
              color: C.text,
              fontSize: 12,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isOnline(member.id) ? C.green : C.offline,
                display: "inline-block",
              }}
            />
            <span>{member.full_name}</span>
          </div>
        ))}
      </div>

      {error && (
        <div
          style={{
            marginBottom: 12,
            border: isDark ? "1px solid #7f1d1d" : "1px solid #fecaca",
            background: isDark ? "#450a0a" : "#fef2f2",
            color: isDark ? "#fecaca" : "#b91c1c",
            padding: "10px 12px",
            borderRadius: 10,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          height: 430,
          overflowY: "auto",
          border: `1px solid ${C.softBorder}`,
          borderRadius: 12,
          padding: 12,
          background: C.innerBg,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {loading ? (
          <div style={{ color: C.muted }}>Mesajlar yükleniyor...</div>
        ) : messages.length === 0 ? (
          <div style={{ color: C.muted }}>
            Henüz mesaj yok. İlk mesajı sen gönder.
          </div>
        ) : (
          messages.map((msg) => {
            const mine = msg.sender_id === currentUserId;

            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: mine ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{

                    maxWidth: "60%",
                    display: "flex",
                    gap: 10,
                    flexDirection: mine ? "row-reverse" : "row",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: mine
                        ? C.messageMineBg
                        : isDark
                        ? "#374151"
                        : "#e5e7eb",
                      color: mine || isDark ? "#ffffff" : "#333333",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 12,
                      flexShrink: 0,
                      border: isDark
                        ? "1px solid #475569"
                        : "1px solid transparent",
                    }}
                  >
                    {getInitials(msg.sender_name || msg.sender_email)}
                  </div>

                  <div
                    style={{
                      border: mine
                        ? `1px solid ${C.messageMineBorder}`
                        : `1px solid ${C.border}`,
                      background: mine ? C.messageMineBg : C.messageOtherBg,
                      color: mine ? "#ffffff" : C.messageOtherText,
                      borderRadius: 14,
                      padding: 12,
                      boxShadow: isDark
                        ? "0 10px 24px rgba(0,0,0,0.18)"
                        : "0 8px 18px rgba(15,23,42,0.05)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                        color: mine
                          ? "#e5e7eb"
                          : isDark
                          ? "#d1d5db"
                          : "#4b5563",
                      }}
                    >
                      {msg.sender_name || msg.sender_email || "Kullanıcı"}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {renderMessageWithMentions(
                        msg.message,
                        members,
                        navigate,
                        isDark
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        marginTop: 8,
                        color: mine
                          ? "rgba(255,255,255,0.72)"
                          : isDark
                          ? "#9ca3af"
                          : "#6b7280",
                      }}
                    >
                      {formatMessageTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {typingUsers.length > 0 && (
          <div style={{ fontSize: 12, color: C.muted, padding: "4px 2px" }}>
            {typingUsers.map((u) => u.full_name).join(", ")} yazıyor...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div
        style={{
          position: "relative",
          display: "flex",
          gap: 10,
          marginTop: 12,
        }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={handleTextChange}
          placeholder="Mesaj yaz... (@kullanici ile etiketleyebilirsin)"
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.inputBg,
            color: C.text,
            fontSize: 14,
            outline: "none",
          }}
          onFocus={(e) => {
            e.target.style.border = isDark
              ? "1px solid #60a5fa"
              : "1px solid #2563eb";
          }}
          onBlur={(e) => {
            e.target.style.border = `1px solid ${C.border}`;
          }}
          onKeyDown={handleKeyDown}
        />

        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          style={{
            border: isDark ? "1px solid #475569" : "1px solid #111",
            background: isDark ? "#020617" : "#111",
            color: "#fff",
            borderRadius: 10,
            padding: "0 18px",
            fontWeight: 700,
            cursor: sending || !text.trim() ? "not-allowed" : "pointer",
            opacity: sending || !text.trim() ? 0.65 : 1,
            transition: "0.2s ease",
          }}
        >
          {sending ? "..." : "Gönder"}
        </button>

        {mentionOpen && filteredMembers.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: 0,
              bottom: 58,
              width: 320,
              background: isDark ? "#1f2937" : "#ffffff",
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              boxShadow: isDark
                ? "0 18px 40px rgba(0,0,0,0.45)"
                : "0 12px 30px rgba(0,0,0,0.12)",
              overflow: "hidden",
              zIndex: 20,
            }}
          >
            {filteredMembers.map((member, index) => (
              <button
                key={member.id}
                type="button"
                onClick={() => insertMention(member)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background:
                    index === selectedMentionIndex
                      ? isDark
                        ? "#334155"
                        : "#f3f4f6"
                      : isDark
                      ? "#1f2937"
                      : "#ffffff",
                  color: C.text,
                  padding: "10px 12px",
                  cursor: "pointer",
                  borderBottom:
                    index !== filteredMembers.length - 1
                      ? `1px solid ${C.softBorder}`
                      : "none",
                }}
              >
                <div style={{ fontWeight: 700 }}>{member.full_name}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  @{(member.email || "").split("@")[0]} • {member.email}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}