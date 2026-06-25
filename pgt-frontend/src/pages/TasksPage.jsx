import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  apiFetch,
  getToken,
  getProjectAttachments,
  uploadProjectAttachment,
  deleteAttachment,
  attachmentViewUrl,
  attachmentDownloadUrl,
  getTaskCodeSubmissions,
  getProjectCodeSubmissions,
  uploadTaskCodeSubmission,
  deleteTaskCodeSubmission,
  taskCodeDownloadUrl,
  summarizeTaskCodeSubmission,
  generateCommitSummary,
} from "../api";
import { getSocket } from "../socketClient";
import "./TasksPage.css";
import TaskComments from "../pages/TaskComments";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Swal from "sweetalert2";

/**
 * TasksPage — v2
 * Tüm fonksiyonlar/akış birebir korunmuştur. Sadece görsel olarak yeniden tasarlandı.
 * v2 tasarım dilini (SprintsPage_v2 / SprintArchivePage_v2) takip eder.
 */

/* ===========================================================
 * DESIGN TOKENS
 * =========================================================== */
const C = {
  bg: "var(--tasks-bg)",
  card: "var(--tasks-card)",
  cardSoft: "var(--tasks-card-soft)",
  border: "var(--tasks-border)",
  borderSoft: "var(--tasks-border-soft)",
  text: "var(--tasks-text)",
  textSoft: "var(--tasks-text-soft)",
  textMuted: "var(--tasks-text-muted)",
  primary: "var(--tasks-primary)",
  primarySoft: "var(--tasks-primary-soft)",
  primaryHover: "var(--tasks-primary-hover)",
  success: "var(--tasks-success)",
  successSoft: "var(--tasks-success-soft)",
  warn: "var(--tasks-warn)",
  warnSoft: "var(--tasks-warn-soft)",
  danger: "var(--tasks-danger)",
  dangerSoft: "var(--tasks-danger-soft)",
  info: "var(--tasks-info)",
  infoSoft: "var(--tasks-info-soft)",
  purple: "var(--tasks-purple)",
  purpleSoft: "var(--tasks-purple-soft)",
  header: "var(--tasks-header)",
  shadow: "var(--tasks-shadow)",
};


const TASKS_THEME_STYLE = `
  .tasks-theme-page {
    --tasks-bg: #F8FAFC;
    --tasks-card: #FFFFFF;
    --tasks-card-soft: #FAFBFD;
    --tasks-border: #E2E8F0;
    --tasks-border-soft: #EEF2F7;
    --tasks-text: #0F172A;
    --tasks-text-soft: #475569;
    --tasks-text-muted: #94A3B8;
    --tasks-primary: #4F46E5;
    --tasks-primary-soft: #EEF2FF;
    --tasks-primary-hover: #4338CA;
    --tasks-success: #10B981;
    --tasks-success-soft: #ECFDF5;
    --tasks-warn: #F59E0B;
    --tasks-warn-soft: #FFFBEB;
    --tasks-danger: #EF4444;
    --tasks-danger-soft: #FEF2F2;
    --tasks-info: #0EA5E9;
    --tasks-info-soft: #E0F2FE;
    --tasks-purple: #7C3AED;
    --tasks-purple-soft: #F5F3FF;
    --tasks-header: rgba(255,255,255,0.85);
    --tasks-shadow: 0 10px 28px rgba(15,23,42,0.05);
  }

  .dark .tasks-theme-page {
    --tasks-bg: #0B1020;
    --tasks-card: #111827;
    --tasks-card-soft: #0F172A;
    --tasks-border: #263244;
    --tasks-border-soft: #1F2937;
    --tasks-text: #F8FAFC;
    --tasks-text-soft: #CBD5E1;
    --tasks-text-muted: #94A3B8;
    --tasks-primary: #8B5CF6;
    --tasks-primary-soft: rgba(139,92,246,0.16);
    --tasks-primary-hover: #7C3AED;
    --tasks-success: #10B981;
    --tasks-success-soft: rgba(16,185,129,0.14);
    --tasks-warn: #F59E0B;
    --tasks-warn-soft: rgba(245,158,11,0.14);
    --tasks-danger: #EF4444;
    --tasks-danger-soft: rgba(239,68,68,0.14);
    --tasks-info: #38BDF8;
    --tasks-info-soft: rgba(14,165,233,0.14);
    --tasks-purple: #A78BFA;
    --tasks-purple-soft: rgba(124,58,237,0.16);
    --tasks-header: rgba(11,16,32,0.88);
    --tasks-shadow: 0 18px 40px rgba(0,0,0,0.28);
  }

  .tasks-theme-page input::placeholder,
  .tasks-theme-page textarea::placeholder {
    color: var(--tasks-text-muted);
  }

  .tasks-theme-page select,
  .tasks-theme-page input,
  .tasks-theme-page textarea {
    color-scheme: light;
  }

  .dark .tasks-theme-page select,
  .dark .tasks-theme-page input,
  .dark .tasks-theme-page textarea {
    color-scheme: dark;
  }

  /* ✨ v3 polish — daha modern, daha yumuşak, daha hoş */
  .tasks-theme-page {
    --tasks-bg: #F6F7FB;
    --tasks-card: #FFFFFF;
    --tasks-card-soft: #F9FAFC;
    --tasks-border: #E6E8EF;
    --tasks-border-soft: #F0F2F7;
    --tasks-primary: #6366F1;
    --tasks-primary-soft: #EEF0FF;
    --tasks-primary-hover: #4F46E5;
    --tasks-shadow: 0 8px 24px rgba(17,24,39,0.06);
    background-image:
      radial-gradient(1200px 600px at 0% -10%, rgba(99,102,241,0.06), transparent 60%),
      radial-gradient(900px 500px at 100% 0%, rgba(168,85,247,0.05), transparent 60%);
  }
  .dark .tasks-theme-page {
    background-image:
      radial-gradient(1200px 600px at 0% -10%, rgba(139,92,246,0.10), transparent 60%),
      radial-gradient(900px 500px at 100% 0%, rgba(56,189,248,0.06), transparent 60%);
  }

  .tasks-theme-page button { transition: transform .12s ease, box-shadow .15s ease, background .15s ease, color .15s ease, border-color .15s ease; }
  .tasks-theme-page button:hover:not(:disabled) { transform: translateY(-1px); }
  .tasks-theme-page button:active:not(:disabled) { transform: translateY(0); }

  .tasks-theme-page input, .tasks-theme-page textarea, .tasks-theme-page select {
    transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
  }
  .tasks-theme-page input:focus, .tasks-theme-page textarea:focus, .tasks-theme-page select:focus {
    outline: none;
    border-color: var(--tasks-primary) !important;
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--tasks-primary) 18%, transparent);
  }

  @keyframes tasksFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .tasks-theme-page .tasks-fade-in { animation: tasksFadeIn .22s ease both; }

  /* Hoş bir scrollbar */
  .tasks-theme-page ::-webkit-scrollbar { width: 10px; height: 10px; }
  .tasks-theme-page ::-webkit-scrollbar-thumb {
    background: color-mix(in oklab, var(--tasks-text-muted) 35%, transparent);
    border-radius: 999px; border: 2px solid transparent; background-clip: padding-box;
  }
  .tasks-theme-page ::-webkit-scrollbar-thumb:hover {
    background: color-mix(in oklab, var(--tasks-primary) 50%, transparent);
    background-clip: padding-box; border: 2px solid transparent;
  }

  .tasks-header-inner {
    min-width: 0;
  }

  .tasks-header-left {
    min-width: 0;
    overflow: hidden;
  }

  .tasks-header-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tasks-header-actions {
    flex-shrink: 0;
  }

  @media (max-width: 760px) {
    .tasks-header-inner {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    .tasks-header-actions {
      justify-self: start;
    }
  }
`;


const STATUS = ["TODO", "IN_PROGRESS", "DONE"];

const STATUS_META = {
  TODO:        { label: "Yapılacak",     icon: "📋", color: C.textSoft, bg: C.borderSoft, dot: C.textMuted },
  IN_PROGRESS: { label: "Devam Ediyor",  icon: "🚧", color: C.warn,     bg: C.warnSoft,    dot: C.warn },
  DONE:        { label: "Tamamlandı",    icon: "✅", color: C.success,  bg: C.successSoft, dot: C.success },
};

const PRIORITY_META = {
  HIGH:   { label: "Yüksek", icon: "🔥", color: C.danger, bg: C.dangerSoft },
  MEDIUM: { label: "Orta",   icon: "⚡", color: C.warn,   bg: C.warnSoft },
  LOW:    { label: "Düşük",  icon: "🌿", color: C.info,   bg: C.infoSoft },
};

/* ===========================================================
 * HELPERS — orijinaliyle aynı (logic değişmedi)
 * =========================================================== */
function toDateInputValue(d) {
  if (!d) return "";
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function unwrapTask(data) {
  return data?.task ?? data;
}
function buildColumns(tasks) {
  return {
    TODO: tasks.filter((t) => t.status === "TODO").map((t) => String(t.id)),
    IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").map((t) => String(t.id)),
    DONE: tasks.filter((t) => t.status === "DONE").map((t) => String(t.id)),
  };
}
function findContainer(columns, taskId) {
  const id = String(taskId);
  for (const s of STATUS) if (columns[s].includes(id)) return s;
  return null;
}
function isColumnId(id) {
  return String(id).startsWith("col:");
}
function columnFromId(id) {
  return String(id).replace("col:", "");
}
function toDateOnly(d) {
  if (!d) return "";
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtDateTR(iso) {
  if (!iso) return "-";
  const s = toDateOnly(iso);
  if (!s) return "-";
  const [y, m, d] = s.split("-");
  return `${d}.${m}.${y}`;
}
function isOverdue(task) {
  if (!task?.due_date) return false;
  if (task.status === "DONE") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);
  const start = task.start_date ? new Date(task.start_date) : null;
  if (start) {
    start.setHours(0, 0, 0, 0);
    if (start > today) return false;
  }
  return due < today;
}
function daysUntilDue(task) {
  if (!task?.due_date) return null;
  const dueStr = toDateOnly(task.due_date);
  if (!dueStr) return null;
  const [y, m, d] = dueStr.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
function toggleId(list, id) {
  const sid = String(id);
  return list.map(String).includes(sid)
    ? list.filter((x) => String(x) !== sid)
    : [...list, sid];
}
function assigneeNames(task) {
  if (Array.isArray(task.assignees) && task.assignees.length > 0) {
    return task.assignees.map((u) => u.full_name || u.email).filter(Boolean).join(", ");
  }
  return task.assigned_to_name || "—";
}
function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}
function todayInputValue() {
  return toDateInputValue(new Date());
}

function addDaysInput(dateStr, days) {
  if (!dateStr) return todayInputValue();

  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + Number(days || 0));

  return toDateInputValue(d);
}


/* ===========================================================
 * UI PRIMITIVES
 * =========================================================== */
function Card({ children, padding = 20, style }) {
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

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.TODO;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: m.bg,
        color: m.color,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 12, lineHeight: 1 }}>{m.icon}</span>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: m.dot, display: "inline-block" }} />
      {m.label}
    </span>
  );
}

function PriorityPill({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META.MEDIUM;
  return (
    <span
      style={{
        background: m.bg,
        color: m.color,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ marginRight: 4 }}>{m.icon}</span>{m.label}
    </span>
  );
}

function DuePill({ task }) {
  if (!task.due_date) return null;
  const overdue = isOverdue(task);
  const left = daysUntilDue(task);
  const soon = !overdue && left !== null && left >= 0 && left <= 2 && task.status !== "DONE";

  let bg = C.borderSoft, color = C.textSoft;
  if (overdue) { bg = C.danger; color = "#fff"; }
  else if (soon) { bg = C.warn; color = "#fff"; }

  let icon = overdue ? "⏰" : soon ? "⏳" : "📅";
  let label = `${fmtDateTR(task.due_date)}`;
  if (left !== null && task.status !== "DONE") {
    if (left === 0) label += " · bugün";
    else if (left > 0) label += ` · ${left}g`;
    else label += ` · ${Math.abs(left)}g geç`;
  }
  return (
    <span
      style={{
        background: bg,
        color,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ marginRight: 4 }}>{icon}</span>{label}
    </span>
  );
}

function Avatar({ name, size = 24 }) {
  return (
    <div
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: C.primarySoft,
        color: C.primary,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.42,
        fontWeight: 800,
        border: `1px solid ${C.border}`,
      }}
    >
      {initials(name)}
    </div>
  );
}

function AssigneeStack({ task, max = 3 }) {
  const list = Array.isArray(task.assignees) && task.assignees.length > 0
    ? task.assignees.map((u) => u.full_name || u.email)
    : task.assigned_to_name ? [task.assigned_to_name] : [];
  if (list.length === 0)
    return <span style={{ fontSize: 12, color: C.textMuted }}>Atanmamış</span>;

  const shown = list.slice(0, max);
  const extra = list.length - shown.length;
  return (
    <div style={{ display: "inline-flex", alignItems: "center" }}>
      {shown.map((n, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <Avatar name={n} />
        </div>
      ))}
      {extra > 0 && (
        <div
          style={{
            marginLeft: -6,
            width: 24,
            height: 24,
            borderRadius: 999,
            background: C.borderSoft,
            color: C.textSoft,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 800,
            border: `1px solid ${C.border}`,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}

function Button({ variant = "primary", children, style, ...rest }) {
  const base = {
    border: "none",
    borderRadius: 10,
    padding: "9px 14px",
    fontWeight: 700,
    fontSize: 13,
    cursor: rest.disabled ? "not-allowed" : "pointer",
    opacity: rest.disabled ? 0.55 : 1,
    transition: "all .15s ease",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };
  const variants = {
    primary: { background: C.primary, color: "#fff" },
    ghost: { background: "transparent", color: C.textSoft, border: `1px solid ${C.border}` },
    soft: { background: C.primarySoft, color: C.primary },
    danger: { background: C.dangerSoft, color: C.danger },
    subtle: { background: C.borderSoft, color: C.text },
  };
  return (
    <button {...rest} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: C.textSoft }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: C.textMuted }}>{hint}</div>}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.card,
  color: C.text,
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

function Section({ title, subtitle, open, onToggle, children, icon }) {
  return (
    <section
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        background: C.card,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "12px 14px",
          background: open ? C.cardSoft : C.card,
          border: "none",
          borderBottom: open ? `1px solid ${C.border}` : "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {icon && (
            <div
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: C.primarySoft, color: C.primary,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 800,
              }}
            >
              {icon}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 800, color: C.text, fontSize: 14 }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
        </div>
        <span style={{ color: C.textMuted, fontSize: 12 }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && <div style={{ padding: 16 }}>{children}</div>}
    </section>
  );
}

/* ===========================================================
 * TASK CARD (Kanban)
 * =========================================================== */
function TaskCard({ task, onDelete, myRole, onOpen }) {
  const taskId = String(task.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: taskId });

  const overdue = isOverdue(task);
  const left = daysUntilDue(task);
  const dueSoon =
    !overdue && left !== null && left >= 0 && left <= 2 && task.status !== "DONE";

  const accent = overdue ? C.danger : dueSoon ? C.warn : C.primary;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    border: `1px solid ${overdue ? C.danger : dueSoon ? C.warn : C.border}`,
    borderRadius: 12,
    padding: 14,
    background: C.card,
    cursor: "grab",
    boxShadow: isDragging
      ? "0 14px 30px rgba(15,23,42,0.15)"
      : "0 1px 2px rgba(15,23,42,0.04)",
    position: "relative",
    overflow: "hidden",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
    >
      <div
        style={{
          position: "absolute",
          left: 0, top: 0, bottom: 0,
          width: 3,
          background: accent,
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, color: C.text, fontSize: 14, lineHeight: 1.35, wordBreak: "break-word" }}>
            {task.title}
          </div>
          {task.description && (
            <div
              style={{
                color: C.textSoft,
                fontSize: 12,
                marginTop: 6,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {task.description}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        <PriorityPill priority={task.priority} />
        <DuePill task={task} />
        {Array.isArray(task.dependencies) && task.dependencies.length > 0 && (
          <span
            style={{
              background: C.primarySoft,
              color: C.primary,
              padding: "3px 9px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            🔗 {task.dependencies.length}
          </span>
        )}
        {Number(task.attachment_count || 0) > 0 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {(task.attachment_types || []).map((type) => {
              const styles = {
                PDF: {
                  bg: C.dangerSoft,
                  color: C.danger,
                },
                IMAGE: {
                  bg: C.infoSoft,
                  color: C.info,
                },
                DOCX: {
                  bg: C.primarySoft,
                  color: C.primary,
                },
                PPTX: {
                  bg: C.warnSoft,
                  color: C.warn,
                },
                XLSX: {
                  bg: C.successSoft,
                  color: C.success,
                },
                FILE: {
                  bg: C.borderSoft,
                  color: C.textSoft,
                },
              };

              const s = styles[type] || styles.FILE;

              return (
                <span
                  key={type}
                  style={{
                    background: s.bg,
                    color: s.color,
                    padding: "3px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.3,
                  }}
                >
                  {type} {task.attachment_count}
                </span>
              );
            })}

            
          </div>
        )}
        {Number(task.code_submission_count || 0) > 0 && (
          <div
            style={{
              display: "flex",
              gap: 6,
              flesxWrap: "wrap",
              alignItems: "center",
            }}
          >
            {(task.code_types || []).map((type) => (
              <span
                key={type}
                style={{
                  background: C.primarySoft,
                  color: C.primary,
                  padding: "3px 8px",
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.3,
                }}
              >
                {type} {task.code_submission_count}
              </span>
            ))}
          </div>
        )}
        {(task.estimated_cost || task.actual_cost != null) && (
          <span
            style={{
              background: C.borderSoft,
              color: C.textSoft,
              padding: "3px 9px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            ₺ {task.actual_cost ?? task.estimated_cost ?? 0}
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: `1px solid ${C.borderSoft}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <AssigneeStack task={task} />
        {myRole === "LEADER" && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(String(task.id)); }}
            style={{
              background: "transparent",
              border: "none",
              color: C.textMuted,
              cursor: "pointer",
              fontSize: 12,
              padding: 4,
            }}
            title="Sil"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}

/* ===========================================================
 * KANBAN COLUMN
 * =========================================================== */
function KanbanColumn({ col, ids, taskById, onDelete, myRole, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col}` });
  const meta = STATUS_META[col];

  return (
    <div
      ref={setNodeRef}
      style={{
        border: `1px solid ${isOver ? C.primary : col === "TODO" ? "#CBD5E1" : col === "IN_PROGRESS" ? "#FDE68A" : "#BBF7D0"}`,
        borderRadius: 16,
        padding: 14,
        minHeight: 380,
        background: isOver
          ? C.primarySoft
          : col === "TODO"
          ? `linear-gradient(180deg, ${C.cardSoft} 0%, ${C.card} 100%)`
          : col === "IN_PROGRESS"
          ? `linear-gradient(180deg, ${C.warnSoft} 0%, ${C.card} 100%)`
          : `linear-gradient(180deg, ${C.successSoft} 0%, ${C.card} 100%)`,
        transition: "all .15s ease",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: "0 10px 28px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "4px 4px 8px",
          borderBottom: `1px solid ${C.borderSoft}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: meta.dot }} />
          <span style={{ fontWeight: 800, color: C.text, fontSize: 13, letterSpacing: 0.3 }}>
            {meta.label.toUpperCase()}
          </span>
        </div>
        <span
          style={{
            background: C.card,
            color: C.textSoft,
            fontWeight: 800,
            fontSize: 12,
            padding: "2px 8px",
            borderRadius: 999,
            border: `1px solid ${C.border}`,
          }}
        >
          {ids.length}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ids.map((id) => {
          const task = taskById.get(String(id));
          if (!task) return null;
          return (
            <TaskCard
              key={String(id)}
              task={task}
              onDelete={onDelete}
              myRole={myRole}
              onOpen={onOpen}
            />
          );
        })}
        {ids.length === 0 && (
          <div
            style={{
              fontSize: 12,
              color: C.textMuted,
              textAlign: "center",
              padding: "30px 10px",
              border: `1px dashed ${C.border}`,
              borderRadius: 10,
            }}
          >
            Bu kolonda task yok
          </div>
        )}
      </div>
    </div>
  );
}

/* ===========================================================
 * TIMELINE / GANTT
 * =========================================================== */
function TimelineView({ tasks, onOpen }) {
  if (!tasks.length)
    return (
      <div style={{ padding: 30, textAlign: "center", color: C.textMuted, fontSize: 13 }}>
        Henüz task yok.
      </div>
    );

  const DAY_W = 44;
  const LEFT_W = 280;

  const timelineBg = C.card;
  const timelineWeekend = C.cardSoft || "#111827";
  const timelineToday = "rgba(139,92,246,0.18)";

  const visible = tasks
    .filter((t) => t.created_at || t.due_date)
    .sort(
      (a, b) =>
        new Date(a.due_date || a.created_at) - new Date(b.due_date || b.created_at)
    );

  const allDates = visible.flatMap((t) => [
    new Date(t.start_date || t.created_at),
    new Date(t.due_date || t.start_date || t.created_at),
  ]);

  const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
  const maxTaskDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

  minDate.setHours(0, 0, 0, 0);
  maxTaskDate.setHours(0, 0, 0, 0);

  const visibleDayCount =
    typeof window !== "undefined"
      ? Math.ceil((window.innerWidth - LEFT_W - 160) / DAY_W)
      : 20;

  const taskDayCount =
    Math.ceil((maxTaskDate - minDate) / (1000 * 60 * 60 * 24)) + 1;

  const totalDays = Math.max(taskDayCount, visibleDayCount, 20);

  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(minDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayIdx = Math.round((today - minDate) / (1000 * 60 * 60 * 24));

  const dayIndex = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);

    return Math.max(
      0,
      Math.min(
        totalDays - 1,
        Math.round((x - minDate) / (1000 * 60 * 60 * 24))
      )
    );
  };

  const barColor = (t) => {
    if (t.status === "DONE") return C.success;
    if (isOverdue(t)) return C.danger;
    if (t.status === "IN_PROGRESS") return C.warn;
    return C.primary;
  };

  const monthLabel = (d) =>
    d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

  const weekdayShort = (d) =>
    d.toLocaleDateString("tr-TR", { weekday: "short" });

  const monthGroups = [];
  days.forEach((d, i) => {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const last = monthGroups[monthGroups.length - 1];

    if (last && last.key === key) last.span++;
    else monthGroups.push({ key, label: monthLabel(d), span: 1, startIdx: i });
  });

  const taskAssignees = (task) => {
    if (Array.isArray(task.assignees) && task.assignees.length > 0) {
      return task.assignees.map((u) => u.full_name || u.email).filter(Boolean);
    }

    return task.assigned_to_name ? [task.assigned_to_name] : [];
  };

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        overflow: "hidden",
        background: C.card,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontWeight: 800, color: C.text }}>Zaman Çizelgesi</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            Günlük takvim görünümü · {totalDays} gün
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, fontSize: 11, color: C.textSoft, flexWrap: "wrap" }}>
          <Legend dot={C.primary} text="Yapılacak" />
          <Legend dot={C.warn} text="Devam" />
          <Legend dot={C.success} text="Tamam" />
          <Legend dot={C.danger} text="Gecikmiş" />
        </div>
      </div>

      <div
        style={{
          width: "100%",
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        <div
          style={{
            width: LEFT_W + totalDays * DAY_W,
            minWidth: LEFT_W + totalDays * DAY_W,
          }}
        >
          <div
            style={{
              display: "flex",
              background: C.cardSoft,
              borderBottom: `1px solid ${C.borderSoft}`,
            }}
          >
            <div
              style={{
                width: LEFT_W,
                flexShrink: 0,
                padding: "8px 12px",
                fontSize: 11,
                fontWeight: 700,
                color: C.textSoft,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                borderRight: `1px solid ${C.border}`,
              }}
            >
              Task / Atanan
            </div>

            {monthGroups.map((m) => (
              <div
                key={m.key}
                style={{
                  width: m.span * DAY_W,
                  flexShrink: 0,
                  padding: "8px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.text,
                  borderRight: `1px solid ${C.borderSoft}`,
                  textTransform: "capitalize",
                }}
              >
                {m.label}
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              background: C.card,
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <div
              style={{
                width: LEFT_W,
                flexShrink: 0,
                borderRight: `1px solid ${C.border}`,
              }}
            />

            {days.map((d, i) => {
              const isToday = i === todayIdx;
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;

              return (
                <div
                  key={i}
                  style={{
                    width: DAY_W,
                    flexShrink: 0,
                    padding: "6px 0",
                    textAlign: "center",
                    borderRight: `1px solid ${C.borderSoft}`,
                    background: isToday
                      ? timelineToday
                      : isWeekend
                      ? timelineWeekend
                      : timelineBg,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: isToday ? C.primary : C.textMuted,
                      textTransform: "uppercase",
                      fontWeight: 700,
                    }}
                  >
                    {weekdayShort(d)}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: isToday ? 800 : 600,
                      color: isToday ? C.primary : C.text,
                    }}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              maxHeight: 420,
              overflowY: "auto",
              overflowX: "hidden",
            }}
          >
            {visible.map((task) => {
              const start = task.start_date || task.created_at;
              const end = task.due_date || task.start_date || task.created_at;
              const sIdx = dayIndex(start);
              const eIdx = dayIndex(end);
              const span = Math.max(1, eIdx - sIdx + 1);
              const overdue = isOverdue(task);
              const assignees = taskAssignees(task);
              const color = barColor(task);

              return (
                <div
                  key={task.id}
                  onClick={() => onOpen?.(task)}
                  style={{
                    display: "flex",
                    borderBottom: `1px solid ${C.borderSoft}`,
                    cursor: "pointer",
                    minHeight: 64,
                    transition: "background .12s ease",
                    background: C.card,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.cardSoft)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = C.card)}
                >
                  <div
                    style={{
                      width: LEFT_W,
                      flexShrink: 0,
                      padding: "10px 12px",
                      borderRight: `1px solid ${C.border}`,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: C.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={task.title}
                    >
                      {task.title}
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        color: C.textMuted,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={assignees.join(", ")}
                    >
                      <span>👤</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {assignees.length > 0 ? assignees.join(", ") : "Atanmamış"}
                      </span>
                    </div>
                  </div>

                  <div style={{ position: "relative", display: "flex", flex: 1 }}>
                    {days.map((d, i) => {
                      const isToday = i === todayIdx;
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                      return (
                        <div
                          key={i}
                          style={{
                            width: DAY_W,
                            flexShrink: 0,
                            borderRight: `1px solid ${C.borderSoft}`,
                            background: isToday
                              ? timelineToday
                              : isWeekend
                              ? timelineWeekend
                              : "transparent",
                          }}
                        />
                      );
                    })}

                    <div
                      style={{
                        position: "absolute",
                        left: sIdx * DAY_W + 4,
                        width: span * DAY_W - 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        height: 32,
                        background: color,
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                        display: "flex",
                        alignItems: "center",
                        padding: "0 10px",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        gap: 6,
                      }}
                      title={`${task.title} — ${assignees.join(", ") || "Atanmamış"}`}
                    >
                      {Array.isArray(task.dependencies) && task.dependencies.length > 0 ? (
                        <span>🔗</span>
                      ) : null}

                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                        {overdue && task.status !== "DONE" ? "Gecikmiş · " : ""}
                        {assignees[0] || STATUS_META[task.status]?.label || task.status}
                        {assignees.length > 1 ? ` +${assignees.length - 1}` : ""}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ dot, text }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: dot }} />
      {text}
    </span>
  );
}

function getFileTypeLabel(fileName = "", mimeType = "") {
  const name = String(fileName).toLowerCase();
  const mime = String(mimeType).toLowerCase();

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "PDF";
  if (mime.includes("image") || /\.(png|jpg|jpeg|webp|gif)$/i.test(name)) return "IMAGE";
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "DOCX";
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) return "XLSX";
  if (name.endsWith(".ppt") || name.endsWith(".pptx")) return "PPTX";
  if (name.endsWith(".zip") || name.endsWith(".rar")) return "ZIP";
  return "FILE";
}

function getFileTypeStyle(type) {
  const map = {
    PDF: { bg: C.dangerSoft, color: C.danger },
    IMAGE: { bg: C.infoSoft, color: C.info },
    DOCX: { bg: C.primarySoft, color: C.primary },
    XLSX: { bg: C.successSoft, color: C.success },
    PPTX: { bg: C.warnSoft, color: C.warn },
    ZIP: { bg: C.purpleSoft, color: C.purple },
    FILE: { bg: C.borderSoft, color: C.textSoft },
  };

  return map[type] || map.FILE;
}



/* ===========================================================
 * DASHBOARD STYLE BLOCKS
 * =========================================================== */
function SuggestionMetaPill({ children, bg = C.borderSoft, color = C.textSoft }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: bg,
        color,
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function AiSuggestionCard({
  suggestion: s,
  isEditing,
  suggestionDraft,
  setSuggestionDraft,
  members,
  tasks,
  onStartEdit,
  onCancelEdit,
  onAccept,
  onAcceptEdited,
  onReject,
  onDelete,
}) {
  const availableDependencyTasks = tasks.filter(
    (t) => t.status !== "DONE"
  );
  if (isEditing) {
    return (
      <div
        style={{
          gridColumn: "1 / -1",
          border: `1px solid ${C.primary}`,
          borderRadius: 18,
          padding: 18,
          background: `linear-gradient(180deg, ${C.card} 0%, ${C.cardSoft} 100%)`,
          boxShadow: "0 18px 40px rgba(79,70,229,0.10)",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <Field label="Başlık">
            <input
              value={suggestionDraft.title}
              onChange={(e) => setSuggestionDraft((p) => ({ ...p, title: e.target.value }))}
              style={{ ...inputStyle, height: 44 }}
            />
          </Field>

          <Field label="Açıklama">
            <textarea
              value={suggestionDraft.description}
              onChange={(e) => setSuggestionDraft((p) => ({ ...p, description: e.target.value }))}
              style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(140px, 1fr))", gap: 12 }}>
            <Field label="Öncelik">
              <select
                value={suggestionDraft.priority}
                onChange={(e) => setSuggestionDraft((p) => ({ ...p, priority: e.target.value }))}
                style={inputStyle}
              >
                <option value="LOW">Düşük</option>
                <option value="MEDIUM">Orta</option>
                <option value="HIGH">Yüksek</option>
              </select>
            </Field>

            <Field label="Tahmini saat">
              <input
                type="number"
                min="1"
                value={suggestionDraft.estimated_hours}
                onChange={(e) => setSuggestionDraft((p) => ({ ...p, estimated_hours: Number(e.target.value) }))}
                style={inputStyle}
              />
            </Field>

            <Field label="Tahmini gün">
              <input
                type="number"
                min="1"
                value={suggestionDraft.estimated_days}
                onChange={(e) => setSuggestionDraft((p) => ({ ...p, estimated_days: Number(e.target.value) }))}
                style={inputStyle}
              />
            </Field>

            <Field label="Atanacak kişi">
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#cbd5e1" }}>
                  Atanacak Kişiler
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 8,
                  }}
                >
                  {members.map((m) => {
                    const checked = (suggestionDraft.assignee_ids || [])
                      .map(String)
                      .includes(String(m.id));

                    return (
                      <label
                        key={m.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "9px 10px",
                          borderRadius: 10,
                          border: checked
                            ? "1px solid rgba(139,92,246,0.75)"
                            : "1px solid rgba(255,255,255,0.12)",
                          background: checked
                            ? "rgba(139,92,246,0.18)"
                            : "rgba(255,255,255,0.04)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSuggestionDraft((p) => ({
                              ...p,
                              assignee_ids: toggleId(p.assignee_ids || [], m.id),
                            }))
                          }
                          style={{ accentColor: "#8b5cf6" }}
                        />

                        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                          {m.full_name || m.email}
                        </span>
                      </label>
                    );
                  })}
                </div>

                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                  Birden fazla kişi seçebilirsin. Seçim yapılmazsa görev lider hesabına atanır.
                </div>
              </div>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 12 }}>
            <Field label="Başlangıç tarihi">
              <input
                type="date"
                value={suggestionDraft.start_date}
                onChange={(e) => setSuggestionDraft((p) => ({ ...p, start_date: e.target.value }))}
                style={inputStyle}
              />
            </Field>

            <Field label="Bitiş tarihi">
              <input
                type="date"
                value={suggestionDraft.due_date}
                onChange={(e) => setSuggestionDraft((p) => ({ ...p, due_date: e.target.value }))}
                style={inputStyle}
              />
            </Field>
          </div>

          

          <Field label="Bağlı olduğu tasklar">
            {availableDependencyTasks.length === 0 ? (
              <div style={{ fontSize: 12, color: C.textMuted }}>
                Bağlanabilecek task yok.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 10,
                  maxHeight: 230,
                  overflow: "auto",
                  paddingRight: 4,
                }}
              >
                {availableDependencyTasks.map((t) => {
                  const checked = suggestionDraft.dependency_ids
                    .map(String)
                    .includes(String(t.id));

                  return (
                    <label
                      key={t.id}
                      title={t.title}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 14px",
                        border: checked
                          ? `1px solid ${C.primary}`
                          : `1px solid ${C.border}`,
                        borderRadius: 14,
                        background: checked ? C.primarySoft : C.cardSoft,
                        color: C.text,
                        cursor: "pointer",
                        minHeight: 90,
                        boxShadow: checked
                          ? "0 10px 24px rgba(139,92,246,0.18)"
                          : "none",
                        transition: "all .15s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSuggestionDraft((p) => ({
                            ...p,
                            dependency_ids: toggleId(p.dependency_ids || [], t.id),
                          }))
                        }
                        style={{ accentColor: C.primary, flexShrink: 0 }}
                      />

                      <span
                        title={t.title}
                        style={{
                          fontWeight: 800,
                          fontSize: 13,
                          flex: 1,
                          color: C.text,
                          lineHeight: 1.45,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {t.title}
                      </span>

                      <StatusPill status={t.status} />
                    </label>
                  );
                })}
              </div>
            )}
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
            <Button variant="ghost" onClick={onCancelEdit}>Vazgeç</Button>
            <Button onClick={() => onAcceptEdited(s.id)} disabled={!suggestionDraft.title.trim()}>
              ✅ Düzenleyerek Kanbana Ekle
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: 16,
        background: C.card,
        boxShadow: C.shadow,
        minHeight: 230,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: C.text, lineHeight: 1.35 }}>{s.title}</div>
            <div style={{ marginTop: 7, marginRight: -100, fontSize: 12.5, color: C.textSoft, lineHeight: 1.55 }}>{s.description}</div>
          </div>

          {s.status === "PENDING" ? (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button onClick={() => onStartEdit(s)} title="Düzenle" style={miniIconBtn(C.primarySoft, C.primary)}>✎</button>
              <button onClick={() => onAccept(s.id)} title="Kanbana ekle" style={miniIconBtn(C.successSoft, C.success)}>✓</button>
              <button onClick={() => onReject(s.id)} title="Reddet" style={miniIconBtn(C.dangerSoft, C.danger)}>×</button>
            </div>
          ) : (
            <div style={{ fontSize: 11, fontWeight: 900, color: s.status === "ACCEPTED" ? C.success : C.danger }}>
              {s.status === "ACCEPTED" ? "KANBANA EKLENDİ" : "REDDEDİLDİ"}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 14 }}>
          <PriorityPill priority={s.priority} />
          {s.roadmap_order && (
            <SuggestionMetaPill bg={C.borderSoft} color={C.textSoft}>
              Adım #{s.roadmap_order}
            </SuggestionMetaPill>
          )}
          <SuggestionMetaPill bg={C.primarySoft} color={C.primary}>{s.category}</SuggestionMetaPill>
          {s.task_type && (
            <SuggestionMetaPill bg={C.purpleSoft} color={C.purple}>
              🧩 {s.task_type}
            </SuggestionMetaPill>
          )}
          <SuggestionMetaPill>⏱ {s.estimated_hours || 0}s</SuggestionMetaPill>
          {s.due_date && <SuggestionMetaPill bg={C.warnSoft} color={C.warn}>🗓 {fmtDateTR(s.due_date)}</SuggestionMetaPill>}
          {s.suggested_assignee_name && <SuggestionMetaPill bg={C.successSoft} color={C.success}>👤 {s.suggested_assignee_name}</SuggestionMetaPill>}
        </div>

        {s.suggested_assignee_reason && (
          <div style={{ marginTop: 12, fontSize: 11.5, color: C.textMuted, lineHeight: 1.5 }}>
            <b>AI atama nedeni:</b> {s.suggested_assignee_reason}
          </div>
        )}

        {Array.isArray(s.suggested_dependencies) && s.suggested_dependencies.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: C.textMuted, lineHeight: 1.5 }}>
            🔗 AI bağlı task önerisi: <b>{s.suggested_dependencies.map((d) => d.title).filter(Boolean).join(", ")}</b>
          </div>
        )}

        {s.suggested_dependency_reason && (
          <div style={{ marginTop: 5, fontSize: 11.5, color: C.textMuted, lineHeight: 1.5 }}>
            <b>Neden:</b> {s.suggested_dependency_reason}
          </div>
        )}

        {Array.isArray(s.subtasks) && s.subtasks.length > 0 && (
          <div
            style={{
              marginTop: 5,
              padding: "10px 12px",
              borderRadius: 12,
              background: C.cardSoft,
              border: `1px solid ${C.borderSoft}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: C.textSoft,
                marginBottom: 8,
              }}
            >
              Alt Görevler
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              {s.subtasks.map((sub, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: 11.5,
                    color: C.textSoft,
                    lineHeight: 1.45,
                  }}
                >
                  <b style={{ color: C.text }}>{idx + 1}. {sub.title}</b>
                  {sub.description && (
                    <div style={{ marginTop: 2 }}>
                      {sub.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        
      </div>

      {Array.isArray(s.acceptance_criteria) &&
        s.acceptance_criteria.length > 0 && (
          <div
            style={{
              marginTop: 2,
              padding: "10px 12px",
              borderRadius: 12,
              background: C.cardSoft,
              border: `1px solid ${C.borderSoft}`,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                color: C.textSoft,
                marginBottom: 8,
              }}
            >
              Tamamlanma Kriterleri
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              {s.acceptance_criteria.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: 11.5,
                    color: C.textSoft,
                    lineHeight: 1.45,
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      color: "#10B981",
                      fontWeight: 900,
                      marginTop: 1,
                    }}
                  >
                    ✓
                  </span>

                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
      )}

      {s.status === "PENDING" && (
        <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
          <Button variant="soft" onClick={() => onStartEdit(s)} style={{ flex: 1, justifyContent: "center" }}>✏️ Düzenle</Button>
          <Button variant="ghost" onClick={() => onDelete(s.id)} style={{ paddingInline: 12 }}>🗑</Button>
        </div>
      )}
    </div>
  );
}

function miniIconBtn(bg, color) {
  return {
    border: "none",
    width: 30,
    height: 30,
    borderRadius: 9,
    background: bg,
    color,
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}



function QuickTaskCreateCard({
  title,
  setTitle,
  createTask,
  disabled,
  setOpenCreateSections,
  showDetailedCreate,
  setShowDetailedCreate,
}) {
  return (
    <Card padding={20}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>Yeni Task Oluştur</h3>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Proje için yeni bir görev oluşturun.</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr auto auto", gap: 12, alignItems: "center" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Yeni task başlığı yaz..."
          style={{ ...inputStyle, height: 46 }}
        />
        <Button onClick={() => setShowDetailedCreate((p) => !p)}>
          {showDetailedCreate ? "− Detayları Gizle" : "+ Yeni Task"}
        </Button>
      </div>
    </Card>
  );
}

function ActivitySummaryCard({ recentLogs, logsLoading, loadRecentLogs, projectId }) {
  return (
    <Card padding={20}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>Son Aktiviteler</h3>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Projedeki son hareketler</div>
        </div>
        <Button variant="ghost" onClick={loadRecentLogs} style={{ padding: "8px 12px" }}>↻</Button>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {logsLoading ? (
          <div style={{ color: C.textMuted, fontSize: 13 }}>Yükleniyor…</div>
        ) : recentLogs.length ? (
          recentLogs
            .slice(0, Number(localStorage.getItem("activity_limit") || 5))
            .map((log) => (
            <div
              key={log.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontSize: 12.5,
                color: C.textSoft,
                minWidth: 0,
              }}
            >
              <Avatar name={log.actor_name || "?"} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: C.text,
                    fontWeight: 700,
                    lineHeight: 1.35,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    wordBreak: "break-word",
                  }}
                >
                  {log.message}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{new Date(log.created_at).toLocaleString("tr-TR")}</div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 12, color: C.textMuted }}>Henüz aktivite yok.</div>
        )}
      </div>
      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
        <Link to={`/projects/${projectId}`} style={{ fontSize: 12, color: C.primary, textDecoration: "none", fontWeight: 800 }}>Tüm Aktiviteler →</Link>
      </div>
    </Card>
  );
}

/* ===========================================================
 * MAIN PAGE
 * =========================================================== */
export default function TasksPage_v2() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = getToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const notificationTaskId = searchParams.get("taskId");

  const [project, setProject] = useState(null);

  const [activeTaskId, setActiveTaskId] = useState(null);
  const [myRole, setMyRole] = useState(null);
  const [members, setMembers] = useState([]);

  const [newAssigneeIds, setNewAssigneeIds] = useState([]);
  const [editAssigneeIds, setEditAssigneeIds] = useState([]);

  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState({ TODO: [], IN_PROGRESS: [], DONE: [] });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("TODO");
  const [saving, setSaving] = useState(false);

  const [recentLogs, setRecentLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [taskLogs, setTaskLogs] = useState([]);
  const [taskLogsLoading, setTaskLogsLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [myUserId, setMyUserId] = useState(null);

  const [q, setQ] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "ALL");
  const [creatorFilter, setCreatorFilter] = useState(searchParams.get("assigned_to") || "ALL");
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get("priority") || "ALL");
  const [dateFilter, setDateFilter] = useState(searchParams.get("dateFilter") || "ALL");
  const [onlyMine, setOnlyMine] = useState(searchParams.get("only_mine") === "true");
  const [sortMode, setSortMode] = useState(searchParams.get("sortMode") || "MANUAL");

  const [showDetailedCreate, setShowDetailedCreate] = useState(false);

  const [newPriority, setNewPriority] = useState("MEDIUM");
  const [newDueDate, setNewDueDate] = useState("");

  const [editPriority, setEditPriority] = useState("MEDIUM");
  const [editDueDate, setEditDueDate] = useState("");

  const [newEstimatedCost, setNewEstimatedCost] = useState("");
  const [newCostNote, setNewCostNote] = useState("");

  const [editEstimatedCost, setEditEstimatedCost] = useState("");
  const [editActualCost, setEditActualCost] = useState("");
  const [editCostNote, setEditCostNote] = useState("");

  const [newDependencyIds, setNewDependencyIds] = useState([]);
  const [editDependencyIds, setEditDependencyIds] = useState([]);

  const [dependencyGraph, setDependencyGraph] = useState({
    tasks: [],
    edges: [],
  });
  const [expandedCategories, setExpandedCategories] = useState({});

  const [editError, setEditError] = useState("");

  const [viewMode, setViewMode] = useState(
    localStorage.getItem("default_task_view") || "KANBAN"
  );

  const [newStartDate, setNewStartDate] = useState("");
  const [editStartDate, setEditStartDate] = useState("");

  const [attachments, setAttachments] = useState([]);

  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [generatingStage, setGeneratingStage] = useState("");

  const [aiSuggestionFilter, setAiSuggestionFilter] = useState("PENDING");

  const [workloadAnalysis, setWorkloadAnalysis] = useState(null);
  const [workloadLoading, setWorkloadLoading] = useState(false);

  const [codeSubmissions, setCodeSubmissions] = useState([]);
  const [codeFile, setCodeFile] = useState(null);
  const [codeDescription, setCodeDescription] = useState("");
  const [uploadingCode, setUploadingCode] = useState(false);
  const [expandedCodeId, setExpandedCodeId] = useState(null);

  const [summarizingCodeId, setSummarizingCodeId] = useState(null);

  const [generatingCommitId, setGeneratingCommitId] = useState(null);

  const [editingSuggestionId, setEditingSuggestionId] = useState(null);
  const [suggestionDraft, setSuggestionDraft] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    estimated_hours: 2,
  });

  const [attachmentTaskId, setAttachmentTaskId] = useState("");
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [modalAttachmentFile, setModalAttachmentFile] = useState(null);
  const [uploadingModalAttachment, setUploadingModalAttachment] = useState(false);

  const [codeTaskId, setCodeTaskId] = useState("");
  const [projectCodeFile, setProjectCodeFile] = useState(null);
  const [projectCodeDescription, setProjectCodeDescription] = useState("");
  const [uploadingProjectCode, setUploadingProjectCode] = useState(false);

  const [allCodeSubmissions, setAllCodeSubmissions] = useState([]);

  const [expandedCodeSubmissionId, setExpandedCodeSubmissionId] = useState(null);

  const [openCreateSections, setOpenCreateSections] = useState({
    info: true,
    assign: false,
    planning: false,
    cost: false,
    dependency: false,
  });
  function toggleCreateSection(key) {
    setOpenCreateSections((p) => ({ ...p, [key]: !p[key] }));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const taskById = useMemo(() => {
    const m = new Map();
    for (const t of tasks) m.set(String(t.id), t);
    return m;
  }, [tasks]);

  const creatorOptions = useMemo(() => {
    return members
      .map((m) => ({ id: String(m.id), name: m.full_name || m.email || "—" }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [members]);

  const [openEditSections, setOpenEditSections] = useState({
    info: true,
    aiSubtasks: true,
    aiCriteria: true,
    assign: false,
    planning: false,
    cost: false,
    dependency: false,
    code: false,
    files: false,
    activity: false,
    comments: true,
  });

  const [activeTab, setActiveTab] = useState("summary");
  const [codeTabs, setCodeTabs] = useState({});

  function toggleEditSection(key) {
    setOpenEditSections((p) => ({ ...p, [key]: !p[key] }));
  }

  function canChangeTaskStatus(task) {
    if (!task) return false;
    if (myRole === "LEADER") return true;

    const ids = Array.isArray(task.assignee_ids)
      ? task.assignee_ids.map(String)
      : task.assigned_to
      ? [String(task.assigned_to)]
      : [];

    return ids.includes(String(myUserId));
  }

  function toggleId(list, id) {
    const sid = String(id);

    if (list.map(String).includes(sid)) {
      return list.filter((x) => String(x) !== sid);
    }

    return [...list, sid];
  }

  async function loadAllCodeSubmissions() {
    try {
      const data = await getProjectCodeSubmissions(id);
      setAllCodeSubmissions(data.submissions || []);
    } catch (e) {
      console.error("loadAllCodeSubmissions:", e);
      setAllCodeSubmissions([]);
    }
  }

  async function openEditModal(task, options = {}) {
    const forceCostOpen = options.forceCostOpen === true;

    setSelectedTask(task);
    setEditTitle(task.title || "");
    setEditDescription(task.description || "");
    setEditStatus(options.status || task.status || "TODO");
    setIsModalOpen(true);

    setOpenEditSections((prev) => ({
      ...prev,
      info: !forceCostOpen,
      cost: forceCostOpen || prev.cost,
    }));

    loadTaskLogs(task.id);
    setEditPriority(task.priority || "MEDIUM");
    setEditStartDate(toDateInputValue(task.start_date));
    setEditDueDate(toDateInputValue(task.due_date));
    setEditAssigneeIds(
      Array.isArray(task.assignee_ids)
        ? task.assignee_ids.map(String)
        : task.assigned_to
        ? [String(task.assigned_to)]
        : []
    );
    setEditEstimatedCost(task.estimated_cost ?? "");
    setEditActualCost(forceCostOpen ? "" : task.actual_cost ?? "");
    setEditCostNote(task.cost_note || "");
    loadCodeSubmissions(task.id);

    try {
      const res = await apiFetch(`/tasks/${task.id}/dependencies`, { token });
      const deps = res?.dependencies || [];
      setEditDependencyIds(deps.map((d) => String(d.id)));
    } catch (e) {
      console.error("dependency load error:", e);
    }
  }

  function closeEditModal() {
    setIsModalOpen(false);
    setSelectedTask(null);
    setEditTitle("");
    setEditDescription("");
    setEditStatus("TODO");
    setEditError("");
  }

  async function loadMyRole() {
    try {
      const data = await apiFetch(`/projects/${id}`, { token });
      setMyRole(data.my_role);
      setProject(data.project || null);
    } catch (e) {
      console.error(e);
    }
  }
  async function loadMembers() {
    try {
      const data = await apiFetch(`/projects/${id}/members`, { token });
      const list = Array.isArray(data) ? data : (data?.members || []);
      setMembers(list);
    } catch (e) { console.error("loadMembers error:", e); }
  }

  async function loadTasks() {
    setErr("");
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (creatorFilter !== "ALL") params.set("assigned_to", creatorFilter);
      if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
      if (onlyMine) params.set("only_mine", "true");
      const sortMap = {
        MANUAL: "",
        UPDATED_DESC: "updated_desc",
        UPDATED_ASC: "updated_asc",
        CREATED_DESC: "newest",
        CREATED_ASC: "oldest",
        TITLE_ASC: "title_asc",
        TITLE_DESC: "title_desc",
      };
      const backendSort = sortMap[sortMode];
      if (backendSort) params.set("sort", backendSort);
      const query = params.toString();
      const url = query ? `/projects/${id}/tasks?${query}` : `/projects/${id}/tasks`;
      const data = await apiFetch(url, { token });
      const list = data.tasks || [];
      setTasks(list);
      setColumns(buildColumns(list));
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function openTaskFromNotification(taskId) {
    try {
      const data = await apiFetch(`/tasks/${taskId}`, { token });
      const task = data?.task ?? data;
      if (!task?.id) return;
      openEditModal(task);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("taskId");
      nextParams.delete("notification");
      setSearchParams(nextParams, { replace: true });
    } catch (e) {
      console.error("openTaskFromNotification:", e);
    }
  }

  async function loadRecentLogs() {
    setLogsLoading(true);
    try {
      const data = await apiFetch(`/projects/${id}/activity?limit=5`, { token });
      const list = data.logs ?? data ?? [];
      setRecentLogs(list.slice(0, 5));
    } catch (e) {
      console.error("loadRecentLogs:", e);
    } finally {
      setLogsLoading(false);
    }
  }

  async function loadAttachments() {
    try {
      const data = await getProjectAttachments(id);
      setAttachments(data.attachments || []);
    } catch (e) {
      console.error("loadAttachments:", e);
    }
  }

  async function loadAiSuggestions() {
    try {
      const data = await apiFetch(
        `/projects/${id}/ai-task-suggestions`,
        { token }
      );

      setAiSuggestions(data.suggestions || []);
    } catch (e) {
      console.error("loadAiSuggestions:", e);
    }
  }

  async function loadDependencyGraph() {
    try {
      const data = await apiFetch(
        `/projects/${id}/task-dependency-graph`,
        { token }
      );

      setDependencyGraph({
        tasks: data.tasks || [],
        edges: data.edges || [],
      });
    } catch (e) {
      console.error("loadDependencyGraph:", e);
    }
  }

  async function loadWorkloadAnalysis() {
    try {
      setWorkloadLoading(true);

      const data = await apiFetch(`/projects/${id}/workload-analysis`, {
        token,
      });

      setWorkloadAnalysis(data);
    } catch (e) {
      console.error("loadWorkloadAnalysis:", e);
    } finally {
      setWorkloadLoading(false);
    }
  }

  async function loadCodeSubmissions(taskId) {
    if (!taskId) return;

    try {
      const data = await getTaskCodeSubmissions(taskId);
      setCodeSubmissions(data.submissions || []);
    } catch (e) {
      console.error("loadCodeSubmissions:", e);
      setCodeSubmissions([]);
    }
  }

  async function handleUploadCodeSubmission() {
    if (isArchived) {
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }

    if (!selectedTask?.id) {
      showWarning("Task seçilmedi.");
      return;
    }

    if (!codeFile) {
      showWarning("Kod dosyası seçmelisin.");
      return;
    }

    try {
      setUploadingCode(true);
      setErr("");

      await uploadTaskCodeSubmission(
        selectedTask.id,
        codeFile,
        codeDescription
      );

      setCodeFile(null);
      setCodeDescription("");
      setExpandedCodeId(null);
      

      await loadCodeSubmissions(selectedTask.id);
    } catch (e) {
      showError(e.message);
    } finally {
      setUploadingCode(false);
    }
  }

  async function handleUploadProjectCodeSubmission() {
    if (isArchived) {
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }

    if (!codeTaskId) {
      showWarning("Task seçmelisin.");
      return;
    }

    if (!projectCodeFile) {
      showWarning("Kod dosyası seçmelisin.");
      return;
    }

    try {
      setUploadingProjectCode(true);
      setErr("");

      await uploadTaskCodeSubmission(
        codeTaskId,
        projectCodeFile,
        projectCodeDescription
      );
      await loadAllCodeSubmissionsFromTasks();

      setCodeTaskId("");
      setProjectCodeFile(null);
      setProjectCodeDescription("");

      if (selectedTask?.id && String(selectedTask.id) === String(codeTaskId)) {
        await loadCodeSubmissions(codeTaskId);
      }
    } catch (e) {
      console.error("handleUploadProjectCodeSubmission:", e);
      showError(e.message || "Kod teslimi yüklenemedi.");
    } finally {
      setUploadingProjectCode(false);
    }
  }

  async function handleDeleteCodeSubmission(submissionId) {
    const ok = confirm("Kod teslimi silinsin mi?");
    if (!ok) return;

    try {
      await deleteTaskCodeSubmission(submissionId);
      await loadCodeSubmissions(selectedTask?.id);
    } catch (e) {
      showError(e.message);
    }
  }

  async function copyCodeToClipboard(code) {
    try {
      await navigator.clipboard.writeText(code || "");
      alert("Kod kopyalandı.");
    } catch (e) {
      alert("Kod kopyalanamadı.");
    }
  }

  function downloadCodeSubmission(submission) {
    const token = getToken();

    fetch(taskCodeDownloadUrl(submission.id), {
      headers: {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
      },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Dosya indirilemedi.");

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = submission.file_name || "code-file";
        document.body.appendChild(a);
        a.click();
        a.remove();

        window.URL.revokeObjectURL(url);
      })
      .catch((e) => showError(e.message));
  }

  async function handleSummarizeCodeSubmission(submissionId) {
    try {
      setSummarizingCodeId(submissionId);
      setErr("");

      await summarizeTaskCodeSubmission(submissionId);
      await loadCodeSubmissions(selectedTask?.id);
    } catch (e) {
      showError(e.message);
    } finally {
      setSummarizingCodeId(null);
    }
  }

  async function handleGenerateCommitSummary(submissionId) {
    try {
      setGeneratingCommitId(submissionId);

      await generateCommitSummary(submissionId);

      await loadCodeSubmissions(selectedTask?.id);
    } catch (e) {
      showError(e.message);
    } finally {
      setGeneratingCommitId(null);
    }
  }

  async function generateAiSuggestions(stage) {
    if (isArchived) {
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }

    try {
      setAiLoading(true);
      setGeneratingStage(stage);

      const result = await apiFetch(`/projects/${id}/ai-task-suggestions/generate`, {
        token,
        method: "POST",
        body: { stage },
      });

      console.log("AI suggestion result:", result);

      await loadAiSuggestions();
      await loadRecentLogs();

      if (!result?.suggestions?.length) {
        showWarning(
          "AI öneri üretti ancak mevcut görevlerle benzer olduğu için eklenmedi. Farklı bir kategori seçerek tekrar deneyebilirsin."
        );
      } else {
        console.log(`${result.suggestions.length} yeni AI görev önerisi üretildi.`);
      }
    } catch (e) {
      console.error("AI suggestion frontend error:", e);
      showError(e.message || "AI önerisi üretilemedi.");
    } finally {
      setAiLoading(false);
      setGeneratingStage("");
    }
  }

  async function acceptAiSuggestion(suggestionId) {
    if (isArchived) {
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }
    try {
      const suggestion = aiSuggestions.find(
        (s) => String(s.id) === String(suggestionId)
      );

      const estimatedDays = Number(suggestion?.estimated_days || 1);

      const startDate = suggestion?.start_date
        ? toDateInputValue(suggestion.start_date)
        : todayInputValue();

      const dueDate = suggestion?.due_date
        ? toDateInputValue(suggestion.due_date)
        : addDaysInput(startDate, estimatedDays);

      await apiFetch(
        `/projects/${id}/ai-task-suggestions/${suggestionId}/accept`,
        {
          token,
          method: "PATCH",
          body: {
            assignee_ids: suggestion?.suggested_assignee_id
              ? [String(suggestion.suggested_assignee_id)]
              : [],
            estimated_days: estimatedDays,
            start_date: startDate,
            due_date: dueDate,
            dependency_ids: Array.isArray(suggestion?.suggested_dependency_ids)
              ? suggestion.suggested_dependency_ids
              : [],
          },
        }
      );

      await loadAiSuggestions();
      await loadTasks();
      await loadDependencyGraph();
      await loadRecentLogs();
      await loadWorkloadAnalysis();
    } catch (e) {
      showError(e.message);
    }
  }

  async function rejectAiSuggestion(suggestionId) {
    if (isArchived) {
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }
    try {
      await apiFetch(
        `/projects/${id}/ai-task-suggestions/${suggestionId}/reject`,
        {
          token,
          method: "PATCH",
        }
      );

      await loadAiSuggestions();
    } catch (e) {
      showError(e.message);
    }
  }

  function startEditSuggestion(s) {
    const estimatedDays = Number(s.estimated_days || 1);

    const startDate = s.start_date
      ? toDateInputValue(s.start_date)
      : todayInputValue();

    const dueDate = s.due_date
      ? toDateInputValue(s.due_date)
      : addDaysInput(startDate, estimatedDays);

    const matchedAssignee = s.suggested_assignee_id
      ? String(s.suggested_assignee_id)
      : members.find(
          (m) =>
            String(m.email || "").toLowerCase() ===
            String(s.suggested_assignee_email || "").toLowerCase()
        )?.id || "";

    const assigneeIds = Array.isArray(s.suggested_assignee_ids)
      ? s.suggested_assignee_ids.map(String)
      : matchedAssignee
      ? [String(matchedAssignee)]
      : [];

    const dependencyIds = Array.isArray(s.suggested_dependency_ids)
      ? s.suggested_dependency_ids.map(String)
      : [];

    setEditingSuggestionId(s.id);

    setSuggestionDraft({
      title: s.title || "",
      description: s.description || "",
      priority: s.priority || "MEDIUM",
      estimated_hours: s.estimated_hours || 2,
      estimated_days: estimatedDays,

      // eski tekli atama yerine çoklu atama
      assignee_ids: assigneeIds,

      start_date: startDate,
      due_date: dueDate,
      dependency_ids: dependencyIds,
    });
  }

  function cancelEditSuggestion() {
    setEditingSuggestionId(null);
    setSuggestionDraft({
      title: "",
      description: "",
      priority: "MEDIUM",
      estimated_hours: 2,
      estimated_days: 1,
      assignee_ids: [],
      start_date: "",
      due_date: "",
      dependency_ids: [],
    });
  }

  async function acceptEditedAiSuggestion(suggestionId) {
    if (isArchived) {
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }
    try {
      await apiFetch(
        `/projects/${id}/ai-task-suggestions/${suggestionId}/accept`,
        {
          token,
          method: "PATCH",
          body: {
            title: suggestionDraft.title,
            description: suggestionDraft.description,
            priority: suggestionDraft.priority,
            estimated_hours: suggestionDraft.estimated_hours,
            estimated_days: suggestionDraft.estimated_days,
            assignee_ids: suggestionDraft.assignee_ids || [],
            start_date: suggestionDraft.start_date || null,
            due_date: suggestionDraft.due_date || null,
            dependency_ids: suggestionDraft.dependency_ids || [],
          },
        }
      );

      cancelEditSuggestion();
      await loadAiSuggestions();
      await loadTasks();
      await loadDependencyGraph();
      await loadRecentLogs();
    } catch (e) {
      showError(e.message);
    }
  }

  async function deleteAiSuggestion(suggestionId) {
    if (isArchived) {
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }
    try {
      await apiFetch(
        `/projects/${id}/ai-task-suggestions/${suggestionId}`,
        {
          token,
          method: "DELETE",
        }
      );

      await loadAiSuggestions();
    } catch (e) {
      showError(e.message);
    }
  }

  async function openAttachment(attachmentId) {
    try {
      const API = import.meta.env.VITE_API_URL || "/api";
      const res = await fetch(`${API}/attachments/${attachmentId}/view`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!res.ok) throw new Error("Dosya görüntülenemedi");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e) {
      showError(e.message);
    }
  }

  async function downloadAttachmentFile(attachmentId, fileName = "dosya") {
    try {
      const API = import.meta.env.VITE_API_URL || "/api";
      const res = await fetch(`${API}/attachments/${attachmentId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
      });

      if (!res.ok) throw new Error("Dosya indirilemedi");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e) {
      showError(e.message);
    }
  }

  async function handleUploadAttachment() {
    if (isArchived) {
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }
    if (!attachmentFile) {
      showWarning("Dosya seçmelisin.");
      return;
    }

    if (!attachmentTaskId) {
      showWarning("Dosyanın bağlı olduğu taskı seçmelisin.");
      return;
    }

    try {
      setErr("");
      setUploadingAttachment(true);

      await uploadProjectAttachment(id, attachmentTaskId, attachmentFile);

      setAttachmentFile(null);
      setAttachmentTaskId("");

      await loadAttachments();
      await loadTasks();
      await loadDependencyGraph();
      await loadRecentLogs();
    } catch (e) {
      showError(e.message);
    } finally {
      setUploadingAttachment(false);
    }
  }

  async function handleUploadModalAttachment() {
    if (isArchived) {
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }

    if (!selectedTask?.id) {
      showWarning("Task seçilmedi.");
      return;
    }

    if (!modalAttachmentFile) {
      showWarning("Dosya seçmelisin.");
      return;
    }

    try {
      setUploadingModalAttachment(true);

      await uploadProjectAttachment(
        id,
        selectedTask.id,
        modalAttachmentFile
      );

      setModalAttachmentFile(null);
      await loadAttachments();
    } catch (e) {
      console.error("handleUploadModalAttachment:", e);
      showError(e?.message || "Dosya yüklenemedi.");
    } finally {
      setUploadingModalAttachment(false);
    }
  }

  async function handleDeleteAttachment(attachmentId) {
    if (isArchived) {
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }
    const ok = confirm("Dosya silinsin mi?");
    if (!ok) return;

    try {
      await deleteAttachment(attachmentId);
      await loadAttachments();
      await loadTasks();
      await loadDependencyGraph();
      await loadRecentLogs();
    } catch (e) {
      showError(e.message);
    }
  }

  function getTaskAttachments(taskId) {
    return attachments.filter((a) => String(a.task_id) === String(taskId));
  }

  function formatFileSize(bytes) {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function loadTaskLogs(taskId) {
    setTaskLogsLoading(true);
    try {
      const data = await apiFetch(`/projects/${id}/activity`, { token });
      const logs = Array.isArray(data) ? data : (data?.logs || []);
      setTaskLogs(logs.filter((l) => String(l.task_id) === String(taskId)));
    } catch (e) {
      console.error(e);
      setTaskLogs([]);
    } finally {
      setTaskLogsLoading(false);
    }
  }

  async function createTask() {
    if (isArchived) {
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }
    setErr("");
    try {
      const data = await apiFetch(`/projects/${id}/tasks`, {
        token,
        method: "POST",
        body: {
          title,
          description,
          priority: newPriority || "MEDIUM",
          start_date: newStartDate || null,
          due_date: newDueDate || null,
          assignee_ids: newAssigneeIds,
          estimated_cost: newEstimatedCost,
          cost_note: newCostNote,
        },
      });
      const created = data?.task ?? data;
      if (!created?.id) throw new Error("Create response task format is invalid");
      if (myRole === "LEADER" && newDependencyIds.length > 0) {
        await apiFetch(`/tasks/${created.id}/dependencies`, {
          token,
          method: "PUT",
          body: { dependency_ids: newDependencyIds },
        });
      }
      setTitle(""); setDescription(""); setNewPriority("MEDIUM");
      setNewStartDate(""); setNewDueDate(""); setNewAssigneeIds([]);
      setNewEstimatedCost(""); setNewCostNote(""); setNewDependencyIds([]);
      await loadTasks();
      await loadDependencyGraph();
      await loadRecentLogs();
      await loadWorkloadAnalysis();
    } catch (e) {
      showError(e.message);
    }
  }

  async function deleteTask(taskId) {
    if (isArchived) {
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }
    const ok = confirm("Task silinsin mi?");
    if (!ok) return;
    setErr("");
    const tid = String(taskId);
    try {
      await apiFetch(`/tasks/${tid}`, { token, method: "DELETE" });
      setTasks((prev) => prev.filter((t) => String(t.id) !== tid));
      setColumns((c) => {
        const next = { ...c };
        for (const s of STATUS) next[s] = next[s].filter((x) => String(x) !== tid);
        return next;
      });
      await loadDependencyGraph();
      await loadRecentLogs();
      await loadWorkloadAnalysis();
    } catch (e) {
      showError(e.message);
    }
  }

  async function saveTaskEdit() {
    if (isArchived) {
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }
    if (!selectedTask) return;
    if (editStatus === "DONE" && !editActualCost) {
      showWarning("Gerçek maliyet girmen zorunlu!");
      return;
    }
    setEditError("");
    setSaving(true);
    const taskId = String(selectedTask.id);
    const prevTasks = [...tasks];
    const prevColumns = JSON.parse(JSON.stringify(columns));

    setTasks((prev) =>
      prev.map((t) =>
        String(t.id) === taskId
          ? {
              ...t,
              title: editTitle.trim(),
              description: editDescription || null,
              status: editStatus,
              priority: editPriority,
              start_date: editStartDate || null,
              due_date: editDueDate || null,
              assignee_ids: editAssigneeIds,
              estimated_cost: editEstimatedCost,
              actual_cost: editStatus === "DONE" ? editActualCost : null,
              cost_note: editCostNote,
            }
          : t
      )
    );
    const from = findContainer(columns, taskId);
    const to = editStatus;
    if (from && to && from !== to) {
      setColumns((c) => ({
        ...c,
        [from]: c[from].filter((x) => String(x) !== taskId),
        [to]: [taskId, ...c[to]],
      }));
    }

    try {
      const updateBody =
        myRole === "LEADER"
          ? {
              title: editTitle.trim(),
              description: editDescription || null,
              status: editStatus,
              priority: editPriority,
              start_date: editStartDate || null,
              due_date: editDueDate || null,
              assignee_ids: editAssigneeIds,
              estimated_cost: editEstimatedCost,
              actual_cost: editStatus === "DONE" ? editActualCost : null,
              cost_note: editCostNote,
            }
          : {
              status: editStatus,
              actual_cost: editStatus === "DONE" ? editActualCost : null,
            };

      const data = await apiFetch(`/tasks/${taskId}`, {
        token,
        method: "PATCH",
        body: updateBody,
      });

      const updated = unwrapTask(data);
      if (!updated?.id) throw new Error("Update response task format is invalid");

      const oldDeps = Array.isArray(selectedTask.dependencies)
        ? selectedTask.dependencies.map((d) => String(d.id)).sort()
        : [];

      const newDeps = [...editDependencyIds.map(String)].sort();

      const depsChanged = JSON.stringify(oldDeps) !== JSON.stringify(newDeps);

      if (myRole === "LEADER" && depsChanged) {
        await apiFetch(`/tasks/${taskId}/dependencies`, {
          token,
          method: "PUT",
          body: { dependency_ids: editDependencyIds },
        });
      }

      const nextTasks = prevTasks.map((t) =>
        String(t.id) === taskId ? updated : t
      );

      setTasks(nextTasks);
      setColumns(buildColumns(nextTasks));
      closeEditModal();

      await loadDependencyGraph();
      await loadRecentLogs();
      await loadWorkloadAnalysis();
    } catch (e) {
      // console.error("SAVE TASK EDIT ERROR:", e);

      setTasks(prevTasks);
      setColumns(prevColumns);

      const blockers = e?.data?.blocking_dependencies;

      if (blockers?.length) {
        showWarning(
          `Bu task tamamlanamaz.\nÖnce şu tasklar tamamlanmalı:\n${blockers
            .map((b) => `• ${b.title} (${b.status})`)
            .join("\n")}`,
          "Bağımlı Tasklar Var"
        );
      } else {
        showError(e.message || "Bir hata oluştu");
      }
    } finally {
      setSaving(false);
    }
  }

  async function loadMe() {
    try {
      const data = await apiFetch("/users/me", { token });
      const user = data?.user ?? data?.me ?? data?.data ?? data;
      const uid = user?.id ?? user?.userId ?? user?._id;
      if (!uid) throw new Error("Cannot read my user id from /me response");
      setMyUserId(String(uid));
    } catch (e) {
      console.error("loadMe:", e);
    }
  }

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    loadMe();
    loadMyRole();
    loadRecentLogs();
    loadMembers();
    loadAttachments();
    loadAiSuggestions();
    loadDependencyGraph();
    loadWorkloadAnalysis();
    loadAllCodeSubmissions();
  }, [id]);

  useEffect(() => {
    if (!token) return;
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, q, statusFilter, creatorFilter, priorityFilter, onlyMine, sortMode]);

  useEffect(() => {
    const params = {};
    if (q.trim()) params.q = q.trim();
    if (statusFilter !== "ALL") params.status = statusFilter;
    if (creatorFilter !== "ALL") params.assigned_to = creatorFilter;
    if (priorityFilter !== "ALL") params.priority = priorityFilter;
    if (dateFilter !== "ALL") params.dateFilter = dateFilter;
    if (onlyMine) params.only_mine = "true";
    if (sortMode !== "MANUAL") params.sortMode = sortMode;
    setSearchParams(params, { replace: true });
  }, [q, statusFilter, creatorFilter, priorityFilter, dateFilter, onlyMine, sortMode, setSearchParams]);

  useEffect(() => {
    if (!notificationTaskId || tasks.length === 0) return;
    const task = tasks.find((t) => String(t.id) === String(notificationTaskId));
    if (task) {
      openEditModal(task);
      searchParams.delete("taskId");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationTaskId, tasks]);

  useEffect(() => {
    if (!token || !notificationTaskId) return;
    if (isModalOpen) return;
    openTaskFromNotification(notificationTaskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, notificationTaskId]);

  useEffect(() => {
    if (!id || !token) return;

    const socket = getSocket();
    if (!socket) return;

    socket.emit("join-project-room", { projectId: id });

    let refreshTimer;

    const refreshTasks = () => {
      clearTimeout(refreshTimer);

      refreshTimer = setTimeout(() => {
        loadTasks();
        loadRecentLogs();
        loadAttachments();
        loadAiSuggestions();
        loadDependencyGraph();
        loadWorkloadAnalysis();
      }, 500);
    };

    socket.on("project:task-created", refreshTasks);
    socket.on("project:task-updated", refreshTasks);
    socket.on("project:task-deleted", refreshTasks);
    socket.on("project:comment-created", refreshTasks);
    socket.on("project:sprint-updated", refreshTasks);
    socket.on("project:attachment-created", refreshTasks);
    socket.on("project:attachment-deleted", refreshTasks);

    return () => {
      socket.emit("leave-project-room", { projectId: id });

      socket.off("project:task-created", refreshTasks);
      socket.off("project:task-updated", refreshTasks);
      socket.off("project:task-deleted", refreshTasks);
      socket.off("project:comment-created", refreshTasks);
      socket.off("project:sprint-updated", refreshTasks);
      socket.off("project:attachment-created", refreshTasks);
      socket.off("project:attachment-deleted", refreshTasks);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const handleDragStart = (e) => setActiveTaskId(String(e.active.id));
  const handleDragCancel = () => setActiveTaskId(null);

  const handleDragEnd = async (event) => {
    if (isArchived) {
      setActiveTaskId(null);
      showWarning("Bu proje arşivlenmiş. Değişiklik yapılamaz.");
      return;
    }
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const draggedTask = taskById.get(activeId);

    if (!canChangeTaskStatus(draggedTask)) {
      showWarning(
        "Bu task sana atanmadığı için durumunu değiştiremezsin.",
        "Yetkin Yok"
      );
      return;
    }
    const overId = String(over.id);
    const prevTasks = [...tasks];
    const prevColumns = JSON.parse(JSON.stringify(columns));
    const from = findContainer(columns, activeId);
    let to = isColumnId(overId) ? columnFromId(overId) : findContainer(columns, overId);
    if (!to) {
      const overTask = taskById.get(overId);
      if (overTask?.status) {
        to = overTask.status;
      }
    }
    if (!from || !to) return;

    if (from === to) {
      const oldIndex = columns[from].indexOf(activeId);
      const newIndex = columns[to].indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setColumns((c) => ({ ...c, [from]: arrayMove(c[from], oldIndex, newIndex) }));
      }
      return;
    }

    if (to === "DONE") {
      const task = taskById.get(activeId);
      if (task) {
        openEditModal(task, {
          status: "DONE",
          forceCostOpen: true,
        });
      }
      return;
    }

    setColumns((c) => {
      const fromItems = c[from].filter((x) => String(x) !== activeId);
      const toItems = c[to].filter((x) => String(x) !== activeId);
      let insertIndex;
      if (isColumnId(overId)) insertIndex = toItems.length;
      else {
        const idx = toItems.indexOf(overId);
        insertIndex = idx === -1 ? toItems.length : idx;
      }
      toItems.splice(insertIndex, 0, activeId);
      return { ...c, [from]: fromItems, [to]: toItems };
    });

    try {
      const data = await apiFetch(`/tasks/${activeId}`, {
        token,
        method: "PATCH",
        body: { status: to },
      });
      const updated = unwrapTask(data);
      if (!updated?.id) throw new Error("Update response task format is invalid");
      setTasks((prev) => {
        const next = prev.map((t) => (String(t.id) === activeId ? updated : t));
        setColumns(buildColumns(next));
        return next;
      });
      await loadDependencyGraph();
      await loadRecentLogs();
      await loadWorkloadAnalysis();
    } catch (e) {
      console.error("DRAG STATUS UPDATE ERROR:", e);
      setTasks(prevTasks);
      setColumns(prevColumns);
      showError(e.message);
    }
  };

  const qNorm = q.trim().toLowerCase();
  const passesFilters = (t) => {
    if (!t) return false;
    if (qNorm) {
      const hay = `${t.title || ""} ${t.description || ""}`.toLowerCase();
      if (!hay.includes(qNorm)) return false;
    }
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (creatorFilter !== "ALL") {
      const ids = Array.isArray(t.assignee_ids)
        ? t.assignee_ids.map(String)
        : t.assigned_to ? [String(t.assigned_to)] : [];
      if (!ids.includes(String(creatorFilter))) return false;
    }
    if (
      priorityFilter !== "ALL" &&
      String(t.priority || "").toUpperCase() !== String(priorityFilter).toUpperCase()
    ) return false;
    if (onlyMine) {
      if (!myUserId) return true;
      const ids = Array.isArray(t.assignee_ids)
        ? t.assignee_ids.map(String)
        : t.assigned_to ? [String(t.assigned_to)] : [];
      if (!ids.includes(String(myUserId))) return false;
    }
    return true;
  };

  const allowedIds = useMemo(() => {
    const s = new Set();
    for (const t of tasks) if (passesFilters(t)) s.add(String(t.id));
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, qNorm, statusFilter, creatorFilter, priorityFilter, onlyMine]);

  const dateAllowedIds = useMemo(() => {
    if (dateFilter === "ALL") return allowedIds;
    const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const parseDue = (due) => {
      if (!due) return null;
      const d = new Date(due);
      if (Number.isNaN(d.getTime())) return null;
      return d;
    };
    const today = startOfDay(new Date());
    const keep = new Set();
    for (const id of allowedIds) {
      const t = taskById.get(String(id));
      if (!t) continue;
      if (t.status === "DONE") continue;
      const due = parseDue(t.due_date);
      if (!due) continue;
      const diffDays = Math.round((startOfDay(due) - today) / (1000 * 60 * 60 * 24));
      if (dateFilter === "OVERDUE" && diffDays < 0) { keep.add(String(id)); continue; }
      if (dateFilter === "DUE_1" && diffDays >= 0 && diffDays <= 1) { keep.add(String(id)); continue; }
      if (dateFilter === "DUE_3" && diffDays >= 0 && diffDays <= 3) { keep.add(String(id)); continue; }
      if (dateFilter === "DUE_7" && diffDays >= 0 && diffDays <= 7) { keep.add(String(id)); continue; }
    }
    return keep;
  }, [dateFilter, allowedIds, taskById]);

  const compareTasks = (a, b) => {
    if (!a || !b) return 0;
    const da = (x) => (x ? new Date(x).getTime() : 0);
    const priorityRank = (p) => {
      switch (String(p || "").toUpperCase()) {
        case "HIGH": return 3; case "MEDIUM": return 2; case "LOW": return 1; default: return 0;
      }
    };
    const dueTime = (x) => {
      if (!x) return Number.MAX_SAFE_INTEGER;
      const t = new Date(x).getTime();
      return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
    };
    switch (sortMode) {
      case "UPDATED_DESC": return da(b.updated_at) - da(a.updated_at);
      case "UPDATED_ASC": return da(a.updated_at) - da(b.updated_at);
      case "CREATED_DESC": return da(b.created_at) - da(a.created_at);
      case "CREATED_ASC": return da(a.created_at) - da(b.created_at);
      case "TITLE_ASC": return String(a.title || "").localeCompare(String(b.title || ""), "tr");
      case "TITLE_DESC": return String(b.title || "").localeCompare(String(a.title || ""), "tr");
      case "PRIORITY_DESC": return priorityRank(b.priority) - priorityRank(a.priority);
      case "PRIORITY_ASC": return priorityRank(a.priority) - priorityRank(b.priority);
      case "DUE_ASC": return dueTime(a.due_date) - dueTime(b.due_date);
      case "DUE_DESC": return dueTime(b.due_date) - dueTime(a.due_date);
      default: return 0;
    }
  };

  const dueStats = useMemo(() => {
    const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
    const parseDue = (due) => {
      if (!due) return null;
      const d = new Date(due);
      if (Number.isNaN(d.getTime())) return null;
      return d;
    };
    const today = startOfDay(new Date());
    let overdue = 0, dueSoon = 0;
    for (const t of tasks) {
      if (t.status === "DONE") continue;
      const due = parseDue(t.due_date);
      if (!due) continue;
      const diffDays = Math.round((startOfDay(due) - today) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) overdue++;
      else if (diffDays <= 3) dueSoon++;
    }
    return { overdue, dueSoon };
  }, [tasks]);

  const viewColumns = useMemo(() => {
    const next = {};
    for (const col of STATUS) {
      const ids = (columns[col] || []).filter((id) => dateAllowedIds.has(String(id)));
      if (sortMode === "MANUAL") next[col] = ids;
      else {
        next[col] = [...ids].sort((id1, id2) => {
          const t1 = taskById.get(String(id1));
          const t2 = taskById.get(String(id2));
          return compareTasks(t1, t2);
        });
      }
    }
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, dateAllowedIds, sortMode, taskById]);

  const filteredAiSuggestions = useMemo(() => {
    const list = Array.isArray(aiSuggestions) ? aiSuggestions : [];

    if (aiSuggestionFilter === "ALL") {
      return [...list].sort(
        (a, b) => Number(a.roadmap_order || 999) - Number(b.roadmap_order || 999)
      );
    }

    return list
      .filter((s) => String(s.status || "PENDING").toUpperCase() === aiSuggestionFilter)
      .sort((a, b) => Number(a.roadmap_order || 999) - Number(b.roadmap_order || 999));
  }, [aiSuggestions, aiSuggestionFilter]);

  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.status === "DONE").length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const todoCount = tasks.filter((t) => t.status === "TODO").length;
  const progressPct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  function showError(message, title = "İşlem Başarısız") {
    Swal.fire({
      icon: "error",
      title,
      text: message || "Bir hata oluştu.",
      confirmButtonText: "Tamam",
      background: "#0B1020",
      color: "#fff",
      confirmButtonColor: "#8b5cf6",
      target: document.body,
      didOpen: () => {
        const container = document.querySelector(".swal2-container");
        if (container) container.style.zIndex = "20000";
      },
    });
  }

  function showWarning(message, title = "Uyarı") {
    Swal.fire({
      icon: "warning",
      title,
      text: message || "Bu işlem yapılamaz.",
      confirmButtonText: "Tamam",
      background: "#0B1020",
      color: "#fff",
      confirmButtonColor: "#8b5cf6",
      target: document.body,
      didOpen: () => {
        const container = document.querySelector(".swal2-container");
        if (container) container.style.zIndex = "20000";
      },
    });
  }

  const isArchived = Boolean(project?.is_archived || project?.archived_at);

  /* ===========================================================
   * RENDER
   * =========================================================== */
  return (
    <div
      className="tasks-theme-page"
      style={{
        minHeight: "100vh",
        width: "100%",
        background: C.bg,
        color: C.text,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
        transition: "background .25s ease, color .25s ease",
      }}
    >
      <style>{TASKS_THEME_STYLE}</style>
      {/* STICKY TOP BAR */}
      <div
        style={{
          position: "sticky",
          top: 0,
          left: 0,
          right: 0,
          width: "100%",
          maxWidth: "100%",
          overflow: "hidden",
          zIndex: 50,
          background: C.header,
          backdropFilter: "saturate(140%) blur(10px)",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          className="tasks-header-inner"
          style={{
            width: "100%",
            maxWidth: 1680,
            margin: "0 auto",
            padding: "14px 24px",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            alignItems: "center",
            gap: 16,
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <Link
              to={`/projects/${id}`}
              style={{
                textDecoration: "none",
                color: C.textSoft,
                fontSize: 13,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.card,
              }}
            >
              ← Proje
            </Link>
            <div
              className="tasks-header-left"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <h1
                className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-[#0B1020]/80"
                style={{
                  margin: 0,
                  fontSize: "clamp(18px, 2vw, 25px)",
                  fontWeight: 800,
                  letterSpacing: -0.3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                }}
              >
                {project?.name || "Proje"}
              </h1>

              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                Tasklar · {total} task · %{progressPct} tamamlandı
              </div>
              
            </div>
          </div>
          <div className="tasks-header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button variant="ghost" onClick={() => { loadTasks(); loadDependencyGraph(); loadRecentLogs(); }}>
              ↻ Yenile
            </Button>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1680,
          margin: "0 auto",
          padding: "20px 24px",
          display: "grid",
          gap: 20,
          minWidth: 0,
          boxSizing: "border-box",
        }}
      >
        
        {isArchived && (
          <div
            style={{
              background: C.warnSoft,
              color: C.warn,
              border: `1px solid ${C.warn}`,
              padding: "12px 14px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 800,
              marginBottom: 14,
            }}
          >
            📦 Bu proje arşivlenmiş. Tasklar yalnızca görüntülenebilir;
            oluşturma, düzenleme, silme, AI önerisi ve dosya işlemleri kapalıdır.
          </div>
        )}

        {/* PROGRESS / STATS */}
        <Card padding={20}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <StatTile label="Toplam" value={total} dot={C.primary} />
            <StatTile label="Yapılacak" value={todoCount} dot={STATUS_META.TODO.dot} />
            <StatTile label="Devam Ediyor" value={inProgressCount} dot={STATUS_META.IN_PROGRESS.dot} />
            <StatTile label="Tamamlandı" value={doneCount} dot={STATUS_META.DONE.dot} />
            <StatTile label="Gecikmiş" value={dueStats.overdue} dot={C.danger} />
            <StatTile label="3 Gün İçinde" value={dueStats.dueSoon} dot={C.warn} />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: C.textSoft }}>
              Genel İlerleme
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>%{progressPct}</div>
          </div>
          <div
            style={{
              height: 10,
              background: C.borderSoft,
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${C.primary}, ${C.success})`,
                transition: "width 400ms ease",
              }}
            />
          </div>
        </Card>

        {/* ── Hızlı İşlemler ── */}
<div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 4px 0" }}>
  <div style={{ fontSize: 18 }}>⚡</div>
  <div>
    <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Hızlı İşlemler</div>
    <div style={{ fontSize: 12, color: C.textMuted }}>Yeni task oluştur & son aktiviteler</div>
  </div>
  <div style={{ flex: 1, height: 1, background: C.borderSoft }} />
</div>

{/* QUICK CREATE + ACTIVITY */}
<div
  style={{
    display: "grid",
    gridTemplateColumns:
      myRole === "LEADER"
        ? "minmax(0, 1fr) minmax(360px, 0.9fr)"
        : "1fr",
    gap: 20,
    alignItems: "start",
  }}
  className="task-top-grid"
>
  {myRole === "LEADER" && (
    <Card
      padding={20}
      style={{
        height: showDetailedCreate ? 400 : 400,
        overflow: "hidden",
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Yeni Task Oluştur</h3>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
          Proje için yeni bir görev oluşturun.
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Yeni task başlığı yaz..."
          style={{
            ...inputStyle,
            flex: 1,
            height: 52,
          }}
        />

        <Button
          type="button"
          onClick={() => {
            setShowDetailedCreate((p) => !p);
            setOpenCreateSections((p) => ({
              ...p,
              info: true,
            }));
          }}
          style={{
            whiteSpace: "nowrap",
            height: 48,
            padding: "0 18px",
          }}
        >
          {showDetailedCreate ? "− Detayları Gizle" : "+ Detayları Göster"}
        </Button>
      </div>

      

      {showDetailedCreate && (
  <div
    style={{
      marginTop: 22,
      paddingTop: 18,
      borderTop: `1px solid ${C.borderSoft}`,
      maxHeight: 170,
      overflowY: "auto",
      paddingRight: 6,
    }}
  >
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
              Task Detaylı Oluşturma
            </h3>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              Atama, tarih, maliyet ve bağımlılık bilgilerini buradan ekleyebilirsin.
            </div>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <Section
              title="Task Bilgileri"
              subtitle="Başlık, açıklama ve öncelik"
              icon="1"
              open={openCreateSections.info}
              onToggle={() => toggleCreateSection("info")}
            >
              <div style={{ display: "grid", gap: 12 }}>
                <Field label="Başlık">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Örn: Backend API endpointlerini oluştur"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Açıklama">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Task açıklaması (opsiyonel)"
                    style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                  />
                </Field>

                <Field label="Öncelik">
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="LOW">Düşük</option>
                    <option value="MEDIUM">Orta</option>
                    <option value="HIGH">Yüksek</option>
                  </select>
                </Field>
              </div>
            </Section>

            <Section
              title="Atama"
              subtitle="Ekip üyelerinden seç"
              icon="2"
              open={openCreateSections.assign}
              onToggle={() => toggleCreateSection("assign")}
            >
              <div style={{ display: "grid", gap: 8 }}>
                {members.map((m) => {
                  const checked = newAssigneeIds.map(String).includes(String(m.id));

                  return (
                    <label
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        cursor: "pointer",
                        padding: "10px 12px",
                        border: `1px solid ${checked ? C.primary : C.border}`,
                        borderRadius: 10,
                        background: checked ? C.primarySoft : C.cardSoft,
                        color: C.text,
                        transition: "all .15s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setNewAssigneeIds((p) => toggleId(p, m.id))}
                        style={{ accentColor: C.primary }}
                      />

                      <Avatar name={m.full_name || m.email} size={28} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
                          {m.full_name || m.email}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{m.role}</div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
                Seçim yapılmazsa task sana atanır.
              </div>
            </Section>

            <Section
              title="Planlama"
              subtitle="Başlangıç ve bitiş tarihi"
              icon="3"
              open={openCreateSections.planning}
              onToggle={() => toggleCreateSection("planning")}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Başlangıç">
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Bitiş">
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </Section>

            <Section
              title="Maliyet"
              subtitle="Tahmini maliyet ve not"
              icon="4"
              open={openCreateSections.cost}
              onToggle={() => toggleCreateSection("cost")}
            >
              <div style={{ display: "grid", gap: 12 }}>
                <Field label="Tahmini Maliyet (₺)">
                  <input
                    type="number"
                    placeholder="Örn: 500"
                    value={newEstimatedCost || ""}
                    onChange={(e) => setNewEstimatedCost(e.target.value)}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Maliyet Notu">
                  <textarea
                    placeholder="API, hosting, lisans gibi notlar"
                    value={newCostNote}
                    onChange={(e) => setNewCostNote(e.target.value)}
                    style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                  />
                </Field>
              </div>
            </Section>

            <Section
              title="Bağımlılıklar"
              subtitle="Bu task hangi tasklara bağlı"
              icon="5"
              open={openCreateSections.dependency}
              onToggle={() => toggleCreateSection("dependency")}
            >
              {tasks.length === 0 ? (
                <div style={{ fontSize: 12, color: C.textMuted }}>
                  Bağlanabilecek task yok.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8, maxHeight: 220, overflow: "auto" }}>
                  {tasks.map((t) => {
                    const checked = newDependencyIds.includes(String(t.id));

                    return (
                      <label
                        key={t.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          border: `1px solid ${checked ? C.primary : C.border}`,
                          borderRadius: 10,
                          background: checked ? C.primarySoft : C.cardSoft,
                          color: C.text,
                          cursor: "pointer",
                          transition: "all .15s ease",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setNewDependencyIds((p) => toggleId(p, t.id))}
                          style={{ accentColor: C.primary }}
                        />

                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            flex: 1,
                            color: C.text,
                          }}
                        >
                          {t.title}
                        </span>

                        <StatusPill status={t.status} />
                      </label>
                    );
                  })}
                </div>
              )}
            </Section>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <Button onClick={createTask} disabled={isArchived || !title.trim()}>
                + Task Oluştur
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )}

  <ActivitySummaryCard
    recentLogs={recentLogs}
    logsLoading={logsLoading}
    loadRecentLogs={loadRecentLogs}
    projectId={id}
  />
</div>

        

        {/* ── Görev Tahtası ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 4px 0" }}>
          <div style={{ fontSize: 18 }}>🗂️</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Görev Tahtası</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>Filtrele, sırala ve görevleri yönet</div>
          </div>
          <div style={{ flex: 1, height: 1, background: C.borderSoft }} />
        </div>


        {/* FILTERS */}
        <Card padding={18}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 2fr) repeat(5, minmax(140px, 1fr))",
              gap: 10,
            }}
            className="task-filter-grid"
          >
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted, fontSize: 13 }}>🔍</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Başlık veya açıklamada ara"
                style={{ ...inputStyle, paddingLeft: 34 }}
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
              <option value="ALL">Tüm Durumlar</option>
              <option value="TODO">Yapılacak</option>
              <option value="IN_PROGRESS">Devam Ediyor</option>
              <option value="DONE">Tamamlandı</option>
            </select>
            <select value={creatorFilter} onChange={(e) => setCreatorFilter(e.target.value)} style={inputStyle}>
              <option value="ALL">Tüm Atananlar</option>
              {creatorOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} style={inputStyle}>
              <option value="ALL">Tüm Öncelikler</option>
              <option value="LOW">Düşük</option>
              <option value="MEDIUM">Orta</option>
              <option value="HIGH">Yüksek</option>
            </select>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={inputStyle}>
              <option value="ALL">Tüm Tarihler</option>
              <option value="OVERDUE">Gecikmiş</option>
              <option value="DUE_1">1 gün içinde</option>
              <option value="DUE_3">3 gün içinde</option>
              <option value="DUE_7">7 gün içinde</option>
            </select>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} style={inputStyle}>
              <option value="MANUAL">Manuel Sıralama</option>
              <option value="UPDATED_DESC">Son Güncellenen</option>
              <option value="UPDATED_ASC">İlk Güncellenen</option>
              <option value="CREATED_DESC">Yeni Oluşturulan</option>
              <option value="CREATED_ASC">Eski Oluşturulan</option>
              <option value="TITLE_ASC">Başlık A → Z</option>
              <option value="TITLE_DESC">Başlık Z → A</option>
              <option value="PRIORITY_DESC">Öncelik Yüksek → Düşük</option>
              <option value="PRIORITY_ASC">Öncelik Düşük → Yüksek</option>
              <option value="DUE_ASC">Bitiş Yakın → Uzak</option>
              <option value="DUE_DESC">Bitiş Uzak → Yakın</option>
            </select>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: C.textSoft, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={onlyMine}
                  onChange={(e) => setOnlyMine(e.target.checked)}
                  style={{ accentColor: C.primary }}
                />
                Sadece benim tasklarım
              </label>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                Gösterilen: <b style={{ color: C.text }}>{allowedIds.size}</b> / {tasks.length}
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setQ(""); setStatusFilter("ALL"); setCreatorFilter("ALL");
                setPriorityFilter("ALL"); setDateFilter("ALL");
                setOnlyMine(false); setSortMode("MANUAL");
              }}
              style={{ fontSize: 12, padding: "6px 12px" }}
            >
              Filtreleri Sıfırla
            </Button>
          </div>
        </Card>

        {/* BOARD */}
        <Card
          padding={20}
          style={{
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>Kanban Board</h3>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                Sürükleyerek durum değiştirebilirsin.
              </div>
            </div>
            <div
              style={{
                display: "inline-flex",
                background: C.borderSoft,
                borderRadius: 10,
                padding: 3,
              }}
            >
              {["KANBAN", "TIMELINE"].map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setViewMode(m);
                    localStorage.setItem("default_task_view", m);
                  }}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: "none",
                    background:
                      viewMode === m
                        ? "rgba(139,92,246,0.22)"
                        : "transparent",

                    color:
                      viewMode === m
                        ? "#fff"
                        : "rgba(255,255,255,0.7)",

                    border:
                      viewMode === m
                        ? "1px solid rgba(139,92,246,0.45)"
                        : "1px solid transparent",

                    boxShadow:
                      viewMode === m
                        ? "0 4px 12px rgba(139,92,246,0.18)"
                        : "none",
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                    transition: "all .15s ease",
                  }}
                >
                  {m === "KANBAN" ? "Kanban" : "Timeline"}
                </button>
              ))}
            </div>
          </div>

          {(dueStats.overdue > 0 || dueStats.dueSoon > 0) && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {dueStats.overdue > 0 && (
                <button
                  onClick={() => setDateFilter((p) => (p === "OVERDUE" ? "ALL" : "OVERDUE"))}
                  style={{
                    border: `1px solid ${dateFilter === "OVERDUE" ? C.danger : "#FECACA"}`,
                    background: dateFilter === "OVERDUE" ? C.danger : C.dangerSoft,
                    color: dateFilter === "OVERDUE" ? "#fff" : C.danger,
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "all .15s ease",
                  }}
                >
                  🔴 Gecikmiş: {dueStats.overdue}
                </button>
              )}
              {dueStats.dueSoon > 0 && (
                <button
                  onClick={() => setDateFilter((p) => (p === "DUE_3" ? "ALL" : "DUE_3"))}
                  style={{
                    border: `1px solid ${dateFilter === "DUE_3" ? C.warn : "#FDE68A"}`,
                    background: dateFilter === "DUE_3" ? C.warn : C.warnSoft,
                    color: dateFilter === "DUE_3" ? "#fff" : "#92400E",
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    transition: "all .15s ease",
                  }}
                >
                  🟠 3 gün içinde: {dueStats.dueSoon}
                </button>
              )}
            </div>
          )}

          {viewMode === "KANBAN" &&
            (loading ? (
              <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>Yükleniyor…</div>
            ) : tasks.length ? (
              <DndContext
                sensors={sensors}
                collisionDetection={(args) => {
                  const pointerCollisions = pointerWithin(args);
                  if (pointerCollisions.length > 0) return pointerCollisions;
                  return rectIntersection(args);
                }}
                onDragStart={handleDragStart}
                onDragCancel={handleDragCancel}
                onDragEnd={handleDragEnd}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(280px, 1fr))",
                    gap: 14,
                    overflowX: "auto",
                    paddingBottom: 6,
                  }}
                >
                  {STATUS.map((col) => (
                    <SortableContext
                      key={col}
                      items={viewColumns[col]}
                      strategy={verticalListSortingStrategy}
                    >
                      <KanbanColumn
                        col={col}
                        ids={viewColumns[col]}
                        taskById={taskById}
                        onDelete={deleteTask}
                        myRole={myRole}
                        onOpen={openEditModal}
                      />
                    </SortableContext>
                  ))}
                </div>

                <DragOverlay>
                  {activeTaskId ? (
                    <div
                      style={{
                        border: `1px solid ${C.primary}`,
                        borderRadius: 12,
                        padding: 14,
                        background: C.card,
                        boxShadow: "0 18px 40px rgba(15,23,42,0.18)",
                        width: 280,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {taskById.get(activeTaskId)?.title}
                      </div>
                      <div style={{ color: C.textSoft, fontSize: 12, marginTop: 6 }}>
                        {taskById.get(activeTaskId)?.description || "—"}
                      </div>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            ) : (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: C.textMuted,
                  border: `1px dashed ${C.border}`,
                  borderRadius: 12,
                }}
              >
                Henüz task yok. Yukarıdan ilk task'ı oluştur.
              </div>
            ))}

          {viewMode === "TIMELINE" && <TimelineView tasks={tasks} onOpen={openEditModal} />}
        </Card>

        {/* ── Bağımlılıklar & İş Yükü ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 4px 0" }}>
          <div style={{ fontSize: 18 }}>🔗</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Bağımlılıklar & İş Yükü</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>Görevler arası ilişki ve ekip dağılımı</div>
          </div>
          <div style={{ flex: 1, height: 1, background: C.borderSoft }} />
        </div>


        <DependencyGraphCard
          graph={dependencyGraph}
          visibleTasks={tasks}
          onOpenTask={(task) => {
            const fullTask = tasks.find((t) => String(t.id) === String(task.id));
            if (fullTask) openEditModal(fullTask);
          }}
        />

        <WorkloadAnalysisCard
          data={workloadAnalysis}
          loading={workloadLoading}
        />

        {/* ── AI & Kaynaklar ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 4px 0" }}>
          <div style={{ fontSize: 18 }}>🤖</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>AI & Kaynaklar</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>AI önerileri ve dosyalar</div>
          </div>
          <div style={{ flex: 1, height: 1, background: C.borderSoft }} />
        </div>


        {myRole === "LEADER" && (
          <Card padding={20} style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>✨ AI Görev Önerileri</h3>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                  Projenize özel AI tarafından önerilen görevlerdir.
                </div>
              </div>
              <Button
                disabled={aiLoading || isArchived}
                onClick={() => generateAiSuggestions("planning")}
              >
                ✨ AI ile yeni öneri üret
              </Button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  ["planning", "📋 Analiz"],
                  ["frontend", "🎨 Frontend"],
                  ["backend", "⚙️ Backend"],
                  ["database", "🗄️ Veritabanı"],
                  ["testing", "🧪 Test"],
                ].map(([key, label]) => (
                  <Button key={key} variant="soft" disabled={aiLoading} onClick={() => generateAiSuggestions(key)}>
                    {aiLoading && generatingStage === key ? "Üretiliyor..." : label}
                  </Button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginLeft: "auto" }}>
                {[
                  ["PENDING", "Bekleyen"],
                  ["ACCEPTED", "Kabul edilen"],
                  ["REJECTED", "Reddedilen"],
                  ["ALL", "Tümü"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAiSuggestionFilter(key)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 999,

                      background:
                        aiSuggestionFilter === key
                          ? "rgba(139,92,246,0.22)"
                          : "rgba(255,255,255,0.03)",

                      color:
                        aiSuggestionFilter === key
                          ? "#fff"
                          : "rgba(255,255,255,0.72)",

                      border:
                        aiSuggestionFilter === key
                          ? "1px solid rgba(139,92,246,0.45)"
                          : "1px solid rgba(255,255,255,0.08)",

                      boxShadow:
                        aiSuggestionFilter === key
                          ? "0 4px 12px rgba(139,92,246,0.18)"
                          : "none",

                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",

                      transition: "all .18s ease",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredAiSuggestions.length === 0 ? (
              <div style={{ border: `1px dashed ${C.border}`, borderRadius: 14, padding: 28, textAlign: "center", color: C.textMuted, fontSize: 13 }}>
                Henüz AI önerisi yok.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                {filteredAiSuggestions.map((s) => (
                  <AiSuggestionCard
                    key={s.id}
                    suggestion={s}
                    isEditing={editingSuggestionId === s.id}
                    suggestionDraft={suggestionDraft}
                    setSuggestionDraft={setSuggestionDraft}
                    members={members}
                    tasks={tasks}
                    onStartEdit={startEditSuggestion}
                    onCancelEdit={cancelEditSuggestion}
                    onAccept={acceptAiSuggestion}
                    onAcceptEdited={acceptEditedAiSuggestion}
                    onReject={rejectAiSuggestion}
                    onDelete={deleteAiSuggestion}
                  />
                ))}
              </div>
            )}
          </Card>
        )}

        {/*dosyalar */}

        <Card padding={20}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                Kaynaklar / Dosyalar
              </h3>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                Dosyaları tasklarla ilişkilendirerek saklayabilirsin.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr) auto",
              gap: 10,
              alignItems: "end",
              marginBottom: 16,
            }}
          >
            <Field label="Bağlı Task">
              <select
                value={attachmentTaskId}
                onChange={(e) => setAttachmentTaskId(e.target.value)}
                style={inputStyle}
              >
                <option value="">Task seç</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Dosya">
              <input
                type="file"
                onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                style={inputStyle}
              />
            </Field>

            <Button
              onClick={handleUploadAttachment}
              disabled={isArchived || uploadingAttachment || !attachmentFile || !attachmentTaskId}
            >
              {uploadingAttachment ? "Yükleniyor..." : "📎 Yükle"}
            </Button>
          </div>

          {attachments.length === 0 ? (
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
              Henüz dosya eklenmemiş.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {attachments.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    alignItems: "center",
                    border: `1px solid ${C.borderSoft}`,
                    borderRadius: 12,
                    padding: 12,
                    background: C.cardSoft,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: C.text }}>
                        📎 {a.original_name}
                      </span>

                      {(() => {
                        const type = getFileTypeLabel(a.original_name, a.mime_type);
                        const style = getFileTypeStyle(type);

                        return (
                          <span
                            style={{
                              background: style.bg,
                              color: style.color,
                              padding: "3px 8px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 800,
                            }}
                          >
                            {type}
                          </span>
                        );
                      })()}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                      Task: <b>{a.task_title || "Bağlantı yok"}</b> ·{" "}
                      {formatFileSize(a.size_bytes)} ·{" "}
                      {a.uploaded_by_name || a.uploaded_by_email || "—"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => openAttachment(a.id)}
                    >
                      Görüntüle
                    </Button>

                    <Button
                      variant="soft"
                      type="button"
                      onClick={() => downloadAttachmentFile(a.id, a.original_name)}
                    >
                      İndir
                    </Button>

                    <Button
                      variant="danger"
                      type="button"
                      onClick={() => handleDeleteAttachment(a.id)}
                    >
                      Sil
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padding={20}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                Kodlar
              </h3>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
                Kod teslimlerini tasklarla ilişkilendirerek saklayabilirsin.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr) auto",
              gap: 10,
              alignItems: "end",
              marginBottom: 16,
            }}
          >
            <Field label="Bağlı Task">
              <select
                value={codeTaskId}
                onChange={async (e) => {
                  setCodeTaskId(e.target.value);

                  if (e.target.value) {
                    await loadCodeSubmissions(e.target.value);
                  }
                }}
                style={inputStyle}
              >
                <option value="">Task seç</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Kod Dosyası">
              <input
                type="file"
                accept=".js,.jsx,.ts,.tsx,.css,.html,.json"
                onChange={(e) => setProjectCodeFile(e.target.files?.[0] || null)}
                style={inputStyle}
              />
            </Field>

            <Button
              onClick={handleUploadProjectCodeSubmission}
              disabled={
                isArchived ||
                uploadingProjectCode ||
                !projectCodeFile ||
                !codeTaskId
              }
            >
              {uploadingProjectCode ? "Yükleniyor..." : "💻 Kodu Yükle"}
            </Button>
          </div>

          <Field label="Kısa açıklama">
            <textarea
              value={projectCodeDescription}
              onChange={(e) => setProjectCodeDescription(e.target.value)}
              placeholder="Örn: Login API düzenlendi, validasyon eklendi."
              style={{
                ...inputStyle,
                minHeight: 70,
                resize: "vertical",
                marginBottom: 16,
              }}
            />
          </Field>

          {allCodeSubmissions.length === 0 ? (
            <div
              style={{
                border: `1px dashed ${C.border}`,
                borderRadius: 12,
                padding: 20,
                textAlign: "center",
                color: C.textMuted,
                fontSize: 13,
              }}
            >
              Henüz kod teslimi yok.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {allCodeSubmissions.map((s) => {
                const ext =
                  String(s.file_name || "").split(".").pop()?.toUpperCase() || "CODE";

                return (
                  <div
                    key={s.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "center",
                      border: `1px solid ${C.borderSoft}`,
                      borderRadius: 12,
                      padding: 12,
                      background: C.cardSoft,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ fontWeight: 800, fontSize: 13, color: C.text }}>
                          💻 {s.file_name}
                        </span>

                        <span
                          style={{
                            background: C.primarySoft,
                            color: C.primary,
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          {ext}
                        </span>

                        <span
                          style={{
                            background: C.successSoft,
                            color: C.success,
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          v{s.version_no || 1}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: C.textMuted,
                          marginTop: 4,
                        }}
                      >
                        Task: <b>{s.task_title || "Bağlı task yok"}</b> ·{" "}
                        {s.uploaded_by_name || s.uploaded_by_email || "—"} ·{" "}
                        {s.created_at
                          ? new Date(s.created_at).toLocaleString("tr-TR")
                          : "—"}
                      </div>

                      {s.description && (
                        <div
                          style={{
                            fontSize: 12,
                            color: C.textSoft,
                            marginTop: 6,
                          }}
                        >
                          {s.description}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() =>
                          setExpandedCodeSubmissionId(
                            expandedCodeSubmissionId === s.id ? null : s.id
                          )
                        }
                      >
                        {expandedCodeSubmissionId === s.id ? "Gizle" : "Görüntüle"}
                        
                      </Button>

                      <Button
                        variant="soft"
                        type="button"
                        onClick={() => downloadCodeSubmission(s)}
                      >
                        İndir
                      </Button>

                      {(myRole === "LEADER" ||
                        String(s.assigned_to) === String(myUserId) ||
                        String(s.uploaded_by) === String(myUserId)) && (
                        <Button
                          variant="danger"
                          type="button"
                          onClick={() => handleDeleteCodeSubmission(s.id)}
                        >
                          Sil
                        </Button>
                      )}

                      
                    </div>

                    {expandedCodeSubmissionId === s.id && (
                          <div
                            style={{
                              marginTop: 12,
                              border: `1px solid ${C.borderSoft}`,
                              borderRadius: 12,
                              overflow: "hidden",
                            }}
                          >
                            <SyntaxHighlighter
                              language={
                                String(s.file_name || "").endsWith(".jsx")
                                  ? "jsx"
                                  : String(s.file_name || "").endsWith(".tsx")
                                  ? "tsx"
                                  : String(s.file_name || "").endsWith(".ts")
                                  ? "typescript"
                                  : String(s.file_name || "").endsWith(".css")
                                  ? "css"
                                  : String(s.file_name || "").endsWith(".html")
                                  ? "html"
                                  : String(s.file_name || "").endsWith(".json")
                                  ? "json"
                                  : "javascript"
                              }
                              style={oneDark}
                              customStyle={{
                                margin: 0,
                                padding: 14,
                                maxHeight: 400,
                                overflow: "auto",
                                fontSize: 12,
                                lineHeight: 1.55,
                              }}
                              wrapLongLines
                            >
                              {s.code_content || ""}
                            </SyntaxHighlighter>
                          </div>
                        )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div
          onClick={closeEditModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1100px, 100%)",
              maxHeight: "92vh",
              overflowY: "auto",
              background: C.card,
              borderRadius: 18,
              border: `1px solid ${C.border}`,
              boxShadow: "0 30px 80px rgba(15,23,42,0.25)",
            }}
          >
            {/* HEADER */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: C.header,
                backdropFilter: "blur(8px)",
                padding: "16px 20px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <StatusPill status={editStatus} />
                  <PriorityPill priority={editPriority} />
                </div>

                <h3
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: -0.3,
                  }}
                >
                  {editTitle || selectedTask?.title || "Task Düzenle"}
                </h3>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: C.textMuted,
                  }}
                >
                  Görev detaylarını görüntüleyebilir ve düzenleyebilirsiniz.
                </div>
              </div>

              <button
                onClick={closeEditModal}
                style={{
                  border: `1px solid ${C.border}`,
                  background: C.card,
                  borderRadius: 10,
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: 14,
                  color: C.textSoft,
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: 20, display: "grid", gap: 14 }}>
              {editError && (
                <div
                  style={{
                    background: C.dangerSoft,
                    color: C.danger,
                    border: `1px solid ${C.danger}`,
                    padding: "10px 14px",
                    borderRadius: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "pre-line",
                  }}
                >
                  {editError}
                </div>
              )}

              {/* 1. Bilgiler */}
              <Section
                title="Task Bilgileri"
                icon="1"
                open={openEditSections.info}
                onToggle={() => toggleEditSection("info")}
              >
                <div style={{ display: "grid", gap: 12 }}>
                  <Field label="Başlık">
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Açıklama">
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                    />
                  </Field>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Durum">
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={inputStyle}>
                        <option value="TODO">Yapılacak</option>
                        <option value="IN_PROGRESS">Devam Ediyor</option>
                        <option value="DONE">Tamamlandı</option>
                      </select>
                    </Field>
                    <Field label="Öncelik">
                      <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)} style={inputStyle}>
                        <option value="LOW">Düşük</option>
                        <option value="MEDIUM">Orta</option>
                        <option value="HIGH">Yüksek</option>
                      </select>
                    </Field>
                  </div>
                </div>
              </Section>

              {/* AI Alt Görevler */}
{Array.isArray(selectedTask?.subtasks) &&
  selectedTask.subtasks.length > 0 && (
    <Section
      title="AI Alt Görevler"
      icon="🧩"
      open={openEditSections.aiSubtasks}
      onToggle={() => toggleEditSection("aiSubtasks")}
    >
      <div style={{ display: "grid", gap: 10 }}>
        {selectedTask.subtasks.map((sub, idx) => (
          <div
            key={idx}
            style={{
              padding: 12,
              border: `1px solid ${C.borderSoft}`,
              borderRadius: 12,
              background: C.cardSoft,
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: 13,
                color: C.text,
                marginBottom: 4,
              }}
            >
              {idx + 1}. {sub.title}
            </div>

            {sub.description && (
              <div
                style={{
                  fontSize: 12,
                  color: C.textSoft,
                  lineHeight: 1.5,
                }}
              >
                {sub.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
)}

{/* AI Başarı Kriterleri */}
{Array.isArray(selectedTask?.acceptance_criteria) &&
  selectedTask.acceptance_criteria.length > 0 && (
    <Section
      title="AI Başarı Kriterleri"
      icon="✅"
      open={openEditSections.aiCriteria}
      onToggle={() => toggleEditSection("aiCriteria")}
    >
      <div style={{ display: "grid", gap: 8 }}>
        {selectedTask.acceptance_criteria.map((item, idx) => (
          <div
            key={idx}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: C.successSoft,
              border: `1px solid ${C.borderSoft}`,
              fontSize: 13,
              color: C.text,
            }}
          >
            ✓ {item}
          </div>
        ))}
      </div>
    </Section>
)}

              {/* 2. Atama */}
              {myRole === "LEADER" && (
                <Section
                  title="Atama"
                  icon="2"
                  open={openEditSections.assign}
                  onToggle={() => toggleEditSection("assign")}
                >
                  <div style={{ display: "grid", gap: 8 }}>
                    {members.map((m) => {
                      const checked = editAssigneeIds.map(String).includes(String(m.id));
                      return (
                        <label
                          key={m.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            border: `1px solid ${checked ? C.primary : C.border}`,
                            borderRadius: 10,
                            background: checked ? C.primarySoft : C.cardSoft,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => setEditAssigneeIds((p) => toggleId(p, m.id))}
                            style={{ accentColor: C.primary }}
                          />
                          <Avatar name={m.full_name || m.email} size={28} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{m.full_name || m.email}</div>
                            <div style={{ fontSize: 11, color: C.textMuted }}>{m.role}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* 3. Planlama */}
              <Section
                title="Planlama"
                icon="3"
                open={openEditSections.planning}
                onToggle={() => toggleEditSection("planning")}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Başlangıç tarihi">
                    <input type="date" value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)} style={inputStyle} />
                  </Field>
                  <Field label="Bitiş tarihi">
                    <input type="date" value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)} style={inputStyle} />
                  </Field>
                </div>
              </Section>

              {/* 4. Maliyet */}
              <Section
                title="Maliyet"
                icon="4"
                open={openEditSections.cost}
                onToggle={() => toggleEditSection("cost")}
              >
                <div style={{ display: "grid", gap: 12 }}>
                  <Field label="Tahmini maliyet (₺)">
                    <input type="number" value={editEstimatedCost}
                      onChange={(e) => setEditEstimatedCost(e.target.value)} style={inputStyle} />
                  </Field>
                  <Field
                    label="Gerçek maliyet (₺)"
                    hint={editStatus !== "DONE" ? "Yalnızca task tamamlandığında girilebilir." : undefined}
                  >
                    <input
                      type="number"
                      value={editActualCost}
                      onChange={(e) => setEditActualCost(e.target.value)}
                      disabled={editStatus !== "DONE"}
                      placeholder={editStatus !== "DONE" ? "Task tamamlanınca aktif" : "Gerçek maliyet"}
                      style={{
                        ...inputStyle,background: editStatus !== "DONE" ? C.borderSoft : C.card,
                        
                        cursor: editStatus !== "DONE" ? "not-allowed" : "text",
                      }}
                    />
                  </Field>
                  <Field label="Maliyet açıklaması">
                    <textarea
                      value={editCostNote}
                      onChange={(e) => setEditCostNote(e.target.value)}
                      style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                    />
                  </Field>
                </div>
              </Section>

              {/* 5. Bağlı tasklar */}
              <Section
                title="Bağlı Olduğu Tasklar"
                icon="5"
                open={openEditSections.dependency}
                onToggle={() => toggleEditSection("dependency")}
              >
                <div style={{ display: "grid", gap: 8, maxHeight: 200, overflow: "auto" }}>
                  {tasks
                    .filter((t) => String(t.id) !== String(selectedTask?.id))
                    .map((t) => {
                      const checked = editDependencyIds.includes(String(t.id));
                      return (
                        <label
                          key={t.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 12px",
                            border: `1px solid ${checked ? C.primary : C.border}`,
                            borderRadius: 10,
                            background: checked ? C.primarySoft : C.card,
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setEditDependencyIds((p) =>
                                p.includes(String(t.id))
                                  ? p.filter((x) => x !== String(t.id))
                                  : [...p, String(t.id)]
                              )
                            }
                            style={{ accentColor: C.primary }}
                          />
                          <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{t.title}</span>
                          <StatusPill status={t.status} />
                        </label>
                      );
                    })}
                </div>
              </Section>

              {/* 6. Kod Teslimleri */}
              <Section
                title="Kod Teslimleri"
                icon="6"
                open={openEditSections.code}
                onToggle={() => toggleEditSection("code")}
              >
                <div style={{ display: "grid", gap: 14 }}>
                  <div
                    style={{
                      border: `1px solid ${C.borderSoft}`,
                      borderRadius: 14,
                      padding: 14,
                      background: C.cardSoft,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <Field label="Kod dosyası yükle">
                      <input
                        type="file"
                        accept=".js,.jsx,.ts,.tsx,.css,.html,.json"
                        onChange={(e) => setCodeFile(e.target.files?.[0] || null)}
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="Kısa açıklama">
                      <textarea
                        value={codeDescription}
                        onChange={(e) => setCodeDescription(e.target.value)}
                        placeholder="Örn: HomePage tasarımı düzenlendi, dark mode uyumu eklendi."
                        style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                      />
                    </Field>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button
                        type="button"
                        onClick={handleUploadCodeSubmission}
                        disabled={isArchived || uploadingCode || !codeFile}
                      >
                        {uploadingCode ? "Yükleniyor..." : "💻 Kodu Yükle"}
                      </Button>
                    </div>
                  </div>

                  {codeSubmissions.length === 0 ? (
                    <div
                      style={{
                        border: `1px dashed ${C.border}`,
                        borderRadius: 12,
                        padding: 20,
                        textAlign: "center",
                        color: C.textMuted,
                        fontSize: 13,
                      }}
                    >
                      Bu task için henüz kod teslimi yok.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {codeSubmissions.map((s) => {
                        const activeCodeTab =
                          codeTabs?.[s.id] ||
                          (s.ai_summary ? "summary" : s.ai_commit_summary ? "commit" : "code");

                        const setActiveCodeTab = (tab) => {
                          setCodeTabs((prev) => ({
                            ...prev,
                            [s.id]: tab,
                          }));
                        };

                        const codeLanguage = String(s.file_name || "").endsWith(".jsx")
                          ? "jsx"
                          : String(s.file_name || "").endsWith(".tsx")
                          ? "tsx"
                          : String(s.file_name || "").endsWith(".ts")
                          ? "typescript"
                          : String(s.file_name || "").endsWith(".css")
                          ? "css"
                          : String(s.file_name || "").endsWith(".html")
                          ? "html"
                          : String(s.file_name || "").endsWith(".json")
                          ? "json"
                          : "javascript";

                        return (
                          <div
                            key={s.id}
                            style={{
                              border: `1px solid ${C.borderSoft}`,
                              borderRadius: 14,
                              background: C.cardSoft,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                padding: 12,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 10,
                                flexWrap: "wrap",
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontWeight: 900,
                                    fontSize: 13,
                                    color: C.text,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <span>💻 {s.file_name}</span>

                                  <span
                                    style={{
                                      background: C.primarySoft,
                                      color: C.primary,
                                      padding: "3px 8px",
                                      borderRadius: 999,
                                      fontSize: 10,
                                      fontWeight: 900,
                                    }}
                                  >
                                    {s.file_type || "CODE"}
                                  </span>

                                  <span
                                    style={{
                                      background: C.successSoft,
                                      color: C.success,
                                      padding: "3px 8px",
                                      borderRadius: 999,
                                      fontSize: 10,
                                      fontWeight: 900,
                                    }}
                                  >
                                    v{s.version_no || 1}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    fontSize: 11,
                                    color: C.textMuted,
                                    marginTop: 4,
                                  }}
                                >
                                  {s.uploaded_by_name || s.uploaded_by_email || "—"} ·{" "}
                                  {new Date(s.created_at).toLocaleString("tr-TR")}
                                </div>

                                {s.description && (
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: C.textSoft,
                                      marginTop: 6,
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {s.description}
                                  </div>
                                )}
                              </div>

                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <Button
                                  variant="soft"
                                  type="button"
                                  onClick={() => copyCodeToClipboard(s.code_content)}
                                >
                                  Kopyala
                                </Button>

                                <Button
                                  variant="soft"
                                  type="button"
                                  onClick={() => downloadCodeSubmission(s)}
                                >
                                  İndir
                                </Button>

                                <Button
                                  variant="soft"
                                  type="button"
                                  onClick={() => handleSummarizeCodeSubmission(s.id)}
                                  disabled={summarizingCodeId === s.id}
                                >
                                  {summarizingCodeId === s.id ? "Özetleniyor..." : "AI Özetle"}
                                </Button>

                                <Button
                                  variant="soft"
                                  type="button"
                                  onClick={() => handleGenerateCommitSummary(s.id)}
                                  disabled={generatingCommitId === s.id}
                                >
                                  {generatingCommitId === s.id
                                    ? "Oluşturuluyor..."
                                    : "Commit Özeti"}
                                </Button>

                                <Button
                                  variant="danger"
                                  type="button"
                                  onClick={() => handleDeleteCodeSubmission(s.id)}
                                >
                                  Sil
                                </Button>
                              </div>
                            </div>

                            <div
                              style={{
                                padding: "0 12px 12px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  flexWrap: "wrap",
                                  marginBottom: 10,
                                  borderTop: `1px solid ${C.borderSoft}`,
                                  paddingTop: 12,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => setActiveCodeTab("summary")}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: 999,
                                    border: `1px solid ${
                                      activeCodeTab === "summary" ? C.primary : C.borderSoft
                                    }`,
                                    background:
                                      activeCodeTab === "summary" ? C.primarySoft : C.card,
                                    color:
                                      activeCodeTab === "summary" ? C.primary : C.textMuted,
                                    fontSize: 12,
                                    fontWeight: 900,
                                    cursor: "pointer",
                                  }}
                                >
                                  ✨ AI Kod Özeti
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setActiveCodeTab("commit")}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: 999,
                                    border: `1px solid ${
                                      activeCodeTab === "commit" ? C.primary : C.borderSoft
                                    }`,
                                    background:
                                      activeCodeTab === "commit" ? C.primarySoft : C.card,
                                    color:
                                      activeCodeTab === "commit" ? C.primary : C.textMuted,
                                    fontSize: 12,
                                    fontWeight: 900,
                                    cursor: "pointer",
                                  }}
                                >
                                  🚀 Commit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setActiveCodeTab("code")}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: 999,
                                    border: `1px solid ${
                                      activeCodeTab === "code" ? C.primary : C.borderSoft
                                    }`,
                                    background:
                                      activeCodeTab === "code" ? C.primarySoft : C.card,
                                    color: activeCodeTab === "code" ? C.primary : C.textMuted,
                                    fontSize: 12,
                                    fontWeight: 900,
                                    cursor: "pointer",
                                  }}
                                >
                                  💻 Kod
                                </button>
                              </div>

                              {activeCodeTab === "summary" && (
                                <div
                                  style={{
                                    padding: "12px 14px",
                                    borderRadius: 12,
                                    background: C.primarySoft,
                                    border: `1px solid ${C.borderSoft}`,
                                    color: C.text,
                                    fontSize: 12.5,
                                    lineHeight: 1.6,
                                    whiteSpace: "pre-line",
                                    minHeight: 90,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: 900,
                                      color: C.primary,
                                      marginBottom: 6,
                                    }}
                                  >
                                    ✨ AI Kod Özeti
                                  </div>

                                  {s.ai_summary || "Bu kod için henüz AI özeti oluşturulmadı."}
                                </div>
                              )}

                              {activeCodeTab === "commit" && (
                                <div
                                  style={{
                                    padding: "12px 14px",
                                    borderRadius: 12,
                                    background: C.card,
                                    border: `1px solid ${C.borderSoft}`,
                                    color: C.text,
                                    fontSize: 12.5,
                                    lineHeight: 1.6,
                                    whiteSpace: "pre-line",
                                    minHeight: 90,
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight: 900,
                                      marginBottom: 6,
                                    }}
                                  >
                                    🚀 AI Commit Özeti
                                  </div>

                                  {s.ai_commit_summary ||
                                    "Bu kod için henüz commit özeti oluşturulmadı."}
                                </div>
                              )}

                              {activeCodeTab === "code" && (
                                <SyntaxHighlighter
                                  language={codeLanguage}
                                  style={oneDark}
                                  customStyle={{
                                    margin: 0,
                                    padding: 14,
                                    maxHeight: 360,
                                    overflow: "auto",
                                    fontSize: 12,
                                    lineHeight: 1.55,
                                    border: `1px solid ${C.border}`,
                                    borderRadius: 12,
                                  }}
                                  wrapLongLines
                                >
                                  {s.code_content || ""}
                                </SyntaxHighlighter>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Section>

              {/*7. bağlı dosyalar */}
              <Section
                title="Bağlı Dosyalar"
                icon="7"
                open={openEditSections.files}
                onToggle={() => toggleEditSection("files")}
              >
                <div style={{ display: "grid", gap: 14 }}>
                  <div
                    style={{
                      border: `1px solid ${C.borderSoft}`,
                      borderRadius: 14,
                      padding: 14,
                      background: C.cardSoft,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <Field label="Bu taska dosya yükle">
                      <input
                        type="file"
                        onChange={(e) => setModalAttachmentFile(e.target.files?.[0] || null)}
                        style={inputStyle}
                      />
                    </Field>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button
                        type="button"
                        onClick={handleUploadModalAttachment}
                        disabled={
                          isArchived ||
                          uploadingModalAttachment ||
                          !modalAttachmentFile ||
                          !selectedTask?.id
                        }
                      >
                        {uploadingModalAttachment ? "Yükleniyor..." : "📎 Dosya Yükle"}
                      </Button>
                    </div>
                  </div>

                  {selectedTask && getTaskAttachments(selectedTask.id).length > 0 ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {getTaskAttachments(selectedTask.id).map((a) => (
                        <div
                          key={a.id}
                          style={{
                            border: `1px solid ${C.borderSoft}`,
                            borderRadius: 12,
                            padding: 12,
                            background: C.cardSoft,
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <span style={{ fontWeight: 800, fontSize: 13, color: C.text }}>
                                📎 {a.original_name}
                              </span>

                              {(() => {
                                const type = getFileTypeLabel(a.original_name, a.mime_type);
                                const style = getFileTypeStyle(type);

                                return (
                                  <span
                                    style={{
                                      background: style.bg,
                                      color: style.color,
                                      padding: "3px 8px",
                                      borderRadius: 999,
                                      fontSize: 10,
                                      fontWeight: 800,
                                    }}
                                  >
                                    {type}
                                  </span>
                                );
                              })()}
                            </div>

                            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                              {formatFileSize(a.size_bytes)} ·{" "}
                              {a.uploaded_by_name || a.uploaded_by_email || "—"}
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Button
                              variant="ghost"
                              type="button"
                              onClick={() => openAttachment(a.id)}
                            >
                              Görüntüle
                            </Button>

                            <Button
                              variant="soft"
                              type="button"
                              onClick={() => downloadAttachmentFile(a.id, a.original_name)}
                            >
                              İndir
                            </Button>

                            <Button
                              variant="danger"
                              type="button"
                              onClick={() => handleDeleteAttachment(a.id)}
                            >
                              Sil
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        border: `1px dashed ${C.border}`,
                        borderRadius: 12,
                        padding: 20,
                        textAlign: "center",
                        color: C.textMuted,
                        fontSize: 13,
                      }}
                    >
                      Bu taska bağlı dosya yok.
                    </div>
                  )}
                </div>
              </Section>

              {/* 8. Aktiviteler */}
              <Section
                title="Aktiviteler"
                icon="8"
                open={openEditSections.activity}
                onToggle={() => toggleEditSection("activity")}
              >
                {taskLogsLoading ? (
                  <div style={{ fontSize: 13, color: C.textMuted }}>Yükleniyor…</div>
                ) : taskLogs.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.textMuted }}>Bu task için aktivite yok.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10, maxHeight: 280, overflow: "auto" }}>
                    {taskLogs.map((l) => {
                      const isComment =
                        l.action === "COMMENT_ADDED" || l.action === "COMMENT_UPDATED";
                      return (
                        <div
                          key={l.id}
                          style={{
                            border: `1px solid ${C.borderSoft}`,
                            borderRadius: 12,
                            padding: 12,
                            background: C.cardSoft,
                          }}
                        >
                          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <Avatar name={l.actor_name || "?"} size={28} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                                {l.action === "COMMENT_ADDED"
                                  ? `${l.actor_name || "Bir kullanıcı"} yorum yaptı`
                                  : l.action === "COMMENT_UPDATED"
                                  ? `${l.actor_name || "Bir kullanıcı"} yorumu düzenledi`
                                  : l.message}
                              </div>
                              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                                {l.actor_name || l.actor_email || "—"} ·{" "}
                                {new Date(l.created_at).toLocaleString("tr-TR")}
                              </div>
                              {isComment && l.meta?.comment_body && (
                                <div
                                  style={{
                                    marginTop: 10,
                                    padding: "10px 12px",
                                    background: C.card,
                                    border: `1px solid ${C.borderSoft}`,
                                    borderLeft: `3px solid ${l.action === "COMMENT_UPDATED" ? C.warn : C.purple}`,
                                    borderRadius: 10,
                                    fontSize: 13,
                                    color: C.text,
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {l.meta.comment_body}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>

              {/* 9. Yorumlar */}
              <Section
                title="Yorumlar"
                icon="9"
                open={openEditSections.comments}
                onToggle={() => toggleEditSection("comments")}
              >
                <TaskComments
                  projectId={id}
                  taskId={selectedTask?.id}
                  myRole={myRole}
                  onCommentsChanged={() => loadTaskLogs(selectedTask?.id)}
                />
              </Section>
            </div>

            {/* FOOTER */}
            <div
              style={{
                position: "sticky",
                bottom: 0,
                background: C.header,
                backdropFilter: "blur(8px)",
                padding: "14px 20px",
                borderTop: `1px solid ${C.border}`,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <Button variant="ghost" onClick={closeEditModal} disabled={saving}>
                İptal
              </Button>
              <Button onClick={saveTaskEdit} disabled={saving || !editTitle.trim()}>
                {saving ? "Kaydediliyor…" : "💾 Kaydet"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkloadAnalysisCard({ data, loading }) {
  const levelStyle = {
    LOW: { bg: C.successSoft, color: C.success, text: "Rahat" },
    NORMAL: { bg: C.infoSoft, color: C.info, text: "Dengeli" },
    HIGH: { bg: C.warnSoft, color: C.warn, text: "Yoğun" },
    OVERLOAD: { bg: C.dangerSoft, color: C.danger, text: "Aşırı Yüklü" },
  };

  if (loading) {
    return (
      <Card padding={20}>
        <div style={{ color: C.textMuted, fontSize: 13 }}>
          İş yükü analizi yükleniyor...
        </div>
      </Card>
    );
  }

  if (!data || !Array.isArray(data.analysis)) return null;

  const list = data.analysis;

  return (
    <Card padding={20}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
            👥 Ekip İş Yükü Analizi
          </h3>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
            {data.is_leader
              ? "Aktif sprintte ekip üyelerinin görev yoğunluğunu gösterir."
              : "Aktif sprintte yalnızca kendi iş yükünü gösterir."}
          </div>
        </div>

        {data.summary?.has_overload && (
          <span
            style={{
              background: C.dangerSoft,
              color: C.danger,
              padding: "7px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            ⚠️ Overload kullanıcı var
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <div
          style={{
            border: `1px dashed ${C.border}`,
            borderRadius: 14,
            padding: 24,
            color: C.textMuted,
            fontSize: 13,
            textAlign: "center",
          }}
        >
          Aktif sprintte analiz edilecek görev bulunamadı.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {list.map((u) => {
            const style = levelStyle[u.workload_level] || levelStyle.NORMAL;
            const open = Number(u.open_tasks || 0);
            const done = Number(u.done_tasks || 0);
            const total = Number(u.total_tasks || 0);
            const percent = total === 0 ? 0 : Math.round((done / total) * 100);

            return (
              <div
                key={u.user_id}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 16,
                  padding: 16,
                  background: C.card,
                  boxShadow: C.shadow,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar name={u.full_name || u.email} size={34} />

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 14,
                        color: C.text,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {u.full_name || u.email}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                      {u.role === "LEADER" ? "Lider" : "Üye"}
                    </div>
                  </div>

                  <span
                    style={{
                      background: style.bg,
                      color: style.color,
                      padding: "5px 9px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {style.text}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 8,
                  }}
                >
                  <MiniWorkloadStat label="Aktif Görev" value={open} />
                  <MiniWorkloadStat label="Tamamlanan" value={done} />
                  <MiniWorkloadStat label="Geciken Görev" value={u.overdue_tasks} />
                  <MiniWorkloadStat label="Kritik Görev" value={u.high_priority_open_tasks} />
                </div>

                <div style={{ marginTop: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: C.textMuted,
                      marginBottom: 6,
                    }}
                  >
                    <span>Tamamlanma</span>
                    <b style={{ color: C.text }}>%{percent}</b>
                  </div>

                  <div
                    style={{
                      height: 8,
                      background: C.borderSoft,
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${percent}%`,
                        height: "100%",
                        background:
                          u.workload_level === "OVERLOAD"
                            ? C.danger
                            : u.workload_level === "HIGH"
                            ? C.warn
                            : C.success,
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    fontSize: 12,
                    color: C.textSoft,
                    lineHeight: 1.5,
                  }}
                >
                  {u.workload_message}
                </div>

                {data.is_leader && u.workload_level === "OVERLOAD" && (
                  <div
                    style={{
                      marginTop: 12,
                      background: C.cardSoft,
                      border: `1px solid ${C.border}`,
                      borderRadius: 14,
                      padding: "11px 12px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: C.danger,
                        marginBottom: 7,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      ⚠️ AI Lider Önerisi
                    </div>

                    <div
                      style={{
                        fontSize: 11.5,
                        color: C.textSoft,
                        lineHeight: 1.6,
                      }}
                    >
                      <b style={{ color: C.text }}>{u.full_name}</b>{" "}
                      üzerinde yüksek görev yoğunluğu tespit edildi.
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: C.card,
                        border: `1px solid ${C.borderSoft}`,
                        fontSize: 11.5,
                        color: C.text,
                        lineHeight: 1.55,
                      }}
                    >
                      {u.transfer_suggestion?.available ? (
                        <>
                          <span style={{ fontWeight: 800 }}>
                            → “{u.transfer_suggestion.task_title}”
                          </span>{" "}
                          görevi{" "}
                          <b>{u.transfer_suggestion.from_user_name}</b> kullanıcısından{" "}
                          <b>{u.transfer_suggestion.to_user_name}</b> kullanıcısına aktarılabilir.
                        </>
                      ) : (
                        u.transfer_suggestion?.message ||
                        "Aktarılabilecek uygun görev bulunamadı."
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        color: C.textMuted,
                      }}
                    >
                      Analiz nedeni:{" "}
                      {u.overdue_tasks > 0
                        ? "Geciken görevler mevcut."
                        : u.high_priority_open_tasks > 1
                        ? "Birden fazla kritik görev bulunuyor."
                        : "Aktif görev sayısı yüksek."}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function MiniWorkloadStat({ label, value }) {
  return (
    <div
      style={{
        border: `1px solid ${C.borderSoft}`,
        borderRadius: 12,
        padding: "9px 8px",
        background: C.cardSoft,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 900, color: C.text }}>
        {value || 0}
      </div>
      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

function DependencyGraphCard({ graph, visibleTasks = [], onOpenTask }) {
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [expandedCategories, setExpandedCategories] = useState({});

  const visibleIds = new Set(visibleTasks.map((t) => String(t.id)));
  const visibleTaskById = new Map(visibleTasks.map((t) => [String(t.id), t]));

  const graphTasks = (Array.isArray(graph?.tasks) ? graph.tasks : [])
    .filter((t) => visibleIds.has(String(t.id)))
    .map((t) => ({
      ...t,
      ...(visibleTaskById.get(String(t.id)) || {}),
    }));

  const edges = (Array.isArray(graph?.edges) ? graph.edges : []).filter(
    (e) =>
      visibleIds.has(String(e.from_task_id)) &&
      visibleIds.has(String(e.to_task_id))
  );

  const taskById = new Map(graphTasks.map((t) => [String(t.id), t]));

  const getCategory = (task) => {
    const raw =
      task.category ||
      task.task_category ||
      task.task_type ||
      task.type ||
      task.module ||
      "";

    if (raw && raw !== "Genel") return raw;

    const title = String(task.title || "").toLowerCase();

    if (
      title.includes("test") ||
      title.includes("senaryo") ||
      title.includes("doğrulama")
    )
      return "Test";

    if (
      title.includes("api") ||
      title.includes("endpoint") ||
      title.includes("backend") ||
      title.includes("sunucu")
    )
      return "Backend";

    if (
      title.includes("tablo") ||
      title.includes("veri") ||
      title.includes("şema") ||
      title.includes("ilişkilendirme") ||
      title.includes("database") ||
      title.includes("veritaban")
    )
      return "Database";

    if (
      title.includes("arayüz") ||
      title.includes("sayfa") ||
      title.includes("listeleme") ||
      title.includes("görüntüleme") ||
      title.includes("frontend")
    )
      return "Frontend";

    if (
      title.includes("analiz") ||
      title.includes("mimari") ||
      title.includes("rol") ||
      title.includes("yetkilendirme") ||
      title.includes("gereksinim")
    )
      return "Analiz";

    return "Genel";
  };
  const statusColor = (status) => {
    if (status === "DONE") return C.success;
    if (status === "IN_PROGRESS") return C.warn;
    if (status === "REVIEW") return "#38bdf8";
    return C.textMuted;
  };

  const getAssigneeNames = (task) => {
    if (Array.isArray(task.assignees) && task.assignees.length > 0) {
      return task.assignees
        .map((u) => u.full_name || u.name || u.email)
        .filter(Boolean);
    }

    if (task.assignee_name) return [task.assignee_name];
    if (task.assigned_to_name) return [task.assigned_to_name];
    if (task.full_name) return [task.full_name];

    return [];
  };

  const dependencyCount = (taskId) => {
    const id = String(taskId);
    return edges.filter(
      (e) => String(e.from_task_id) === id || String(e.to_task_id) === id
    ).length;
  };

  const categories = Array.from(
    new Set(graphTasks.map((t) => getCategory(t)))
  );

  const filteredTasks = graphTasks.filter((task) => {
    const statusOk = statusFilter === "ALL" || task.status === statusFilter;
    const categoryOk =
      categoryFilter === "ALL" || getCategory(task) === categoryFilter;

    return statusOk && categoryOk;
  });

  const groupedTasks = categories
    .filter((cat) => categoryFilter === "ALL" || cat === categoryFilter)
    .map((cat) => ({
      name: cat,
      tasks: filteredTasks.filter((t) => getCategory(t) === cat),
    }))
    .filter((g) => g.tasks.length > 0);

  const selectedTask = selectedTaskId ? taskById.get(String(selectedTaskId)) : null;

  const incomingEdges = selectedTask
    ? edges.filter((e) => String(e.to_task_id) === String(selectedTask.id))
    : [];

  const outgoingEdges = selectedTask
    ? edges.filter((e) => String(e.from_task_id) === String(selectedTask.id))
    : [];

  const previousTasks = incomingEdges
    .map((e) => taskById.get(String(e.from_task_id)))
    .filter(Boolean);

  const nextTasks = outgoingEdges
    .map((e) => taskById.get(String(e.to_task_id)))
    .filter(Boolean);

  const focusIds = new Set([
    ...(selectedTask ? [String(selectedTask.id)] : []),
    ...previousTasks.map((t) => String(t.id)),
    ...nextTasks.map((t) => String(t.id)),
  ]);

  const renderOwner = (task, maxWidth = 130) => {
    const names = getAssigneeNames(task);

    if (names.length === 0) {
      return (
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
          👤 Atanmamış
        </div>
      );
    }

    return (
      <div style={{ marginTop: 9, display: "grid", gap: 5 }}>
        {names.slice(0, 2).map((name, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              color: C.textSoft,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: C.primary,
                color: "#fff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              {name.charAt(0).toUpperCase()}
            </span>

            <span
              style={{
                maxWidth,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={name}
            >
              {name}
            </span>
          </div>
        ))}

        {names.length > 2 && (
          <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700 }}>
            +{names.length - 2} kişi daha
          </div>
        )}
      </div>
    );
  };

  const renderTaskCard = (task, options = {}) => {
    const {
      small = false,
      selected = false,
      faded = false,
      showDependencyBadge = true,
    } = options;

    return (
      <button
        key={task.id}
        type="button"
        onClick={() => setSelectedTaskId(String(task.id))}
        onDoubleClick={() => onOpenTask?.(task)}
        style={{
          width: small ? 210 : "100%",
          minHeight: small ? 96 : 104,
          border: selected
            ? `1px solid ${C.warn}`
            : `1px solid ${C.border}`,
          borderLeft: `4px solid ${statusColor(task.status)}`,
          borderRadius: 16,
          background: selected
  ? "linear-gradient(135deg, #ffffff, #f8fafc)"
  : C.card,
color: C.text,
          position: "relative",
          zIndex: 5,
          padding: "13px 14px",
          textAlign: "left",
          cursor: "pointer",
          boxShadow: selected
            ? "0 0 0 3px rgba(245,158,11,0.16)"
            : C.shadow,
          opacity: faded ? 0.28 : 1,
          transition: "0.2s ease",
          position: "relative",
        }}
      >
        {showDependencyBadge && (
          <span
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              minWidth: 24,
              height: 24,
              borderRadius: 999,
              background: "rgba(139,92,246,0.22)",
              color: C.text,
              fontSize: 11,
              fontWeight: 900,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Bağımlılık sayısı"
          >
            {dependencyCount(task.id)}
          </span>
        )}

        <div
          style={{
            paddingRight: showDependencyBadge ? 34 : 0,
            fontSize: 13,
            fontWeight: 900,
            color: C.text,
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {task.title}
        </div>

        <div
          style={{
            marginTop: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 11,
            fontWeight: 900,
            color: statusColor(task.status),
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: statusColor(task.status),
            }}
          />
          {STATUS_META[task.status]?.label || task.status}
        </div>

        {renderOwner(task, small ? 120 : 150)}
      </button>
    );
  };

  const renderFocusNode = (task, type) => {
    const isMain = type === "main";

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div style={{ width: isMain ? 280 : 235 }}>
          {renderTaskCard(task, {
            small: true,
            selected: isMain,
            showDependencyBadge: false,
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
      <Card
        padding={20}
        style={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
              🔗 Task Bağımlılık Haritası
            </h3>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
              Görevler kategori bazlı gösterilir. Bir göreve tıklayınca sadece ilgili bağımlılıklar açılır.
            </div>
          </div>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12 }}>
            <Legend dot={STATUS_META.TODO.dot} text="Yapılacak" />
            <Legend dot={STATUS_META.IN_PROGRESS.dot} text="Devam Ediyor" />
            <Legend dot={STATUS_META.DONE.dot} text="Tamamlandı" />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <FilterButton
            active={statusFilter === "ALL"}
            onClick={() => setStatusFilter("ALL")}
          >
            Tüm Görevler
          </FilterButton>

          <FilterButton
            active={statusFilter === "IN_PROGRESS"}
            onClick={() => setStatusFilter("IN_PROGRESS")}
          >
            Devam Edenler
          </FilterButton>

          <FilterButton
            active={statusFilter === "DONE"}
            onClick={() => setStatusFilter("DONE")}
          >
            Tamamlananlar
          </FilterButton>

          <FilterButton
            active={statusFilter === "TODO"}
            onClick={() => setStatusFilter("TODO")}
          >
            Yapılacaklar
          </FilterButton>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              height: 38,
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: C.card,
              color: C.text,
              padding: "0 12px",
              fontSize: 13,
              fontWeight: 800,
              outline: "none",
            }}
          >
            <option value="ALL">Tüm Kategoriler</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {selectedTask && (
            <button
              type="button"
              onClick={() => setSelectedTaskId(null)}
              style={{
                height: 38,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                background: "rgba(239,68,68,0.12)",
                color: "#f87171",
                padding: "0 13px",
                fontSize: 13,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Odak Modundan Çık
            </button>
          )}
        </div>

        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            background: `radial-gradient(circle at top left, rgba(139,92,246,0.12), transparent 35%), linear-gradient(135deg, ${C.card}, ${C.cardSoft})`,
            padding: 18,
            width: "100%",
            maxWidth: "100%",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {graphTasks.length === 0 ? (
            <div style={{ color: C.textMuted, fontSize: 13 }}>
              Haritada gösterilecek task yok.
            </div>
          ) : selectedTask ? (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "280px 1fr",
                  gap: 18,
                  alignItems: "stretch",
                }}
              >
                <div
                  style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 18,
                    background: "linear-gradient(135deg, #ffffff, #f8fafc)",
boxShadow: "0 18px 40px rgba(15,23,42,0.08)",
                    padding: 16,
                    minHeight: 330,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(null)}
                    style={{
                      height: 34,
                      borderRadius: 10,
                      border: `1px solid ${C.border}`,
                      background: C.card,
                      color: C.text,
                      padding: "0 12px",
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                      marginBottom: 14,
                    }}
                  >
                    ← Tüm Görevlere Dön
                  </button>

                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>
                    {selectedTask.title}
                  </h4>

                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      fontWeight: 900,
                      color: statusColor(selectedTask.status),
                    }}
                  >
                    Durum: {STATUS_META[selectedTask.status]?.label || selectedTask.status}
                  </div>

                  {renderOwner(selectedTask, 190)}

                  <div style={{ marginTop: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        fontWeight: 900,
                        color: C.text,
                        marginBottom: 10,
                      }}
                    >
                      <span>Bağlı Olduğu Görevler</span>
                      <span>{previousTasks.length}</span>
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      {previousTasks.length === 0 ? (
                        <span style={{ fontSize: 12, color: C.textMuted }}>
                          Ön koşul görev yok.
                        </span>
                      ) : (
                        previousTasks.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTaskId(String(t.id))}
                            style={{
                              border: 0,
                              background: "transparent",
                              color: C.textSoft,
                              textAlign: "left",
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            ✓ {t.title}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        fontWeight: 900,
                        color: C.text,
                        marginBottom: 10,
                      }}
                    >
                      <span>Bu Göreve Bağlı Görevler</span>
                      <span>{nextTasks.length}</span>
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      {nextTasks.length === 0 ? (
                        <span style={{ fontSize: 12, color: C.textMuted }}>
                          Sonrasında bağlı görev yok.
                        </span>
                      ) : (
                        nextTasks.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedTaskId(String(t.id))}
                            style={{
                              border: 0,
                              background: "transparent",
                              color: C.textSoft,
                              textAlign: "left",
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            ○ {t.title}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenTask?.(selectedTask)}
                    style={{
                      width: "100%",
                      height: 42,
                      marginTop: 22,
                      borderRadius: 12,
                      border: 0,
                      background: C.primary,
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    Detayları Aç
                  </button>
                </div>

                {(() => {
  const CARD_W = 235;
  const MAIN_W = 280;
  const CARD_H = 108;
  const ROW_GAP = 22;

  const rowCount = Math.max(previousTasks.length, nextTasks.length, 1);
  const canvasH = Math.max(390, rowCount * (CARD_H + ROW_GAP) + 80);

  const leftX = 55;
  const mainX = 390;
  const rightX = 725;

  const startY = 60;
  const mainY = canvasH / 2 - CARD_H / 2;

  const getY = (index) => startY + index * (CARD_H + ROW_GAP);

  return (
    <div
      style={{
        position: "relative",
        minWidth: 980,
        height: canvasH,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: leftX,
          top: 18,
          width: CARD_W,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 900,
          color: C.textMuted,
        }}
      >
        Ön Koşullar
      </div>

      <div
        style={{
          position: "absolute",
          left: mainX,
          top: mainY - 28,
          width: MAIN_W,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 900,
          color: C.textMuted,
        }}
      >
        Seçili Görev
      </div>

      <div
        style={{
          position: "absolute",
          left: rightX,
          top: 18,
          width: CARD_W,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 900,
          color: C.textMuted,
        }}
      >
        Sonraki Görevler
      </div>

      <svg
        width="980"
        height={canvasH}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        <defs>
          <marker
            id={`focusArrow-${selectedTask.id}`}
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill={C.primary} />
          </marker>
        </defs>

        {previousTasks.map((_, index) => {
          const fromX = leftX + CARD_W - 30;
          const fromY = getY(index) + CARD_H / 2;
          const toX = mainX;
          const toY = mainY + CARD_H / 2;

          return (
            <path
              key={`prev-line-${index}`}
              d={`M ${fromX} ${fromY} C ${fromX + 70} ${fromY}, ${toX - 70} ${toY}, ${toX} ${toY}`}
              fill="none"
              stroke={C.primary}
              strokeWidth="2.5"
              markerEnd={`url(#focusArrow-${selectedTask.id})`}
              opacity="0.9"
            />
          );
        })}

        {nextTasks.map((_, index) => {
          const fromX = mainX + MAIN_W - 70;
          const fromY = mainY + CARD_H / 2;
          const toX = rightX - 8;
          const toY = getY(index) + CARD_H / 2;

          return (
            <path
              key={`next-line-${index}`}
              d={`M ${fromX} ${fromY} C ${fromX + 95} ${fromY}, ${toX - 95} ${toY}, ${toX} ${toY}`}
              fill="none"
              stroke={C.primary}
              strokeWidth="2.5"
              markerEnd={`url(#focusArrow-${selectedTask.id})`}
              opacity="0.9"
            />
          );
        })}
      </svg>

      {previousTasks.map((task, index) => (
        <div
          key={task.id}
          style={{
            position: "absolute",
            left: leftX,
            top: getY(index),
            zIndex: 2,
          }}
        >
          {renderFocusNode(task, "prev")}
        </div>
      ))}

      <div
        style={{
          position: "absolute",
          left: mainX,
          top: mainY,
          zIndex: 3,
        }}
      >
        {renderFocusNode(selectedTask, "main")}
      </div>

      {nextTasks.map((task, index) => (
        <div
          key={task.id}
          style={{
            position: "absolute",
            left: rightX,
            top: getY(index),
            zIndex: 2,
          }}
        >
          {renderFocusNode(task, "next")}
        </div>
      ))}
    </div>
  );
})()}
              </div>

              <div
                style={{
                  marginTop: 18,
                  borderTop: `1px dashed ${C.border}`,
                  paddingTop: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: C.textMuted,
                    marginBottom: 12,
                  }}
                >
                  Diğer görevler
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  {filteredTasks
                    .filter((t) => !focusIds.has(String(t.id)))
                    .slice(0, 12)
                    .map((t) => renderTaskCard(t, { faded: true }))}
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 14,
              }}
            >
              {groupedTasks.map((group) => (
                <div
                  key={group.name}
                  style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.9)",
boxShadow: "0 14px 30px rgba(15,23,42,0.06)",
                    padding: 14,
                    minHeight: 230,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <h4
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 900,
                        color: C.text,
                        textTransform: "uppercase",
                      }}
                    >
                      {group.name}
                    </h4>

                    <span
                      style={{
                        minWidth: 26,
                        height: 26,
                        borderRadius: 999,
                        background: "rgba(148,163,184,0.16)",
                        color: C.textSoft,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 900,
                      }}
                    >
                      {group.tasks.length}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: 10 }}>
                    {group.tasks
                      .slice(0, expandedCategories[group.name] ? group.tasks.length : 4)
                      .map((task) => renderTaskCard(task))}
                  </div>

                  {group.tasks.length > 4 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCategories((prev) => ({
                          ...prev,
                          [group.name]: !prev[group.name],
                        }))
                      }
                      style={{
                        marginTop: 12,
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        color: C.primary,
                        fontSize: 12,
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      {expandedCategories[group.name]
                        ? "Daha az göster"
                        : `+${group.tasks.length - 4} görev daha`}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            fontSize: 12,
            color: C.textMuted,
          }}
        >
          <span>Karttaki sayı, görevin toplam bağımlılık sayısını gösterir.</span>
          <span>Tek tık odak modu, çift tık görev detayını açar.</span>
        </div>
      </Card>
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 38,
        borderRadius: 12,
        border: active ? `1px solid ${C.primary}` : `1px solid ${C.border}`,
        background: active ? C.primary : C.card,
        color: active ? "#fff" : C.textSoft,
        padding: "0 14px",
        fontSize: 13,
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function EmptyFocusText({ text }) {
  return (
    <div
      style={{
        border: `1px dashed ${C.border}`,
        borderRadius: 14,
        padding: 16,
        textAlign: "center",
        color: C.textMuted,
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {text}
    </div>
  );
}

/* ===========================================================
 * STAT TILE
 * =========================================================== */
function StatTile({ label, value, dot }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        background: C.cardSoft,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {dot && <span style={{ width: 7, height: 7, borderRadius: 999, background: dot }} />}
        <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: -0.5 }}>
        {value}
      </div>
    </div>
  );
}

function FocusConnector() {
  return (
    <div
      style={{
        width: "100%",
        height: 22,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          flex: 1,
          height: 3,
          background: C.primary,
          borderRadius: 999,
          opacity: 0.9,
        }}
      />
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: "7px solid transparent",
          borderBottom: "7px solid transparent",
          borderLeft: `12px solid ${C.primary}`,
        }}
      />
    </div>
  );
}