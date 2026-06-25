import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getUserProfile } from "../api";
import { useTheme } from "../context/ThemeContext.jsx";

/**
 * UserProfilePage — v2
 * Diğer v2 sayfaları ile uyumlu modern tasarım.
 * Tüm fonksiyonlar (kullanıcı profili, member/leader projeler) korunur.
 */

const LIGHT_COLORS = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  cardSoft: "#F8FAFC",
  border: "#E2E8F0",
  borderSoft: "#EEF2F7",
  text: "#0F172A",
  textSoft: "#475569",
  textMuted: "#94A3B8",
  headerBg: "rgba(255,255,255,0.86)",
  buttonBg: "#FFFFFF",
  hoverBg: "#F8FAFC",
  shadow: "0 1px 2px rgba(15,23,42,0.04)",
  avatarRing: "#FFFFFF",

  primary: "#4F46E5",
  primarySoft: "#EEF2FF",
  success: "#10B981",
  successSoft: "#ECFDF5",
  warn: "#F59E0B",
  warnSoft: "#FFFBEB",
  warnText: "#92400E",
  danger: "#EF4444",
  dangerSoft: "#FEF2F2",
  info: "#0EA5E9",
  infoSoft: "#E0F2FE",
  purple: "#8B5CF6",
  purpleSoft: "#F5F3FF",
};

const DARK_COLORS = {
  bg: "#0B1020",
  card: "#111827",
  cardSoft: "#0F172A",
  border: "#263244",
  borderSoft: "#1E293B",
  text: "#F8FAFC",
  textSoft: "#CBD5E1",
  textMuted: "#94A3B8",
  headerBg: "rgba(11,16,32,0.88)",
  buttonBg: "#111827",
  hoverBg: "#172033",
  shadow: "0 12px 30px rgba(0,0,0,0.22)",
  avatarRing: "#111827",

  primary: "#818CF8",
  primarySoft: "rgba(99,102,241,0.16)",
  success: "#34D399",
  successSoft: "rgba(16,185,129,0.16)",
  warn: "#FBBF24",
  warnSoft: "rgba(245,158,11,0.16)",
  warnText: "#FCD34D",
  danger: "#F87171",
  dangerSoft: "rgba(239,68,68,0.16)",
  info: "#38BDF8",
  infoSoft: "rgba(14,165,233,0.16)",
  purple: "#A78BFA",
  purpleSoft: "rgba(139,92,246,0.16)",
};

function Card({ children, padding = 20, style, C }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding,
        boxShadow: C.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Btn({ children, onClick, variant = "ghost", style, C }) {
  const styles = {
    primary: { background: C.primary, color: "#fff", border: `1px solid ${C.primary}` },
    ghost: { background: C.buttonBg, color: C.text, border: `1px solid ${C.border}` },
  }[variant];
  return (
    <button
      onClick={onClick}
      style={{
        ...styles,
        padding: "8px 14px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all .15s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, icon, accent, accentSoft, hint, C }) {
  return (
    <Card C={C} padding={20} style={{ position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          right: -30,
          top: -30,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: accentSoft,
          opacity: 0.6,
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
        <div>
          <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase" }}>
            {label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginTop: 6, lineHeight: 1.1 }}>
            {value}
          </div>
          {hint && (
            <div style={{ fontSize: 12, color: C.textSoft, marginTop: 8 }}>{hint}</div>
          )}
        </div>
        <div
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: accentSoft, color: accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function isArchivedProject(project) {
  const status = String(project?.status || project?.project_status || "").toUpperCase();

  return (
    project?.is_archived === true ||
    project?.archived === true ||
    Boolean(project?.archived_at) ||
    status === "ARCHIVED" ||
    status === "ARŞİV" ||
    status === "ARSIV"
  );
}

function ProjectItem({ project, onClick, C }) {
  const isLeader = (project.role || "").toUpperCase() === "LEADER";
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 12,
        border: `1px solid ${C.borderSoft}`,
        background: C.buttonBg, cursor: onClick ? "pointer" : "default",
        textAlign: "left", width: "100%", transition: "all .15s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.borderSoft; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = C.buttonBg; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: isLeader ? C.warnSoft : C.primarySoft,
        color: isLeader ? C.warnText : C.primary,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 14, flexShrink: 0,
      }}>
        {getInitials(project.name)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.name}
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.description || "Açıklama yok"}
        </div>
      </div>
      {project.role && (
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: isLeader ? C.warnText : C.primary,
          background: isLeader ? C.warnSoft : C.primarySoft,
          padding: "3px 8px", borderRadius: 999, flexShrink: 0,
        }}>
          {project.role}
        </span>
      )}
    </button>
  );
}

function EmptyState({ text, C }) {
  return (
    <div style={{
      padding: 24, textAlign: "center",
      color: C.textMuted, fontSize: 13,
      border: `1px dashed ${C.border}`, borderRadius: 12,
    }}>
      {text}
    </div>
  );
}

export default function UserProfilePage() {
  const { isDark } = useTheme();
  const C = isDark ? DARK_COLORS : LIGHT_COLORS;

  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [memberProjects, setMemberProjects] = useState([]);
  const [leaderProjects, setLeaderProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadProfile() {
    try {
      setLoading(true);
      setError("");
      const data = await getUserProfile(id);
      setUser(data.user || null);
      setMemberProjects(data.member_projects || []);
      setLeaderProjects(data.leader_projects || []);
    } catch (e) {
      console.error("loadProfile:", e);
      setError(e?.message || "Profil yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  const activeMemberProjects = useMemo(
    () => memberProjects.filter((p) => !isArchivedProject(p)),
    [memberProjects]
  );

  const activeLeaderProjects = useMemo(
    () => leaderProjects.filter((p) => !isArchivedProject(p)),
    [leaderProjects]
  );

  const activeLeaderProjectIds = useMemo(
    () => new Set(activeLeaderProjects.map((p) => String(p.id))),
    [activeLeaderProjects]
  );

  const memberOnlyProjects = useMemo(
    () => activeMemberProjects.filter((p) => !activeLeaderProjectIds.has(String(p.id))),
    [activeMemberProjects, activeLeaderProjectIds]
  );

  const totalProjects = useMemo(() => {
    const uniqueIds = new Set([
      ...activeMemberProjects.map((p) => String(p.id)),
      ...activeLeaderProjects.map((p) => String(p.id)),
    ]);
    return uniqueIds.size;
  }, [activeMemberProjects, activeLeaderProjects]);

  const memberSince = useMemo(() => {
    const raw = user?.created_at || user?.createdAt;
    if (!raw) return null;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" });
  }, [user]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: 24 }}>
        <Card C={C}><p style={{ color: C.textSoft, margin: 0 }}>Yükleniyor...</p></Card>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: 24 }}>
        <Card C={C} style={{ borderColor: C.danger, background: C.dangerSoft }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.danger }}>Hata</div>
              <div style={{ fontSize: 13, color: C.textSoft, marginTop: 2 }}>{error}</div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <Btn C={C} variant="primary" onClick={loadProfile}>Tekrar Dene</Btn>
            <Btn C={C} variant="ghost" onClick={() => navigate(-1)}>Geri</Btn>
          </div>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: 24 }}>
        <Card C={C}>
          <p style={{ color: C.textSoft, margin: 0 }}>Kullanıcı bulunamadı.</p>
          <div style={{ marginTop: 12 }}>
            <Btn C={C} variant="ghost" onClick={() => navigate(-1)}>Geri Dön</Btn>
          </div>
        </Card>
      </div>
    );
  }

  const roleLabel = activeLeaderProjects.length > 0 ? "Leader / Member" : "Member";

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      {/* Sticky header */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 10,
          background: C.headerBg,
          backdropFilter: "saturate(180%) blur(10px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button
              onClick={() => navigate(-1)}
              style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${C.border}`, background: C.buttonBg, cursor: "pointer", fontSize: 16 }}
              title="Geri"
            >
              ←
            </button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>
                Kullanıcı Profili
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.full_name}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {user.email && (
              <Btn C={C} variant="ghost" onClick={() => { window.location.href = `mailto:${user.email}`; }}>
                ✉️ E-posta Gönder
              </Btn>
            )}
            <Btn C={C} variant="ghost" onClick={() => navigate(-1)}>Geri Dön</Btn>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Hero */}
        <Card C={C} padding={0} style={{ overflow: "hidden" }}>
          <div style={{ height: 110, background: `linear-gradient(135deg, ${C.primary} 0%, ${C.purple} 100%)` }} />
          <div style={{ padding: "0 24px 24px", marginTop: -40, display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{
              width: 96, height: 96, borderRadius: "50%",
              background: C.avatarRing, padding: 4,
              boxShadow: isDark ? "0 10px 28px rgba(0,0,0,0.35)" : "0 6px 20px rgba(15,23,42,0.12)", flexShrink: 0,
            }}>
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div style={{
                  width: "100%", height: "100%", borderRadius: "50%",
                  background: `linear-gradient(135deg, ${C.primary}, ${C.purple})`,
                  color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 32, fontWeight: 800,
                }}>
                  {getInitials(user.full_name)}
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>
                {user.full_name}
              </div>
              <div style={{ fontSize: 14, color: C.textSoft, marginTop: 4, paddingTop: 4}}>
                {user.email || "-"}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                {user.title && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 10px", borderRadius: 999,
                    background: C.primarySoft, color: C.primary,
                    fontSize: 12, fontWeight: 600,
                  }}>
                    💼 {user.title}
                  </span>
                )}
                {activeLeaderProjects.length > 0 && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 10px", borderRadius: 999,
                    background: C.warnSoft, color: C.warnText,
                    fontSize: 12, fontWeight: 600,
                  }}>
                    👑 {activeLeaderProjects.length} projede lider
                  </span>
                )}
                {memberSince && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "4px 10px", borderRadius: 999,
                    background: C.borderSoft, color: C.textSoft,
                    fontSize: 12, fontWeight: 600,
                  }}>
                    📅 {memberSince}
                  </span>
                )}
              </div>

              {user.bio && (
                <p style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6, color: C.textSoft, maxWidth: 720 }}>
                  {user.bio}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <StatCard
            C={C}
            label="Toplam Proje"
            value={totalProjects}
            icon="📁"
            accent={C.primary}
            accentSoft={C.primarySoft}
            hint="Bulunduğun proje sayısı"
          />
          <StatCard
            C={C}
            label="Üye Olduğu"
            value={memberOnlyProjects.length}
            icon="👥"
            accent={C.info}
            accentSoft={C.infoSoft}
            hint="Lider olmadığın projeler"
          />
          <StatCard
            C={C}
            label="Lider Olduğu"
            value={activeLeaderProjects.length}
            icon="👑"
            accent={C.warn}
            accentSoft={C.warnSoft}
            hint="Yönettiğin projeler"
          />
          <StatCard
            C={C}
            label="Rol"
            value={roleLabel}
            icon="🎖️"
            accent={C.purple}
            accentSoft={C.purpleSoft}
            hint="Kullanıcı tipi"
          />
        </div>

        {/* Projects */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          <Card C={C}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: C.infoSoft, color: C.info,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16,
                }}>👥</div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>Üye Olduğu Projeler</h3>
              </div>
              <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>
                {memberOnlyProjects.length} PROJE
              </span>
            </div>
            {memberOnlyProjects.length === 0 ? (
              <EmptyState C={C} text="Üye olduğu proje yok." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
                {memberOnlyProjects.map((p) => (
                  <ProjectItem C={C} key={p.id} project={p} onClick={() => navigate(`/projects/${p.id}`)} />
                ))}
              </div>
            )}
          </Card>

          <Card C={C}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: C.warnSoft, color: C.warnText,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16,
                }}>👑</div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>Lider Olduğu Projeler</h3>
              </div>
              <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600 }}>
                {activeLeaderProjects.length} PROJE
              </span>
            </div>
            {activeLeaderProjects.length === 0 ? (
              <EmptyState C={C} text="Lider olduğu proje yok." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
                {activeLeaderProjects.map((p) => (
                  <ProjectItem
                    C={C}
                    key={p.id}
                    project={{ ...p, role: p.role || "LEADER" }}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}