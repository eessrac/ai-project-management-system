import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, getToken } from "../api";
import ProjectChat from "../components/ProjectChat";
import { useTheme } from "../context/ThemeContext.jsx";
import AIProjectAssistant from "../components/AIProjectAssistant";

function getColors(isDark) {
  return {
    bg: isDark ? "#0B1020" : "#F8FAFC",
    card: isDark ? "#111827" : "#FFFFFF",
    card2: isDark ? "#0F172A" : "#F8FAFC",
    soft: isDark ? "#172033" : "#FCFCFD",
    border: isDark ? "#263244" : "#E2E8F0",
    borderSoft: isDark ? "#1F2937" : "#EEF2F7",
    text: isDark ? "#F8FAFC" : "#0F172A",
    textSoft: isDark ? "#CBD5E1" : "#475569",
    textMuted: isDark ? "#94A3B8" : "#94A3B8",
    primary: isDark ? "#8B5CF6" : "#4F46E5",
    primarySoft: isDark ? "rgba(139,92,246,0.16)" : "#EEF2FF",
    success: "#10B981",
    successSoft: isDark ? "rgba(16,185,129,0.15)" : "#ECFDF5",
    warn: "#F59E0B",
    warnSoft: isDark ? "rgba(245,158,11,0.15)" : "#FFFBEB",
    danger: "#EF4444",
    dangerSoft: isDark ? "rgba(239,68,68,0.14)" : "#FEF2F2",
    shadow: isDark
      ? "0 14px 35px rgba(0,0,0,0.28)"
      : "0 2px 8px rgba(15,23,42,0.03)",
    menuShadow: isDark
      ? "0 18px 40px rgba(0,0,0,0.35)"
      : "0 12px 30px rgba(15,23,42,0.12)",
  };
}

function Section({ C, title, action, children, padding = 20 }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: C.shadow,
        color: C.text,
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "14px 20px",
            borderBottom: `1px solid ${C.borderSoft}`,
            background: C.card,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>
            {title}
          </h3>
          {action}
        </div>
      )}

      <div style={{ padding }}>{children}</div>
    </div>
  );
}

function Pill({ C, children, color = C.primary, bg = C.primarySoft }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color,
        background: bg,
      }}
    >
      {children}
    </span>
  );
}

function PrimaryButton({ C, children, ...props }) {
  return (
    <button
      {...props}
      style={{
        background: C.primary,
        color: "#fff",
        border: "none",
        borderRadius: 10,
        padding: "9px 14px",
        fontWeight: 700,
        fontSize: 14,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
        boxShadow: "0 8px 18px rgba(79,70,229,0.18)",
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ C, children, ...props }) {
  return (
    <button
      {...props}
      style={{
        background: C.card2,
        color: C.text,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "9px 14px",
        fontWeight: 700,
        fontSize: 14,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

function parseJwt(token) {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = getToken();

  const { isDark } = useTheme();
  const C = useMemo(() => getColors(isDark), [isDark]);

  const [searchParams] = useSearchParams();
  const chatSectionRef = useRef(null);

  const [project, setProject] = useState(null);
  const [myRole, setMyRole] = useState(null);

  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPagination, setLogsPagination] = useState(null);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);

  const [openLogMenuId, setOpenLogMenuId] = useState(null);

  const [error, setError] = useState("");
  const [activeSprint, setActiveSprint] = useState(null);
  const [loadingSprint, setLoadingSprint] = useState(false);

  const [leaving, setLeaving] = useState(false);

  const [tab, setTab] = useState("overview");

  const [chatMessages, setChatMessages] = useState([]);
  const [lastReadChatAt, setLastReadChatAt] = useState(null);

  const decoded = useMemo(() => parseJwt(token), [token]);
  const currentUserId = decoded?.userId || null;

  async function loadDetail() {
    try {
      const data = await apiFetch(`/projects/${id}`, { token });
      setProject(data.project);
      setMyRole(data.my_role || null);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadMembers() {
    try {
      setLoadingMembers(true);
      const data = await apiFetch(`/projects/${id}/members`, { token });
      setMembers(data.members || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function loadActivity(page = 1, append = false) {
    try {
      if (append) setLoadingMoreLogs(true);
      else setLoadingLogs(true);

      const data = await apiFetch(`/projects/${id}/activity?page=${page}&limit=20`, {
        token,
      });

      const nextLogs = data.logs || [];
      setLogs((prev) => (append ? [...prev, ...nextLogs] : nextLogs));
      setLogsPagination(data.pagination || null);
      setLogsPage(page);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingLogs(false);
      setLoadingMoreLogs(false);
    }
  }

  async function handleLoadMoreLogs() {
    if (!logsPagination?.hasNextPage || loadingMoreLogs) return;
    await loadActivity(logsPage + 1, true);
  }

  async function loadActiveSprint() {
    try {
      setLoadingSprint(true);
      const data = await apiFetch(`/projects/${id}/sprints/active`, { token });
      setActiveSprint(data.sprint);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingSprint(false);
    }
  }

  async function loadChatUnreadInfo() {
    try {
      if (!id || !token) return;

      const data = await apiFetch(`/projects/${id}/chat`, { token });
      const messages = data.messages || [];

      const storageKey = `project_chat_last_read_at_${id}_${currentUserId}`;
      const savedReadAt = localStorage.getItem(storageKey);

      setChatMessages(messages);
      setLastReadChatAt(savedReadAt);
    } catch (e) {
      console.error("loadChatUnreadInfo:", e);
    }
  }

  async function onLeaveProject() {
    const ok = window.confirm("Bu projeden ayrılmak istiyor musun?");
    if (!ok) return;

    try {
      setLeaving(true);
      await apiFetch(`/projects/${id}/leave`, { method: "DELETE", token });
      alert("Projeden ayrıldın");
      navigate("/projects");
    } catch (e) {
      alert(e.message || "Projeden ayrılınamadı");
    } finally {
      setLeaving(false);
    }
  }

  useEffect(() => {
    loadDetail();
    loadMembers();
    if (id && token) {
      loadActivity(1, false);
      loadChatUnreadInfo();
    }
    loadActiveSprint();
    // eslint-disable-next-line
  }, [id, currentUserId]);

  useEffect(() => {
    if (tab !== "chat" || !id || !currentUserId) return;

    const now = new Date().toISOString();
    const storageKey = `project_chat_last_read_at_${id}_${currentUserId}`;

    localStorage.setItem(storageKey, now);
    setLastReadChatAt(now);
  }, [tab, id, currentUserId]);

  useEffect(() => {
    function handleFocus() {
      loadChatUnreadInfo();
    }

    window.addEventListener("focus", handleFocus);

    return () => window.removeEventListener("focus", handleFocus);
    // eslint-disable-next-line
  }, [id, token, currentUserId]);

  useEffect(() => {
    const t = searchParams.get("tab");

    if (t === "chat") {
      setTab("chat");

      setTimeout(() => {
        chatSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 250);
    }
  }, [searchParams]);

  useEffect(() => {
    function handleClickOutside() {
      setOpenLogMenuId(null);
    }

    if (openLogMenuId) {
      document.addEventListener("click", handleClickOutside);
    }

    return () => document.removeEventListener("click", handleClickOutside);
  }, [openLogMenuId]);

  function getInitials(nameOrEmail) {
    if (!nameOrEmail) return "?";

    const text = String(nameOrEmail).trim();
    if (!text) return "?";

    const parts = text.split(" ").filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return text.slice(0, 2).toUpperCase();
  }

  function formatDateOnly(value) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("tr-TR");
  }

  function formatTimeOnly(value) {
    if (!value) return "-";

    return new Date(value).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function getActionLabel(action) {
    const map = {
      PROJECT_UPDATED: "Proje güncellendi",
      TASK_CREATED: "Görev oluşturuldu",
      STATUS_CHANGED: "Durum değişti",
      TASK_DELETED: "Görev silindi",
      TASK_ASSIGNED: "Görev atandı",
      TASK_ATTACHMENT_ADDED: "Dosya eklendi",
      TASK_ATTACHMENT_DELETED: "Dosya silindi",
      COMMENT_CREATED: "Yorum eklendi",
      SPRINT_CREATED: "Sprint oluşturuldu",
      SPRINT_UPDATED: "Sprint güncellendi",
    };

    return map[action] || action;
  }

  function getActionIcon(action) {
    const map = {
      PROJECT_UPDATED: "✏️",
      TASK_CREATED: "🟢",
      STATUS_CHANGED: "🔄",
      TASK_DELETED: "🗑️",
      TASK_ASSIGNED: "👤",
      TASK_ATTACHMENT_ADDED: "PDF",
      TASK_ATTACHMENT_DELETED: "🗑️",
      COMMENT_CREATED: "💬",
      SPRINT_CREATED: "🏃",
      SPRINT_UPDATED: "📝",
    };

    return map[action] || "•";
  }

  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === "LEADER" && b.role !== "LEADER") return -1;
    if (a.role !== "LEADER" && b.role === "LEADER") return 1;

    return (a.full_name || "").localeCompare(b.full_name || "", "tr", {
      sensitivity: "base",
    });
  });

  if (!project) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.textSoft,
          padding: 40,
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        Yükleniyor...
      </div>
    );
  }

  const leaderCount = members.filter((m) => m.role === "LEADER").length;
  const isArchived = Boolean(project?.is_archived || project?.archived_at);

  const unreadChatCount = chatMessages.filter((msg) => {
    if (!msg.created_at) return false;

    const isMine = String(msg.sender_id) === String(currentUserId);
    const msgTime = new Date(msg.created_at).getTime();
    const readTime = lastReadChatAt ? new Date(lastReadChatAt).getTime() : 0;

    return !isMine && msgTime > readTime;
  }).length;


  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100vh",
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: C.text,
        transition: "background .25s ease, color .25s ease",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 48px" }}>
        <div
          style={{
            fontSize: 13,
            color: C.textMuted,
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <button
            onClick={() => navigate("/projects")}
            style={{
              border: "none",
              background: "transparent",
              color: C.textSoft,
              cursor: "pointer",
              padding: 0,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Projeler
          </button>

          <span>/</span>
          <span style={{ color: C.text, fontWeight: 700 }}>{project.name}</span>
        </div>

        <div
          style={{
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 18,
            padding: 24,
            marginBottom: 20,
            boxShadow: C.shadow,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 20,
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                minWidth: 0,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${C.primary}, #7C3AED)`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 22,
                  flexShrink: 0,
                }}
              >
                {getInitials(project.name)}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <h1
                    style={{
                      margin: 0,
                      fontSize: 22,
                      fontWeight: 800,
                      color: C.text,
                      lineHeight: 1.2,
                    }}
                  >
                    {project.name}
                  </h1>

                  {myRole === "LEADER" ? (
                    <Pill C={C} color="#F59E0B" bg={C.warnSoft}>
                      👑 Leader
                    </Pill>
                  ) : (
                    <Pill C={C} color={C.textSoft} bg={C.card2}>
                      Üye
                    </Pill>
                  )}
                </div>

                {isArchived && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: C.warnSoft,
                      border: `1px solid ${isDark ? "rgba(245,158,11,0.28)" : "#FDE68A"}`,
                      color: C.warn,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    📦 Bu proje arşivlenmiş. Yalnızca görüntüleme yapılabilir.
                  </div>
                )}

                <p
                  style={{
                    margin: "6px 0 0",
                    color: C.textSoft,
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {project.description || "Bu proje için henüz açıklama eklenmemiş."}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <PrimaryButton C={C} onClick={() => navigate(`/projects/${id}/tasks`)}>
                {isArchived
                  ? "Taskları Görüntüle"
                  : activeSprint
                  ? "Görevlere Git"
                  : "Aktif Sprint Yok"}
              </PrimaryButton>

              <GhostButton C={C} onClick={() => navigate(`/projects/${id}/sprints`)}>
                Sprintler
              </GhostButton>

              {myRole === "LEADER" && (
                <GhostButton C={C} onClick={() => navigate(`/projects/${id}/settings`)}>
                  ⚙️ Yönet
                </GhostButton>
              )}

              <GhostButton
                C={C}
                onClick={onLeaveProject}
                disabled={leaving}
                style={{
                  color: C.danger,
                  borderColor: isDark ? "rgba(239,68,68,0.35)" : "#FECACA",
                }}
              >
                {leaving ? "Ayrılıyor..." : "Ayrıl"}
              </GhostButton>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
              marginTop: 22,
              paddingTop: 20,
              borderTop: `1px solid ${C.borderSoft}`,
            }}
          >
            <Stat C={C} label="Üye Sayısı" value={members.length} />
            <Stat C={C} label="Liderler" value={leaderCount} />
            <Stat
              C={C}
              label="Aktif Sprint"
              value={activeSprint ? activeSprint.name : "Yok"}
              valueColor={activeSprint ? C.success : C.textMuted}
            />
            <Stat C={C} label="Aktivite" value={logs.length} />
          </div>
        </div>

        {error && (
          <div
            style={{
              background: C.dangerSoft,
              border: `1px solid ${isDark ? "rgba(239,68,68,0.35)" : "#FECACA"}`,
              color: C.danger,
              padding: "10px 14px",
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 4,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: 4,
            marginBottom: 20,
            width: "fit-content",
            maxWidth: "100%",
            overflowX: "auto",
            boxShadow: C.shadow,
          }}
        >
          {[
            { key: "overview", label: "Genel Bakış" },
            {
              key: "activity",
              label: `Aktivite${logs.length ? ` (${logs.length})` : ""}`,
            },
            {
              key: "chat",
              label: `Sohbet${unreadChatCount > 0 ? ` (${unreadChatCount})` : ""}`,
            },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                border: "none",
                background: tab === t.key ? C.primarySoft : "transparent",
                color: tab === t.key ? C.primary : C.textSoft,
                fontWeight: 800,
                fontSize: 14,
                padding: "8px 16px",
                borderRadius: 8,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {t.label}

                {t.key === "chat" && unreadChatCount > 0 && (
                  <span
                    style={{
                      minWidth: 18,
                      height: 18,
                      padding: "0 6px",
                      borderRadius: 999,
                      background: C.danger,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 900,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {unreadChatCount}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>


        {tab === "overview" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
              gap: 16,
            }}
          >
            <Section C={C} title={`Üyeler (${members.length})`}>
              {loadingMembers ? (
                <div style={{ color: C.textMuted }}>Yükleniyor...</div>
              ) : members.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {sortedMembers.map((member) => (
                    <div
                      key={member.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: `1px solid ${C.borderSoft}`,
                        background: C.soft,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background: C.primarySoft,
                            color: C.primary,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(member.full_name || member.email)}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <button
                            onClick={() => navigate(`/users/${member.id}`)}
                            style={{
                              fontWeight: 700,
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              color: C.text,
                              textAlign: "left",
                              fontSize: 14,
                            }}
                          >
                            {member.full_name || "İsimsiz"}
                          </button>

                          <div
                            style={{
                              fontSize: 12,
                              color: C.textMuted,
                              marginTop: 2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {member.email}
                          </div>
                        </div>
                      </div>

                      {member.role === "LEADER" ? (
                        <Pill C={C} color="#F59E0B" bg={C.warnSoft}>
                          Leader
                        </Pill>
                      ) : (
                        <Pill C={C} color={C.textSoft} bg={C.card2}>
                          Member
                        </Pill>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: C.textMuted }}>Henüz üye yok.</div>
              )}
            </Section>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Section C={C} title="Aktif Sprint">
                {loadingSprint ? (
                  <div style={{ color: C.textMuted }}>Yükleniyor...</div>
                ) : activeSprint ? (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: C.success,
                        }}
                      />

                      <div style={{ fontWeight: 800, fontSize: 15, color: C.text }}>
                        {activeSprint.name}
                      </div>
                    </div>

                    <div style={{ color: C.textSoft, fontSize: 13, lineHeight: 1.6 }}>
                      📅 {activeSprint.start_date} → {activeSprint.end_date}
                    </div>

                    <div style={{ marginTop: 8 }}>
                      <Pill C={C} color={C.success} bg={C.successSoft}>
                        {activeSprint.status}
                      </Pill>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <PrimaryButton C={C} onClick={() => navigate(`/projects/${id}/tasks`)}>
                        Görevleri Aç →
                      </PrimaryButton>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: C.textSoft, fontSize: 14, lineHeight: 1.6 }}>
                    Aktif sprint yok.

                    <div style={{ marginTop: 12 }}>
                      <GhostButton C={C} onClick={() => navigate(`/projects/${id}/sprints`)}>
                        Sprint Oluştur
                      </GhostButton>
                    </div>
                  </div>
                )}
              </Section>

              <Section C={C} title="Hızlı Erişim">
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <QuickLink
                    C={C}
                    icon="📋"
                    label="Görevler"
                    onClick={() => navigate(`/projects/${id}/tasks`)}
                  />

                  <QuickLink
                    C={C}
                    icon="🏃"
                    label="Sprintler"
                    onClick={() => navigate(`/projects/${id}/sprints`)}
                  />

                  <QuickLink C={C} icon="💬" label="Sohbet" onClick={() => setTab("chat")} />

                  {myRole === "LEADER" && (
                    <QuickLink
                      C={C}
                      icon="⚙️"
                      label="Proje Ayarları"
                      onClick={() => navigate(`/projects/${id}/settings`)}
                    />
                  )}
                </div>
              </Section>
            </div>
          </div>
        )}

        {tab === "activity" && (
          <Section C={C} title="Aktivite Akışı">
            {loadingLogs ? (
              <div style={{ color: C.textMuted }}>Yükleniyor...</div>
            ) : logs.length ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        position: "relative",
                        border: `1px solid ${C.borderSoft}`,
                        borderRadius: 12,
                        padding: 12,
                        background: C.soft,
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: C.primarySoft,
                          color: C.primary,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: 13,
                          flexShrink: 0,
                        }}
                      >
                        {getInitials(log.actor_name || log.actor_email)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            color: C.text,
                            lineHeight: 1.5,
                            wordBreak: "break-word",
                          }}
                        >
                          <span style={{ marginRight: 6 }}>{getActionIcon(log.action)}</span>
                          {log.message}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            marginTop: 6,
                            color: C.textMuted,
                            fontSize: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <span>{log.actor_name || log.actor_email || "-"}</span>
                          <span>•</span>
                          <span>
                            {formatDateOnly(log.created_at)} {formatTimeOnly(log.created_at)}
                          </span>

                          {log.action && (
                            <>
                              <span>•</span>
                              <span>{getActionLabel(log.action)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenLogMenuId((prev) => (prev === log.id ? null : log.id));
                          }}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: 18,
                            lineHeight: 1,
                            padding: "4px 8px",
                            borderRadius: 8,
                            color: C.textMuted,
                          }}
                          title="Detaylar"
                        >
                          ⋮
                        </button>

                        {openLogMenuId === log.id ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: "absolute",
                              top: 30,
                              right: 0,
                              width: 240,
                              background: C.card,
                              border: `1px solid ${C.border}`,
                              borderRadius: 12,
                              boxShadow: C.menuShadow,
                              padding: 12,
                              zIndex: 999,
                              fontSize: 13,
                              color: C.textSoft,
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <div>
                                <strong style={{ color: C.text }}>Kullanıcı:</strong>{" "}
                                {log.actor_name || log.actor_email || "-"}
                              </div>

                              <div>
                                <strong style={{ color: C.text }}>Tarih:</strong>{" "}
                                {formatDateOnly(log.created_at)}
                              </div>

                              <div>
                                <strong style={{ color: C.text }}>Saat:</strong>{" "}
                                {formatTimeOnly(log.created_at)}
                              </div>

                              {log.action && (
                                <div>
                                  <strong style={{ color: C.text }}>İşlem:</strong>{" "}
                                  {getActionLabel(log.action)}
                                </div>
                              )}

                              {log.task_title && (
                                <div>
                                  <strong style={{ color: C.text }}>Görev:</strong>{" "}
                                  {log.task_title}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {logsPagination?.hasNextPage ? (
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
                    <GhostButton C={C} onClick={handleLoadMoreLogs} disabled={loadingMoreLogs}>
                      {loadingMoreLogs ? "Yükleniyor..." : "Daha fazla yükle"}
                    </GhostButton>
                  </div>
                ) : null}
              </>
            ) : (
              <div
                style={{
                  color: C.textMuted,
                  textAlign: "center",
                  padding: "32px 0",
                }}
              >
                Henüz aktivite yok.
              </div>
            )}
          </Section>
        )}

        {tab === "chat" && (
          <div ref={chatSectionRef}>
            <Section C={C} title="Proje Sohbeti" padding={0}>
              <ProjectChat projectId={id} />
            </Section>
          </div>
        )}
      </div>
      <AIProjectAssistant projectId={id} />
    </div>
  );
}

function Stat({ C, label, value, valueColor }) {
  return (
    <div
      style={{
        background: C.card2,
        border: `1px solid ${C.borderSoft}`,
        borderRadius: 14,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: C.textMuted,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: valueColor || C.text,
          marginTop: 4,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function QuickLink({ C, icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        border: `1px solid ${C.borderSoft}`,
        background: C.soft,
        borderRadius: 10,
        cursor: "pointer",
        textAlign: "left",
        fontSize: 14,
        fontWeight: 700,
        color: C.text,
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span>{label}</span>
      <span style={{ marginLeft: "auto", color: C.textMuted }}>→</span>
    </button>
  );
}