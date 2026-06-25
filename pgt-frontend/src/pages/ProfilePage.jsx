import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getToken } from "../api";

const COLORS = {
  bg: "var(--profile-bg)",
  card: "var(--profile-card)",
  cardSoft: "var(--profile-card-soft)",
  border: "var(--profile-border)",
  borderSoft: "var(--profile-border-soft)",
  text: "var(--profile-text)",
  textSoft: "var(--profile-text-soft)",
  textMuted: "var(--profile-text-muted)",
  primary: "var(--profile-primary)",
  primarySoft: "var(--profile-primary-soft)",
  success: "var(--profile-success)",
  successSoft: "var(--profile-success-soft)",
  warn: "var(--profile-warn)",
  warnSoft: "var(--profile-warn-soft)",
  danger: "var(--profile-danger)",
  dangerSoft: "var(--profile-danger-soft)",
  info: "var(--profile-info)",
  infoSoft: "var(--profile-info-soft)",
  purple: "var(--profile-purple)",
  purpleSoft: "var(--profile-purple-soft)",
  header: "var(--profile-header)",
  shadow: "var(--profile-shadow)",
};

const PROFILE_THEME_STYLE = `
  .profile-theme-page {
    --profile-bg: #F8FAFC;
    --profile-card: #FFFFFF;
    --profile-card-soft: #FAFBFD;
    --profile-border: #E2E8F0;
    --profile-border-soft: #EEF2F7;
    --profile-text: #0F172A;
    --profile-text-soft: #475569;
    --profile-text-muted: #94A3B8;
    --profile-primary: #4F46E5;
    --profile-primary-soft: #EEF2FF;
    --profile-success: #10B981;
    --profile-success-soft: #ECFDF5;
    --profile-warn: #F59E0B;
    --profile-warn-soft: #FFFBEB;
    --profile-danger: #EF4444;
    --profile-danger-soft: #FEF2F2;
    --profile-info: #0EA5E9;
    --profile-info-soft: #E0F2FE;
    --profile-purple: #8B5CF6;
    --profile-purple-soft: #F5F3FF;
    --profile-header: rgba(255,255,255,0.85);
    --profile-shadow: 0 1px 2px rgba(15,23,42,0.04);
  }

  .dark .profile-theme-page {
    --profile-bg: #0B1020;
    --profile-card: #111827;
    --profile-card-soft: #0F172A;
    --profile-border: #263244;
    --profile-border-soft: #1F2937;
    --profile-text: #F8FAFC;
    --profile-text-soft: #CBD5E1;
    --profile-text-muted: #94A3B8;
    --profile-primary: #8B5CF6;
    --profile-primary-soft: rgba(139,92,246,0.16);
    --profile-success: #10B981;
    --profile-success-soft: rgba(16,185,129,0.14);
    --profile-warn: #F59E0B;
    --profile-warn-soft: rgba(245,158,11,0.14);
    --profile-danger: #EF4444;
    --profile-danger-soft: rgba(239,68,68,0.14);
    --profile-info: #38BDF8;
    --profile-info-soft: rgba(14,165,233,0.14);
    --profile-purple: #A78BFA;
    --profile-purple-soft: rgba(124,58,237,0.18);
    --profile-header: rgba(11,16,32,0.88);
    --profile-shadow: 0 18px 40px rgba(0,0,0,0.28);
  }
`;

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

function StatCard({
  label,
  value,
  icon,
  accent = COLORS.primary,
  accentSoft = COLORS.primarySoft,
  hint,
}) {
  return (
    <Card padding={20} style={{ position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          right: -30,
          top: -30,
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: accentSoft,
          opacity: 0.75,
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          position: "relative",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            {label}
          </div>

          <div
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: COLORS.text,
              marginTop: 6,
              lineHeight: 1,
            }}
          >
            {value}
          </div>

          {hint && (
            <div style={{ fontSize: 12, color: COLORS.textSoft, marginTop: 8 }}>
              {hint}
            </div>
          )}
        </div>

        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: accentSoft,
            color: accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            position: "relative",
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function Btn({ children, onClick, variant = "ghost", style }) {
  const styles = {
    primary: {
      background: COLORS.primary,
      color: "#fff",
      border: `1px solid ${COLORS.primary}`,
    },
    ghost: {
      background: COLORS.card,
      color: COLORS.text,
      border: `1px solid ${COLORS.border}`,
    },
    danger: {
      background: COLORS.dangerSoft,
      color: COLORS.danger,
      border: `1px solid ${COLORS.danger}`,
    },
  }[variant];

  return (
    <button
      onClick={onClick}
      style={{
        ...styles,
        padding: "8px 14px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        transition: "all .15s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const token = getToken();

  useEffect(() => {
    if (!token) navigate("/login", { replace: true });
  }, [token, navigate]);

  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadProfilePage() {
    try {
      setLoading(true);
      if (!token) return;

      const meData = await apiFetch("/users/me", { token });
      const currentUser = meData.user || null;
      setUser(currentUser);

      const projectsData = await apiFetch("/projects", { token });
      const projectList = projectsData.projects || [];
      setProjects(projectList);
    } catch (e) {
      console.error("loadProfilePage:", e);
      alert("Profil sayfası yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfilePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  function getProjectRole(p) {
    return String(
      p.my_role ||
        p.role ||
        p.user_role ||
        p.member_role ||
        p.project_role ||
        ""
    ).toUpperCase();
  }

  const leaderCount = useMemo(
    () => projects.filter((p) => getProjectRole(p) === "LEADER").length,
    [projects]
  );

  const memberCount = useMemo(
    () => projects.filter((p) => getProjectRole(p) !== "LEADER").length,
    [projects]
  );

  const memberSince = useMemo(() => {
    const raw = user?.created_at || user?.createdAt;
    if (!raw) return null;

    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return null;

      return d.toLocaleDateString("tr-TR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return null;
    }
  }, [user]);

  const daysActive = useMemo(() => {
    const raw = user?.created_at || user?.createdAt;
    if (!raw) return null;

    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;

    return Math.max(
      1,
      Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
    );
  }, [user]);

  if (loading) {
    return (
      <div
        className="profile-theme-page"
        style={{ minHeight: "100vh", background: COLORS.bg, padding: 24 }}
      >
        <style>{PROFILE_THEME_STYLE}</style>
        <Card>
          <p style={{ color: COLORS.textSoft, margin: 0 }}>Yükleniyor...</p>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="profile-theme-page"
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        transition: "background .25s ease, color .25s ease",
      }}
    >
      <style>{PROFILE_THEME_STYLE}</style>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: COLORS.header,
          backdropFilter: "saturate(180%) blur(10px)",
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button
              onClick={() => navigate("/projects")}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.card,
                color: COLORS.text,
                cursor: "pointer",
                fontSize: 16,
              }}
              title="Geri"
            >
              ←
            </button>

            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 700 }}>
                Hesap
              </div>

              <div style={{ fontSize: 18, fontWeight: 900, color: COLORS.text }}>
                Profilim
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Btn variant="ghost" onClick={() => navigate("/projects")}>
              Projelere Dön
            </Btn>

            <Btn variant="danger" onClick={handleLogout}>
              Çıkış Yap
            </Btn>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <Card padding={0} style={{ overflow: "hidden" }}>
          <div
            style={{
              height: 110,
              background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.purple} 100%)`,
            }}
          />

          <div
            style={{
              padding: "0 24px 24px",
              marginTop: -40,
              display: "flex",
              gap: 20,
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: "50%",
                background: COLORS.card,
                padding: 4,
                boxShadow: "0 6px 20px rgba(15,23,42,0.20)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.purple})`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  fontWeight: 900,
                }}
              >
                {initialsOf(user?.full_name)}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: COLORS.text }}>
                {user?.full_name || "Kullanıcı"}
              </div>

              <div style={{ fontSize: 14, color: COLORS.textSoft, marginTop: 2 }}>
                {user?.email || "-"}
              </div>

              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: COLORS.primarySoft,
                    color: COLORS.primary,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  ✓ Aktif Üye
                </span>

                {leaderCount > 0 && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: COLORS.warnSoft,
                      color: COLORS.warn,
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    👑 {leaderCount} projede lider
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <StatCard
            label="Toplam Proje"
            value={projects.length}
            icon="📁"
            accent={COLORS.primary}
            accentSoft={COLORS.primarySoft}
            hint={leaderCount > 0 ? `${leaderCount} tanesinde lidersin` : "Üye olduğun projeler"}
          />

          <StatCard
            label="Lider Olduğum"
            value={leaderCount}
            icon="👑"
            accent={COLORS.warn}
            accentSoft={COLORS.warnSoft}
            hint={leaderCount > 0 ? "Yönettiğin projeler" : "Henüz lider değilsin"}
          />

          <StatCard
            label="Üye Olduğum"
            value={memberCount}
            icon="👥"
            accent={COLORS.info}
            accentSoft={COLORS.infoSoft}
            hint="Katılımcı olarak"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: COLORS.text }}>
                Kullanıcı Bilgileri
              </h3>

              <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 800 }}>
                HESAP DETAYI
              </span>
            </div>

            <InfoRow label="Ad Soyad" value={user?.full_name || "-"} />
            <InfoRow label="E-posta" value={user?.email || "-"} />

            {memberSince && <InfoRow label="Üyelik Tarihi" value={memberSince} />}
            {daysActive && <InfoRow label="Aktif Gün" value={`${daysActive} gün`} />}

            <InfoRow
              label="Kullanıcı ID"
              value={
                <span
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 12,
                    color: COLORS.textSoft,
                    background: COLORS.borderSoft,
                    padding: "2px 8px",
                    borderRadius: 6,
                  }}
                >
                  {user?.id || "-"}
                </span>
              }
              last
            />
          </Card>

          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: COLORS.text }}>
                Projelerim
              </h3>

              <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 800 }}>
                {projects.length} PROJE
              </span>
            </div>

            {projects.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: COLORS.textMuted,
                  fontSize: 13,
                  border: `1px dashed ${COLORS.border}`,
                  borderRadius: 12,
                }}
              >
                Henüz bir projede yer almıyorsun.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxHeight: 320,
                  overflowY: "auto",
                }}
              >
                {projects.map((p) => {
                  const isLeader = getProjectRole(p) === "LEADER";

                  return (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: `1px solid ${COLORS.borderSoft}`,
                        background: COLORS.cardSoft,
                        color: COLORS.text,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all .15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = COLORS.borderSoft;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = COLORS.cardSoft;
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: isLeader ? COLORS.warnSoft : COLORS.primarySoft,
                          color: isLeader ? COLORS.warn : COLORS.primary,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          fontSize: 14,
                          flexShrink: 0,
                        }}
                      >
                        {initialsOf(p.name)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: COLORS.text,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.name}
                        </div>

                        {p.description && (
                          <div
                            style={{
                              fontSize: 12,
                              color: COLORS.textMuted,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.description}
                          </div>
                        )}
                      </div>

                      {isLeader && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            color: COLORS.warn,
                            background: COLORS.warnSoft,
                            padding: "3px 8px",
                            borderRadius: 999,
                          }}
                        >
                          LİDER
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: COLORS.text }}>
                Hızlı Erişim
              </h3>

              <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 800 }}>
                KISAYOLLAR
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <QuickAction
                icon="📁"
                label="Projeler"
                desc="Tüm projelerine git"
                color={COLORS.primary}
                bg={COLORS.primarySoft}
                onClick={() => navigate("/projects")}
              />

              <QuickAction
                icon="🔔"
                label="Bildirimler"
                desc="Güncellemeleri gör"
                color={COLORS.purple}
                bg={COLORS.purpleSoft}
                onClick={() => navigate("/notifications")}
              />

              <QuickAction
                icon="➕"
                label="Yeni Proje"
                desc="Hızlıca oluştur"
                color={COLORS.success}
                bg={COLORS.successSoft}
                onClick={() => navigate("/projects?new=1")}
              />

              <QuickAction
                icon="🚪"
                label="Çıkış Yap"
                desc="Oturumu sonlandır"
                color={COLORS.danger}
                bg={COLORS.dangerSoft}
                onClick={handleLogout}
              />
            </div>
          </Card>

          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: COLORS.text }}>
                Hesap & Güvenlik
              </h3>

              <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 800 }}>
                İPUÇLARI
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Tip
                icon="🔐"
                color={COLORS.success}
                bg={COLORS.successSoft}
                title="Hesabın aktif"
                desc="E-posta adresin doğrulanmış görünüyor."
              />

              <Tip
                icon="🛡️"
                color={COLORS.warn}
                bg={COLORS.warnSoft}
                title="Güçlü bir şifre kullan"
                desc="En az 8 karakter, sayı ve sembol içermesi önerilir."
              />

              <Tip
                icon="💡"
                color={COLORS.info}
                bg={COLORS.infoSoft}
                title="Bildirimlerini takip et"
                desc="Etiketlendiğin yorumları ve atanan görevleri kaçırma."
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, desc, color, bg, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${COLORS.borderSoft}`,
        background: COLORS.cardSoft,
        color: COLORS.text,
        cursor: "pointer",
        textAlign: "left",
        transition: "all .15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = COLORS.borderSoft;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: bg,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: COLORS.text }}>
          {label}
        </div>

        <div
          style={{
            fontSize: 11,
            color: COLORS.textMuted,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {desc}
        </div>
      </div>
    </button>
  );
}

function Tip({ icon, color, bg, title, desc }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: 12,
        borderRadius: 12,
        background: bg,
        border: `1px solid ${color}`,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: COLORS.card,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: COLORS.text }}>
          {title}
        </div>

        <div style={{ fontSize: 12, color: COLORS.textSoft, marginTop: 2 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: last ? "none" : `1px solid ${COLORS.borderSoft}`,
      }}
    >
      <span style={{ fontSize: 13, color: COLORS.textSoft }}>{label}</span>

      <span
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: COLORS.text,
          textAlign: "right",
          maxWidth: "60%",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </span>
    </div>
  );
}