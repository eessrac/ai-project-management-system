import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAllNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../api";

const COLORS = {
  bg: "var(--notif-bg)",
  card: "var(--notif-card)",
  cardSoft: "var(--notif-card-soft)",
  border: "var(--notif-border)",
  borderSoft: "var(--notif-border-soft)",
  text: "var(--notif-text)",
  textSoft: "var(--notif-text-soft)",
  textMuted: "var(--notif-text-muted)",
  primary: "var(--notif-primary)",
  primarySoft: "var(--notif-primary-soft)",
  success: "var(--notif-success)",
  successSoft: "var(--notif-success-soft)",
  warn: "var(--notif-warn)",
  warnSoft: "var(--notif-warn-soft)",
  danger: "var(--notif-danger)",
  dangerSoft: "var(--notif-danger-soft)",
  info: "var(--notif-info)",
  infoSoft: "var(--notif-info-soft)",
  purple: "var(--notif-purple)",
  purpleSoft: "var(--notif-purple-soft)",
  header: "var(--notif-header)",
  shadow: "var(--notif-shadow)",
};

const NOTIFICATION_THEME_STYLE = `
  .notifications-theme-page {
    --notif-bg: #F8FAFC;
    --notif-card: #FFFFFF;
    --notif-card-soft: #FAFBFD;
    --notif-border: #E2E8F0;
    --notif-border-soft: #EEF2F7;
    --notif-text: #0F172A;
    --notif-text-soft: #475569;
    --notif-text-muted: #94A3B8;
    --notif-primary: #4F46E5;
    --notif-primary-soft: #EEF2FF;
    --notif-success: #10B981;
    --notif-success-soft: #ECFDF5;
    --notif-warn: #F59E0B;
    --notif-warn-soft: #FFFBEB;
    --notif-danger: #EF4444;
    --notif-danger-soft: #FEF2F2;
    --notif-info: #0EA5E9;
    --notif-info-soft: #E0F2FE;
    --notif-purple: #8B5CF6;
    --notif-purple-soft: #F5F3FF;
    --notif-header: rgba(255,255,255,0.85);
    --notif-shadow: 0 1px 2px rgba(15,23,42,0.04);
  }

  .dark .notifications-theme-page {
    --notif-bg: #0B1020;
    --notif-card: #111827;
    --notif-card-soft: #0F172A;
    --notif-border: #263244;
    --notif-border-soft: #1F2937;
    --notif-text: #F8FAFC;
    --notif-text-soft: #CBD5E1;
    --notif-text-muted: #94A3B8;
    --notif-primary: #8B5CF6;
    --notif-primary-soft: rgba(139,92,246,0.16);
    --notif-success: #10B981;
    --notif-success-soft: rgba(16,185,129,0.14);
    --notif-warn: #F59E0B;
    --notif-warn-soft: rgba(245,158,11,0.14);
    --notif-danger: #EF4444;
    --notif-danger-soft: rgba(239,68,68,0.14);
    --notif-info: #38BDF8;
    --notif-info-soft: rgba(14,165,233,0.14);
    --notif-purple: #A78BFA;
    --notif-purple-soft: rgba(124,58,237,0.18);
    --notif-header: rgba(11,16,32,0.88);
    --notif-shadow: 0 18px 40px rgba(0,0,0,0.28);
  }

  .notifications-theme-page select {
    color-scheme: light;
  }

  .dark .notifications-theme-page select {
    color-scheme: dark;
  }
`;

const TYPE_META = {
  MENTION: { icon: "@", bg: COLORS.primarySoft, color: COLORS.primary, group: "Etiketleme" },
  PROJECT_CHAT_MENTION: { icon: "@", bg: COLORS.primarySoft, color: COLORS.primary, group: "Etiketleme" },
  TASK_ASSIGNED: { icon: "📌", bg: COLORS.infoSoft, color: COLORS.info, group: "Görev" },
  TASK_STATUS_CHANGED: { icon: "🔄", bg: COLORS.infoSoft, color: COLORS.info, group: "Görev" },
  COMMENT_ON_ASSIGNED_TASK: { icon: "💬", bg: COLORS.purpleSoft, color: COLORS.purple, group: "Yorum" },
  COMMENT_DELETED: { icon: "🗑️", bg: COLORS.dangerSoft, color: COLORS.danger, group: "Yorum" },
  COMMENT_DELETED_ON_ASSIGNED_TASK: { icon: "🗑️", bg: COLORS.dangerSoft, color: COLORS.danger, group: "Yorum" },
  COMMENT_UPDATED_ON_ASSIGNED_TASK: { icon: "✏️", bg: COLORS.purpleSoft, color: COLORS.purple, group: "Yorum" },
  PROJECT_CHAT_MESSAGE: { icon: "💬", bg: COLORS.purpleSoft, color: COLORS.purple, group: "Sohbet" },
  MEMBER_JOINED: { icon: "👋", bg: COLORS.successSoft, color: COLORS.success, group: "Üyelik" },
  MEMBER_ROLE_CHANGED: { icon: "🛡️", bg: COLORS.warnSoft, color: COLORS.warn, group: "Üyelik" },
  LEADERSHIP_TRANSFERRED: { icon: "👑", bg: COLORS.warnSoft, color: COLORS.warn, group: "Üyelik" },
  ADDED_TO_PROJECT: { icon: "➕", bg: COLORS.successSoft, color: COLORS.success, group: "Üyelik" },
  REMOVED_FROM_PROJECT: { icon: "➖", bg: COLORS.dangerSoft, color: COLORS.danger, group: "Üyelik" },
  DUE_DATE_SOON: { icon: "⏰", bg: COLORS.warnSoft, color: COLORS.warn, group: "Hatırlatma" },
  SPRINT_STARTED: { icon: "🚀", bg: COLORS.primarySoft, color: COLORS.primary, group: "Sprint" },
  SPRINT_ENDED: { icon: "🏁", bg: COLORS.cardSoft, color: COLORS.textSoft, group: "Sprint" },
  SPRINT_TASKS_MOVED: { icon: "↪️", bg: COLORS.infoSoft, color: COLORS.info, group: "Sprint" },
  SPRINT_UPDATED: {icon: "🔄",bg: COLORS.primarySoft,color: COLORS.primary,group: "Sprint",},
  PROJECT_JOIN_REQUEST: {icon: "📩",bg: COLORS.warnSoft,color: COLORS.warn,group: "Davet",},
  PROJECT_JOIN_REQUEST_APPROVED: {icon: "✅",bg: COLORS.successSoft,color: COLORS.success,group: "Davet",},
  PROJECT_JOIN_REQUEST_REJECTED: {icon: "❌",bg: COLORS.dangerSoft,color: COLORS.danger,group: "Davet",},
  MEMBER_LEFT_PROJECT: {icon: "🚪",bg: COLORS.dangerSoft,color: COLORS.danger,group: "Üyelik",},
  SPRINT_CLOSED: {icon: "🏁",bg: COLORS.successSoft,color: COLORS.success,group: "Sprint",},
  SPRINT_AUTO_CLOSED: {icon: "🤖",bg: COLORS.primarySoft,color: COLORS.primary,group: "Sprint",},
};

// Bildirim türüne göre ikon, renk ve kategori bilgilerini döndürür.
function getTypeMeta(type) {
  return TYPE_META[type] || {
    icon: "🔔",
    bg: COLORS.borderSoft,
    color: COLORS.textSoft,
    group: "Diğer",
  };
}

function Card({ children, padding = 20, style }) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 16,
        padding,
        boxShadow: COLORS.shadow,
        color: COLORS.text,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Kullanıcının tüm bildirimlerini görüntülemesini ve yönetmesini sağlayan sayfa.
export default function NotificationsPage() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readCount, setReadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingAll, setUpdatingAll] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");

      const data = await getAllNotifications();

      setNotifications(data.notifications || []);
      setTotalCount(Number(data.total_count || data.notifications?.length || 0));
      setUnreadCount(Number(data.unread_count || 0));
      setReadCount(Number(data.read_count || 0));
    } catch (e) {
      console.error("loadNotifications:", e);
      setError(e?.message || "Bildirimler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  function formatNotificationTime(value) {
    if (!value) return "";

    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Az önce";
    if (diffMin < 60) return `${diffMin} dk önce`;

    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} sa önce`;

    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay} gün önce`;

    return date.toLocaleString("tr-TR");
  }

  function getNotificationText(n) {
    switch (n.type) {
      case "MENTION":
        return `${n.triggered_by_name || "Bir kullanıcı"} seni yorumda etiketledi`;
      case "TASK_ASSIGNED":
        return `${n.triggered_by_name || "Bir kullanıcı"} sana task atadı`;
      case "COMMENT_ON_ASSIGNED_TASK":
        return `${n.triggered_by_name || "Bir kullanıcı"} atandığın task'a yorum yaptı`;
      case "MEMBER_JOINED":
        return `${n.triggered_by_name || "Bir kullanıcı"} projeye katıldı`;
      case "MEMBER_ROLE_CHANGED":
        return `Rolün değiştirildi`;
      case "LEADERSHIP_TRANSFERRED":
        return `Proje liderliği sana geçti`;
      case "DUE_DATE_SOON":
        return `Task son tarihi yaklaşıyor`;
      case "SPRINT_STARTED":
        return `Yeni sprint başladı`;
      case "SPRINT_ENDED":
        return `Sprint tamamlandı`;
      case "SPRINT_UPDATED":
        return n.title || "Sprint güncellendi";
      case "SPRINT_CLOSED":
        return n.title;
      case "SPRINT_AUTO_CLOSED":
        return n.title;
      case "ADDED_TO_PROJECT":
        return `Bir projeye eklendin`;
      case "COMMENT_DELETED":
        return `Yorumun silindi`;
      case "COMMENT_DELETED_ON_ASSIGNED_TASK":
        return `Atandığın task'ta bir yorum silindi`;
      case "COMMENT_UPDATED_ON_ASSIGNED_TASK":
        return `Atandığın task'ta bir yorum düzenlendi`;
      case "TASK_STATUS_CHANGED":
        return `Task durumun güncellendi`;
      case "REMOVED_FROM_PROJECT":
        return `Projeden çıkarıldın`;
      case "SPRINT_TASKS_MOVED":
        return n.title || "Tasklar yeni sprint'e taşındı";
      case "PROJECT_CHAT_MENTION":
        return n.title || `${n.triggered_by_name || "Bir kullanıcı"} seni proje sohbetinde etiketledi`;
      case "PROJECT_CHAT_MESSAGE":
        return n.title || `${n.triggered_by_name || "Bir kullanıcı"} projede mesaj gönderdi`;
      case "PROJECT_JOIN_REQUEST":
        return n.title || "Yeni katılım isteği";
      case "PROJECT_JOIN_REQUEST_APPROVED":
        return n.title || "Katılım isteğin onaylandı";
      case "PROJECT_JOIN_REQUEST_REJECTED":
        return n.title || "Katılım isteğin reddedildi";
      case "MEMBER_LEFT_PROJECT":
        return n.title || "Bir üye projeden ayrıldı";
      default:
        return n.title || "Yeni bildirim";
    }
  }

  async function handleMarkOneRead(notificationId, e) {
    if (e) e.stopPropagation();

    try {
      await markNotificationRead(notificationId);

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item
        )
      );

      setUnreadCount((prev) => Math.max(prev - 1, 0));
      setReadCount((prev) => prev + 1);

      window.dispatchEvent(
        new CustomEvent("notifications-updated", {
          detail: { unread_count: Math.max(unreadCount - 1, 0) },
        })
      );
    } catch (e) {
      console.error("handleMarkOneRead:", e);
      alert("Bildirim okundu yapılamadı.");
    }
  }

  async function handleMarkAllRead() {
    try {
      setUpdatingAll(true);

      await markAllNotificationsRead();

      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true }))
      );

      setReadCount(totalCount);
      setUnreadCount(0);

      window.dispatchEvent(
        new CustomEvent("notifications-updated", {
          detail: { unread_count: 0 },
        })
      );
    } catch (e) {
      console.error("handleMarkAllRead:", e);
      alert("Bildirimler okundu yapılamadı.");
    } finally {
      setUpdatingAll(false);
    }
  }

  async function handleNotificationClick(notification) {
    try {
      if (!notification?.id) return;

      if (!notification.is_read) {
        await markNotificationRead(notification.id);

        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, is_read: true } : n
          )
        );
      }

      if (notification.project_id && notification.task_id) {
        navigate(
          `/projects/${notification.project_id}/tasks?taskId=${notification.task_id}&notification=${notification.id}`
        );
        return;
      }

      if (
        (notification.type === "PROJECT_CHAT_MESSAGE" ||
          notification.type === "PROJECT_CHAT_MENTION") &&
        notification.project_id
      ) {
        navigate(
          `/projects/${notification.project_id}?tab=chat&notification=${notification.id}`
        );
        return;
      }

      if (notification.type === "SPRINT_TASKS_MOVED" && notification.project_id) {
        navigate(`/projects/${notification.project_id}/tasks`);
        return;
      }

      if (
        (notification.type === "SPRINT_STARTED" ||
          notification.type === "SPRINT_ENDED") &&
        notification.project_id
      ) {
        navigate(`/projects/${notification.project_id}/sprints`);
        return;
      }

      if (notification.project_id) {
        navigate(`/projects/${notification.project_id}`);
        return;
      }

      navigate("/projects");
    } catch (e) {
      console.error("handleNotificationClick:", e);
      alert("Bildirim açılamadı.");
    }
  }


  const groups = useMemo(() => {
    const set = new Set(notifications.map((n) => getTypeMeta(n.type).group));
    return ["ALL", ...Array.from(set)];
  }, [notifications]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "UNREAD" && n.is_read) return false;
      if (filter === "READ" && !n.is_read) return false;
      if (groupFilter !== "ALL" && getTypeMeta(n.type).group !== groupFilter) {
        return false;
      }
      return true;
    });
  }, [notifications, filter, groupFilter]);

  const grouped = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const buckets = { Bugün: [], Dün: [], "Bu Hafta": [], "Daha Eski": [] };

    for (const n of filtered) {
      const d = new Date(n.created_at);

      if (d >= today) buckets["Bugün"].push(n);
      else if (d >= yesterday) buckets["Dün"].push(n);
      else if (d >= weekAgo) buckets["Bu Hafta"].push(n);
      else buckets["Daha Eski"].push(n);
    }

    return buckets;
  }, [filtered]);

  const FilterPill = ({ value, label, count }) => {
    const active = filter === value;

    return (
      <button
        onClick={() => setFilter(value)}
        style={{
          border: active
            ? `1px solid ${COLORS.primary}`
            : `1px solid ${COLORS.border}`,
          background: active ? COLORS.primary : COLORS.card,
          color: active ? "#fff" : COLORS.text,
          borderRadius: 999,
          padding: "6px 14px",
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          transition: "all .15s",
          boxShadow: active ? "0 4px 12px rgba(139,92,246,0.18)" : "none",
        }}
      >
        {label}

        {typeof count === "number" && (
          <span
            style={{
              background: active ? "rgba(255,255,255,0.25)" : COLORS.borderSoft,
              color: active ? "#fff" : COLORS.textSoft,
              borderRadius: 999,
              padding: "1px 8px",
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div
      className="notifications-theme-page"
      style={{
        background: COLORS.bg,
        minHeight: "100vh",
        color: COLORS.text,
        transition: "background .25s ease, color .25s ease",
      }}
    >
      <style>{NOTIFICATION_THEME_STYLE}</style>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: COLORS.header,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1000,
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.purple})`,
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 20,
                boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
              }}
            >
              🔔
            </div>

            <div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 700 }}>
                Bildirim Merkezi
              </div>

              <div style={{ fontWeight: 900, color: COLORS.text, fontSize: 18 }}>
                Tüm Bildirimler
              </div>
            </div>
          </div>

          <button
            onClick={handleMarkAllRead}
            disabled={updatingAll || unreadCount === 0}
            style={{
              border: "none",
              background:
                updatingAll || unreadCount === 0
                  ? COLORS.borderSoft
                  : COLORS.primary,
              color:
                updatingAll || unreadCount === 0 ? COLORS.textMuted : "#fff",
              borderRadius: 10,
              padding: "10px 16px",
              cursor:
                updatingAll || unreadCount === 0 ? "not-allowed" : "pointer",
              fontWeight: 800,
              fontSize: 13,
              boxShadow:
                updatingAll || unreadCount === 0
                  ? "none"
                  : "0 4px 12px rgba(139,92,246,0.22)",
            }}
          >
            {updatingAll ? "İşleniyor..." : "✓ Tümünü Okundu Yap"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 24px 80px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[
            { label: "Toplam", value: totalCount, color: COLORS.text, icon: "📊" },
            { label: "Okunmamış", value: unreadCount, color: COLORS.primary, icon: "✉️" },
            { label: "Okundu", value: readCount, color: COLORS.success, icon: "✓" },
          ].map((s) => (
            <Card key={s.label} padding={16}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 700 }}>
                    {s.label}
                  </div>

                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 900,
                      color: s.color,
                      marginTop: 4,
                    }}
                  >
                    {s.value}
                  </div>
                </div>

                <div style={{ fontSize: 22, opacity: 0.75 }}>{s.icon}</div>
              </div>
            </Card>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <FilterPill value="ALL" label="Hepsi" count={totalCount} />
          <FilterPill value="UNREAD" label="Okunmamış" count={unreadCount} />
          <FilterPill value="READ" label="Okundu" count={readCount} />

          {groups.length > 1 && (
            <>
              <div
                style={{
                  width: 1,
                  height: 22,
                  background: COLORS.border,
                  margin: "0 4px",
                }}
              />

              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                style={{
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.card,
                  borderRadius: 999,
                  padding: "6px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  color: COLORS.text,
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g === "ALL" ? "Tüm kategoriler" : g}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {loading && (
          <Card>
            <div style={{ color: COLORS.textSoft }}>Bildirimler yükleniyor...</div>
          </Card>
        )}

        {error && (
          <Card style={{ borderColor: COLORS.danger, background: COLORS.dangerSoft }}>
            <div style={{ color: COLORS.danger, fontSize: 14 }}>{error}</div>
          </Card>
        )}

        {!loading && !error && filtered.length === 0 && (
          <Card>
            <div
              style={{
                textAlign: "center",
                padding: "32px 12px",
                color: COLORS.textMuted,
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>

              <div style={{ fontWeight: 800, color: COLORS.text }}>
                {filter === "UNREAD" ? "Okunmamış bildirim yok" : "Bildirim yok"}
              </div>

              <div style={{ fontSize: 13, marginTop: 6 }}>
                Yeni bir şey olduğunda burada görünecek.
              </div>
            </div>
          </Card>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {Object.entries(grouped).map(([bucket, items]) => {
              if (items.length === 0) return null;

              return (
                <div key={bucket}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: COLORS.textMuted,
                      letterSpacing: 0.6,
                      textTransform: "uppercase",
                      marginBottom: 10,
                      paddingLeft: 4,
                    }}
                  >
                    {bucket} · {items.length}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {items.map((n) => {
                      const meta = getTypeMeta(n.type);

                      return (
                        <button
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            border: `1px solid ${
                              n.is_read ? COLORS.border : COLORS.primary
                            }`,
                            background: n.is_read
                              ? COLORS.card
                              : `linear-gradient(135deg, ${COLORS.primarySoft}, ${COLORS.card})`,
                            borderRadius: 14,
                            padding: 14,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 12,
                            position: "relative",
                            transition: "all .15s",
                            boxShadow: n.is_read
                              ? COLORS.shadow
                              : "0 8px 24px rgba(139,92,246,0.12)",
                            color: COLORS.text,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = COLORS.primary;
                            e.currentTarget.style.boxShadow =
                              "0 8px 24px rgba(139,92,246,0.18)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = n.is_read
                              ? COLORS.border
                              : COLORS.primary;
                            e.currentTarget.style.boxShadow = n.is_read
                              ? COLORS.shadow
                              : "0 8px 24px rgba(139,92,246,0.12)";
                          }}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              background: meta.bg,
                              color: meta.color,
                              display: "grid",
                              placeItems: "center",
                              fontSize: 18,
                              flexShrink: 0,
                            }}
                          >
                            {meta.icon}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                marginBottom: 4,
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 900,
                                  color: meta.color,
                                  background: meta.bg,
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  textTransform: "uppercase",
                                  letterSpacing: 0.4,
                                }}
                              >
                                {meta.group}
                              </span>

                              {!n.is_read && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 900,
                                    color: "#fff",
                                    background: COLORS.primary,
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    letterSpacing: 0.4,
                                  }}
                                >
                                  YENİ
                                </span>
                              )}

                              <span
                                style={{
                                  fontSize: 11,
                                  color: COLORS.textMuted,
                                  marginLeft: "auto",
                                }}
                              >
                                {formatNotificationTime(n.created_at)}
                              </span>
                            </div>

                            <div
                              style={{
                                fontSize: 14,
                                fontWeight: n.is_read ? 600 : 900,
                                color: COLORS.text,
                                lineHeight: 1.4,
                              }}
                            >
                              {getNotificationText(n)}
                            </div>

                            {(n.project_name || n.task_title) && (
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 6,
                                  marginTop: 8,
                                }}
                              >
                                {n.project_name && (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: COLORS.textSoft,
                                      background: COLORS.borderSoft,
                                      border: `1px solid ${COLORS.border}`,
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                    }}
                                  >
                                    📁 {n.project_name}
                                  </span>
                                )}

                                {n.task_title && (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 700,
                                      color: COLORS.textSoft,
                                      background: COLORS.borderSoft,
                                      border: `1px solid ${COLORS.border}`,
                                      padding: "3px 8px",
                                      borderRadius: 6,
                                    }}
                                  >
                                    ☑ {n.task_title}
                                  </span>
                                )}
                              </div>
                            )}

                            {n.body && (
                              <div
                                style={{
                                  fontSize: 13,
                                  color: COLORS.textSoft,
                                  marginTop: 8,
                                  lineHeight: 1.5,
                                  background: COLORS.borderSoft,
                                  padding: "8px 10px",
                                  borderRadius: 8,
                                  borderLeft: `3px solid ${meta.color}`,
                                }}
                              >
                                {n.body}
                              </div>
                            )}
                          </div>

                          {!n.is_read && (
                            <div
                              onClick={(e) => handleMarkOneRead(n.id, e)}
                              title="Okundu olarak işaretle"
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: COLORS.primary,
                                marginTop: 6,
                                flexShrink: 0,
                                boxShadow: "0 0 0 4px rgba(139,92,246,0.18)",
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}