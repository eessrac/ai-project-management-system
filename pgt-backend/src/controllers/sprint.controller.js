const pool = require("../config/db.js");
const {
  ensureProjectMember,
  ensureLeader,
} = require("../utils/projectAuth");
const { createNotification } = require("../utils/notification");
const { createSprintArchiveSnapshot } = require("../utils/sprintArchive");
const { askAI } = require("../services/qwen.service");

/**
 * Bu controller, sprint yönetimi işlemlerini gerçekleştirir.
 * Sprint oluşturma, güncelleme, tamamlama, arşivleme, görev taşıma
 * ve yapay zekâ destekli sprint analizlerinin oluşturulmasını sağlar.
 */

const ALLOWED_STATUS = new Set(["ACTIVE", "DONE"]);

function toISODateOnly(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  const str = String(value).trim();

  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const d = new Date(str);
  if (isNaN(d.getTime())) return null;

  return d.toISOString().slice(0, 10);
}

function addDaysISO(dateStr, days) {
  const cleanDate = toISODateOnly(dateStr);

  if (!cleanDate) {
    throw new Error(`addDaysISO: tarih parse edilemedi -> ${dateStr}`);
  }

  const d = new Date(`${cleanDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + Number(days || 0));

  return d.toISOString().slice(0, 10);
}

function normalizeText(value) {
  if (value === undefined) return undefined;
  const trimmed = String(value).trim();
  return trimmed;
}

async function notifyProjectMembers({
  projectId,
  triggeredBy,
  type,
  title,
  body = null,
  includeActor = true,
}) {
  const membersQ = await pool.query(
    `
    SELECT user_id
    FROM project_members
    WHERE project_id = $1
    `,
    [projectId]
  );

  for (const member of membersQ.rows) {
    if (
      !includeActor &&
      triggeredBy &&
      String(member.user_id) === String(triggeredBy)
    ) {
      continue;
    }

    await createNotification({
      userId: member.user_id,
      type,
      title,
      body,
      projectId,
      triggeredBy,
    });
  }
}

async function notifySprintTasksMoved({
  projectId,
  sprintName,
  movedCount,
  triggeredBy,
}) {
  if (!movedCount || movedCount <= 0) return;

  const membersQ = await pool.query(
    `
    SELECT user_id
    FROM project_members
    WHERE project_id = $1
    `,
    [projectId]
  );

  for (const member of membersQ.rows) {
    if (triggeredBy && String(member.user_id) === String(triggeredBy)) continue;

    await createNotification({
      userId: member.user_id,
      type: "SPRINT_TASKS_MOVED",
      title: `${movedCount} task yeni sprint'e geçti`,
      body: sprintName,
      projectId,
      triggeredBy,
    });
  }

    await createSprintLog({
    projectId,
    sprintId: null,
    action: "SPRINT_TASKS_MOVED",
    message: `${movedCount} task yeni sprint'e taşındı: "${sprintName}"`,
    meta: {
      sprint_name: sprintName,
      moved_count: movedCount,
    },
    actorId: triggeredBy,
  });
}

async function getSprint(projectId, sprintId) {
  const q = await pool.query(
    `SELECT
       id,
       project_id,
       name,
       start_date,
       end_date,
       status,
       created_by,
       created_at,
       updated_at
     FROM sprints
     WHERE id = $1 AND project_id = $2`,
    [sprintId, projectId]
  );

  return q.rows[0] || null;
}



async function getProjectSprintDuration(projectId, client = pool) {
  const q = await client.query(
    `SELECT sprint_duration_days FROM projects WHERE id = $1`,
    [projectId]
  );

  return Number(q.rows[0]?.sprint_duration_days || 14);
}

async function getNextSprintName(projectId, client = pool) {
  const q = await client.query(
    `
    SELECT COUNT(*)::int AS count
    FROM sprints
    WHERE project_id = $1
    `,
    [projectId]
  );

  const nextNo = Number(q.rows[0]?.count || 0) + 1;
  return `Sprint ${nextNo}`;
}

async function createNextActiveSprint(client, { projectId, previousEndDate, userId }) {
  if (!previousEndDate) {
    throw new Error("Yeni sprint oluşturulamadı: previousEndDate boş geldi.");
  }

  const cleanPreviousEndDate = toISODateOnly(previousEndDate);
  const ns = addDaysISO(cleanPreviousEndDate, 1);
  const durationDays = await getProjectSprintDuration(projectId, client);
  const ne = addDaysISO(ns, durationDays - 1);

  const autoName = await getNextSprintName(projectId, client);

  const ins = await client.query(
    `
    INSERT INTO sprints (project_id, name, start_date, end_date, status, created_by)
    VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
    RETURNING
      id,
      project_id,
      name,
      to_char(start_date, 'YYYY-MM-DD') AS start_date,
      to_char(end_date, 'YYYY-MM-DD') AS end_date,
      status
    `,
    [projectId, autoName, ns, ne, userId]
  );

  return ins.rows[0];
}

// GET /projects/:id/sprints
async function listSprints(req, res) {
  const { id: projectId } = req.params;

  try {
    const membership = await ensureProjectMember(projectId, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const q = await pool.query(
      `SELECT
        id,
        project_id,
        name,
        to_char(start_date, 'YYYY-MM-DD') AS start_date,
        to_char(end_date,   'YYYY-MM-DD') AS end_date,
        status
       FROM sprints
       WHERE project_id = $1
       ORDER BY start_date DESC`,
      [projectId]
    );

    return res.json({ sprints: q.rows });
  } catch (err) {
    console.error("LIST SPRINTS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /projects/:id/sprints/active
async function getActiveSprint(req, res) {
  const { id: projectId } = req.params;

  try {
    const membership = await ensureProjectMember(projectId, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const q = await pool.query(
      `SELECT
         id,
         project_id,
         name,
         to_char(start_date, 'YYYY-MM-DD') AS start_date,
         to_char(end_date,   'YYYY-MM-DD') AS end_date,
         status,
         (end_date < CURRENT_DATE) AS is_overdue
       FROM sprints
       WHERE project_id = $1 AND status = 'ACTIVE'
       ORDER BY start_date DESC
       LIMIT 1`,
      [projectId]
    );

    const active = q.rows[0] || null;

    if (!active) {
      return res.json({ sprint: null });
    }

    console.log("AUTO CLOSE CHECK(DB):", {
      activeId: active.id,
      end_date: active.end_date,
      is_overdue: active.is_overdue,
    });

    if (!active.is_overdue) {
      return res.json({ sprint: active });
    }

    await pool.query("BEGIN");

    const lockQ = await pool.query(
      `SELECT
         id,
         name,
         to_char(end_date, 'YYYY-MM-DD') AS end_date,
         status
       FROM sprints
       WHERE id = $1 AND project_id = $2
       FOR UPDATE`,
      [active.id, projectId]
    );

    if (!lockQ.rows.length) {
      await pool.query("ROLLBACK");
      return res.json({ sprint: null });
    }

    const locked = lockQ.rows[0];

    let nextSprint = null;

    if (locked.status !== "ACTIVE") {
      await pool.query("COMMIT");
    } else {
      await createSprintArchiveSnapshot(pool, {
        projectId,
        sprintId: active.id,
      });

      nextSprint = await createNextActiveSprint(pool, {
        projectId,
        previousEndDate: locked.end_date,
        userId: req.user.userId,
      });

      const movedQ = await pool.query(
        `
        UPDATE tasks
        SET sprint_id = $1,
            updated_at = now()
        WHERE project_id = $2
          AND sprint_id = $3
          AND status <> 'DONE'
        RETURNING id, title, assigned_to
        `,
        [nextSprint.id, projectId, active.id]
      );

      const movedCount = movedQ.rows.length;

      const doneUpd = await pool.query(
        `
        UPDATE sprints
        SET status = 'DONE',
            updated_at = now()
        WHERE id = $1
          AND project_id = $2
          AND status = 'ACTIVE'
        RETURNING id, project_id, name, start_date, end_date, status
        `,
        [active.id, projectId]
      );

      if (doneUpd.rowCount !== 1) {
        throw new Error("Could not mark ACTIVE sprint as DONE (rowCount != 1)");
      }

      await createSprintLog({
        projectId,
        sprintId: active.id,
        action: "SPRINT_UPDATED",
        message: `${doneUpd.rows[0].name} otomatik tamamlandı. ${nextSprint.name} başladı. ${movedCount} task yeni sprinte aktarıldı.`,
        meta: {
          old_sprint: doneUpd.rows[0].name,
          new_sprint: nextSprint.name,
          moved_count: movedCount,
          auto_closed: true,
        },
        actorId: req.user.userId,
      });

      await pool.query("COMMIT");

      await notifyProjectMembers({
        projectId,
        triggeredBy: req.user.userId,
        type: "SPRINT_AUTO_CLOSED",
        title: "🤖 Sprint otomatik tamamlandı",
        body:
      `Tamamlanan Sprint:
      ${doneUpd.rows[0].name}
      Başlangıç: ${String(doneUpd.rows[0].start_date).slice(0,10)}
      Bitiş: ${String(doneUpd.rows[0].end_date).slice(0,10)}

      Yeni Sprint:
      ${nextSprint.name}
      Başlangıç: ${nextSprint.start_date}
      Bitiş: ${nextSprint.end_date}

      Aktarılan Task Sayısı: ${movedCount}`,
        includeActor: true,
      });
    }

    const q2 = await pool.query(
      `SELECT
         id,
         project_id,
         name,
         to_char(start_date, 'YYYY-MM-DD') AS start_date,
         to_char(end_date,   'YYYY-MM-DD') AS end_date,
         status
       FROM sprints
       WHERE project_id = $1 AND status = 'ACTIVE'
       ORDER BY start_date DESC
       LIMIT 1`,
      [projectId]
    );

    return res.json({
      sprint: q2.rows[0] || nextSprint || null,
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("GET ACTIVE SPRINT ERROR:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
}

// POST /projects/:id/sprints
// Body: { start_date, name? }
async function createSprint(req, res) {
  const { id: projectId } = req.params;
  const { start_date, name } = req.body;

  const sd = String(start_date || "").trim();
  if (!sd) {
    return res.status(400).json({ message: "start_date required (YYYY-MM-DD)" });
  }

  const normalizedName = normalizeText(name);


  try {
    const authz = await ensureLeader(projectId, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res.status(403).json({ message: "Not a member of this project" });
      }
      return res.status(403).json({ message: "Only LEADER can create sprint" });
    }

    await pool.query("BEGIN");

    const durationDays = await getProjectSprintDuration(projectId);
    const end_date = addDaysISO(sd, durationDays - 1);
    const sprintName = normalizedName || await getNextSprintName(projectId, pool);

    const exists = await pool.query(
      `SELECT id FROM sprints WHERE project_id = $1 AND start_date = $2 LIMIT 1`,
      [projectId, sd]
    );

    if (exists.rows.length) {
      await pool.query("ROLLBACK");
      return res.status(400).json({ message: "Sprint already exists for this start_date" });
    }

    const activeQ = await pool.query(
      `SELECT id FROM sprints WHERE project_id = $1 AND status = 'ACTIVE' LIMIT 1`,
      [projectId]
    );

    if (activeQ.rows.length) {
      await pool.query("ROLLBACK");
      return res.status(400).json({
        message: "Zaten aktif bir sprint var. Yeni sprint oluşturmak için önce aktif sprinti bitir.",
      });
    }

    const ins = await pool.query(
      `INSERT INTO sprints (project_id, name, start_date, end_date, status, created_by)
      VALUES ($1,$2,$3,$4,'ACTIVE',$5)
      RETURNING id, project_id, name, start_date, end_date, status, created_at`,
      [projectId, sprintName, sd, end_date, req.user.userId]
    );

    const createdSprint = ins.rows[0];

    await pool.query("COMMIT");

    return res.status(201).json({
      sprint: createdSprint,
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("CREATE SPRINT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function createSprintLog({
  projectId,
  sprintId,
  action,
  message,
  meta = {},
  actorId,
}) {
  await pool.query(
    `
    INSERT INTO task_logs (project_id, task_id, action, message, meta, actor_id)
    VALUES ($1, NULL, $2, $3, $4, $5)
    `,
    [
      projectId,
      action,
      message,
      JSON.stringify({
        sprint_id: sprintId,
        ...meta,
      }),
      actorId,
    ]
  );
}

// PATCH /projects/:id/sprints/:sprintId
async function updateSprint(req, res) {
  const { id: projectId, sprintId } = req.params;
  const { name, start_date, end_date, status } = req.body;

  const normalizedName = normalizeText(name);

  if (name !== undefined && !normalizedName) {
    return res.status(400).json({ message: "name cannot be empty" });
  }

  if (status !== undefined && !ALLOWED_STATUS.has(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    const authz = await ensureLeader(projectId, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res.status(403).json({ message: "Not a member of this project" });
      }
      return res.status(403).json({ message: "Only LEADER can update sprint" });
    }

    const old = await getSprint(projectId, sprintId);
    if (!old) {
      return res.status(404).json({ message: "Sprint not found" });
    }

    if (old.status === "DONE") {
      return res.status(400).json({ message: "DONE sprint cannot be edited" });
    }

    let nextName = old.name;
    let nextStartDate = old.start_date;
    let nextEndDate = old.end_date;
    let nextStatus = old.status;

    if (name !== undefined) nextName = normalizedName;
    if (start_date !== undefined) nextStartDate = start_date || old.start_date;
    if (end_date !== undefined) nextEndDate = end_date || old.end_date;
    if (status !== undefined) nextStatus = status;

    if (nextStatus === "DONE" && old.status !== "DONE") {
      return res.status(400).json({
        message: "Use close endpoint to finish a sprint",
      });
    }

    if (nextStatus === "ACTIVE" && old.status !== "ACTIVE") {
      return res.status(400).json({
        message: "Use activate endpoint to activate a sprint",
      });
    }

    const upd = await pool.query(
      `UPDATE sprints
       SET name = $1,
           start_date = $2,
           end_date = $3,
           status = $4,
           updated_at = now()
       WHERE id = $5 AND project_id = $6
       RETURNING id, project_id, name, start_date, end_date, status, updated_at`,
      [nextName, nextStartDate, nextEndDate, nextStatus, sprintId, projectId]
    );

    return res.json({ sprint: upd.rows[0] });
  } catch (err) {
    console.error("UPDATE SPRINT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// POST /projects/:id/sprints/:sprintId/activate
async function setActiveSprint(req, res) {
  const { id: projectId, sprintId } = req.params;

  try {
    const authz = await ensureLeader(projectId, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res.status(403).json({ message: "Not a member of this project" });
      }
      return res.status(403).json({ message: "Only LEADER can activate sprint" });
    }

    await pool.query("BEGIN");

    const sprint = await getSprint(projectId, sprintId);
    if (!sprint) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ message: "Sprint not found" });
    }

    if (sprint.status === "DONE") {
      await pool.query("ROLLBACK");
      return res.status(400).json({ message: "DONE sprint cannot be activated" });
    }

    const upd = await pool.query(
      `UPDATE sprints
       SET status = 'ACTIVE', updated_at = now()
       WHERE id = $1 AND project_id = $2 AND status <> 'DONE'
       RETURNING id, project_id, name, start_date, end_date, status`,
      [sprintId, projectId]
    );

    if (!upd.rows.length) {
      await pool.query("ROLLBACK");
      return res.status(404).json({ message: "Sprint not found or already DONE" });
    }

    await createSprintLog({
      projectId,
      sprintId,
      action: "SPRINT_STARTED",
      message: `Sprint aktif edildi: "${upd.rows[0].name}"`,
      meta: {
        sprint_name: upd.rows[0].name,
        status: "ACTIVE",
      },
      actorId: req.user.userId,
    });

    await pool.query("COMMIT");

    await notifyProjectMembers({
      projectId,
      triggeredBy: req.user.userId,
      type: "SPRINT_STARTED",
      title: "Yeni sprint başladı",
      body: upd.rows[0].name,
      includeActor: true,
    });

    return res.json({ sprint: upd.rows[0] });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("ACTIVATE SPRINT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// POST /projects/:id/sprints/:sprintId/close
async function closeSprint(req, res) {
  const { id: projectId, sprintId } = req.params;
  const client = await pool.connect();

  try {
    const authz = await ensureLeader(projectId, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res.status(403).json({ message: "Not a member of this project" });
      }

      return res.status(403).json({
        message: "Only LEADER can close sprint",
      });
    }

    await client.query("BEGIN");

    const curQ = await client.query(
      `
      SELECT id, status, start_date, end_date, name
      FROM sprints
      WHERE id = $1 AND project_id = $2
      FOR UPDATE
      `,
      [sprintId, projectId]
    );

    if (!curQ.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Sprint not found" });
    }

    const cur = curQ.rows[0];

    if (cur.status === "DONE") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Sprint already DONE" });
    }

    await createSprintArchiveSnapshot(client, {
      projectId,
      sprintId,
    });

    const nextSprint = await createNextActiveSprint(client, {
      projectId,
      previousEndDate: cur.end_date,
      userId: req.user.userId,
    });

    const movedQ = await client.query(
      `
      UPDATE tasks
      SET sprint_id = $1,
          updated_at = now()
      WHERE project_id = $2
        AND sprint_id = $3
        AND status <> 'DONE'
      RETURNING id, title, assigned_to
      `,
      [nextSprint.id, projectId, sprintId]
    );

    const movedCount = movedQ.rows.length;

    const upd = await client.query(
      `
      UPDATE sprints
      SET status = 'DONE',
          updated_at = now()
      WHERE id = $1
        AND project_id = $2
      RETURNING id, project_id, name, start_date, end_date, status
      `,
      [sprintId, projectId]
    );

    await createSprintLog({
      projectId,
      sprintId,
      action: "SPRINT_UPDATED",
      message: `${upd.rows[0].name} tamamlandı. ${nextSprint.name} başladı. ${movedCount} task yeni sprinte aktarıldı.`,
      meta: {
        old_sprint: upd.rows[0].name,
        new_sprint: nextSprint.name,
        moved_count: movedCount,
      },
      actorId: req.user.userId,
    });

    await client.query("COMMIT");

    await notifyProjectMembers({
      projectId,
      triggeredBy: req.user.userId,
      type: "SPRINT_CLOSED",
      title: "🏁 Sprint tamamlandı",
      body:
    `Tamamlanan Sprint:
    ${upd.rows[0].name}
    Başlangıç: ${String(upd.rows[0].start_date).slice(0,10)}
    Bitiş: ${String(upd.rows[0].end_date).slice(0,10)}

    Yeni Sprint:
    ${nextSprint.name}
    Başlangıç: ${nextSprint.start_date}
    Bitiş: ${nextSprint.end_date}

    Aktarılan Task Sayısı: ${movedCount}`,
      includeActor: true,
    });

    return res.json({
      sprint: upd.rows[0],
      next_sprint: nextSprint,
      carry_over: {
        moved_count: movedCount,
        to_sprint: nextSprint,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CLOSE SPRINT ERROR:", err);

    return res.status(500).json({
      message: "Server error",
    });
  } finally {
    client.release();
  }
}

// DELETE /projects/:id/sprints/:sprintId
async function deleteSprint(req, res) {
  const { id: projectId, sprintId } = req.params;

  try {
    const authz = await ensureLeader(projectId, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res.status(403).json({ message: "Not a member of this project" });
      }
      return res.status(403).json({ message: "Only LEADER can delete sprint" });
    }

    const sprint = await getSprint(projectId, sprintId);
    if (!sprint) {
      return res.status(404).json({ message: "Sprint not found" });
    }

    if (sprint.status === "DONE") {
      return res.status(400).json({ message: "DONE sprint cannot be deleted" });
    }

    if (sprint.status !== "ACTIVE") {
      return res.status(400).json({
        message: "Only ACTIVE sprint can be deleted",
      });
    }

    await pool.query("BEGIN");

    await pool.query(
      `UPDATE tasks
       SET sprint_id = NULL, updated_at = now()
       WHERE sprint_id = $1`,
      [sprintId]
    );

    await pool.query(
      `DELETE FROM sprints
       WHERE id = $1 AND project_id = $2`,
      [sprintId, projectId]
    );

    await pool.query("COMMIT");

    return res.json({ message: "Sprint deleted" });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("DELETE SPRINT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// POST /projects/:id/sprints/:sprintId/claim-tasks
// Backlog (sprint_id IS NULL) taskları bu sprint'e bağlar
async function claimTasksToSprint(req, res) {
  const { id: projectId, sprintId } = req.params;
  const { task_ids } = req.body || {};

  try {
    const authz = await ensureLeader(projectId, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res.status(403).json({ message: "Not a member of this project" });
      }
      return res.status(403).json({ message: "Only LEADER can claim backlog tasks" });
    }

    const sprint = await getSprint(projectId, sprintId);
    if (!sprint) {
      return res.status(404).json({ message: "Sprint not found" });
    }

    if (sprint.status === "DONE") {
      return res.status(400).json({ message: "Cannot claim tasks into DONE sprint" });
    }

    let normalizedTaskIds = [];

    if (Array.isArray(task_ids)) {
      normalizedTaskIds = [...new Set(task_ids.map((x) => String(x).trim()).filter(Boolean))];
    }

    let upd;

    if (normalizedTaskIds.length > 0) {
      upd = await pool.query(
        `
        UPDATE tasks
        SET sprint_id = $1, updated_at = now()
        WHERE project_id = $2
          AND sprint_id IS NULL
          AND id = ANY($3::uuid[])
        RETURNING id, title, assigned_to
        `,
        [sprintId, projectId, normalizedTaskIds]
      );
    } else {
      upd = await pool.query(
        `
        UPDATE tasks
        SET sprint_id = $1, updated_at = now()
        WHERE project_id = $2
          AND sprint_id IS NULL
        RETURNING id, title, assigned_to
        `,
        [sprintId, projectId]
      );
    }

    await notifySprintTasksMoved({
      projectId,
      sprintName: sprint.name,
      movedCount: upd.rows.length,
      triggeredBy: req.user.userId,
    });

    return res.json({
      moved_count: upd.rows.length,
      tasks: upd.rows,
    });
  } catch (err) {
    console.error("CLAIM TASKS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /projects/:id/sprints/:sprintId/archive
async function getSprintArchive(req, res) {
  const { id: projectId, sprintId } = req.params;

  try {
    const membership = await ensureProjectMember(projectId, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const q = await pool.query(
      `SELECT
         id,
         sprint_id,
         project_id,
         sprint_name,
         to_char(start_date, 'YYYY-MM-DD') AS start_date,
         to_char(end_date, 'YYYY-MM-DD') AS end_date,
         closed_at,
         total_task_count,
         done_task_count,
         todo_task_count,
         in_progress_task_count,
         overdue_task_count,
         completion_rate,
         created_at
       FROM sprint_archives
       WHERE project_id = $1 AND sprint_id = $2
       LIMIT 1`,
      [projectId, sprintId]
    );

    if (!q.rows.length) {
      return res.status(404).json({ message: "Archive not found" });
    }

    return res.json({ archive: q.rows[0] });
  } catch (err) {
    console.error("GET SPRINT ARCHIVE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /projects/:id/sprints/:sprintId/archive/tasks
async function listSprintArchiveTasks(req, res) {
  const { id: projectId, sprintId } = req.params;

  try {
    const membership = await ensureProjectMember(projectId, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const archiveQ = await pool.query(
      `SELECT id
       FROM sprint_archives
       WHERE project_id = $1 AND sprint_id = $2
       LIMIT 1`,
      [projectId, sprintId]
    );

    if (!archiveQ.rows.length) {
      return res.status(404).json({ message: "Archive not found" });
    }

    const archiveId = archiveQ.rows[0].id;

    const tasksQ = await pool.query(
      `SELECT
         id,
         archive_id,
         original_task_id,
         title,
         description,
         status,
         priority,
         to_char(due_date, 'YYYY-MM-DD') AS due_date,
         assigned_to,
         assigned_to_name,
         created_by,
         created_by_name,
         comment_count,
         activity_count,
         estimated_cost,
         actual_cost,
         cost_note,
         original_created_at,
         original_updated_at,
         snapshotted_at
       FROM sprint_archive_tasks
       WHERE archive_id = $1
         AND status = 'DONE'
       ORDER BY original_updated_at DESC NULLS LAST, original_created_at DESC NULLS LAST`,
      [archiveId]
    );

    return res.json({ tasks: tasksQ.rows });
  } catch (err) {
    console.error("LIST SPRINT ARCHIVE TASKS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /projects/:id/sprints/:sprintId/archive/tasks/:archiveTaskId
async function getSprintArchiveTaskDetail(req, res) {
  const { id: projectId, sprintId, archiveTaskId } = req.params;

  try {
    const membership = await ensureProjectMember(projectId, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const taskQ = await pool.query(
      `SELECT
         sat.id,
         sat.archive_id,
         sat.original_task_id,
         sat.project_id,
         sat.sprint_id,
         sat.title,
         sat.description,
         sat.status,
         sat.priority,
         to_char(sat.due_date, 'YYYY-MM-DD') AS due_date,
         sat.assigned_to,
         sat.assigned_to_name,
         sat.created_by,
         sat.created_by_name,
         sat.comment_count,
         sat.activity_count,
         sat.estimated_cost,
         sat.actual_cost,
         sat.cost_note,
         sat.original_created_at,
         sat.original_updated_at,
         sat.snapshotted_at,
         sa.sprint_name,
         to_char(sa.start_date, 'YYYY-MM-DD') AS sprint_start_date,
         to_char(sa.end_date, 'YYYY-MM-DD') AS sprint_end_date,
         sa.completion_rate
       FROM sprint_archive_tasks sat
       INNER JOIN sprint_archives sa
         ON sa.id = sat.archive_id
       WHERE sat.id = $1
         AND sat.project_id = $2
         AND sat.sprint_id = $3
       LIMIT 1`,
      [archiveTaskId, projectId, sprintId]
    );

    if (!taskQ.rows.length) {
      return res.status(404).json({ message: "Archived task not found" });
    }

    const commentsQ = await pool.query(
      `SELECT
         id,
         original_comment_id,
         author_id,
         author_name,
         body,
         created_at,
         snapshotted_at
       FROM sprint_archive_comments
       WHERE archive_task_id = $1
       ORDER BY created_at ASC NULLS LAST, snapshotted_at ASC`,
      [archiveTaskId]
    );

    const activitiesQ = await pool.query(
      `SELECT
         id,
         original_log_id,
         actor_id,
         actor_name,
         action,
         message,
         meta,
         created_at,
         snapshotted_at
       FROM sprint_archive_activities
       WHERE archive_task_id = $1
       ORDER BY created_at ASC NULLS LAST, snapshotted_at ASC`,
      [archiveTaskId]
    );

    return res.json({
      task: taskQ.rows[0],
      comments: commentsQ.rows,
      activities: activitiesQ.rows,
    });
  } catch (err) {
    console.error("GET SPRINT ARCHIVE TASK DETAIL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

// GET /projects/:id/sprints/:sprintId/archive/ai-analysis
async function getSavedSprintAiAnalysis(req, res) {
  const { id: projectId, sprintId } = req.params;

  try {
    const membership = await ensureProjectMember(projectId, req.user.userId);

    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const q = await pool.query(
      `
      SELECT
        id,
        project_id,
        sprint_id,
        archive_id,
        analysis,
        model_name,
        generated_by,
        created_at,
        updated_at
      FROM sprint_ai_analyses
      WHERE project_id = $1
        AND sprint_id = $2
      LIMIT 1
      `,
      [projectId, sprintId]
    );

    return res.json({
      analysis: q.rows[0] || null,
    });
  } catch (err) {
    console.error("GET SAVED SPRINT AI ANALYSIS ERROR:", err);
    return res.status(500).json({
      message: "Kayıtlı AI analizi getirilemedi",
    });
  }
}

// POST /projects/:id/sprints/:sprintId/archive/ai-analysis
async function generateSprintAiAnalysis(req, res) {
  try {
    const { id: projectId, sprintId } = req.params;

    const { archive, tasks, costStats } = req.body;

    if (!archive) {
      return res.status(400).json({
        message: "Archive verisi gerekli",
      });
    }

    const systemPrompt = `
    Sen deneyimli bir Agile Scrum danışmanı ve yapay zekâ destekli proje yönetim uzmanısın.

    Görevin:
    - Sprint verilerini profesyonel şekilde analiz etmek
    - Takım performansını değerlendirmek
    - Riskleri tespit etmek
    - Teknik lider için öneriler üretmek
    - Sprint sağlığını yorumlamak

    Kurallar:
    - Türkçe yaz
    - Çok kısa cevap verme
    - Her başlık altında detaylı ama okunabilir yorum yap
    - Tekrar eden cümle kurma
    - Verileri yorumla
    - Yapay zekâ analiz hissi ver
    - Gerektiğinde teknik değerlendirme yap
    - Agile/Scrum mantığıyla yorumla
    `;

    const total = Number(archive.total_task_count || 0);
    const done = Number(archive.done_task_count || 0);
    const todo = Number(archive.todo_task_count || 0);
    const inProgress = Number(archive.in_progress_task_count || 0);
    const overdue = Number(archive.overdue_task_count || 0);
    const completion = Number(archive.completion_rate || 0);

    const userPrompt = `
    Aşağıdaki sprint verilerini analiz et.

    KESİN SAYISAL VERİLER:
    - Sprint adı: ${archive.sprint_name}
    - Tarih aralığı: ${archive.start_date} - ${archive.end_date}
    - Toplam task: ${total}
    - Tamamlanan task: ${done}
    - Yapılacak task: ${todo}
    - Devam eden task: ${inProgress}
    - Geciken task: ${overdue}
    - Tamamlanma oranı: %${completion}
    - Tahmini maliyet: ${costStats?.estimated || 0} TL
    - Gerçek maliyet: ${costStats?.actual || 0} TL
    - Maliyet farkı: ${costStats?.diff || 0} TL

    ÖNEMLİ KURALLAR:
    - Sayıları değiştirme.
    - "3 task beklenirken 4 tamamlandı" gibi matematiksel çelişki kurma.
    - Toplam task ${total}, tamamlanan task ${done}. Bu değerleri aynen kullan.
    - Eğer tamamlanma oranı %80 altındaysa performans düşük/orta olarak değerlendir.
    - Eğer overdue ${overdue} değerinden büyükse risk artar.
    - Cevabı sadece geçerli JSON olarak döndür.

    JSON formatı şu olsun:
    {
      "summary": "",
      "performance": "",
      "teamAnalysis": "",
      "sprintHealth": "",
      "riskLevel": "LOW | MEDIUM | HIGH",
      "riskReason": "",
      "costComment": "",
      "technicalInsight": "",
      "managerRecommendation": "",
      "suggestions": []
    }

    Ek olarak şunları da değerlendir:
  - Sprint planlama kalitesi
  - Görev dağılım dengesi
  - Takım verimliliği
  - Sprint hedeflerinin gerçekçiliği
  - Teknik risk seviyesi
  - Süre yönetimi
  - İş yükü yoğunluğu
  - Agile süreç sağlığı

    Öneriler kısmı daha detaylı olsun.
    En az 5 öneri üret.
    `;

    const result = await askAI({
      systemPrompt,
      userPrompt,
      maxTokens: 2500,
    });

    let parsedAnalysis = null;

    try {
      const cleaned = String(result || "")
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const jsonStart = cleaned.indexOf("{");
      const jsonEnd = cleaned.lastIndexOf("}");

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("JSON object bulunamadı");
      }

      const jsonText = cleaned.slice(jsonStart, jsonEnd + 1);
      parsedAnalysis = JSON.parse(jsonText);
    } catch (parseErr) {
      console.error("SPRINT AI JSON PARSE ERROR:", parseErr.message);
      console.error(result);

      parsedAnalysis = {
        summary: "AI analizi oluşturuldu ancak cevap beklenen JSON formatında ayrıştırılamadı.",
        performance: String(result || "").slice(0, 800),
        teamAnalysis: "Takım analizi ayrıştırılamadı.",
        sprintHealth: "Sprint sağlığı ayrıştırılamadı.",
        riskLevel: completion < 50 || overdue > 0 ? "HIGH" : completion < 80 ? "MEDIUM" : "LOW",
        riskReason: "AI cevabı JSON formatında dönmediği için risk seviyesi sprint metriklerine göre hesaplandı.",
        costComment: `Tahmini maliyet ${costStats?.estimated || 0} TL, gerçek maliyet ${costStats?.actual || 0} TL, fark ${costStats?.diff || 0} TL.`,
        technicalInsight: "Teknik içgörü ayrıştırılamadı.",
        managerRecommendation: "Sprint verileri manuel olarak kontrol edilmeli ve eksik kalan görevler sonraki sprint planına göre değerlendirilmelidir.",
        suggestions: [
          "Sprint planlamasında görev kapsamları daha küçük parçalara ayrılmalıdır.",
          "Geciken veya tamamlanamayan işler sonraki sprintte önceliklendirilmelidir.",
          "Takım iş yükü sprint başlangıcında daha dengeli dağıtılmalıdır.",
        ],
      };
    }

    const archiveResult = await pool.query(
      `
      SELECT id
      FROM sprint_archives
      WHERE project_id = $1
        AND sprint_id = $2
      LIMIT 1
      `,
      [projectId, sprintId]
    );

    const archiveId = archiveResult.rows[0]?.id || null;

    const existing = await pool.query(
      `
      SELECT id
      FROM sprint_ai_analyses
      WHERE project_id = $1
        AND sprint_id = $2
      LIMIT 1
      `,
      [projectId, sprintId]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `
        UPDATE sprint_ai_analyses
        SET
          analysis = $3,
          model_name = $4,
          updated_at = now()
        WHERE project_id = $1
          AND sprint_id = $2
        `,
        [
          projectId,
          sprintId,
          JSON.stringify(parsedAnalysis),
          process.env.QWEN_MODEL || "qwen-turbo",
        ]
      );
    } else {
      await pool.query(
        `
        INSERT INTO sprint_ai_analyses (
          project_id,
          sprint_id,
          archive_id,
          analysis,
          generated_by,
          model_name
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          projectId,
          sprintId,
          archiveId,
          JSON.stringify(parsedAnalysis),
          req.user.userId,
          process.env.QWEN_MODEL || "qwen-turbo",
        ]
      );
    }

    return res.json({
      success: true,
      analysis: parsedAnalysis,
    });
  } catch (err) {
    console.error("AI SPRINT ANALYSIS ERROR:", err);

    return res.status(500).json({
      message: "AI sprint analizi oluşturulamadı",
    });
  }
}

module.exports = {
  listSprints,
  getActiveSprint,
  createSprint,
  updateSprint,
  setActiveSprint,
  closeSprint,
  deleteSprint,
  claimTasksToSprint,
  getSprintArchive,
  listSprintArchiveTasks,
  getSprintArchiveTaskDetail,
  generateSprintAiAnalysis,
  getSavedSprintAiAnalysis,
};
