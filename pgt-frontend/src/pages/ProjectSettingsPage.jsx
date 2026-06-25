import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  apiFetch,
  getToken,
  updateProject,
  getProjectJoinRequests,
  approveProjectJoinRequest,
  rejectProjectJoinRequest,
} from "../api";
import { useTheme } from "../context/ThemeContext.jsx";

function getColors(isDark) {
  return {
    bg: isDark ? "#0B1020" : "#F8FAFC",
    card: isDark ? "#111827" : "#FFFFFF",
    cardSoft: isDark ? "#0F172A" : "#FCFDFE",
    border: isDark ? "#263244" : "#E2E8F0",
    borderSoft: isDark ? "#1F2937" : "#EEF2F7",
    text: isDark ? "#F8FAFC" : "#0F172A",
    textSoft: isDark ? "#CBD5E1" : "#475569",
    textMuted: isDark ? "#94A3B8" : "#94A3B8",
    primary: isDark ? "#8B5CF6" : "#4F46E5",
    primarySoft: isDark ? "rgba(139,92,246,0.16)" : "#EEF2FF",
    success: "#10B981",
    successSoft: isDark ? "rgba(16,185,129,0.14)" : "#ECFDF5",
    warn: "#F59E0B",
    warnSoft: isDark ? "rgba(245,158,11,0.14)" : "#FFFBEB",
    danger: "#EF4444",
    dangerSoft: isDark ? "rgba(239,68,68,0.14)" : "#FEF2F2",
    info: "#0EA5E9",
    infoSoft: isDark ? "rgba(14,165,233,0.14)" : "#E0F2FE",
    shadow: isDark
      ? "0 14px 35px rgba(0,0,0,0.28)"
      : "0 1px 2px rgba(15,23,42,0.04)",
  };
}

const SPRINT_DURATIONS = [
  { label: "1 hafta", value: 7 },
  { label: "2 hafta", value: 14 },
  { label: "10 gün", value: 10 },
  { label: "1 ay", value: 30 },
];

function sprintDurationLabel(days) {
  const found = SPRINT_DURATIONS.find((x) => x.value === Number(days));
  return found ? found.label : `${days} gün`;
}

function Card({ C, children, padding = 20, style }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding,
        boxShadow: C.shadow,
        color: C.text,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ C, icon, title, subtitle, right }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: C.primarySoft,
            color: C.primary,
            display: "grid",
            placeItems: "center",
            fontSize: 18,
          }}
        >
          {icon}
        </div>

        <div>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 16 }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {right}
    </div>
  );
}

function PrimaryButton({ C, children, onClick, disabled, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "none",
        background: disabled ? "#6B7280" : C.primary,
        color: "#fff",
        borderRadius: 10,
        padding: "10px 16px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 600,
        fontSize: 14,
        boxShadow: disabled ? "none" : "0 8px 18px rgba(79,70,229,0.25)",
        transition: "all .15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ C, children, onClick, disabled, danger, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${danger ? C.danger : C.border}`,
        background: danger ? C.dangerSoft : C.cardSoft,
        color: danger ? C.danger : C.text,
        borderRadius: 10,
        padding: "8px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 600,
        fontSize: 13,
        transition: "all .15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function getInputStyle(C) {
  return {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.cardSoft,
    color: C.text,
    fontSize: 14,
    outline: "none",
    transition: "border-color .15s, box-shadow .15s",
    fontFamily: "inherit",
  };
}

function Avatar({ C, name, size = 36 }) {
  const initials = (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${C.primary}, #7C3AED)`,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontWeight: 700,
        fontSize: size * 0.38,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function RoleBadge({ C, role }) {
  const isLeader = role === "LEADER";

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        padding: "3px 8px",
        borderRadius: 6,
        background: isLeader ? C.warnSoft : C.primarySoft,
        color: isLeader ? C.warn : C.primary,
        border: `1px solid ${isLeader ? C.warn : C.primary}`,
      }}
    >
      {isLeader ? "LİDER" : "ÜYE"}
    </span>
  );
}

function StatusBadge({ C, status }) {
  const map = {
    PENDING: {
      bg: C.warnSoft,
      color: C.warn,
      border: C.warn,
      label: "Beklemede",
    },
    APPROVED: {
      bg: C.successSoft,
      color: C.success,
      border: C.success,
      label: "Onaylandı",
    },
    REJECTED: {
      bg: C.dangerSoft,
      color: C.danger,
      border: C.danger,
      label: "Reddedildi",
    },
  };

  const m = map[status] || map.PENDING;

  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "4px 10px",
        borderRadius: 999,
        background: m.bg,
        color: m.color,
        border: `1px solid ${m.border}`,
      }}
    >
      {m.label}
    </span>
  );
}

export default function ProjectSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = getToken();
  const { isDark } = useTheme();
  const C = useMemo(() => getColors(isDark), [isDark]);
  const inputStyle = useMemo(() => getInputStyle(C), [C]);

  const [project, setProject] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingProject, setSavingProject] = useState(false);
  const [savingRoleId, setSavingRoleId] = useState(null);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [error, setError] = useState("");

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSprintDurationDays, setEditSprintDurationDays] = useState(14);

  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [addingMember, setAddingMember] = useState(false);

  const [joinRequests, setJoinRequests] = useState([]);
  const [loadingJoinRequests, setLoadingJoinRequests] = useState(false);
  const [processingJoinRequestId, setProcessingJoinRequestId] = useState(null);

  const [memberFilter, setMemberFilter] = useState("");

  async function loadPage() {
    try {
      setLoading(true);
      setError("");

      const [detailData, membersData] = await Promise.all([
        apiFetch(`/projects/${id}`, { token }),
        apiFetch(`/projects/${id}/members`, { token }),
      ]);

      setProject(detailData.project);
      setMyRole(detailData.my_role || null);
      setMembers(membersData.members || []);

      setEditName(detailData.project?.name || "");
      setEditDescription(detailData.project?.description || "");
      setEditSprintDurationDays(
        Number(detailData.project?.sprint_duration_days || 14)
      );
    } catch (e) {
      setError(e.message || "Sayfa yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  async function loadJoinRequests() {
    try {
      setLoadingJoinRequests(true);
      const data = await getProjectJoinRequests(id);
      setJoinRequests(data.requests || []);
    } catch (e) {
      console.error("loadJoinRequests:", e);
    } finally {
      setLoadingJoinRequests(false);
    }
  }

  async function onApproveJoinRequest(requestId) {
    const ok = window.confirm("Bu katılım isteğini onaylamak istiyor musun?");
    if (!ok) return;

    try {
      setProcessingJoinRequestId(requestId);
      await approveProjectJoinRequest(requestId);
      await loadPage();
      await loadJoinRequests();
      alert("Katılım isteği onaylandı");
    } catch (e) {
      alert(e.message || "İstek onaylanamadı");
    } finally {
      setProcessingJoinRequestId(null);
    }
  }

  async function onRejectJoinRequest(requestId) {
    const ok = window.confirm("Bu katılım isteğini reddetmek istiyor musun?");
    if (!ok) return;

    try {
      setProcessingJoinRequestId(requestId);
      await rejectProjectJoinRequest(requestId);
      await loadJoinRequests();
      alert("Katılım isteği reddedildi");
    } catch (e) {
      alert(e.message || "İstek reddedilemedi");
    } finally {
      setProcessingJoinRequestId(null);
    }
  }

  useEffect(() => {
    loadPage();
    loadJoinRequests();
  }, [id]);

  async function onSaveProject() {
    const normalizedName = editName.trim();
    const normalizedDescription = editDescription.trim();

    if (!normalizedName) {
      alert("Proje adı boş olamaz");
      return;
    }

    try {
      setSavingProject(true);

      const data = await updateProject(id, {
        name: normalizedName,
        description: normalizedDescription || null,
        sprint_duration_days: Number(editSprintDurationDays || 14),
      });

      setProject(data.project);

      alert(
        data.message === "No changes detected"
          ? "Değişiklik yok"
          : "Proje başarıyla güncellendi"
      );
    } catch (e) {
      alert(e.message || "Proje güncellenemedi");
    } finally {
      setSavingProject(false);
    }
  }

  async function copyJoinCode() {
    try {
      if (!project?.join_code) return;
      await navigator.clipboard.writeText(project.join_code);
      alert("Join code kopyalandı");
    } catch {
      alert("Join code kopyalanamadı");
    }
  }

  async function onRegenerateJoinCode() {
    const ok = window.confirm(
      "Join code yenilensin mi? Eski kod artık geçersiz olacak."
    );

    if (!ok) return;

    try {
      setRegeneratingCode(true);

      const data = await apiFetch(`/projects/${id}/join-code/regenerate`, {
        method: "PATCH",
        token,
      });

      setProject(data.project);
      alert("Join code yenilendi");
    } catch (e) {
      alert(e.message || "Join code yenilenemedi");
    } finally {
      setRegeneratingCode(false);
    }
  }

  async function onArchiveProject() {
    const ok = window.confirm(
      "Bu projeyi arşivlemek istiyor musun?\n\nProje salt-okunur moda geçecektir."
    );

    if (!ok) return;

    try {
      await apiFetch(`/projects/${id}/archive`, {
        method: "PATCH",
        token,
      });

      alert("Proje arşivlendi.");
      navigate("/projects/archived", { replace: true });
    } catch (e) {
      alert(e.message || "Proje arşivlenemedi");
    }
  }

  async function onChangeRole(member, nextRole) {
    if (!member?.id) return;
    if (!nextRole || nextRole === member.role) return;

    const ok = window.confirm(
      `${member.full_name} için rol ${member.role} → ${nextRole} olarak değiştirilsin mi?`
    );

    if (!ok) return;

    try {
      setSavingRoleId(member.id);

      await apiFetch(`/projects/${id}/members/${member.id}/role`, {
        method: "PATCH",
        token,
        body: { role: nextRole },
      });

      await loadPage();
    } catch (e) {
      alert(e.message || "Rol değiştirilemedi");
    } finally {
      setSavingRoleId(null);
    }
  }

  async function onRemoveMember(member) {
    const ok = window.confirm(
      `${member.full_name} adlı üyeyi projeden çıkarmak istiyor musun?`
    );

    if (!ok) return;

    try {
      await apiFetch(`/projects/${id}/members/${member.id}`, {
        method: "DELETE",
        token,
      });

      await loadPage();
    } catch (e) {
      alert(e.message || "Üye çıkarılamadı");
    }
  }

  async function handleUserSearch(value) {
    setUserSearch(value);

    const q = value.trim();

    if (q.length < 2) {
      setUserResults([]);
      return;
    }

    try {
      setSearchingUsers(true);

      const data = await apiFetch(
        `/users/search?q=${encodeURIComponent(q)}&projectId=${id}`,
        { token }
      );

      setUserResults(data.users || []);
    } catch (e) {
      console.error("handleUserSearch:", e);
      setUserResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }

  async function onAddMember() {
    if (!selectedUser?.id) {
      alert("Lütfen bir kullanıcı seç");
      return;
    }

    try {
      setAddingMember(true);

      await apiFetch(`/projects/${id}/members`, {
        method: "POST",
        token,
        body: { userId: selectedUser.id, role: "MEMBER" },
      });

      setUserSearch("");
      setUserResults([]);
      setSelectedUser(null);

      await loadPage();
      alert("Üye eklendi");
    } catch (e) {
      alert(e.message || "Üye eklenemedi");
    } finally {
      setAddingMember(false);
    }
  }

  const sortedMembers = useMemo(() => {
    const filtered = memberFilter
      ? members.filter((m) =>
          (m.full_name + " " + m.email)
            .toLowerCase()
            .includes(memberFilter.toLowerCase())
        )
      : members;

    return [...filtered].sort((a, b) => {
      if (a.role === "LEADER" && b.role !== "LEADER") return -1;
      if (a.role !== "LEADER" && b.role === "LEADER") return 1;

      return (a.full_name || "").localeCompare(b.full_name || "", "tr", {
        sensitivity: "base",
      });
    });
  }, [members, memberFilter]);

  const sortedJoinRequests = useMemo(() => {
    const order = { PENDING: 0, APPROVED: 1, REJECTED: 2 };

    return [...joinRequests].sort((a, b) => {
      const sc = (order[a.status] ?? 99) - (order[b.status] ?? 99);

      if (sc !== 0) return sc;

      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [joinRequests]);

  const pendingCount = joinRequests.filter((r) => r.status === "PENDING").length;
  const leaderCount = members.filter((m) => m.role === "LEADER").length;

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", padding: 40 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", color: C.textSoft }}>
          Yükleniyor...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", padding: 40 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Card C={C}>
            <div style={{ color: C.danger }}>{error}</div>
          </Card>
        </div>
      </div>
    );
  }

  if (!project) return null;

  const isLeader = myRole === "LEADER";

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: isDark ? "rgba(11,16,32,0.88)" : "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => navigate(`/projects/${id}`)}
              style={{
                border: "none",
                background: "transparent",
                color: C.textSoft,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                padding: "6px 8px",
                borderRadius: 8,
              }}
            >
              ← Proje Detayı
            </button>

            <div
              style={{
                width: 1,
                height: 22,
                background: C.border,
              }}
            />

            <div>
              <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 500 }}>
                Proje Ayarları
              </div>
              <div style={{ fontWeight: 700, color: C.text, fontSize: 16 }}>
                {project.name}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 12,
                color: C.textSoft,
                background: C.cardSoft,
                border: `1px solid ${C.border}`,
                padding: "6px 10px",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              {members.length} üye
            </span>

            {pendingCount > 0 && isLeader && (
              <span
                style={{
                  fontSize: 12,
                  color: C.warn,
                  background: C.warnSoft,
                  border: `1px solid ${C.warn}`,
                  padding: "5px 10px",
                  borderRadius: 8,
                  fontWeight: 700,
                }}
              >
                {pendingCount} bekleyen istek
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "28px 24px 80px",
        }}
      >
        {!isLeader ? (
          <Card C={C}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: C.warnSoft,
                  color: C.warn,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 22,
                }}
              >
                🔒
              </div>

              <div>
                <div style={{ fontWeight: 700, color: C.text }}>
                  Erişim kısıtlı
                </div>
                <div style={{ fontSize: 13, color: C.textSoft, marginTop: 4 }}>
                  Bu sayfayı yalnızca proje lideri yönetebilir.
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
              gap: 20,
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: 20, minWidth: 0 }}>
              <Card C={C}>
                <SectionHeader
                  C={C}
                  icon="⚙️"
                  title="Genel Bilgiler"
                  subtitle="Proje adı ve açıklamasını güncelle"
                />

                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.textSoft,
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Proje Adı
                    </label>

                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Proje adı"
                      maxLength={120}
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.textSoft,
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Açıklama
                    </label>

                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Projenin amacını kısaca açıkla"
                      rows={5}
                      style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: C.textSoft,
                        display: "block",
                        marginBottom: 8,
                      }}
                    >
                      Varsayılan Sprint Süresi
                    </label>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      {SPRINT_DURATIONS.map((item) => {
                        const active =
                          Number(editSprintDurationDays) === item.value;

                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => setEditSprintDurationDays(item.value)}
                            style={{
                              border: `1px solid ${
                                active ? C.primary : C.border
                              }`,
                              background: active ? C.primarySoft : C.cardSoft,
                              color: active ? C.primary : C.textSoft,
                              borderRadius: 10,
                              padding: "10px 8px",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "140px 1fr",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={editSprintDurationDays}
                        onChange={(e) => {
                          const v = Number(e.target.value);

                          if (!Number.isNaN(v)) {
                            setEditSprintDurationDays(
                              Math.min(60, Math.max(1, v))
                            );
                          }
                        }}
                        style={inputStyle}
                      />

                      <div
                        style={{
                          fontSize: 12,
                          color: C.textMuted,
                          lineHeight: 1.5,
                        }}
                      >
                        Şu an seçili süre:{" "}
                        <b>{sprintDurationLabel(editSprintDurationDays)}</b>.
                        Yeni oluşturulacak sprintlerin bitiş tarihi bu süreye göre
                        hesaplanır.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <GhostButton
                      C={C}
                      danger
                      onClick={onArchiveProject}
                      style={{ marginRight: "auto" }}
                    >
                      📦 Projeyi Arşivle
                    </GhostButton>

                    <PrimaryButton
                      C={C}
                      onClick={onSaveProject}
                      disabled={savingProject}
                    >
                      {savingProject
                        ? "Kaydediliyor..."
                        : "Değişiklikleri Kaydet"}
                    </PrimaryButton>
                  </div>
                </div>
              </Card>

              <Card C={C}>
                <SectionHeader
                  C={C}
                  icon="👥"
                  title={`Üyeler (${members.length})`}
                  subtitle={`${leaderCount} lider · ${
                    members.length - leaderCount
                  } üye`}
                  right={
                    <input
                      value={memberFilter}
                      onChange={(e) => setMemberFilter(e.target.value)}
                      placeholder="Üye ara..."
                      style={{
                        ...inputStyle,
                        width: 180,
                        padding: "8px 12px",
                        fontSize: 13,
                      }}
                    />
                  }
                />

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sortedMembers.length === 0 && (
                    <div style={{ color: C.textMuted, fontSize: 13, padding: 12 }}>
                      Eşleşen üye bulunamadı.
                    </div>
                  )}

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
                        background: C.cardSoft,
                        flexWrap: "wrap",
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
                        <Avatar C={C} name={member.full_name} />

                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: C.text,
                              fontSize: 14,
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                maxWidth: 180,
                              }}
                            >
                              {member.full_name}
                            </span>

                            <RoleBadge C={C} role={member.role} />
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: C.textMuted,
                              marginTop: 2,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 220,
                            }}
                          >
                            {member.email}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <select
                          value={member.role}
                          disabled={savingRoleId === member.id}
                          onChange={(e) => onChangeRole(member, e.target.value)}
                          style={{
                            border: `1px solid ${C.border}`,
                            background: C.card,
                            borderRadius: 8,
                            padding: "6px 10px",
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 600,
                            color: C.text,
                          }}
                        >
                          <option value="MEMBER">Üye</option>
                          <option value="LEADER">Lider</option>
                        </select>

                        {member.role !== "LEADER" && (
                          <GhostButton
                            C={C}
                            danger
                            onClick={() => onRemoveMember(member)}
                          >
                            Çıkar
                          </GhostButton>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div style={{ display: "grid", gap: 20, minWidth: 0 }}>
              <Card C={C}>
                <SectionHeader
                  C={C}
                  icon="🔑"
                  title="Erişim Kodu"
                  subtitle="Bu kodla davet ettiğin kişiler katılım isteği gönderebilir"
                />

                <div
                  style={{
                    background: `linear-gradient(135deg, ${C.primarySoft}, ${
                      isDark ? "rgba(124,58,237,0.12)" : "#F5F3FF"
                    })`,
                    border: `1px dashed ${C.primary}`,
                    borderRadius: 12,
                    padding: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: C.primary,
                        fontWeight: 700,
                        letterSpacing: 0.6,
                        textTransform: "uppercase",
                      }}
                    >
                      Join Code
                    </div>

                    <div
                      style={{
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 22,
                        fontWeight: 700,
                        color: C.text,
                        marginTop: 4,
                        letterSpacing: 1,
                      }}
                    >
                      {project.join_code || "—"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <GhostButton C={C} onClick={copyJoinCode}>
                      📋 Kopyala
                    </GhostButton>

                    <PrimaryButton
                      C={C}
                      onClick={onRegenerateJoinCode}
                      disabled={regeneratingCode}
                      style={{ padding: "8px 14px", fontSize: 13 }}
                    >
                      {regeneratingCode ? "Yenileniyor..." : "↻ Yenile"}
                    </PrimaryButton>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 12,
                    color: C.textMuted,
                  }}
                >
                  Yenileme yaptığında eski kod geçersiz olur.
                </div>
              </Card>

              <Card C={C}>
                <SectionHeader
                  C={C}
                  icon="➕"
                  title="Üye Ekle"
                  subtitle="Sisteme kayıtlı kullanıcıları doğrudan ekle"
                />

                <div style={{ display: "grid", gap: 10 }}>
                  <input
                    value={userSearch}
                    onChange={(e) => handleUserSearch(e.target.value)}
                    placeholder="🔍 Email veya isim ile ara (en az 2 karakter)"
                    style={inputStyle}
                  />

                  {searchingUsers && (
                    <div style={{ fontSize: 13, color: C.textMuted }}>
                      Kullanıcılar aranıyor...
                    </div>
                  )}

                  {!searchingUsers && userResults.length > 0 && (
                    <div
                      style={{
                        border: `1px solid ${C.border}`,
                        borderRadius: 12,
                        overflow: "hidden",
                        background: C.card,
                        maxHeight: 240,
                        overflowY: "auto",
                      }}
                    >
                      {userResults.map((user, idx) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedUser(user);
                            setUserSearch(user.email);
                            setUserResults([]);
                          }}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: 12,
                            border: "none",
                            borderBottom:
                              idx === userResults.length - 1
                                ? "none"
                                : `1px solid ${C.borderSoft}`,
                            background: C.card,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <Avatar C={C} name={user.full_name} size={32} />

                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                color: C.text,
                                fontSize: 14,
                              }}
                            >
                              {user.full_name}
                            </div>

                            <div
                              style={{
                                fontSize: 12,
                                color: C.textMuted,
                                marginTop: 2,
                              }}
                            >
                              {user.email}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedUser && (
                    <div
                      style={{
                        border: `1px solid ${C.primary}`,
                        borderRadius: 12,
                        padding: 12,
                        background: C.primarySoft,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Avatar C={C} name={selectedUser.full_name} size={36} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            color: C.text,
                            fontSize: 14,
                          }}
                        >
                          {selectedUser.full_name}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: C.textSoft,
                            marginTop: 2,
                          }}
                        >
                          {selectedUser.email}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedUser(null);
                          setUserSearch("");
                        }}
                        style={{
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: C.textMuted,
                          fontSize: 18,
                        }}
                        title="Seçimi kaldır"
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <PrimaryButton
                      C={C}
                      onClick={onAddMember}
                      disabled={!selectedUser || addingMember}
                    >
                      {addingMember ? "Ekleniyor..." : "Üye Olarak Ekle"}
                    </PrimaryButton>
                  </div>
                </div>
              </Card>

              <Card C={C}>
                <SectionHeader
                  C={C}
                  icon="📨"
                  title="Katılım İstekleri"
                  subtitle={
                    pendingCount > 0
                      ? `${pendingCount} bekleyen istek var`
                      : "Bekleyen istek yok"
                  }
                />

                {loadingJoinRequests ? (
                  <div style={{ color: C.textMuted, fontSize: 13 }}>
                    Yükleniyor...
                  </div>
                ) : joinRequests.length === 0 ? (
                  <div
                    style={{
                      border: `1px dashed ${C.border}`,
                      borderRadius: 12,
                      padding: 24,
                      textAlign: "center",
                      color: C.textMuted,
                      fontSize: 13,
                    }}
                  >
                    Henüz katılım isteği yok.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sortedJoinRequests.map((req) => (
                      <div
                        key={req.id}
                        style={{
                          border: `1px solid ${C.borderSoft}`,
                          borderRadius: 12,
                          padding: 12,
                          background:
                            req.status === "PENDING" ? C.warnSoft : C.cardSoft,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
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
                          <Avatar C={C} name={req.requester_name} size={34} />

                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 600,
                                color: C.text,
                                fontSize: 14,
                              }}
                            >
                              {req.requester_name}
                            </div>

                            <div
                              style={{
                                fontSize: 12,
                                color: C.textMuted,
                                marginTop: 2,
                              }}
                            >
                              {req.requester_email}
                            </div>

                            <div
                              style={{
                                fontSize: 11,
                                color: C.textMuted,
                                marginTop: 4,
                              }}
                            >
                              {new Date(req.created_at).toLocaleString("tr-TR")}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <StatusBadge C={C} status={req.status} />

                          {req.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => onApproveJoinRequest(req.id)}
                                disabled={processingJoinRequestId === req.id}
                                style={{
                                  border: "none",
                                  background: C.success,
                                  color: "#fff",
                                  borderRadius: 8,
                                  padding: "6px 12px",
                                  cursor: "pointer",
                                  fontWeight: 600,
                                  fontSize: 12,
                                }}
                              >
                                ✓ Onayla
                              </button>

                              <GhostButton
                                C={C}
                                danger
                                onClick={() => onRejectJoinRequest(req.id)}
                                disabled={processingJoinRequestId === req.id}
                                style={{ padding: "6px 12px", fontSize: 12 }}
                              >
                                ✕ Reddet
                              </GhostButton>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}