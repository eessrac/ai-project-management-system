import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch, getToken } from "../api";
import { useTheme } from "../context/ThemeContext.jsx";

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
    info: "#0EA5E9",
    infoSoft: isDark ? "rgba(14,165,233,0.15)" : "#E0F2FE",
    shadow: isDark
      ? "0 14px 35px rgba(0,0,0,0.28)"
      : "0 2px 8px rgba(15,23,42,0.03)",
  };
}

function fmtDate(iso) {
  if (!iso) return "-";
  const clean = String(iso).split("T")[0];
  const [y, m, d] = clean.split("-");
  if (!y || !m || !d) return "-";
  return `${d}.${m}.${y}`;
}

function daysBetween(a, b) {
  if (!a || !b) return 0;
  const da = new Date(String(a).split("T")[0]);
  const db = new Date(String(b).split("T")[0]);
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

function sprintProgress(sp) {
  if (!sp?.start_date || !sp?.end_date) return 0;

  const total = daysBetween(sp.start_date, sp.end_date) + 1;
  const passed = daysBetween(sp.start_date, new Date().toISOString()) + 1;

  if (sp.status === "DONE") return 100;

  return Math.max(0, Math.min(100, Math.round((passed / total) * 100)));
}

function getStatusMeta(C) {
  return {
    ACTIVE: {
      label: "Aktif",
      color: C.success,
      bg: C.successSoft,
    },
    DONE: {
      label: "Tamamlandı",
      color: C.textSoft,
      bg: C.card2,
    },
    TODO: {
      label: "Yapılacak",
      color: C.warn,
      bg: C.warnSoft,
    },
    IN_PROGRESS: {
      label: "Devam Ediyor",
      color: C.info,
      bg: C.infoSoft,
    },
    COMPLETED: {
      label: "Tamamlandı",
      color: C.success,
      bg: C.successSoft,
    },
  };
}

function Card({ C, children, padding = 20, style }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding,
        color: C.text,
        boxShadow: C.shadow,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function StatusPill({ C, status }) {
  const STATUS_META = getStatusMeta(C);
  const m = STATUS_META[status] || STATUS_META.DONE;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 800,
        padding: "3px 9px",
        borderRadius: 999,
        color: m.color,
        background: m.bg,
        border: `1px solid ${m.color}33`,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: m.color,
        }}
      />
      {m.label}
    </span>
  );
}

function Btn({ C, variant = "secondary", children, style, ...rest }) {
  const variants = {
    primary: {
      bg: C.primary,
      fg: "#fff",
      border: C.primary,
    },
    secondary: {
      bg: C.card2,
      fg: C.text,
      border: C.border,
    },
    ghost: {
      bg: "transparent",
      fg: C.textSoft,
      border: "transparent",
    },
    success: {
      bg: C.success,
      fg: "#fff",
      border: C.success,
    },
    danger: {
      bg: C.card2,
      fg: C.danger,
      border: C.dangerSoft,
    },
    soft: {
      bg: C.primarySoft,
      fg: C.primary,
      border: "transparent",
    },
  };

  const v = variants[variant] || variants.secondary;

  return (
    <button
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "8px 14px",
        fontSize: 13,
        fontWeight: 800,
        borderRadius: 10,
        background: v.bg,
        color: v.fg,
        border: `1px solid ${v.border}`,
        cursor: rest.disabled ? "not-allowed" : "pointer",
        opacity: rest.disabled ? 0.55 : 1,
        transition: "all .15s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ProgressBar({ C, value, color }) {
  const v = Math.max(0, Math.min(100, value || 0));

  return (
    <div
      style={{
        width: "100%",
        height: 8,
        background: C.borderSoft,
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${v}%`,
          height: "100%",
          background: color || C.primary,
          borderRadius: 999,
          transition: "width .3s ease",
        }}
      />
    </div>
  );
}

function StatTile({ C, label, value, sub, color, bg }) {
  return (
    <Card C={C} padding={16} style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          fontSize: 11,
          color: C.textMuted,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: color || C.primary,
        }}
      >
        {value}
      </div>

      {sub && (
        <div
          style={{
            fontSize: 12,
            color: C.textSoft,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sub}
        </div>
      )}

      <div
        style={{
          height: 4,
          background: bg || C.primarySoft,
          borderRadius: 999,
          marginTop: 4,
        }}
      />
    </Card>
  );
}

function MiniBars({ C, data }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 14,
        height: 120,
        padding: "8px 4px",
      }}
    >
      {data.map((d) => (
        <div
          key={d.label}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: "100%",
              height: `${(d.value / max) * 100}%`,
              background: d.color,
              borderRadius: 8,
              minHeight: 4,
              transition: "height .3s ease",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -22,
                left: 0,
                right: 0,
                textAlign: "center",
                fontSize: 12,
                fontWeight: 800,
                color: C.text,
              }}
            >
              {d.value}
            </div>
          </div>

          <div
            style={{
              fontSize: 11,
              color: C.textSoft,
              fontWeight: 700,
            }}
          >
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function Donut({ C, value = 0, size = 140, stroke = 14, color, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        position: "relative",
        width: size,
        height: size,
      }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={C.borderSoft}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color || C.primary}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .4s ease" }}
        />
      </svg>

      <div style={{ position: "absolute", textAlign: "center" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>
          {value}%
        </div>

        {label && (
          <div
            style={{
              fontSize: 11,
              color: C.textMuted,
              fontWeight: 700,
            }}
          >
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SprintsPage_v2() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = getToken();

  const { isDark } = useTheme();
  const C = useMemo(() => getColors(isDark), [isDark]);

  const [project, setProject] = useState(null);
  const [myRole, setMyRole] = useState(null);

  const [sprints, setSprints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSprint, setActiveSprint] = useState(null);
  const [loadingActive, setLoadingActive] = useState(false);

  const [backlogCount, setBacklogCount] = useState(0);
  const [loadingBacklog, setLoadingBacklog] = useState(false);
  const [backlogTasks, setBacklogTasks] = useState([]);
  const [showBacklog, setShowBacklog] = useState(false);
  const [selectedBacklogIds, setSelectedBacklogIds] = useState([]);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");

  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState(null);

  const sprintDurationDays = Number(project?.sprint_duration_days) || 14;
  const isArchived = Boolean(project?.is_archived || project?.archived_at);

  async function loadProject() {
    try {
      const data = await apiFetch(`/projects/${id}`, { token });
      setProject(data.project);
      setMyRole(data.my_role);
    } catch (e) {
      setError(e.message);
    }
  }

  async function loadSprints() {
    try {
      setLoading(true);
      const data = await apiFetch(`/projects/${id}/sprints`, { token });
      setSprints(data.sprints || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadActive() {
    try {
      setLoadingActive(true);
      const data = await apiFetch(`/projects/${id}/sprints/active`, { token });
      setActiveSprint(data.sprint || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingActive(false);
    }
  }

  async function loadBacklogCount() {
    try {
      setLoadingBacklog(true);
      const data = await apiFetch(`/projects/${id}/backlog/count`, { token });
      setBacklogCount(data.count ?? 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBacklog(false);
    }
  }

  async function loadBacklogTasks() {
    try {
      const data = await apiFetch(`/projects/${id}/backlog/tasks`, { token });
      setBacklogTasks(data.tasks || []);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadProject();
    loadSprints();
    loadActive();
    loadBacklogCount();
    loadBacklogTasks();
    // eslint-disable-next-line
  }, [id]);

  const visibleSprints = useMemo(
    () => sprints.filter((s) => s.status !== "PLANNED"),
    [sprints]
  );

  const sorted = useMemo(
    () =>
      [...visibleSprints].sort((a, b) => {
        const ta = new Date(String(a.start_date).split("T")[0]).getTime();
        const tb = new Date(String(b.start_date).split("T")[0]).getTime();
        return tb - ta;
      }),
    [visibleSprints]
  );

  const filtered = useMemo(() => {
    let list = sorted;

    if (filter !== "ALL") {
      list = list.filter((s) => s.status === filter);
    }

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((s) => (s.name || "").toLowerCase().includes(q));
    }

    return list;
  }, [sorted, filter, query]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }

    if (!filtered.find((s) => s.id === selectedId)) {
      const active = filtered.find((s) => s.status === "ACTIVE");
      setSelectedId(active ? active.id : filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(
    () => filtered.find((s) => s.id === selectedId) || activeSprint || filtered[0] || null,
    [filtered, selectedId, activeSprint]
  );

  const counts = useMemo(() => {
    const c = { ACTIVE: 0, DONE: 0 };

    sprints.forEach((s) => {
      c[s.status] = (c[s.status] || 0) + 1;
    });

    return c;
  }, [sprints]);

  async function createSprint(e) {
    e.preventDefault();

    if (isArchived) {
      setError("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }

    setError("");

    if (!startDate) {
      setError("Başlangıç tarihi seç.");
      return;
    }

    try {
      setBusy(true);

      await apiFetch(`/projects/${id}/sprints`, {
        token,
        method: "POST",
        body: {
          start_date: startDate,
          name: name?.trim() || undefined,
        },
      });

      setName("");
      setStartDate("");
      setShowCreate(false);

      await loadSprints();
      await loadActive();
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function activateSprint(sid) {
    if (isArchived) {
      setError("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }

    try {
      setBusy(true);

      await apiFetch(`/projects/${id}/sprints/${sid}/activate`, {
        token,
        method: "POST",
      });

      await loadSprints();
      await loadActive();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function closeSprint(sid) {
    if (isArchived) {
      setError("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }

    try {
      setBusy(true);

      await apiFetch(`/projects/${id}/sprints/${sid}/close`, {
        token,
        method: "POST",
      });

      await loadSprints();
      await loadActive();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSprint(sid) {
    if (isArchived) {
      setError("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }

    if (!confirm("Bu aktif sprint silinsin mi?")) return;

    try {
      setBusy(true);

      await apiFetch(`/projects/${id}/sprints/${sid}`, {
        token,
        method: "DELETE",
      });

      await loadSprints();
      await loadActive();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function claimBacklog() {
    if (isArchived) {
      setError("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }

    if (!activeSprint) return;

    if (!confirm("Backlog'daki tasklar bu sprint'e taşınsın mı?")) return;

    try {
      setBusy(true);

      const res = await apiFetch(`/projects/${id}/sprints/${activeSprint.id}/claim-tasks`, {
        token,
        method: "POST",
        body: {
          task_ids: selectedBacklogIds.length > 0 ? selectedBacklogIds : undefined,
        },
      });

      alert(`Taşınan task sayısı: ${res.moved_count}`);

      setSelectedBacklogIds([]);

      await loadBacklogCount();
      await loadBacklogTasks();

      navigate(`/projects/${id}/tasks`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const progress = selected ? sprintProgress(selected) : 0;

  const inputStyle = {
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    fontSize: 14,
    outline: "none",
    background: C.card2,
    color: C.text,
    boxSizing: "border-box",
  };

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
      <div
        style={{
          background: C.card,
          borderBottom: `1px solid ${C.border}`,
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
          <Btn C={C} variant="ghost" onClick={() => navigate(`/projects/${id}`)}>
            ← Proje
          </Btn>

          <div style={{ width: 1, height: 22, background: C.border }} />

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                color: C.textMuted,
                fontWeight: 800,
                letterSpacing: 0.6,
                textTransform: "uppercase",
              }}
            >
              Sprintler
            </div>

            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 360,
                color: C.text,
              }}
            >
              {project?.name || "—"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Btn C={C} variant="secondary" onClick={() => navigate(`/projects/${id}/tasks`)}>
            Tasklar →
          </Btn>

          <Btn
            C={C}
            variant="primary"
            disabled={isArchived}
            onClick={() => setShowCreate((p) => !p)}
          >
            {showCreate ? "× Kapat" : "+ Yeni Sprint"}
          </Btn>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: 24 }}>
        {error && (
          <Card
            C={C}
            padding={12}
            style={{
              marginBottom: 16,
              background: C.dangerSoft,
              borderColor: isDark ? "rgba(239,68,68,0.35)" : "#FECACA",
              color: C.danger,
              fontWeight: 700,
            }}
          >
            {error}
          </Card>
        )}

        {isArchived && (
          <Card
            C={C}
            padding={12}
            style={{
              marginBottom: 16,
              background: C.warnSoft,
              borderColor: isDark ? "rgba(245,158,11,0.35)" : "#FDE68A",
              color: C.warn,
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            📦 Bu proje arşivlenmiş. Sprintler yalnızca görüntülenebilir; oluşturma,
            aktif yapma, bitirme, silme ve backlog taşıma kapalıdır.
          </Card>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <StatTile
            C={C}
            label="Toplam Sprint"
            value={sprints.length}
            color={C.primary}
            bg={C.primarySoft}
          />

          <StatTile
            C={C}
            label="Aktif"
            value={loadingActive ? "…" : counts.ACTIVE || 0}
            color={C.success}
            bg={C.successSoft}
            sub={activeSprint ? activeSprint.name : "Yok"}
          />

          <div onClick={() => setShowBacklog((p) => !p)} style={{ cursor: "pointer" }}>
            <StatTile
              C={C}
              label="Backlog"
              value={loadingBacklog ? "…" : backlogCount}
              color={C.warn}
              bg={C.warnSoft}
              sub={showBacklog ? "Listeyi gizle" : "Sprint'siz taskları göster"}
            />
          </div>
        </div>

        {showCreate && (
          <Card C={C} style={{ marginBottom: 16 }}>
            <form
              onSubmit={createSprint}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 200px auto",
                gap: 12,
                alignItems: "end",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <label
                  style={{
                    fontSize: 12,
                    color: C.textSoft,
                    fontWeight: 700,
                  }}
                >
                  Sprint Adı (opsiyonel)
                </label>

                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Örn: Sprint 1"
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label
                  style={{
                    fontSize: 12,
                    color: C.textSoft,
                    fontWeight: 700,
                  }}
                >
                  Başlangıç
                </label>

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <Btn C={C} variant="primary" disabled={busy} type="submit">
                {busy ? "Oluşturuluyor…" : `Oluştur (${sprintDurationDays} gün)`}
              </Btn>
            </form>

            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 10 }}>
              Bitiş tarihi otomatik olarak başlangıç + {sprintDurationDays - 1} gün olur.
            </div>
          </Card>
        )}

        {showBacklog && (
          <Card C={C} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 14,
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
                  Backlog Taskları
                </div>

                <div style={{ fontSize: 12, color: C.textSoft, marginTop: 4 }}>
                  Sprint'e eklenmemiş görevler
                </div>
              </div>

              {myRole === "LEADER" && activeSprint && backlogTasks.length > 0 && (
                <Btn C={C} variant="primary" onClick={claimBacklog} disabled={busy || isArchived}>
                  {selectedBacklogIds.length > 0
                    ? `${selectedBacklogIds.length} Taskı Sprint'e Ekle`
                    : "Tümünü Sprint'e Ekle"}
                </Btn>
              )}
            </div>

            {backlogTasks.length === 0 ? (
              <div
                style={{
                  padding: 20,
                  textAlign: "center",
                  color: C.textMuted,
                }}
              >
                Backlog boş.
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 10 }}>
                  {backlogTasks.map((task) => {
                    const checked = selectedBacklogIds.includes(task.id);

                    return (
                      <label
                        key={task.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: 12,
                          border: `1px solid ${checked ? C.primary : C.border}`,
                          borderRadius: 12,
                          background: checked ? C.primarySoft : C.soft,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBacklogIds((prev) => [...prev, task.id]);
                            } else {
                              setSelectedBacklogIds((prev) =>
                                prev.filter((x) => x !== task.id)
                              );
                            }
                          }}
                        />

                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>
                            {task.title}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              color: C.textSoft,
                              marginTop: 3,
                            }}
                          >
                            {task.description || "Açıklama yok"}
                          </div>
                        </div>

                        <StatusPill C={C} status={task.status} />
                      </label>
                    );
                  })}
                </div>

                {myRole === "LEADER" && activeSprint && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginTop: 14,
                      gap: 8,
                    }}
                  >
                    <Btn
                      C={C}
                      variant="secondary"
                      onClick={() => setSelectedBacklogIds([])}
                      disabled={selectedBacklogIds.length === 0 || busy}
                    >
                      Seçimi Temizle
                    </Btn>

                    <Btn
                      C={C}
                      variant="primary"
                      onClick={claimBacklog}
                      disabled={busy || isArchived}
                    >
                      {selectedBacklogIds.length > 0
                        ? `${selectedBacklogIds.length} Taskı Aktif Sprint'e Ekle`
                        : "Tüm Backlog'u Aktif Sprint'e Ekle"}
                    </Btn>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "360px 1fr",
            gap: 16,
            alignItems: "start",
          }}
        >
          <Card C={C} padding={0} style={{ overflow: "hidden" }}>
            <div
              style={{
                padding: 14,
                borderBottom: `1px solid ${C.borderSoft}`,
                display: "grid",
                gap: 10,
              }}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Sprint ara…"
                style={{
                  ...inputStyle,
                  fontSize: 13,
                }}
              />

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  ["ALL", "Tümü", sprints.length],
                  ["ACTIVE", "Aktif", counts.ACTIVE || 0],
                  ["DONE", "Bitti", counts.DONE || 0],
                ].map(([k, lbl, n]) => (
                  <button
                    key={k}
                    onClick={() => setFilter(k)}
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "5px 10px",
                      borderRadius: 999,
                      cursor: "pointer",
                      background: filter === k ? C.primary : C.card2,
                      color: filter === k ? "#fff" : C.textSoft,
                      border: `1px solid ${filter === k ? C.primary : C.border}`,
                    }}
                  >
                    {lbl}
                    <span style={{ opacity: 0.75, marginLeft: 4 }}>{n}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ maxHeight: "calc(100vh - 320px)", overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: 20, color: C.textMuted, fontSize: 13 }}>
                  Yükleniyor…
                </div>
              ) : filtered.length === 0 ? (
                <div
                  style={{
                    padding: 24,
                    textAlign: "center",
                    color: C.textMuted,
                    fontSize: 13,
                  }}
                >
                  Sprint bulunamadı.
                </div>
              ) : (
                filtered.map((sp) => {
                  const isSel = selected?.id === sp.id;
                  const prog = sprintProgress(sp);

                  return (
                    <div
                      key={sp.id}
                      onClick={() => setSelectedId(sp.id)}
                      style={{
                        padding: 14,
                        borderBottom: `1px solid ${C.borderSoft}`,
                        cursor: "pointer",
                        background: isSel ? C.primarySoft : "transparent",
                        borderLeft: `3px solid ${isSel ? C.primary : "transparent"}`,
                        transition: "background .12s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 14,
                            color: C.text,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {sp.name}
                        </div>

                        <StatusPill C={C} status={sp.status} />
                      </div>

                      <div style={{ fontSize: 12, color: C.textSoft, marginBottom: 8 }}>
                        {fmtDate(sp.start_date)} → {fmtDate(sp.end_date)}
                      </div>

                      <ProgressBar
                        C={C}
                        value={prog}
                        color={
                          sp.status === "DONE"
                            ? C.textSoft
                            : sp.status === "ACTIVE"
                            ? C.success
                            : C.info
                        }
                      />

                      {sp.status === "DONE" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/projects/${id}/sprints/${sp.id}/archive`);
                          }}
                          style={{
                            marginTop: 10,
                            width: "100%",
                            fontSize: 12,
                            fontWeight: 800,
                            padding: "7px 10px",
                            borderRadius: 8,
                            background: C.primarySoft,
                            color: C.primary,
                            border: `1px solid ${C.primary}33`,
                            cursor: "pointer",
                          }}
                        >
                          Arşivi Gör →
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <div style={{ display: "grid", gap: 16 }}>
            {!selected ? (
              <Card C={C} padding={48} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>
                  Sprint seçili değil
                </div>

                <div style={{ color: C.textMuted, fontSize: 13 }}>
                  Sol taraftan bir sprint seç ya da yeni bir sprint oluştur.
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
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 6,
                        }}
                      >
                        <h2
                          style={{
                            margin: 0,
                            fontSize: 22,
                            fontWeight: 800,
                            color: C.text,
                          }}
                        >
                          {selected.name}
                        </h2>

                        <StatusPill C={C} status={selected.status} />
                      </div>

                      <div style={{ color: C.textSoft, fontSize: 13 }}>
                        {fmtDate(selected.start_date)} → {fmtDate(selected.end_date)}
                        <span style={{ margin: "0 8px", color: C.textMuted }}>•</span>
                        {daysBetween(selected.start_date, selected.end_date) + 1} gün
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {selected.status === "ACTIVE" && (
                        <>
                          <Btn C={C} variant="primary" onClick={() => navigate(`/projects/${id}/tasks`)}>
                            Tasklara Git →
                          </Btn>

                          <Btn
                            C={C}
                            variant="secondary"
                            disabled={busy || isArchived}
                            onClick={() => closeSprint(selected.id)}
                          >
                            Sprint'i Bitir
                          </Btn>

                          {myRole === "LEADER" && backlogCount > 0 && (
                            <Btn
                              C={C}
                              variant="soft"
                              disabled={busy || isArchived}
                              onClick={claimBacklog}
                            >
                              Backlog'u Taşı ({backlogCount})
                            </Btn>
                          )}
                        </>
                      )}

                      {selected.status === "DONE" && (
                        <Btn
                          C={C}
                          variant="soft"
                          onClick={() =>
                            navigate(`/projects/${id}/sprints/${selected.id}/archive`)
                          }
                        >
                          Arşivi Gör →
                        </Btn>
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: C.textSoft,
                          fontWeight: 700,
                        }}
                      >
                        Süre İlerlemesi
                      </span>

                      <span
                        style={{
                          fontSize: 12,
                          color: C.text,
                          fontWeight: 800,
                        }}
                      >
                        {progress}%
                      </span>
                    </div>

                    <ProgressBar
                      C={C}
                      value={progress}
                      color={
                        selected.status === "DONE"
                          ? C.textSoft
                          : selected.status === "ACTIVE"
                          ? C.success
                          : C.info
                      }
                    />
                  </div>
                </Card>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <Card C={C}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        marginBottom: 16,
                        color: C.text,
                      }}
                    >
                      Süre Tamamlanma
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        padding: "8px 0",
                      }}
                    >
                      <Donut
                        C={C}
                        value={progress}
                        label={selected.status === "DONE" ? "Tamamlandı" : "Geçen Süre"}
                        color={
                          selected.status === "DONE"
                            ? C.success
                            : selected.status === "ACTIVE"
                            ? C.primary
                            : C.info
                        }
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-around",
                        marginTop: 12,
                        fontSize: 12,
                        color: C.textSoft,
                      }}
                    >
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>
                          {Math.max(0, daysBetween(selected.start_date, new Date().toISOString()))}
                        </div>
                        <div>Geçen gün</div>
                      </div>

                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>
                          {Math.max(0, daysBetween(new Date().toISOString(), selected.end_date))}
                        </div>
                        <div>Kalan gün</div>
                      </div>

                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>
                          {daysBetween(selected.start_date, selected.end_date) + 1}
                        </div>
                        <div>Toplam</div>
                      </div>
                    </div>
                  </Card>

                  <Card C={C}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        marginBottom: 8,
                        color: C.text,
                      }}
                    >
                      Sprint Dağılımı
                    </div>

                    <MiniBars
                      C={C}
                      data={[
                        { label: "Aktif", value: counts.ACTIVE || 0, color: C.success },
                        { label: "Bitti", value: counts.DONE || 0, color: C.textMuted },
                      ]}
                    />

                    <div
                      style={{
                        marginTop: 14,
                        padding: 12,
                        background: C.card2,
                        borderRadius: 10,
                        fontSize: 12,
                        color: C.textSoft,
                      }}
                    >
                      Toplam <b style={{ color: C.text }}>{sprints.length}</b> sprint var.
                      {activeSprint ? (
                        <>
                          {" "}
                          Şu an{" "}
                          <b style={{ color: C.success }}>{activeSprint.name}</b> aktif.
                        </>
                      ) : (
                        <> Aktif sprint yok.</>
                      )}
                    </div>
                  </Card>
                </div>

                <Card C={C}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      marginBottom: 14,
                      color: C.text,
                    }}
                  >
                    Sprint Zaman Çizelgesi
                  </div>

                  {sorted.length === 0 ? (
                    <div style={{ color: C.textMuted, fontSize: 13 }}>
                      Henüz sprint yok.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {sorted.slice(0, 8).map((sp) => {
                        const meta = getStatusMeta(C)[sp.status] || getStatusMeta(C).DONE;

                        return (
                          <div
                            key={sp.id}
                            onClick={() => setSelectedId(sp.id)}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "16px 1fr auto",
                              gap: 12,
                              alignItems: "center",
                              padding: "8px 10px",
                              borderRadius: 10,
                              cursor: "pointer",
                              background:
                                selected?.id === sp.id ? C.primarySoft : "transparent",
                            }}
                          >
                            <div
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: meta.color,
                                margin: "0 auto",
                              }}
                            />

                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: C.text,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {sp.name}
                              </div>

                              <div style={{ fontSize: 11, color: C.textMuted }}>
                                {fmtDate(sp.start_date)} → {fmtDate(sp.end_date)}
                              </div>
                            </div>

                            <StatusPill C={C} status={sp.status} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}