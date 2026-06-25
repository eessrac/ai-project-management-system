// Bu sayfa arşivlenmiş projelerin listelenmesini, filtrelenmesini,
// geri yüklenmesini ve yapay zekâ destekli proje özetlerinin oluşturulmasını sağlar.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getToken } from "../api";

const COLORS = {
  bg: "var(--archive-bg)",
  card: "var(--archive-card)",
  cardSoft: "var(--archive-card-soft)",
  border: "var(--archive-border)",
  borderSoft: "var(--archive-border-soft)",
  text: "var(--archive-text)",
  textSoft: "var(--archive-text-soft)",
  textMuted: "var(--archive-text-muted)",
  primary: "var(--archive-primary)",
  primarySoft: "var(--archive-primary-soft)",
  success: "var(--archive-success)",
  successSoft: "var(--archive-success-soft)",
  warn: "var(--archive-warn)",
  warnSoft: "var(--archive-warn-soft)",
  danger: "var(--archive-danger)",
  dangerSoft: "var(--archive-danger-soft)",
  info: "var(--archive-info)",
  infoSoft: "var(--archive-info-soft)",
  purple: "var(--archive-purple)",
  purpleSoft: "var(--archive-purple-soft)",
  header: "var(--archive-header)",
  shadow: "var(--archive-shadow)",
};

const ARCHIVE_THEME_STYLE = `
  .archive-theme-page {
    --archive-bg: #F8FAFC;
    --archive-card: #FFFFFF;
    --archive-card-soft: #FAFBFD;
    --archive-border: #E2E8F0;
    --archive-border-soft: #EEF2F7;
    --archive-text: #0F172A;
    --archive-text-soft: #475569;
    --archive-text-muted: #94A3B8;
    --archive-primary: #4F46E5;
    --archive-primary-soft: #EEF2FF;
    --archive-success: #10B981;
    --archive-success-soft: #ECFDF5;
    --archive-warn: #F59E0B;
    --archive-warn-soft: #FFFBEB;
    --archive-danger: #EF4444;
    --archive-danger-soft: #FEF2F2;
    --archive-info: #0EA5E9;
    --archive-info-soft: #E0F2FE;
    --archive-purple: #8B5CF6;
    --archive-purple-soft: #F5F3FF;
    --archive-header: rgba(255,255,255,0.85);
    --archive-shadow: 0 1px 2px rgba(15,23,42,0.04);
  }

  .dark .archive-theme-page {
    --archive-bg: #0B1020;
    --archive-card: #111827;
    --archive-card-soft: #0F172A;
    --archive-border: #263244;
    --archive-border-soft: #1F2937;
    --archive-text: #F8FAFC;
    --archive-text-soft: #CBD5E1;
    --archive-text-muted: #94A3B8;
    --archive-primary: #8B5CF6;
    --archive-primary-soft: rgba(139,92,246,0.16);
    --archive-success: #10B981;
    --archive-success-soft: rgba(16,185,129,0.14);
    --archive-warn: #F59E0B;
    --archive-warn-soft: rgba(245,158,11,0.14);
    --archive-danger: #EF4444;
    --archive-danger-soft: rgba(239,68,68,0.14);
    --archive-info: #38BDF8;
    --archive-info-soft: rgba(14,165,233,0.14);
    --archive-purple: #A78BFA;
    --archive-purple-soft: rgba(124,58,237,0.18);
    --archive-header: rgba(11,16,32,0.88);
    --archive-shadow: 0 18px 40px rgba(0,0,0,0.28);
  }

  .archive-theme-page input,
  .archive-theme-page select {
    color-scheme: light;
  }

  .dark .archive-theme-page input,
  .dark .archive-theme-page select {
    color-scheme: dark;
  }

  .archive-theme-page input::placeholder {
    color: var(--archive-text-muted);
  }
`;

// Sayfa içerisinde kullanılan ortak kart bileşenini oluşturur.
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

// Farklı görünümlerde buton oluşturmak için kullanılan yardımcı bileşen.
function Btn({ children, onClick, variant = "ghost", style, disabled, title }) {
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
    success: {
      background: COLORS.successSoft,
      color: COLORS.success,
      border: `1px solid ${COLORS.success}`,
    },
    soft: {
      background: COLORS.primarySoft,
      color: COLORS.primary,
      border: `1px solid ${COLORS.primary}`,
    },
    danger: {
      background: COLORS.dangerSoft,
      color: COLORS.danger,
      border: `1px solid ${COLORS.danger}`,
    },
    ai: {
      background: COLORS.purpleSoft,
      color: COLORS.purple,
      border: `1px solid ${COLORS.purple}`,
    },
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...styles,
        padding: "8px 14px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "all .15s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// İstatistik kartlarını görüntülemek için kullanılan bileşen.
function StatCard({ label, value, icon, accent, accentSoft, hint }) {
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
              fontSize: 28,
              fontWeight: 900,
              color: COLORS.text,
              marginTop: 6,
              lineHeight: 1.1,
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
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

// Proje isminden avatar için baş harfleri oluşturur.
function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

// Tarih bilgisini okunabilir formata dönüştürür.
function formatDate(raw) {
  if (!raw) return "—";

  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "—";

    return d.toLocaleDateString("tr-TR", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

// Bir tarihin üzerinden ne kadar süre geçtiğini hesaplar.
function daysAgo(raw) {
  if (!raw) return null;

  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;

  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (days <= 0) return "bugün";
  if (days === 1) return "1 gün önce";
  if (days < 30) return `${days} gün önce`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ay önce`;

  return `${Math.floor(months / 12)} yıl önce`;
}

// Metin dosyası oluşturarak kullanıcının indirmesini sağlar.
function downloadTxt(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

const AI_STORAGE_KEY = "archived_project_ai_summaries";

// Arşivlenmiş projelerin görüntülenmesini ve yönetilmesini sağlayan sayfa.
export default function ArchivedProjectsPage() {
  const navigate = useNavigate();
  const token = getToken();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("recent");

  const [restoringId, setRestoringId] = useState(null);
  const [openSummaryProjectId, setOpenSummaryProjectId] = useState(null);

  const [aiSummaries, setAiSummaries] = useState(() => {
    try {
      const saved = localStorage.getItem(AI_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [aiSummaryLoadingId, setAiSummaryLoadingId] = useState(null);

  useEffect(() => {
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(aiSummaries));
  }, [aiSummaries]);

  useEffect(() => {
    if (!token) navigate("/login", { replace: true });
  }, [token, navigate]);

  useEffect(() => {
    if (!token) return;
    loadArchivedProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadArchivedProjects() {
    try {
      if (!token) return;

      setLoading(true);

      const data = await apiFetch("/projects/archived", { token });
      setProjects(data.projects || []);
    } catch (e) {
      console.error("loadArchivedProjects:", e);
      alert("Arşivlenmiş projeler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  async function unarchiveProject(projectId) {
    const ok = window.confirm("Bu projeyi tekrar aktif hale getirmek istiyor musun?");
    if (!ok) return;

    try {
      setRestoringId(projectId);

      await apiFetch(`/projects/${projectId}/unarchive`, {
        method: "PATCH",
        token,
      });

      await loadArchivedProjects();
      alert("Proje arşivden çıkarıldı.");
    } catch (e) {
      console.error("unarchiveProject:", e);
      alert("Proje arşivden çıkarılamadı.");
    } finally {
      setRestoringId(null);
    }
  }

  // Proje için yapay zekâ destekli özet oluşturur ve görüntüler.
  async function openAiSummary(project, forceRegenerate = false) {
    const projectId = project.id;

    setOpenSummaryProjectId(projectId);

    if (aiSummaries[projectId] && !forceRegenerate) return;

    try {
      setAiSummaryLoadingId(projectId);

      const data = await apiFetch(`/projects/${projectId}/archive-ai-summary`, {
        token,
      });

      setAiSummaries((prev) => ({
        ...prev,
        [projectId]: {
          text: data.summary || "AI özeti oluşturulamadı.",
          generatedAt: new Date().toISOString(),
          projectName: project.name,
        },
      }));
    } catch (e) {
      setAiSummaries((prev) => ({
        ...prev,
        [projectId]: {
          text: e.message || "AI özeti alınamadı.",
          generatedAt: new Date().toISOString(),
          projectName: project.name,
        },
      }));
    } finally {
      setAiSummaryLoadingId(null);
    }
  }

  function copyAiSummary(project) {
    const summary = aiSummaries[project.id]?.text || "";
    if (!summary) return;

    navigator.clipboard.writeText(summary);
    alert("AI proje özeti kopyalandı.");
  }

  function downloadAiSummary(project) {
    const summary = aiSummaries[project.id]?.text || "";
    if (!summary) return;

    const safeName = String(project.name || "proje")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\wğüşöçıİĞÜŞÖÇ-]/gi, "");

    downloadTxt(`${safeName}-ai-proje-ozeti.txt`, summary);
  }

  // Kullanıcının lider olduğu proje sayısını hesaplar.
  const leaderCount = useMemo(
    () =>
      projects.filter((p) => (p.my_role || "").toUpperCase() === "LEADER")
        .length,
    [projects]
  );

  const memberCount = projects.length - leaderCount;

  // Arama, filtreleme ve sıralama işlemlerini uygular.
  const filtered = useMemo(() => {
    let list = [...projects];

    if (roleFilter !== "ALL") {
      list = list.filter((p) => (p.my_role || "").toUpperCase() === roleFilter);
    }

    const q = query.trim().toLowerCase();

    if (q) {
      list = list.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");

      const ta = a.archived_at ? new Date(a.archived_at).getTime() : 0;
      const tb = b.archived_at ? new Date(b.archived_at).getTime() : 0;

      return sortBy === "oldest" ? ta - tb : tb - ta;
    });

    return list;
  }, [projects, query, roleFilter, sortBy]);

  if (!token) return null;

  return (
    <div
      className="archive-theme-page"
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        transition: "background .25s ease, color .25s ease",
      }}
    >
      <style>{ARCHIVE_THEME_STYLE}</style>

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
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button
              onClick={() => navigate("/projects")}
              title="Projelere dön"
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
            >
              ←
            </button>

            <div>
              <div style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 700 }}>
                <span style={{ cursor: "pointer" }} onClick={() => navigate("/projects")}>
                  Projeler
                </span>
                <span style={{ margin: "0 6px" }}>›</span>
                <span>Arşiv</span>
              </div>

              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: COLORS.text,
                }}
              >
                📦 Arşivlenmiş Projeler
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" onClick={() => navigate("/projects")}>
              Aktif Projeler
            </Btn>

            <Btn variant="primary" onClick={loadArchivedProjects} disabled={loading}>
              {loading ? "Yükleniyor..." : "↻ Yenile"}
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
        <Card
          padding={16}
          style={{
            background: COLORS.warnSoft,
            borderColor: COLORS.warn,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: COLORS.card,
                color: COLORS.warn,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              ℹ️
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.warn }}>
                Arşiv hakkında
              </div>
              <div style={{ fontSize: 13, color: COLORS.textSoft, marginTop: 2 }}>
                Buradaki projeler salt-okunur durumdadır. Sadece{" "}
                <strong>lider</strong> rolündeki kullanıcılar bir projeyi geri
                yükleyebilir.
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
            label="Toplam Arşiv"
            value={projects.length}
            icon="📦"
            accent={COLORS.purple}
            accentSoft={COLORS.purpleSoft}
            hint="Arşivlenmiş projeler"
          />

          <StatCard
            label="Lider Olduğun"
            value={leaderCount}
            icon="👑"
            accent={COLORS.warn}
            accentSoft={COLORS.warnSoft}
            hint="Geri yükleyebilirsin"
          />

          <StatCard
            label="Üye Olduğun"
            value={memberCount}
            icon="👥"
            accent={COLORS.info}
            accentSoft={COLORS.infoSoft}
            hint="Salt-okunur erişim"
          />
        </div>

        <Card padding={14}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
              <span
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: COLORS.textMuted,
                  fontSize: 14,
                }}
              >
                🔍
              </span>

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Proje ara..."
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 36px",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  fontSize: 13,
                  outline: "none",
                  background: COLORS.cardSoft,
                  color: COLORS.text,
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: 4,
                padding: 4,
                background: COLORS.borderSoft,
                borderRadius: 10,
              }}
            >
              {[
                { v: "ALL", l: "Tümü" },
                { v: "LEADER", l: "Lider" },
                { v: "MEMBER", l: "Üye" },
              ].map((opt) => {
                const active = roleFilter === opt.v;

                return (
                  <button
                    key={opt.v}
                    onClick={() => setRoleFilter(opt.v)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: active
                        ? `1px solid ${COLORS.primary}`
                        : "1px solid transparent",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 800,
                      background: active ? COLORS.primarySoft : "transparent",
                      color: active ? COLORS.primary : COLORS.textSoft,
                      boxShadow: active
                        ? "0 4px 12px rgba(139,92,246,0.16)"
                        : "none",
                    }}
                  >
                    {opt.l}
                  </button>
                );
              })}
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: "10px 12px",
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                fontSize: 13,
                background: COLORS.cardSoft,
                color: COLORS.text,
                cursor: "pointer",
              }}
            >
              <option value="recent">En Yeni Arşiv</option>
              <option value="oldest">En Eski Arşiv</option>
              <option value="name">İsme Göre (A-Z)</option>
            </select>
          </div>
        </Card>

        {loading ? (
          <Card>
            <p style={{ color: COLORS.textSoft, margin: 0 }}>Yükleniyor...</p>
          </Card>
        ) : filtered.length === 0 ? (
          <Card padding={48} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>

            <div style={{ fontSize: 16, fontWeight: 800, color: COLORS.text }}>
              {projects.length === 0 ? "Arşivlenmiş proje yok" : "Sonuç bulunamadı"}
            </div>

            <div style={{ fontSize: 13, color: COLORS.textSoft, marginTop: 6 }}>
              {projects.length === 0
                ? "Bir proje arşivlediğinde burada listelenir."
                : "Filtreleri temizlemeyi dene."}
            </div>

            {projects.length === 0 && (
              <div style={{ marginTop: 16 }}>
                <Btn variant="primary" onClick={() => navigate("/projects")}>
                  Aktif Projelere Git
                </Btn>
              </div>
            )}
          </Card>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
              gap: 16,
            }}
          >
            {filtered.map((p) => {
              const isLeader = (p.my_role || "").toUpperCase() === "LEADER";
              const ago = daysAgo(p.archived_at);
              const isSummaryOpen = openSummaryProjectId === p.id;
              const summaryData = aiSummaries[p.id];
              const isLoadingSummary = aiSummaryLoadingId === p.id;

              return (
                <Card
                  key={p.id}
                  padding={0}
                  style={{
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <div
                    style={{
                      height: 6,
                      background: isLeader
                        ? `linear-gradient(90deg, ${COLORS.warn}, ${COLORS.purple})`
                        : `linear-gradient(90deg, ${COLORS.info}, ${COLORS.primary})`,
                    }}
                  />

                  <div
                    style={{
                      padding: 18,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      flex: 1,
                    }}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: isLeader ? COLORS.warnSoft : COLORS.primarySoft,
                          color: isLeader ? COLORS.warn : COLORS.primary,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          fontSize: 15,
                          flexShrink: 0,
                          filter: "grayscale(0.2)",
                        }}
                      >
                        {initialsOf(p.name)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: COLORS.text,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.name}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: COLORS.textMuted,
                            marginTop: 2,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: COLORS.textMuted,
                            }}
                          />
                          Arşivde
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: isLeader ? COLORS.warn : COLORS.primary,
                          background: isLeader ? COLORS.warnSoft : COLORS.primarySoft,
                          padding: "4px 10px",
                          borderRadius: 999,
                          flexShrink: 0,
                        }}
                      >
                        {isLeader ? "👑 LİDER" : p.my_role || "ÜYE"}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        color: COLORS.textSoft,
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        minHeight: 38,
                      }}
                    >
                      {p.description || "Açıklama yok."}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        paddingTop: 12,
                        borderTop: `1px solid ${COLORS.borderSoft}`,
                        fontSize: 12,
                        color: COLORS.textMuted,
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        📅 {formatDate(p.archived_at)}
                      </span>

                      {ago && (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: COLORS.borderSoft,
                            color: COLORS.textSoft,
                            fontWeight: 700,
                          }}
                        >
                          {ago}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                      <Btn
                        variant="ghost"
                        onClick={() => navigate(`/projects/${p.id}`)}
                        style={{ flex: 1 }}
                      >
                        Görüntüle
                      </Btn>

                      <Btn
                        variant="ai"
                        onClick={() => openAiSummary(p)}
                        style={{ flex: 1 }}
                        disabled={isLoadingSummary}
                      >
                        {isLoadingSummary ? "Oluşturuluyor..." : "✨ AI Özeti"}
                      </Btn>

                      {isLeader && (
                        <Btn
                          variant="success"
                          onClick={() => unarchiveProject(p.id)}
                          disabled={restoringId === p.id}
                          style={{ flex: 1 }}
                          title="Projeyi tekrar aktif hale getir"
                        >
                          {restoringId === p.id ? "Geri yükleniyor..." : "↩ Geri Yükle"}
                        </Btn>
                      )}
                    </div>

                    {isSummaryOpen && (
                      <div
                        style={{
                          marginTop: 8,
                          border: `1px dashed ${COLORS.purple}`,
                          background: `linear-gradient(135deg, ${COLORS.purpleSoft}, ${COLORS.primarySoft})`,
                          borderRadius: 16,
                          padding: 16,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                            marginBottom: 12,
                          }}
                        >
                          <div>
                            <div
                              style={{
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
                                  gap: 8,
                                  flexWrap: "wrap",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 18,
                                    fontWeight: 900,
                                    color: COLORS.text,
                                  }}
                                >
                                  ✨ AI Proje Özeti
                                </div>

                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 900,
                                    color: COLORS.purple,
                                    background: COLORS.card,
                                    padding: "4px 9px",
                                    borderRadius: 999,
                                    border: `1px solid ${COLORS.purple}`,
                                  }}
                                >
                                  Qwen Turbo
                                </span>
                              </div>
                            </div>

                            <div style={{ fontSize: 12, color: COLORS.textSoft, marginTop: 5 }}>
                              Tüm sprintler, tasklar, ekip katkısı ve risklere göre oluşturulur.
                            </div>

                            {summaryData?.generatedAt && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: COLORS.textMuted,
                                  marginTop: 6,
                                  fontWeight: 700,
                                }}
                              >
                                Son oluşturma:{" "}
                                {new Date(summaryData.generatedAt).toLocaleString("tr-TR", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            )}
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Btn
                              variant="primary"
                              onClick={() => openAiSummary(p, true)}
                              disabled={isLoadingSummary}
                            >
                              {isLoadingSummary ? "Yenileniyor..." : "Yeniden Oluştur"}
                            </Btn>

                            {summaryData?.text && !isLoadingSummary && (
                              <>
                                <Btn variant="ghost" onClick={() => copyAiSummary(p)}>
                                  Kopyala
                                </Btn>

                                <Btn variant="soft" onClick={() => downloadAiSummary(p)}>
                                  TXT İndir
                                </Btn>
                              </>
                            )}

                            <button
                              onClick={() => setOpenSummaryProjectId(null)}
                              style={{
                                border: `1px solid ${COLORS.border}`,
                                background: COLORS.card,
                                color: COLORS.textSoft,
                                borderRadius: 10,
                                padding: "7px 10px",
                                cursor: "pointer",
                                fontWeight: 900,
                              }}
                            >
                              × Kapat
                            </button>
                          </div>
                        </div>

                        {isLoadingSummary ? (
                          <div
                            style={{
                              background: COLORS.card,
                              border: `1px solid ${COLORS.borderSoft}`,
                              borderRadius: 14,
                              padding: 18,
                              color: COLORS.textMuted,
                              fontSize: 13,
                            }}
                          >
                            AI proje özeti oluşturuluyor...
                          </div>
                        ) : summaryData?.text ? (
                          <div
                            style={{
                              background: COLORS.card,
                              border: `1px solid ${COLORS.borderSoft}`,
                              borderRadius: 16,
                              padding: 18,
                              lineHeight: 1.8,
                              fontSize: 14,
                              color: COLORS.textSoft,
                            }}
                          >
                            {summaryData.text
                              .replaceAll("**", "")
                              .split("\n")
                              .filter(Boolean)
                              .map((line, index) => {
                                const isTitle = /^\d+\./.test(line.trim());

                                return (
                                  <div
                                    key={index}
                                    style={{
                                      marginBottom: isTitle ? 8 : 14,
                                      fontWeight: isTitle ? 900 : 500,
                                      color: isTitle ? COLORS.text : COLORS.textSoft,
                                      fontSize: isTitle ? 15 : 13.5,
                                    }}
                                  >
                                    {line}
                                  </div>
                                );
                              })}
                          </div>
                        ) : (
                          <div
                            style={{
                              background: COLORS.card,
                              border: `1px dashed ${COLORS.border}`,
                              borderRadius: 14,
                              padding: 18,
                              color: COLORS.textMuted,
                              fontSize: 13,
                            }}
                          >
                            Henüz AI özeti oluşturulmadı.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}