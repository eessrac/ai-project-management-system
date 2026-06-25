import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch, getToken } from "../api";

/**
 * SprintArchivePage — v2
 * Aynı API ve fonksiyonlar; sadece tasarım iyileştirildi.
 * ProjectDetailPage_v2 / SprintsPage_v2 ile uyumlu görsel dil.
 */

const COLORS = {
  bg: "var(--archive-bg)",
  card: "var(--archive-card)",
  cardSoft: "var(--archive-card-soft)",
  border: "var(--archive-border)",
  borderSoft: "var(--archive-border-soft)",
  text: "var(--archive-text)",
  textSoft: "var(--archive-text-soft)",
  textMuted: "var(--archive-text-muted)",
  primary: "#8B5CF6",
  primarySoft: "var(--archive-primary-soft)",
  success: "#10B981",
  successSoft: "var(--archive-success-soft)",
  warn: "#F59E0B",
  warnSoft: "var(--archive-warn-soft)",
  danger: "#EF4444",
  dangerSoft: "var(--archive-danger-soft)",
  info: "#38BDF8",
  infoSoft: "var(--archive-info-soft)",
  purple: "#A78BFA",
  purpleSoft: "var(--archive-purple-soft)",
};

const ARCHIVE_THEME_STYLE = `
  .sprint-archive-theme {
    --archive-bg: #F8FAFC;
    --archive-card: #FFFFFF;
    --archive-card-soft: #FAFBFD;
    --archive-border: #E2E8F0;
    --archive-border-soft: #EEF2F7;
    --archive-text: #0F172A;
    --archive-text-soft: #475569;
    --archive-text-muted: #94A3B8;
    --archive-primary-soft: #EEF2FF;
    --archive-success-soft: #ECFDF5;
    --archive-warn-soft: #FFFBEB;
    --archive-danger-soft: #FEF2F2;
    --archive-info-soft: #E0F2FE;
    --archive-purple-soft: #F5F3FF;
  }

  .dark .sprint-archive-theme {
    --archive-bg: #0B1020;
    --archive-card: #111827;
    --archive-card-soft: #0F172A;
    --archive-border: #263244;
    --archive-border-soft: #1F2937;
    --archive-text: #F8FAFC;
    --archive-text-soft: #CBD5E1;
    --archive-text-muted: #94A3B8;
    --archive-primary-soft: rgba(139,92,246,.16);
    --archive-success-soft: rgba(16,185,129,.14);
    --archive-warn-soft: rgba(245,158,11,.14);
    --archive-danger-soft: rgba(239,68,68,.14);
    --archive-info-soft: rgba(14,165,233,.14);
    --archive-purple-soft: rgba(124,58,237,.18);
  }

  .sprint-archive-theme button:disabled {
    opacity: .65;
  }
`;

function fmtDate(iso) {
  if (!iso) return "—";
  const clean = String(iso).split("T")[0];
  const [y, m, d] = clean.split("-");
  return `${d}.${m}.${y}`;
}

function Card({ children, padding = 20, style }) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 16,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Btn({ variant = "secondary", children, style, ...rest }) {
  const variants = {
    primary: { bg: COLORS.primary, fg: "#fff", border: COLORS.primary },
    secondary: { bg: COLORS.card, fg: COLORS.text, border: COLORS.border },
    ghost: { bg: "transparent", fg: COLORS.textSoft, border: "transparent" },
    soft: { bg: COLORS.primarySoft, fg: COLORS.primary, border: "transparent" },
  };
  const v = variants[variant] || variants.secondary;
  return (
    <button
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 10,
        background: v.bg,
        color: v.fg,
        border: `1px solid ${v.border}`,
        cursor: "pointer",
        transition: "all .15s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function StatTile({ label, value, color = COLORS.primary, bg = COLORS.primarySoft }) {
  return (
    <Card padding={16} style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      <div style={{ height: 4, background: bg, borderRadius: 999, marginTop: 4 }} />
    </Card>
  );
}

function Badge({ children, color = COLORS.textSoft, bg = COLORS.cardSoft }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 999,
        color,
        background: bg,
        border: `1px solid ${color}22`,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    DONE: { c: COLORS.success, b: COLORS.successSoft, l: "Tamamlandı" },
    TODO: { c: COLORS.info, b: COLORS.infoSoft, l: "Yapılacak" },
    IN_PROGRESS: { c: COLORS.warn, b: COLORS.warnSoft, l: "Devam" },
  };
  const m = map[status] || { c: COLORS.textSoft, b: COLORS.cardSoft, l: status || "—" };
  return <Badge color={m.c} bg={m.b}>{m.l}</Badge>;
}

function PriorityBadge({ priority }) {
  const map = {
    HIGH: { c: COLORS.danger, b: COLORS.dangerSoft },
    MEDIUM: { c: COLORS.warn, b: COLORS.warnSoft },
    LOW: { c: COLORS.info, b: COLORS.infoSoft },
  };
  const m = map[priority] || { c: COLORS.textSoft, b: COLORS.cardSoft };
  return <Badge color={m.c} bg={m.b}>{priority || "—"}</Badge>;
}

function InfoBox({ label, value }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.borderSoft}`,
        borderRadius: 10,
        padding: 12,
        background: COLORS.bg,
      }}
    >
      <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, marginTop: 6, wordBreak: "break-word" }}>
        {value}
      </div>
    </div>
  );
}

function Donut({ value = 0, size = 130, stroke = 14, color = COLORS.success }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div style={{ display: "grid", placeItems: "center", position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={COLORS.borderSoft} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        />
      </svg>
      <div style={{ position: "absolute", textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>{value}%</div>
        <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.4 }}>TAMAMLANMA</div>
      </div>
    </div>
  );
}

function MiniBars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 130, padding: "20px 4px 4px" }}>
      {data.map((d) => (
        <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: "100%",
              height: `${(d.value / max) * 100}%`,
              background: d.color,
              borderRadius: 8,
              minHeight: 4,
              position: "relative",
            }}
          >
            <div style={{ position: "absolute", top: -22, left: 0, right: 0, textAlign: "center", fontSize: 12, fontWeight: 700, color: COLORS.text }}>
              {d.value}
            </div>
          </div>
          <div style={{ fontSize: 11, color: COLORS.textSoft, fontWeight: 600, textAlign: "center" }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export default function SprintArchivePage_v2() {
  const { projectId, sprintId } = useParams();
  const navigate = useNavigate();
  const token = getToken();

  const [loading, setLoading] = useState(true);
  const [archive, setArchive] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [taskDetail, setTaskDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiLoadingText, setAiLoadingText] = useState("");
  const [aiGeneratedAt, setAiGeneratedAt] = useState(null);

  async function loadArchive() {
    try {
      setLoading(true);
      const [archiveData, tasksData] = await Promise.all([
        apiFetch(`/projects/${projectId}/sprints/${sprintId}/archive`, { token }),
        apiFetch(`/projects/${projectId}/sprints/${sprintId}/archive/tasks`, { token }),
      ]);
      setArchive(archiveData.archive || null);
      setTasks(tasksData.tasks || []);
      await loadSavedAiAnalysis();
    } catch (e) {
      console.error("loadArchive:", e);
      alert(e?.message || "Sprint arşivi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  async function openTaskDetail(archiveTaskId) {
    try {
      setSelectedTaskId(archiveTaskId);
      setDetailLoading(true);
      const data = await apiFetch(
        `/projects/${projectId}/sprints/${sprintId}/archive/tasks/${archiveTaskId}`,
        { token }
      );
      setTaskDetail(data || null);
    } catch (e) {
      console.error("openTaskDetail:", e);
      alert(e?.message || "Task detayı yüklenemedi.");
    } finally {
      setDetailLoading(false);
    }
  }

  function closeTaskDetail() {
    setSelectedTaskId(null);
    setTaskDetail(null);
  }

  const aiLoadingMessages = [
    "Sprint verileri analiz ediliyor...",
    "Task dağılımı inceleniyor...",
    "Takım performansı değerlendiriliyor...",
    "Teknik riskler hesaplanıyor...",
    "AI içgörüleri oluşturuluyor...",
  ];

  async function generateAiSprintAnalysis() {
    let interval = null;

    try {
      setAiLoading(true);
      setAiAnalysis(null);

      let index = 0;
      setAiLoadingText(aiLoadingMessages[0]);

      interval = setInterval(() => {
        index = (index + 1) % aiLoadingMessages.length;
        setAiLoadingText(aiLoadingMessages[index]);
      }, 1400);

      const data = await apiFetch(
        `/projects/${projectId}/sprints/${sprintId}/archive/ai-analysis`,
        {
          method: "POST",
          token,
          body: {
            archive,
            tasks,
            costStats,
          },
        }
      );

      setAiAnalysis(data.analysis || null);
      setAiGeneratedAt(new Date());
    } catch (e) {
      console.error("generateAiSprintAnalysis:", e);
      alert(e?.message || "AI sprint analizi oluşturulamadı.");
    } finally {
      if (interval) clearInterval(interval);
      setAiLoading(false);
      setAiLoadingText("");
    }
  }

  async function loadSavedAiAnalysis() {
    try {
      const data = await apiFetch(
        `/projects/${projectId}/sprints/${sprintId}/archive/ai-analysis`,
        { token }
      );

      if (data?.analysis?.analysis) {
        setAiAnalysis(data.analysis.analysis);

        if (data.analysis.updated_at) {
          setAiGeneratedAt(new Date(data.analysis.updated_at));
        }
      }
    } catch (e) {
      console.error("loadSavedAiAnalysis:", e);
    }
  }

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }
    loadArchive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, sprintId, token]);

  const costStats = useMemo(() => {
    const estimated = tasks.reduce((s, t) => s + Number(t.estimated_cost || 0), 0);
    const actual = tasks.reduce((s, t) => s + Number(t.actual_cost || 0), 0);
    return { estimated, actual, diff: actual - estimated };
  }, [tasks]);

  if (!token) return null;

  const completion = Number(archive?.completion_rate || 0);
  const done = Number(archive?.done_task_count || 0);
  const overdue = Number(archive?.overdue_task_count || 0);
  const inProgress = Number(archive?.in_progress_task_count || 0);

  const sprintHealthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        completion -
          overdue * 8 -
          inProgress * 2 +
          done * 2
      )
    )
  );

  const sprintHealthLabel =
    sprintHealthScore >= 80
      ? "Güçlü"
      : sprintHealthScore >= 60
      ? "Orta"
      : "Riskli";

  return (
    <div className="sprint-archive-theme" style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text }}>
      <style>{ARCHIVE_THEME_STYLE}</style>
      {/* Top bar */}
      <div
        style={{
          background: COLORS.card,
          borderBottom: `1px solid ${COLORS.border}`,
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Btn variant="ghost" onClick={() => navigate(`/projects/${projectId}/sprints`)}>← Sprintler</Btn>
          <div style={{ width: 1, height: 22, background: COLORS.border }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>
              Sprint Arşivi
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360 }}>
              {archive?.sprint_name || "—"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" onClick={() => navigate(`/projects/${projectId}`)}>Proje Detayı</Btn>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        {loading ? (
          <Card padding={48} style={{ textAlign: "center", color: COLORS.textMuted }}>Yükleniyor…</Card>
        ) : !archive ? (
          <Card padding={48} style={{ textAlign: "center", color: COLORS.textMuted }}>Arşiv bulunamadı.</Card>
        ) : (
          <>
            {/* Header */}
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{archive.sprint_name}</h2>
                    <Badge color={COLORS.purple} bg={COLORS.purpleSoft}>● ARŞİV</Badge>
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.textSoft }}>
                    {fmtDate(archive.start_date)} → {fmtDate(archive.end_date)}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
                    Arşivlenme Tarihi: {archive.closed_at ? new Date(archive.closed_at).toLocaleString("tr-TR") : "—"}
                  </div>
                </div>
                <div style={{
                  fontSize: 11, color: COLORS.warn, background: COLORS.warnSoft,
                  padding: "8px 12px", borderRadius: 10, border: `1px solid ${COLORS.warn}33`,
                  fontWeight: 600, maxWidth: 320,
                }}>
                  Bu sayfa yalnızca görüntüleme amaçlıdır. Değişiklik yapılamaz.
                </div>
              </div>
            </Card>

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
              <StatTile label="Toplam Task" value={archive.total_task_count ?? 0} color={COLORS.primary} bg={COLORS.primarySoft} />
              <StatTile label="Tamamlanan" value={archive.done_task_count ?? 0} color={COLORS.success} bg={COLORS.successSoft} />
              <StatTile label="Yapılacak" value={archive.todo_task_count ?? 0} color={COLORS.info} bg={COLORS.infoSoft} />
              <StatTile label="Devam Eden" value={archive.in_progress_task_count ?? 0} color={COLORS.warn} bg={COLORS.warnSoft} />
              <StatTile label="Overdue" value={archive.overdue_task_count ?? 0} color={COLORS.danger} bg={COLORS.dangerSoft} />
              <StatTile label="Tamamlanma" value={`%${completion}`} color={COLORS.purple} bg={COLORS.purpleSoft} />
            </div>

            {/* Charts row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Tamamlanma Oranı</div>
                <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
                  <Donut value={completion} color={completion >= 80 ? COLORS.success : completion >= 50 ? COLORS.warn : COLORS.danger} />
                </div>
              </Card>
              <Card>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Task Dağılımı</div>
                <MiniBars
                  data={[
                    { label: "Done", value: archive.done_task_count ?? 0, color: COLORS.success },
                    { label: "Todo", value: archive.todo_task_count ?? 0, color: COLORS.info },
                    { label: "In Prog.", value: archive.in_progress_task_count ?? 0, color: COLORS.warn },
                    { label: "Overdue", value: archive.overdue_task_count ?? 0, color: COLORS.danger },
                  ]}
                />
              </Card>
            </div>

            {/* AI Sprint Analysis */}
            <Card
              padding={20}
              style={{
                background: `linear-gradient(135deg, ${COLORS.purpleSoft}, ${COLORS.primarySoft})`,
                border: `1px dashed ${COLORS.purple}55`,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, #8B5CF6, #4F46E5)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 22,
                  color: "#fff",
                  boxShadow: "0 10px 24px rgba(139,92,246,0.28)",
                  flexShrink: 0,
                }}
              >
                ✨
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: COLORS.text }}>
                    AI Sprint Analizi
                  </div>
                </div>

                <div style={{ fontSize: 13, color: COLORS.textSoft, marginTop: 6, lineHeight: 1.6 }}>
                  Yapay zekâ; sprint performansı, takım verimliliği, teknik riskler ve süreç sağlığı
                  üzerinden otomatik proje yönetimi içgörüleri üretir.
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {aiGeneratedAt && (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 12,
                        color: COLORS.textMuted,
                        fontWeight: 600,
                      }}
                    >
                      Son AI analizi:{" "}
                      {aiGeneratedAt.toLocaleTimeString("tr-TR")}
                    </div>
                  )}
                  <Badge color={COLORS.success} bg={COLORS.successSoft}>
                    Çevik İçgörü
                  </Badge>

                  <Badge color={COLORS.warn} bg={COLORS.warnSoft}>
                    Risk Analizi
                  </Badge>

                  <Badge color={COLORS.info} bg={COLORS.infoSoft}>
                    Sprint Sağlığı
                  </Badge>

                  <Badge color={COLORS.primary} bg={COLORS.primarySoft}>
                    Takım Analizi
                  </Badge>
                </div>
              </div>
            </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Btn
                    variant="primary"
                    onClick={generateAiSprintAnalysis}
                    disabled={aiLoading}
                    style={{
                      opacity: aiLoading ? 0.7 : 1,
                      cursor: aiLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {aiLoading
                      ? aiLoadingText
                      : aiAnalysis
                      ? "Analizi Yenile"
                      : "AI Analiz Oluştur"}
                  </Btn>

                  {aiAnalysis && !aiLoading && (
                    <Btn
                      variant="secondary"
                      onClick={() => {
                        setAiAnalysis(null);
                        setAiGeneratedAt(null);
                      }}
                    >
                      Sonucu Temizle
                    </Btn>
                  )}
                  {aiAnalysis && !aiLoading && (
                    <Btn
                      variant="soft"
                      onClick={() => {
                        const text = `
                  AI Sprint Analizi

                  Sprint Özeti:
                  ${aiAnalysis.summary || "-"}

                  Performans Analizi:
                  ${aiAnalysis.performance || "-"}

                  Risk Analizi:
                  ${aiAnalysis.riskReason || "-"}

                  Maliyet Yorumu:
                  ${aiAnalysis.costComment || "-"}

                  Takım Analizi:
                  ${aiAnalysis.teamAnalysis || "-"}

                  AI Teknik İçgörü:
                  ${aiAnalysis.technicalInsight || "-"}

                  Sprint Sağlığı:
                  ${aiAnalysis.sprintHealth || "-"}

                  Yönetici Önerisi:
                  ${aiAnalysis.managerRecommendation || "-"}

                  Sonraki Sprint Önerileri:
                  ${aiAnalysis.suggestions?.map((s, i) => {
                    const text =
                      typeof s === "object"
                        ? s.description || s.title || s.name || JSON.stringify(s)
                        : s;

                    return `${i + 1}. ${text}`;
                  }).join("\n") || "-"}
                        `.trim();

                        navigator.clipboard.writeText(text);
                        alert("AI analizi kopyalandı.");
                      }}
                    >
                      Analizi Kopyala
                    </Btn>
                  )}
                  {aiAnalysis && !aiLoading && (
                    <Btn
                      variant="soft"
                      onClick={() => {
                        const text = `
                  AI Sprint Analizi

                  Sprint: ${archive?.sprint_name || "-"}
                  Tarih: ${archive?.start_date || "-"} - ${archive?.end_date || "-"}
                  Oluşturulma: ${aiGeneratedAt ? aiGeneratedAt.toLocaleString("tr-TR") : "-"}

                  Sprint Özeti:
                  ${aiAnalysis.summary || "-"}

                  Performans Analizi:
                  ${aiAnalysis.performance || "-"}

                  Risk Seviyesi:
                  ${aiAnalysis.riskLevel || "-"}

                  Risk Analizi:
                  ${aiAnalysis.riskReason || "-"}

                  Maliyet Yorumu:
                  ${aiAnalysis.costComment || "-"}

                  Takım Analizi:
                  ${aiAnalysis.teamAnalysis || "-"}

                  AI Teknik İçgörü:
                  ${aiAnalysis.technicalInsight || "-"}

                  Sprint Sağlığı:
                  ${aiAnalysis.sprintHealth || "-"}

                  Yönetici Önerisi:
                  ${aiAnalysis.managerRecommendation || "-"}

                  Sonraki Sprint Önerileri:
                  ${aiAnalysis.suggestions?.map((s, i) => {
                    const text =
                      typeof s === "object"
                        ? s.description || s.title || s.name || JSON.stringify(s)
                        : s;

                    return `${i + 1}. ${text}`;
                  }).join("\n") || "-"}
                        `.trim();

                        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
                        const url = URL.createObjectURL(blob);

                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${archive?.sprint_name || "sprint"}-ai-analizi.txt`;
                        a.click();

                        URL.revokeObjectURL(url);
                      }}
                    >
                      TXT İndir
                    </Btn>
                  )}
                </div>
              </div>

              {!aiAnalysis ? (
                <div style={{ fontSize: 13, color: COLORS.textSoft, lineHeight: 1.6 }}>
                  Henüz analiz oluşturulmadı. Butona basınca AI sprint snapshot verilerini analiz edecek.
                </div>
              ) : (
                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      background: COLORS.card,
                      border: `1px solid ${COLORS.borderSoft}`,
                      borderRadius: 16,
                      padding: 18,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: COLORS.text }}>
                          🧭 AI Sprint Sağlık Skoru
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
                          Tamamlanma, gecikme ve devam eden iş yoğunluğuna göre hesaplandı.
                        </div>
                      </div>

                      <Badge
                        color={
                          sprintHealthScore >= 80
                            ? COLORS.success
                            : sprintHealthScore >= 60
                            ? COLORS.warn
                            : COLORS.danger
                        }
                        bg={
                          sprintHealthScore >= 80
                            ? COLORS.successSoft
                            : sprintHealthScore >= 60
                            ? COLORS.warnSoft
                            : COLORS.dangerSoft
                        }
                      >
                        {sprintHealthLabel}
                      </Badge>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ fontSize: 30, fontWeight: 900, color: COLORS.text }}>
                        {sprintHealthScore}
                        <span style={{ fontSize: 14, color: COLORS.textMuted }}> / 100</span>
                      </div>

                      <div style={{ flex: 1, height: 10, background: COLORS.borderSoft, borderRadius: 999 }}>
                        <div
                          style={{
                            width: `${sprintHealthScore}%`,
                            height: "100%",
                            borderRadius: 999,
                            background:
                              sprintHealthScore >= 80
                                ? COLORS.success
                                : sprintHealthScore >= 60
                                ? COLORS.warn
                                : COLORS.danger,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      background: COLORS.card,
                      border: `1px solid ${COLORS.borderSoft}`,
                      borderRadius: 14,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.purple, marginBottom: 6 }}>
                      📌 Sprint Özeti
                    </div>
                    <div style={{ fontSize: 13, color: COLORS.textSoft, lineHeight: 1.6 }}>
                      {aiAnalysis.summary}
                    </div>
                  </div>

                  <div
                    style={{
                      background: COLORS.card,
                      border: `1px solid ${COLORS.borderSoft}`,
                      borderRadius: 14,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.info, marginBottom: 6 }}>
                      📊 Performans Analizi
                    </div>
                    <div style={{ fontSize: 13, color: COLORS.textSoft, lineHeight: 1.6 }}>
                      {aiAnalysis.performance}
                    </div>
                  </div>

                  <div
                    style={{
                      background:
                        aiAnalysis.riskLevel === "HIGH"
                          ? COLORS.dangerSoft
                          : aiAnalysis.riskLevel === "MEDIUM"
                          ? COLORS.warnSoft
                          : COLORS.successSoft,
                      border: `1px solid ${
                        aiAnalysis.riskLevel === "HIGH"
                          ? COLORS.danger
                          : aiAnalysis.riskLevel === "MEDIUM"
                          ? COLORS.warn
                          : COLORS.success
                      }33`,
                      borderRadius: 14,
                      padding: 16,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.text }}>
                        ⚠️ Risk Analizi
                      </div>

                      <Badge
                        color={
                          aiAnalysis.riskLevel === "HIGH"
                            ? COLORS.danger
                            : aiAnalysis.riskLevel === "MEDIUM"
                            ? COLORS.warn
                            : COLORS.success
                        }
                        bg={COLORS.card}
                      >
                        {aiAnalysis.riskLevel === "HIGH"
                          ? "YÜKSEK RİSK"
                          : aiAnalysis.riskLevel === "MEDIUM"
                          ? "ORTA RİSK"
                          : "DÜŞÜK RİSK"}
                      </Badge>
                    </div>

                    <div style={{ fontSize: 13, color: COLORS.textSoft, lineHeight: 1.6 }}>
                      {aiAnalysis.riskReason}
                    </div>
                  </div>

                  <div
                    style={{
                      background: COLORS.card,
                      border: `1px solid ${COLORS.borderSoft}`,
                      borderRadius: 14,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.success, marginBottom: 6 }}>
                      💰 Maliyet Yorumu
                    </div>
                    <div style={{ fontSize: 13, color: COLORS.textSoft, lineHeight: 1.6 }}>
                      {aiAnalysis.costComment}
                    </div>
                  </div>

                  <div
                    style={{
                      background: COLORS.card,
                      border: `1px solid ${COLORS.borderSoft}`,
                      borderRadius: 14,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.primary, marginBottom: 6 }}>
                      👥 Takım Analizi
                    </div>

                    <div style={{ fontSize: 13, color: COLORS.textSoft, lineHeight: 1.7 }}>
                      {aiAnalysis.teamAnalysis}
                    </div>
                  </div>

                  <div
                    style={{
                      background: COLORS.card,
                      border: `1px solid ${COLORS.borderSoft}`,
                      borderRadius: 14,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.warn, marginBottom: 6 }}>
                      🧠 AI Teknik İçgörü
                    </div>

                    <div style={{ fontSize: 13, color: COLORS.textSoft, lineHeight: 1.7 }}>
                      {aiAnalysis.technicalInsight}
                    </div>
                  </div>

                  <div
                    style={{
                      background: COLORS.card,
                      border: `1px solid ${COLORS.borderSoft}`,
                      borderRadius: 14,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.success, marginBottom: 6 }}>
                      🚀 Sprint Sağlığı
                    </div>

                    <div style={{ fontSize: 13, color: COLORS.textSoft, lineHeight: 1.7 }}>
                      {aiAnalysis.sprintHealth}
                    </div>
                  </div>

                  <div
                    style={{
                      background: COLORS.card,
                      border: `1px solid ${COLORS.borderSoft}`,
                      borderRadius: 14,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.danger, marginBottom: 6 }}>
                      🎯 Yönetici Önerisi
                    </div>

                    <div style={{ fontSize: 13, color: COLORS.textSoft, lineHeight: 1.7 }}>
                      {aiAnalysis.managerRecommendation}
                    </div>
                  </div>

                  <div
                    style={{
                      background: COLORS.card,
                      border: `1px solid ${COLORS.borderSoft}`,
                      borderRadius: 14,
                      padding: 16,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.primary, marginBottom: 10 }}>
                      ✅ Sonraki Sprint Önerileri
                    </div>

                    {aiAnalysis.suggestions?.length ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        {aiAnalysis.suggestions.map((item, index) => (
                          <div
                            key={index}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 10,
                              fontSize: 13,
                              color: COLORS.textSoft,
                              lineHeight: 1.6,
                              background: COLORS.bg,
                              border: `1px solid ${COLORS.borderSoft}`,
                              borderRadius: 12,
                              padding: 10,
                            }}
                          >
                            <span
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 8,
                                background: COLORS.primarySoft,
                                color: COLORS.primary,
                                fontWeight: 900,
                                display: "grid",
                                placeItems: "center",
                                flexShrink: 0,
                                fontSize: 12,
                              }}
                            >
                              {index + 1}
                            </span>

                            <span style={{ flex: 1 }}>
                              {typeof item === "object"
                                ? item.description || item.title || item.name || JSON.stringify(item)
                                : item}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: COLORS.textMuted }}>
                        Öneri bulunamadı.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* Cost row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
              <Card padding={16} style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>
                  Sprint Tahmini Maliyet
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>
                  {costStats.estimated.toLocaleString("tr-TR")} <span style={{ fontSize: 14, color: COLORS.textMuted }}>TL</span>
                </div>
              </Card>
              <Card padding={16} style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>
                  Sprint Gerçek Maliyet
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>
                  {costStats.actual.toLocaleString("tr-TR")} <span style={{ fontSize: 14, color: COLORS.textMuted }}>TL</span>
                </div>
              </Card>
              <Card padding={16} style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>
                  Maliyet Farkı
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: costStats.diff > 0 ? COLORS.danger : COLORS.success }}>
                  {costStats.diff > 0 ? "+" : ""}{costStats.diff.toLocaleString("tr-TR")} <span style={{ fontSize: 14, color: COLORS.textMuted }}>TL</span>
                </div>
              </Card>
            </div>

            {/* Tasks */}
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Bu sprintte tamamlanan tasklar</div>
                <Badge color={COLORS.textSoft} bg={COLORS.cardSoft}>{tasks.length} task</Badge>
              </div>

              {tasks.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: COLORS.textMuted, fontSize: 13 }}>
                  Tamamlanan task yok.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {tasks.map((task) => {
                    const isSel = selectedTaskId === task.id;
                    return (
                      <button
                        key={task.id}
                        onClick={() => openTaskDetail(task.id)}
                        style={{
                          textAlign: "left",
                          border: `1px solid ${isSel ? COLORS.primary : COLORS.borderSoft}`,
                          borderLeft: `3px solid ${isSel ? COLORS.primary : COLORS.borderSoft}`,
                          borderRadius: 12,
                          background: isSel ? COLORS.primarySoft : COLORS.card,
                          padding: 14,
                          cursor: "pointer",
                          transition: "all .15s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>
                              {task.title}
                            </div>
                            <div style={{ display: "flex", gap: 16, fontSize: 12, color: COLORS.textSoft, flexWrap: "wrap" }}>
                              <span>👤 {task.assigned_to_name || "—"}</span>
                              <span style={{ color: COLORS.textMuted }}>✎ {task.created_by_name || "—"}</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <StatusBadge status={task.status} />
                            <PriorityBadge priority={task.priority} />
                            <Badge color={COLORS.warn} bg={COLORS.warnSoft}>Due: {task.due_date || "—"}</Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>

            
          </>
        )}

        {/* Modal */}
        {selectedTaskId && (
          <div
            onClick={closeTaskDetail}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(15, 23, 42, 0.5)",
              backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1000, padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 960, maxHeight: "90vh", overflow: "auto",
                background: COLORS.card, borderRadius: 16,
                boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                gap: 12, padding: "16px 20px",
                borderBottom: `1px solid ${COLORS.borderSoft}`,
                position: "sticky", top: 0, background: COLORS.card, zIndex: 1,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Arşivlenmiş Task Detayı</h3>
                  <Badge color={COLORS.purple} bg={COLORS.purpleSoft}>Salt Okunur</Badge>
                </div>
                <Btn variant="secondary" onClick={closeTaskDetail}>× Kapat</Btn>
              </div>

              <div style={{ padding: 20 }}>
                {detailLoading ? (
                  <div style={{ padding: 24, textAlign: "center", color: COLORS.textMuted }}>Yükleniyor…</div>
                ) : !taskDetail?.task ? (
                  <div style={{ padding: 24, textAlign: "center", color: COLORS.textMuted }}>Detay bulunamadı.</div>
                ) : (
                  <>
                    <Card padding={18} style={{ marginBottom: 14, background: COLORS.bg }}>
                      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>
                        {taskDetail.task.title}
                      </div>

                      {taskDetail.task.description && (
                        <div style={{ fontSize: 14, color: COLORS.textSoft, lineHeight: 1.6, marginBottom: 16, padding: 12, background: COLORS.card, borderRadius: 10, border: `1px solid ${COLORS.borderSoft}` }}>
                          {taskDetail.task.description}
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                        <InfoBox label="Durum" value={taskDetail.task.status} />
                        <InfoBox label="Öncelik" value={taskDetail.task.priority || "—"} />
                        <InfoBox label="Atanan" value={taskDetail.task.assigned_to_name || "—"} />
                        <InfoBox label="Oluşturan" value={taskDetail.task.created_by_name || "—"} />
                        <InfoBox label="Due Date" value={taskDetail.task.due_date || "—"} />
                        <InfoBox label="Sprint" value={taskDetail.task.sprint_name || "—"} />
                        <InfoBox label="Tahmini Maliyet" value={`${Number(taskDetail.task.estimated_cost || 0).toLocaleString("tr-TR")} TL`} />
                        <InfoBox label="Gerçek Maliyet" value={taskDetail.task.actual_cost ? `${Number(taskDetail.task.actual_cost).toLocaleString("tr-TR")} TL` : "—"} />
                        <InfoBox label="Maliyet Açıklaması" value={taskDetail.task.cost_note || "—"} />
                      </div>
                    </Card>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                      <Card padding={16}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>💬 Yorumlar</div>
                          <Badge color={COLORS.textSoft} bg={COLORS.cardSoft}>{taskDetail.comments?.length || 0}</Badge>
                        </div>
                        {taskDetail.comments?.length ? (
                          <div style={{ display: "grid", gap: 10 }}>
                            {taskDetail.comments.map((c) => (
                              <div key={c.id} style={{ border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: 12, background: COLORS.bg }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.text }}>
                                    {c.author_name || "Kullanıcı"}
                                  </div>
                                  <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                                    {c.created_at ? new Date(c.created_at).toLocaleString("tr-TR") : "—"}
                                  </div>
                                </div>
                                <div style={{ fontSize: 13, color: COLORS.textSoft, lineHeight: 1.5 }}>{c.body}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: COLORS.textMuted, fontSize: 13, textAlign: "center", padding: 16 }}>Yorum yok.</div>
                        )}
                      </Card>

                      <Card padding={16}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>📋 Aktiviteler</div>
                          <Badge color={COLORS.textSoft} bg={COLORS.cardSoft}>{taskDetail.activities?.length || 0}</Badge>
                        </div>
                        {taskDetail.activities?.length ? (
                          <div style={{ display: "grid", gap: 10 }}>
                            {taskDetail.activities.map((a) => (
                              <div key={a.id} style={{ border: `1px solid ${COLORS.borderSoft}`, borderRadius: 10, padding: 12, background: COLORS.bg }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8 }}>
                                  <div style={{ fontSize: 12, color: COLORS.text }}>
                                    <b>{a.actor_name || "Kullanıcı"}</b>
                                    <span style={{ color: COLORS.textMuted, marginLeft: 6 }}>{a.action}</span>
                                  </div>
                                  <div style={{ fontSize: 11, color: COLORS.textMuted, whiteSpace: "nowrap" }}>
                                    {a.created_at ? new Date(a.created_at).toLocaleString("tr-TR") : "—"}
                                  </div>
                                </div>
                                <div style={{ fontSize: 13, color: COLORS.textSoft, lineHeight: 1.5 }}>{a.message}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: COLORS.textMuted, fontSize: 13, textAlign: "center", padding: 16 }}>Aktivite yok.</div>
                        )}
                      </Card>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}