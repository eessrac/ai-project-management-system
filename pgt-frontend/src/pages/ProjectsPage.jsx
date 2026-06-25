import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import {
  apiFetch,
  getToken,
  getProjectSummary,
  sendJoinRequest,
} from "../api";
import { useTheme } from "../context/ThemeContext.jsx";

function getColors(isDark) {
  return {
    bg: isDark ? "#0B1020" : "#F8FAFC",
    card: isDark ? "#111827" : "#FFFFFF",
    card2: isDark ? "#0F172A" : "#F8FAFC",
    border: isDark ? "#263244" : "#E2E8F0",
    text: isDark ? "#F8FAFC" : "#0F172A",
    sub: isDark ? "#CBD5E1" : "#64748B",
    muted: isDark ? "#94A3B8" : "#94A3B8",
    primary: isDark ? "#8B5CF6" : "#4F46E5",
    primarySoft: isDark ? "rgba(139,92,246,0.16)" : "#EEF2FF",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#0EA5E9",
    shadow: isDark
      ? "0 14px 35px rgba(0,0,0,0.28)"
      : "0 2px 8px rgba(15,23,42,0.03)",
    activeShadow: isDark
      ? "0 18px 40px rgba(139,92,246,0.18)"
      : "0 12px 30px rgba(79,70,229,0.14)",
  };
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const token = getToken();
  const { isDark } = useTheme();
  const C = useMemo(() => getColors(isDark), [isDark]);

  const STATUS = useMemo(
    () => ({
      active: { label: "Aktif", color: C.success },
      planning: { label: "Planlama", color: C.info },
      on_hold: { label: "Beklemede", color: C.warning },
      completed: { label: "Tamamlandı", color: C.primary },
      archived: { label: "Arşivli", color: C.muted },
    }),
    [C]
  );

  const inputStyle = {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    fontSize: 13,
    outline: "none",
    background: C.card2,
    color: C.text,
    boxSizing: "border-box",
  };

  const primaryButtonStyle = {
    padding: "10px 18px",
    borderRadius: 10,
    border: "none",
    background: C.primary,
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: isDark
      ? "0 10px 24px rgba(139,92,246,0.24)"
      : "0 8px 18px rgba(79,70,229,0.18)",
  };

  const secondaryButtonStyle = {
    padding: "10px 16px",
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.card2,
    color: C.text,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  };

  const sectionTitle = {
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 4,
    color: C.text,
  };

  const sectionDesc = {
    fontSize: 12,
    color: C.sub,
    marginBottom: 12,
  };

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("overview");
  const detailsRef = useRef(null);

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joinMsg, setJoinMsg] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    if (!token) return;
    loadProjects();
  }, [token]);

  useEffect(() => {
    if (!token || !selectedId) {
      setSummary(null);
      return;
    }

    loadSelectedProjectSummary(selectedId);
  }, [token, selectedId]);

  async function loadProjects() {
    try {
      setLoading(true);

      const data = await apiFetch("/projects", { token });
      const list = data?.projects || [];

      setProjects(list);

      if (list.length > 0) {
        setSelectedId((prev) =>
          prev && list.some((p) => p.id === prev) ? prev : list[0].id
        );
      } else {
        setSelectedId(null);
      }
    } catch (e) {
      console.error("Projects load error:", e);
      alert("Projeler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSelectedProjectSummary(projectId) {
    try {
      setSummaryLoading(true);

      const data = await getProjectSummary(projectId);
      setSummary(data?.summary || null);
    } catch (e) {
      console.error("Project summary error:", e);
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();

    const code = joinCode.trim().toUpperCase();
    if (!code) return;

    try {
      setJoining(true);

      const data = await sendJoinRequest(code);

      setJoinMsg(data?.message || "✓ Katılım isteği gönderildi.");
      setJoinCode("");

      await loadProjects();
    } catch (e) {
      console.error("Join project error:", e);
      setJoinMsg(e?.message || "✗ Katılım isteği gönderilemedi.");
    } finally {
      setJoining(false);
    }
  }

  const filtered = useMemo(() => {
    return projects
      .filter((p) => {
        if (filter === "all") return true;

        const status = getProjectStatus(p);
        return status === filter;
      })
      .filter((p) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;

        return (
          (p.name || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
        );
      });
  }, [projects, search, filter]);

  const leaderProjects = filtered.filter((p) => p.my_role === "LEADER");
  const memberProjects = filtered.filter((p) => p.my_role !== "LEADER");

  const selected = projects.find((p) => p.id === selectedId) || null;

  const mostActiveProjectId = useMemo(() => {
    const list = [...projects].filter((p) => Number(p.activity_count || 0) > 0);

    if (list.length === 0) return null;

    return list.sort(
      (a, b) => Number(b.activity_count || 0) - Number(a.activity_count || 0)
    )[0]?.id;
  }, [projects]);

  const taskDistribution = useMemo(() => {
    if (!summary) return [];

    const hasActiveSprint = summary?.has_active_sprint === true;

    const done = hasActiveSprint
      ? Number(summary.active_done_count || 0)
      : Number(summary.project_done_count || 0);

    const inProgress = hasActiveSprint
      ? Number(summary.active_in_progress_count || 0)
      : Number(summary.project_in_progress_count || 0);

    const todo = hasActiveSprint
      ? Number(summary.active_todo_count || 0)
      : Number(summary.project_todo_count || 0);

    const overdue = hasActiveSprint
      ? Number(summary.active_overdue_count || 0)
      : Number(summary.project_overdue_count || 0);

    return [
      { name: "Tamamlandı", value: done, color: C.success },
      { name: "Devam ediyor", value: inProgress, color: C.info },
      { name: "Bekliyor", value: todo, color: C.warning },
      { name: "Gecikmiş", value: overdue, color: C.danger },
    ].filter((d) => d.value > 0);
  }, [summary, C]);

  const totalTasks = taskDistribution.reduce((a, b) => a + b.value, 0);

  const completedTasks = summary?.has_active_sprint
    ? Number(summary?.active_done_count || 0)
    : Number(summary?.project_done_count || 0);

  const inProgressTasks = summary?.has_active_sprint
    ? Number(summary?.active_in_progress_count || 0)
    : Number(summary?.project_in_progress_count || 0);

  const overdueTasks = summary?.has_active_sprint
    ? Number(summary?.active_overdue_count || 0)
    : Number(summary?.project_overdue_count || 0);

  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const weeklyActivity = useMemo(() => {
    const list = summary?.weeklyActivity || summary?.weekly_activity;

    if (Array.isArray(list) && list.length > 0) return list;

    return [
      { day: "Pzt", tasks: 0 },
      { day: "Sal", tasks: 0 },
      { day: "Çar", tasks: 0 },
      { day: "Per", tasks: 0 },
      { day: "Cum", tasks: 0 },
      { day: "Cmt", tasks: 0 },
      { day: "Paz", tasks: 0 },
    ];
  }, [summary]);

  const memberWorkload = useMemo(() => {
    const list = summary?.memberWorkload || summary?.member_workload;
    if (Array.isArray(list) && list.length > 0) return list;
    return [];
  }, [summary]);

  const recentActivity =
    summary?.recentActivity || summary?.recent_activity || [];

  if (!token) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "Inter, system-ui, sans-serif",
        transition: "background .25s ease, color .25s ease",
      }}
    >
      <header
        style={{
          background: C.card,
          borderBottom: `1px solid ${C.border}`,
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text }}>
            Projelerim
          </div>
          <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>
            Toplam <b>{projects.length}</b> proje ·{" "}
            {projects.filter((p) => getProjectStatus(p) === "active").length} aktif
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => navigate("/projects/archived")}
            style={secondaryButtonStyle}
          >
            📦 Arşiv
          </button>

          <button
            onClick={() => navigate("/projects/new")}
            style={primaryButtonStyle}
          >
            + Yeni Proje
          </button>
        </div>
      </header>

      <div
        style={{
          padding: 24,
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        <Card C={C} style={{ padding: 16, marginBottom: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 220px 260px",
              gap: 12,
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder="Proje ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="all">Tüm projeler</option>
              <option value="active">Aktif</option>
              <option value="planning">Planlama</option>
              <option value="on_hold">Beklemede</option>
              <option value="completed">Tamamlandı</option>
            </select>

            <form onSubmit={handleJoin} style={{ display: "flex", gap: 8 }}>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Davet kodu"
                style={{
                  ...inputStyle,
                  textTransform: "uppercase",
                  minWidth: 0,
                }}
              />

              <button
                type="submit"
                disabled={joining}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "none",
                  cursor: joining ? "not-allowed" : "pointer",
                  background: C.text,
                  color: isDark ? "#0B1020" : "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  opacity: joining ? 0.65 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {joining ? "..." : "Katıl"}
              </button>
            </form>
          </div>

          {joinMsg && (
            <div style={{ fontSize: 12, color: C.sub, marginTop: 10 }}>
              {joinMsg}
            </div>
          )}
        </Card>

        {loading ? (
          <Card C={C} style={{ padding: 50, textAlign: "center", color: C.muted }}>
            Projeler yükleniyor...
          </Card>
        ) : filtered.length === 0 ? (
          <Card C={C} style={{ padding: 50, textAlign: "center", color: C.muted }}>
            Proje bulunamadı.
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {leaderProjects.length > 0 && (
              <ProjectSection
                C={C}
                title="Lider Olduğum Projeler"
                desc="Yönetici olduğun projeler"
                icon="⭐"
                iconBg={C.primarySoft}
              >
                {leaderProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    C={C}
                    STATUS={STATUS}
                    project={p}
                    summary={p.id === selectedId ? summary : null}
                    active={p.id === selectedId}
                    mostActive={p.id === mostActiveProjectId}
                    onClick={() => {
                      setSelectedId(p.id);
                      setTab("overview");

                      setTimeout(() => {
                        detailsRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }, 100);
                    }}
                  />
                ))}
              </ProjectSection>
            )}

            {memberProjects.length > 0 && (
              <ProjectSection
                C={C}
                title="Üye Olduğum Projeler"
                desc="Katıldığın ekip projeleri"
                icon="👥"
                iconBg={isDark ? "rgba(16,185,129,0.15)" : "#ECFDF5"}
              >
                {memberProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    C={C}
                    STATUS={STATUS}
                    project={p}
                    summary={p.id === selectedId ? summary : null}
                    active={p.id === selectedId}
                    mostActive={p.id === mostActiveProjectId}
                    onClick={() => {
                      setSelectedId(p.id);
                      setTab("overview");

                      setTimeout(() => {
                        detailsRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }, 100);
                    }}
                  />
                ))}
              </ProjectSection>
            )}
          </div>
        )}

        <div ref={detailsRef} style={{ marginTop: 24, scrollMarginTop: 90 }}>
          {!selected ? (
            <Card C={C} style={{ padding: 50, textAlign: "center" }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📂</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                Henüz proje seçmedin
              </div>
              <div style={{ fontSize: 13, color: C.sub }}>
                Üstteki kartlardan bir proje seç ya da yeni bir proje oluştur.
              </div>
            </Card>
          ) : (
            <>
              <Card C={C}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 6,
                      }}
                    >
                      <h1
                        style={{
                          fontSize: 22,
                          fontWeight: 800,
                          margin: 0,
                          color: C.text,
                        }}
                      >
                        {selected.name}
                      </h1>

                      <StatusDot C={C} STATUS={STATUS} status={getProjectStatus(selected)} />
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: C.sub,
                        marginBottom: 12,
                        lineHeight: 1.6,
                      }}
                    >
                      {selected.description || "Açıklama eklenmemiş."}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 20,
                        fontSize: 12,
                        color: C.sub,
                        flexWrap: "wrap",
                      }}
                    >
                      <span>👥 {getMemberCount(selected, summary)} üye</span>
                      <span>
                        📅{" "}
                        {formatDate(selected.created_at || selected.createdAt)}
                      </span>
                      {(selected.join_code || selected.code) && (
                        <span>🔑 {selected.join_code || selected.code}</span>
                      )}
                      {selected.my_role && <span>⭐ Rol: {selected.my_role}</span>}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => navigate(`/projects/${selected.id}/tasks`)}
                      style={secondaryButtonStyle}
                    >
                      Görevler
                    </button>

                    <button
                      onClick={() => navigate(`/projects/${selected.id}`)}
                      style={primaryButtonStyle}
                    >
                      Projeyi Aç
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 18 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: C.sub }}>İlerleme</span>
                    <span style={{ fontWeight: 700, color: C.text }}>
                      %{completionRate} · {completedTasks}/{totalTasks} görev
                    </span>
                  </div>

                  <ProgressBar C={C} value={completionRate} />
                </div>
              </Card>

              <Card
                C={C}
                style={{
                  padding: 0,
                  display: "flex",
                  overflow: "hidden",
                  marginTop: 16,
                }}
              >
                <StatBox C={C} label="Toplam görev" value={totalTasks} />
                <StatBox
                  C={C}
                  label="Tamamlanan"
                  value={completedTasks}
                  color={C.success}
                />
                <StatBox
                  C={C}
                  label="Devam eden"
                  value={inProgressTasks}
                  color={C.info}
                />
                <StatBox
                  C={C}
                  label="Gecikmiş"
                  value={overdueTasks}
                  color={C.danger}
                />
              </Card>

              <div
                style={{
                  display: "flex",
                  gap: 4,
                  borderBottom: `1px solid ${C.border}`,
                  marginTop: 18,
                }}
              >
                {[
                  { k: "overview", l: "Genel Bakış" },
                  { k: "charts", l: "Grafikler" },
                  { k: "activity", l: "Aktiviteler" },
                ].map((t) => (
                  <button
                    key={t.k}
                    onClick={() => setTab(t.k)}
                    style={{
                      padding: "10px 16px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 700,
                      color: tab === t.k ? C.primary : C.sub,
                      borderBottom: `2px solid ${
                        tab === t.k ? C.primary : "transparent"
                      }`,
                      marginBottom: -1,
                    }}
                  >
                    {t.l}
                  </button>
                ))}
              </div>

              {summaryLoading ? (
                <Card
                  C={C}
                  style={{
                    padding: 40,
                    textAlign: "center",
                    color: C.muted,
                    marginTop: 16,
                  }}
                >
                  Proje özeti yükleniyor...
                </Card>
              ) : (
                <div style={{ marginTop: 16 }}>
                  {tab === "overview" && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 16,
                      }}
                    >
                      <Card C={C}>
                        <div style={sectionTitle}>Görev Dağılımı</div>
                        <div style={sectionDesc}>
                          Görevlerin durumlara göre dağılımı
                        </div>

                        {taskDistribution.length === 0 ? (
                          <EmptyChart C={C} text="Henüz görev yok" />
                        ) : (
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie
                                data={taskDistribution}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={2}
                              >
                                {taskDistribution.map((d, i) => (
                                  <Cell key={i} fill={d.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  background: C.card,
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 10,
                                  color: C.text,
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        )}

                        {taskDistribution.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                              marginTop: 8,
                            }}
                          >
                            {taskDistribution.map((d, i) => (
                              <div
                                key={i}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  fontSize: 12,
                                }}
                              >
                                <span
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    color: C.sub,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: 2,
                                      background: d.color,
                                    }}
                                  />
                                  {d.name}
                                </span>
                                <span style={{ fontWeight: 700, color: C.text }}>
                                  {d.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>

                      <Card C={C}>
                        <div style={sectionTitle}>Haftalık Aktivite</div>
                        <div style={sectionDesc}>
                          Son 7 günde tamamlanan görevler
                        </div>

                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart
                            data={weeklyActivity}
                            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient
                                id="g1"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor={C.primary}
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="100%"
                                  stopColor={C.primary}
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>

                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={isDark ? "#1F2937" : "#F1F5F9"}
                              vertical={false}
                            />
                            <XAxis
                              dataKey="day"
                              stroke={C.muted}
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              stroke={C.muted}
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip
                              contentStyle={{
                                background: C.card,
                                border: `1px solid ${C.border}`,
                                borderRadius: 10,
                                color: C.text,
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="tasks"
                              stroke={C.primary}
                              fill="url(#g1)"
                              strokeWidth={2}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </Card>
                    </div>
                  )}

                  {tab === "charts" && (
                    <Card C={C}>
                      <div style={sectionTitle}>Üye İş Yükü</div>
                      <div style={sectionDesc}>
                        Takım üyelerinin tamamlanan ve bekleyen görev sayıları
                      </div>

                      {memberWorkload.length === 0 ? (
                        <EmptyChart C={C} text="Üye iş yükü verisi yok" />
                      ) : (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart
                            data={memberWorkload}
                            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={isDark ? "#1F2937" : "#F1F5F9"}
                              vertical={false}
                            />
                            <XAxis
                              dataKey="name"
                              stroke={C.muted}
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              stroke={C.muted}
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip
                              contentStyle={{
                                background: C.card,
                                border: `1px solid ${C.border}`,
                                borderRadius: 10,
                                color: C.text,
                              }}
                            />
                            <Bar
                              dataKey="done"
                              stackId="a"
                              fill={C.success}
                              name="Tamamlanan"
                            />
                            <Bar
                              dataKey="todo"
                              stackId="a"
                              fill={C.warning}
                              name="Bekleyen"
                              radius={[4, 4, 0, 0]}
                            />
                            <Bar
                              dataKey="overdue"
                              stackId="a"
                              fill={C.danger}
                              name="Geciken"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </Card>
                  )}

                  {tab === "activity" && (
                    <Card C={C}>
                      <div style={sectionTitle}>Son Aktiviteler</div>
                      <div style={sectionDesc}>
                        Bu projede yapılan son işlemler
                      </div>

                      {recentActivity.length === 0 ? (
                        <div
                          style={{
                            padding: 24,
                            color: C.muted,
                            textAlign: "center",
                            fontSize: 13,
                          }}
                        >
                          Henüz aktivite yok
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          {recentActivity.slice(0, 8).map((a, i, arr) => (
                            <div
                              key={a.id || i}
                              style={{
                                display: "flex",
                                gap: 12,
                                padding: "12px 0",
                                borderBottom:
                                  i < arr.length - 1
                                    ? `1px solid ${C.border}`
                                    : "none",
                              }}
                            >
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 999,
                                  background: C.primarySoft,
                                  color: C.primary,
                                  display: "grid",
                                  placeItems: "center",
                                  fontSize: 14,
                                  flexShrink: 0,
                                }}
                              >
                                {a.icon || "•"}
                              </div>

                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, color: C.text }}>
                                  <b>{a.user || a.user_name || "Kullanıcı"}</b>{" "}
                                  {a.action || a.message || "bir işlem yaptı"}
                                </div>

                                <div
                                  style={{
                                    fontSize: 11,
                                    color: C.muted,
                                    marginTop: 2,
                                  }}
                                >
                                  {a.time ||
                                    formatDateTime(a.created_at) ||
                                    "az önce"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectSection({ C, title, desc, icon, iconBg, children }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: iconBg,
            display: "grid",
            placeItems: "center",
            fontSize: 18,
          }}
        >
          {icon}
        </div>

        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: C.text,
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: 12,
              color: C.sub,
              marginTop: 2,
            }}
          >
            {desc}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 18,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ProjectCard({ C, STATUS, project, summary, active, mostActive, onClick }) {
  const status = getProjectStatus(project);
  const taskTotal = Number(
    project.project_task_total ||
      project.project_task_count ||
      project.task_count ||
      project.total_tasks ||
      project.total_task_count ||
      0
  );

  const done = Number(
    project.done_task_count ||
      project.project_task_done ||
      project.project_done_count ||
      project.completed_tasks ||
      project.completed_task_count ||
      0
  );

  const progress =
    taskTotal > 0
      ? Math.round((done / taskTotal) * 100)
      : Number(project.progress || 0);

  const projectColor = project.color || C.primary;

  const memberCount = Number(
    project.member_count ||
      project.memberCount ||
      project.members_count ||
      project.total_members ||
      summary?.member_count ||
      summary?.members_count ||
      summary?.total_members ||
      0
  );

  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        border: `1px solid ${active ? projectColor : C.border}`,
        background: active
          ? `linear-gradient(180deg, ${C.card} 0%, ${C.card2} 100%)`
          : C.card,
        borderRadius: 16,
        borderTop: `5px solid ${projectColor}`,
        padding: 18,
        cursor: "pointer",
        boxShadow: active ? C.activeShadow : C.shadow,
        transition: "0.2s ease",
        minHeight: 210,
        color: C.text,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            background: projectColor,
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 20,
          }}
        >
          📁
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <StatusBadge C={C} STATUS={STATUS} status={status} />

          {mostActive && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 999,
                padding: "5px 9px",
                background: "#FEF3C7",
                border: "1px solid #FDE68A",
                fontSize: 11,
                color: "#D97706",
                fontWeight: 800,
              }}
            >
              🔥 En Aktif
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          fontSize: 17,
          fontWeight: 800,
          color: C.text,
          marginBottom: 8,
          lineHeight: 1.25,
        }}
      >
        {project.name}
      </div>

      <div
        style={{
          fontSize: 12,
          color: C.sub,
          lineHeight: 1.55,
          minHeight: 38,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {project.description || "Bu proje için henüz açıklama eklenmemiş."}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          marginTop: 16,
          marginBottom: 14,
        }}
      >
        <MiniInfo C={C} label="Üye" value={memberCount} />
        <MiniInfo C={C} label="Görev" value={taskTotal} />
        <MiniInfo C={C} label="İlerleme" value={`%${progress}`} />
        <MiniInfo
          C={C}
          label="Son Aktivite"
          value={formatShortActivity(project.last_activity_at)}
        />
      </div>

      <ProgressBar C={C} value={progress} color={projectColor} />

      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
          color: C.muted,
        }}
      >
        <span>{formatDate(project.created_at || project.createdAt)}</span>
        <span style={{ color: projectColor, fontWeight: 700 }}>
          {active ? "Seçili" : "Detayı gör"}
        </span>
      </div>
    </button>
  );
}

function MiniInfo({ C, label, value }) {
  return (
    <div
      style={{
        background: C.card2,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "8px 6px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{value}</div>
    </div>
  );
}

function StatusBadge({ C, STATUS, status }) {
  const s = STATUS[status] || STATUS.active;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        padding: "5px 9px",
        background: C.card2,
        border: `1px solid ${C.border}`,
        fontSize: 11,
        color: C.sub,
        fontWeight: 700,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: s.color,
        }}
      />
      {s.label}
    </span>
  );
}

function StatusDot({ C, STATUS, status }) {
  const s = STATUS[status] || STATUS.active;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: C.sub,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: s.color,
        }}
      />
      {s.label}
    </span>
  );
}

function ProgressBar({ C, value, color = C.primary }) {
  const v = Math.max(0, Math.min(100, value || 0));

  return (
    <div
      style={{
        width: "100%",
        height: 6,
        background: C.border,
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${v}%`,
          height: "100%",
          background: color,
          borderRadius: 999,
          transition: "width .4s",
        }}
      />
    </div>
  );
}

function Card({ C, children, style }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: 20,
        boxShadow: C.shadow,
        color: C.text,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StatBox({ C, label, value, color }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "16px 18px",
        borderRight: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          color: C.sub,
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </div>

      <div style={{ fontSize: 24, fontWeight: 800, color: color || C.text }}>
        {value}
      </div>
    </div>
  );
}

function EmptyChart({ C, text }) {
  return (
    <div
      style={{
        height: 220,
        display: "grid",
        placeItems: "center",
        color: C.muted,
        fontSize: 13,
      }}
    >
      {text}
    </div>
  );
}

function getProjectStatus(project) {
  if (project?.is_archived) return "archived";
  if (project?.status) return project.status;
  if (project?.active_sprint_name) return "active";
  return "active";
}

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleDateString("tr-TR");
  } catch {
    return "—";
  }
}

function formatDateTime(value) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString("tr-TR");
  } catch {
    return "";
  }
}

function formatShortActivity(value) {
  if (!value) return "Yok";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Yok";

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getMemberCount(project, summary) {
  return Number(
    project?.member_count ||
      project?.memberCount ||
      project?.members_count ||
      project?.total_members ||
      summary?.member_count ||
      summary?.members_count ||
      summary?.total_members ||
      0
  );
}