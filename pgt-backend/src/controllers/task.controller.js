const pool = require("../config/db.js");
const { ensureProjectMember, ensureLeader } = require("../utils/projectAuth");
const { createNotification } = require("../utils/notification");
const { emitProjectEvent } = require("../socket");

/**
 * Bu controller, görev yönetimi süreçlerini yönetir.
 * Görev oluşturma, güncelleme, silme, atama, bağımlılık yönetimi,
 * aktivite kayıtları, backlog işlemleri ve görev bildirimlerini gerçekleştirir.
 */

console.log("POOL TYPE:", typeof pool);
console.log("POOL.QUERY TYPE:", typeof pool?.query);

const ALLOWED_STATUS = new Set(["TODO", "IN_PROGRESS", "DONE"]);
const ALLOWED_PRIORITY = new Set(["LOW", "MEDIUM", "HIGH"]);

async function addLog({
  projectId,
  taskId = null,
  actorId,
  action,
  message,
  meta = {},
}) {
  await pool.query(
    `INSERT INTO task_logs (project_id, task_id, actor_id, action, message, meta)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [projectId, taskId, actorId, action, message, meta],
  );
}

function normalizeText(value) {
  if (value === undefined) return undefined;
  const trimmed = String(value).trim();
  return trimmed;
}

function normalizeNullableText(value) {
  if (value === undefined) return undefined;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeNullableValue(value) {
  if (value === undefined) return undefined;
  return value === "" ? null : value;
}

async function getTaskBase(taskId) {
  const result = await pool.query(
    `SELECT
       id,
       project_id,
       sprint_id,
       title,
       description,
       status,
       created_by,
       created_at,
       updated_at,
       priority,
       start_date,
       due_date,
       assigned_to,
       estimated_cost,
       actual_cost,
       cost_note,
      subtasks,
      acceptance_criteria
     FROM tasks
     WHERE id = $1`,
    [taskId],
  );

  return result.rows[0] || null;
}

async function getFullTask(taskId) {
  const result = await pool.query(
    `
    SELECT
      t.id,
      t.project_id,
      t.sprint_id,
      t.title,
      t.description,
      t.status,
      t.created_by,
      t.created_at,
      t.updated_at,
      t.priority,
      t.start_date,
      t.due_date,
      t.assigned_to,
      t.estimated_cost,
      t.actual_cost,
      t.cost_note,
      t.subtasks,
      t.acceptance_criteria,
      (
        SELECT COUNT(*)::int
        FROM task_dependencies td
        WHERE td.task_id = t.id
      ) AS dependency_count,
      COALESCE(u.full_name, u.email) AS created_by_name,
      COALESCE(au.full_name, au.email) AS assigned_to_name,
      s.name AS sprint_name,
      s.start_date AS sprint_start_date,
      s.end_date AS sprint_end_date,
      s.status AS sprint_status,

      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'id', assignee.id,
            'full_name', assignee.full_name,
            'email', assignee.email
          )
        ) FILTER (WHERE assignee.id IS NOT NULL),
        '[]'
      ) AS assignees,

      COALESCE(
        array_agg(DISTINCT assignee.id) FILTER (WHERE assignee.id IS NOT NULL),
        '{}'
      ) AS assignee_ids

    FROM tasks t
    LEFT JOIN users u ON u.id = t.created_by
    LEFT JOIN users au ON au.id = t.assigned_to
    LEFT JOIN sprints s ON s.id = t.sprint_id
    LEFT JOIN task_assignees ta ON ta.task_id = t.id
    LEFT JOIN users assignee ON assignee.id = ta.user_id
    WHERE t.id = $1
    GROUP BY
      t.id, u.full_name, u.email,
      au.full_name, au.email,
      s.name, s.start_date, s.end_date, s.status
    `,
    [taskId],
  );

  return result.rows[0] || null;
}

async function getTaskDependencies(taskId) {
  const q = await pool.query(
    `SELECT
       td.depends_on_task_id AS id,
       t.title,
       t.status
     FROM task_dependencies td
     JOIN tasks t ON t.id = td.depends_on_task_id
     WHERE td.task_id = $1`,
    [taskId],
  );

  return q.rows;
}

async function wouldCreateCircularDependency(taskId, dependencyIds) {
  const targetTaskId = String(taskId);

  for (const depId of dependencyIds) {
    if (String(depId) === targetTaskId) {
      return true;
    }

    const visited = new Set();
    const stack = [String(depId)];

    while (stack.length > 0) {
      const currentId = stack.pop();

      if (currentId === targetTaskId) {
        return true;
      }

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const q = await pool.query(
        `
        SELECT depends_on_task_id
        FROM task_dependencies
        WHERE task_id = $1
        `,
        [currentId],
      );

      for (const row of q.rows) {
        stack.push(String(row.depends_on_task_id));
      }
    }
  }

  return false;
}

async function getDependencies(req, res) {
  const { taskId } = req.params;

  try {
    const task = await getTaskBase(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const membership = await ensureProjectMember(
      task.project_id,
      req.user.userId,
    );
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const deps = await getTaskDependencies(taskId);

    return res.json({ dependencies: deps });
  } catch (err) {
    console.error("GET DEPENDENCIES ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function setDependencies(req, res) {
  const { taskId } = req.params;
  const { dependency_ids } = req.body;

  try {
    const task = await getTaskBase(taskId);
    if (!task) return res.status(404).json({ message: "Task not found" });

    const authz = await ensureLeader(task.project_id, req.user.userId);
    if (!authz.ok) {
      return res
        .status(403)
        .json({ message: "Only LEADER can set dependencies" });
    }

    const normalizedDependencyIds = Array.isArray(dependency_ids)
      ? [
          ...new Set(
            dependency_ids.map((id) => String(id).trim()).filter(Boolean),
          ),
        ]
      : [];

    if (normalizedDependencyIds.includes(String(taskId))) {
      return res.status(400).json({
        message: "Bir task kendisine bağlı olamaz.",
      });
    }

    if (normalizedDependencyIds.length > 0) {
      const check = await pool.query(
        `
        SELECT id, project_id, title
        FROM tasks
        WHERE id = ANY($1::uuid[])
        `,
        [normalizedDependencyIds],
      );

      if (check.rows.length !== normalizedDependencyIds.length) {
        return res.status(400).json({
          message: "Seçilen bağlı görevlerden biri bulunamadı.",
        });
      }

      const invalidProjectTask = check.rows.find(
        (row) => String(row.project_id) !== String(task.project_id),
      );

      if (invalidProjectTask) {
        return res.status(400).json({
          message: "Farklı projeye ait task dependency olarak seçilemez.",
        });
      }
    }

    const hasCircular = await wouldCreateCircularDependency(
      taskId,
      normalizedDependencyIds,
    );

    if (hasCircular) {
      return res.status(400).json({
        message:
          "Bu bağlantı döngüsel bağımlılık oluşturuyor. Lütfen farklı bir task seç.",
      });
    }

    await pool.query("BEGIN");

    await pool.query(`DELETE FROM task_dependencies WHERE task_id = $1`, [
      taskId,
    ]);

    for (const depId of normalizedDependencyIds) {
      await pool.query(
        `
        INSERT INTO task_dependencies (project_id, task_id, depends_on_task_id)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        `,
        [task.project_id, taskId, depId],
      );
    }

    await addLog({
      projectId: task.project_id,
      taskId,
      actorId: req.user.userId,
      action: "TASK_DEPENDENCIES_UPDATED",
      message: `Task bağımlılıkları güncellendi: "${task.title}"`,
      meta: {
        dependency_ids: normalizedDependencyIds,
      },
    });

    await pool.query("COMMIT");

    const deps = await getTaskDependencies(taskId);

    emitProjectEvent(task.project_id, "project:task-updated", {
      taskId,
      dependencies: deps,
    });

    return res.json({
      message: "Dependencies updated",
      dependencies: deps,
    });
  } catch (err) {
    await pool.query("ROLLBACK").catch(() => {});
    console.error("SET DEPENDENCIES ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getProjectTaskDependencyGraph(req, res) {
  const { id } = req.params;

  try {
    const tasksQ = await pool.query(
      `
      SELECT 
        id,
        title,
        status,
        priority,
        start_date,
        due_date
      FROM tasks
      WHERE project_id = $1
      ORDER BY created_at ASC
      `,
      [id],
    );

    const edgesQ = await pool.query(
      `
      SELECT 
        task_id,
        depends_on_task_id
      FROM task_dependencies
      WHERE project_id = $1
      `,
      [id],
    );

    return res.json({
      tasks: tasksQ.rows,
      edges: edgesQ.rows.map((e) => ({
        from_task_id: e.depends_on_task_id,
        to_task_id: e.task_id,
      })),
    });
  } catch (err) {
    console.error("GET TASK DEPENDENCY GRAPH ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function ensureAssignableMember(projectId, userId) {
  if (!userId) return true;

  const membership = await ensureProjectMember(projectId, userId);
  return !!membership;
}

function normalizeAssigneeIds(value, fallbackUserId = null) {
  if (value === undefined) {
    return fallbackUserId ? [fallbackUserId] : [];
  }

  if (value === null) {
    return fallbackUserId ? [fallbackUserId] : [];
  }

  if (!Array.isArray(value)) {
    return fallbackUserId ? [fallbackUserId] : [];
  }

  if (value.length === 0) {
    return fallbackUserId ? [fallbackUserId] : [];
  }

  return [...new Set(value.map((x) => String(x).trim()).filter(Boolean))];
}

async function ensureAssignableMembers(projectId, userIds) {
  for (const userId of userIds) {
    const isAssignable = await ensureAssignableMember(projectId, userId);
    if (!isAssignable) return false;
  }
  return true;
}

async function replaceTaskAssignees(taskId, assigneeIds) {
  await pool.query(`DELETE FROM task_assignees WHERE task_id = $1`, [taskId]);

  for (const userId of assigneeIds) {
    await pool.query(
      `INSERT INTO task_assignees (task_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [taskId, userId],
    );
  }
}

async function notifyNewAssignees({
  beforeIds = [],
  afterIds = [],
  task,
  triggeredBy,
}) {
  const beforeSet = new Set(beforeIds.map(String));

  for (const userId of afterIds) {
    if (beforeSet.has(String(userId))) continue;
    if (String(userId) === String(triggeredBy)) continue;

    await createNotification({
      userId,
      type: "TASK_ASSIGNED",
      title: "Sana yeni bir task atandı",
      body: task.title,
      projectId: task.project_id,
      taskId: task.id,
      triggeredBy,
    });
  }
}

async function getTaskById(req, res) {
  const { taskId } = req.params;

  try {
    const task = await getFullTask(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const membership = await ensureProjectMember(
      task.project_id,
      req.user.userId,
    );
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    return res.json({ task });
  } catch (err) {
    console.error("GET TASK ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getTasks(req, res) {
  const { id } = req.params; // project id
  const { sprint_id, q, status, assigned_to, only_mine, sort } = req.query;

  try {
    const membership = await ensureProjectMember(id, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    let effectiveSprintId = sprint_id || null;

    if (!effectiveSprintId) {
      const activeQ = await pool.query(
        `SELECT id
         FROM sprints
         WHERE project_id = $1 AND status = 'ACTIVE'
         ORDER BY start_date DESC
         LIMIT 1`,
        [id],
      );
      effectiveSprintId = activeQ.rows[0]?.id || null;
    }

    if (!effectiveSprintId) {
      return res.json({ tasks: [], sprint_id: null });
    }

    const values = [id, effectiveSprintId];
    const where = [`t.project_id = $1`, `t.sprint_id = $2`];
    let paramIndex = 3;

    if (q && q.trim()) {
      where.push(`(
        LOWER(t.title) LIKE LOWER($${paramIndex})
        OR LOWER(COALESCE(t.description, '')) LIKE LOWER($${paramIndex})
      )`);
      values.push(`%${q.trim()}%`);
      paramIndex++;
    }

    if (status && status !== "ALL") {
      if (!ALLOWED_STATUS.has(status)) {
        return res.status(400).json({ message: "Invalid status filter" });
      }
      where.push(`t.status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    if (assigned_to && assigned_to !== "ALL") {
      where.push(`
        EXISTS (
          SELECT 1
          FROM task_assignees ta_filter
          WHERE ta_filter.task_id = t.id
            AND ta_filter.user_id = $${paramIndex}
        )
      `);
      values.push(assigned_to);
      paramIndex++;
    }

    if (only_mine === "true") {
      where.push(`
        EXISTS (
          SELECT 1
          FROM task_assignees ta_mine
          WHERE ta_mine.task_id = t.id
            AND ta_mine.user_id = $${paramIndex}
        )
      `);
      values.push(req.user.userId);
      paramIndex++;
    }

    let orderBy = `t.created_at DESC`;

    switch (sort) {
      case "newest":
        orderBy = `t.created_at DESC`;
        break;
      case "oldest":
        orderBy = `t.created_at ASC`;
        break;
      case "updated_desc":
        orderBy = `t.updated_at DESC`;
        break;
      case "updated_asc":
        orderBy = `t.updated_at ASC`;
        break;
      case "due_asc":
        orderBy = `t.due_date ASC NULLS LAST`;
        break;
      case "due_desc":
        orderBy = `t.due_date DESC NULLS LAST`;
        break;
      case "title_asc":
        orderBy = `t.title ASC`;
        break;
      case "title_desc":
        orderBy = `t.title DESC`;
        break;
      default:
        orderBy = `t.created_at DESC`;
    }

    const sql = `
      SELECT
        t.id,
        t.project_id,
        t.sprint_id,
        t.title,
        t.description,
        t.status,
        t.created_by,
        t.created_at,
        t.updated_at,
        t.priority,
        t.start_date,
        t.due_date,
        t.estimated_cost,
        t.actual_cost,
        t.cost_note,
        t.subtasks,
        t.acceptance_criteria,
        t.assigned_to,
        (
          SELECT COUNT(*)::int
          FROM task_dependencies td
          WHERE td.task_id = t.id
        ) AS dependency_count,

        (
          SELECT COUNT(*)::int
          FROM task_attachments a
          WHERE a.task_id = t.id
        ) AS attachment_count,

        (
          SELECT COUNT(*)::int
          FROM task_code_submissions cs
          WHERE cs.task_id = t.id
        ) AS code_submission_count,

        ARRAY(
          SELECT DISTINCT
            COALESCE(cs.file_type, 'CODE')
          FROM task_code_submissions cs
          WHERE cs.task_id = t.id
        ) AS code_types,

        ARRAY(
          SELECT DISTINCT
            CASE
              WHEN a.mime_type ILIKE '%pdf%' THEN 'PDF'
              WHEN a.mime_type ILIKE 'image/%' THEN 'IMAGE'
              WHEN a.mime_type ILIKE '%word%'
                OR a.original_name ILIKE '%.doc%'
                OR a.original_name ILIKE '%.docx%'
              THEN 'DOCX'
              WHEN a.mime_type ILIKE '%presentation%'
                OR a.original_name ILIKE '%.ppt%'
                OR a.original_name ILIKE '%.pptx%'
              THEN 'PPTX'
              WHEN a.mime_type ILIKE '%excel%'
                OR a.original_name ILIKE '%.xls%'
                OR a.original_name ILIKE '%.xlsx%'
              THEN 'XLSX'
              ELSE 'FILE'
            END
          FROM task_attachments a
          WHERE a.task_id = t.id
        ) AS attachment_types,

        (
          SELECT COALESCE(
            json_agg(
              jsonb_build_object(
                'id', dep.id,
                'title', dep.title,
                'status', dep.status,
                'due_date', dep.due_date,
                'start_date', dep.start_date
              )
            ),
            '[]'
          )
          FROM task_dependencies td
          JOIN tasks dep ON dep.id = td.depends_on_task_id
          WHERE td.task_id = t.id
        ) AS dependencies,

        COALESCE(u.full_name, u.email) AS created_by_name,
        COALESCE(au.full_name, au.email) AS assigned_to_name,
        s.name       AS sprint_name,
        s.start_date AS sprint_start_date,
        s.end_date   AS sprint_end_date,
        s.status     AS sprint_status,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', assignee.id,
              'full_name', assignee.full_name,
              'email', assignee.email
            )
          ) FILTER (WHERE assignee.id IS NOT NULL),
          '[]'
        ) AS assignees,

        COALESCE(
          array_agg(DISTINCT assignee.id) FILTER (WHERE assignee.id IS NOT NULL),
          '{}'
        ) AS assignee_ids

      FROM tasks t
      LEFT JOIN users u ON u.id = t.created_by
      LEFT JOIN users au ON au.id = t.assigned_to
      LEFT JOIN sprints s ON s.id = t.sprint_id
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      LEFT JOIN users assignee ON assignee.id = ta.user_id
      WHERE ${where.join(" AND ")}
      GROUP BY
        t.id,
        u.full_name,
        u.email,
        au.full_name,
        au.email,
        s.name,
        s.start_date,
        s.end_date,
        s.status
      ORDER BY ${orderBy}
    `;

    const result = await pool.query(sql, values);

    return res.json({
      tasks: result.rows,
      sprint_id: effectiveSprintId,
    });
  } catch (err) {
    console.error("GET TASKS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function createTask(req, res) {
  const { id } = req.params; // project id
  const {
    title,
    description,
    priority,
    start_date,
    due_date,
    assignee_ids,
    estimated_cost,
    actual_cost,
    cost_note,
  } = req.body;

  const normalizedStartDate = normalizeNullableValue(start_date);
  const normalizedTitle = normalizeText(title);
  const normalizedDescription = normalizeNullableText(description);
  const normalizedDueDate = normalizeNullableValue(due_date);
  const normalizedAssigneeIds = normalizeAssigneeIds(
    assignee_ids,
    req.user.userId,
  );

  const primaryAssignedTo = normalizedAssigneeIds[0] || null;
  const normalizedPriority = priority || "MEDIUM";

  const normalizedEstimatedCost =
    estimated_cost === undefined ||
    estimated_cost === "" ||
    estimated_cost === null
      ? 0
      : Number(estimated_cost);

  const normalizedActualCost =
    actual_cost === undefined || actual_cost === "" || actual_cost === null
      ? null
      : Number(actual_cost);

  const normalizedCostNote = normalizeNullableText(cost_note);

  if (!normalizedTitle) {
    return res.status(400).json({ message: "title required" });
  }

  if (!ALLOWED_PRIORITY.has(normalizedPriority)) {
    return res.status(400).json({ message: "Invalid priority" });
  }

  try {
    const authz = await ensureLeader(id, req.user.userId);

    if (!authz.ok) {
      return res.status(403).json({
        message: "Sadece proje lideri task oluşturabilir.",
      });
    }
    const membership = await ensureProjectMember(id, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const allAssignable = await ensureAssignableMembers(
      id,
      normalizedAssigneeIds,
    );
    if (!allAssignable) {
      return res.status(400).json({
        message: "One or more assigned users are not members of this project",
      });
    }

    const activeQ = await pool.query(
      `SELECT id, name, start_date, end_date
       FROM sprints
       WHERE project_id = $1 AND status = 'ACTIVE'
       ORDER BY start_date DESC
       LIMIT 1`,
      [id],
    );

    const activeSprint = activeQ.rows[0] || null;
    const sprintId = activeSprint ? activeSprint.id : null;

    const ins = await pool.query(
      `INSERT INTO tasks
      (
        project_id,
        sprint_id,
        title,
        description,
        status,
        created_by,
        priority,
        start_date,
        due_date,
        assigned_to,
        estimated_cost,
        actual_cost,
        cost_note
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING
        id,
        project_id,
        sprint_id,
        title,
        description,
        status,
        created_by,
        priority,
        start_date,
        due_date,
        assigned_to,
        estimated_cost,
        actual_cost,
        cost_note,
        created_at,
        updated_at`,
      [
        id,
        sprintId,
        normalizedTitle,
        normalizedDescription,
        "TODO",
        req.user.userId,
        normalizedPriority,
        normalizedStartDate,
        normalizedDueDate,
        primaryAssignedTo,
        normalizedEstimatedCost,
        normalizedActualCost,
        normalizedCostNote,
      ],
    );

    const task = ins.rows[0];

    await replaceTaskAssignees(task.id, normalizedAssigneeIds);

    const fullTask = await getFullTask(task.id);

    await notifyNewAssignees({
      beforeIds: [],
      afterIds: normalizedAssigneeIds,
      task,
      triggeredBy: req.user.userId,
    });

    await addLog({
      projectId: task.project_id,
      taskId: task.id,
      actorId: req.user.userId,
      action: "TASK_CREATED",
      message: `Task oluşturuldu: "${task.title}"`,
      meta: {
        priority: task.priority,
        assigned_to: task.assigned_to,
        sprint_id: task.sprint_id,
        estimated_cost: task.estimated_cost,
        actual_cost: task.actual_cost,
        cost_note: task.cost_note,
      },
    });

    emitProjectEvent(task.project_id, "project:task-created", {
      task: fullTask,
    });

    return res.status(201).json({
      task: fullTask,
      active_sprint: activeSprint,
    });
  } catch (err) {
    console.error("CREATE TASK ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function updateTask(req, res) {
  console.log("PATCH BODY:", req.body);

  const { taskId } = req.params;
  const {
    title,
    description,
    status,
    priority,
    start_date,
    due_date,
    assignee_ids,
    estimated_cost,
    actual_cost,
    cost_note,
  } = req.body;

  const normalizedStartDate = normalizeNullableValue(start_date);
  const normalizedTitle = normalizeText(title);
  const normalizedDescription = normalizeNullableText(description);
  const normalizedDueDate = normalizeNullableValue(due_date);
  const normalizedAssigneeIds =
    assignee_ids !== undefined ? normalizeAssigneeIds(assignee_ids) : undefined;

  const primaryAssignedTo =
    normalizedAssigneeIds !== undefined
      ? normalizedAssigneeIds[0] || null
      : undefined;

  const normalizedEstimatedCost =
    estimated_cost === undefined ||
    estimated_cost === "" ||
    estimated_cost === null
      ? null
      : Number(estimated_cost);

  const normalizedActualCost =
    actual_cost === undefined || actual_cost === "" || actual_cost === null
      ? null
      : Number(actual_cost);

  const normalizedCostNote = normalizeNullableText(cost_note);

  if (status !== undefined && !ALLOWED_STATUS.has(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  if (priority !== undefined && !ALLOWED_PRIORITY.has(priority)) {
    return res.status(400).json({ message: "Invalid priority" });
  }

  if (title !== undefined && !normalizedTitle) {
    return res.status(400).json({ message: "title cannot be empty" });
  }

  try {
    const before = await getTaskBase(taskId);

    if (!before) {
      return res.status(404).json({ message: "Task not found" });
    }

    const membership = await ensureProjectMember(
      before.project_id,
      req.user.userId,
    );

    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const authz = await ensureLeader(before.project_id, req.user.userId);
    const isLeader = authz.ok;

    const beforeFull = await getFullTask(taskId);

    const beforeAssigneeIds = Array.isArray(beforeFull?.assignee_ids)
      ? beforeFull.assignee_ids.map(String)
      : [];

    const isAssignedUser = beforeAssigneeIds.includes(String(req.user.userId));

    if (!isLeader) {
      const bodyKeys = Object.keys(req.body || {});
      const allowedMemberKeys = ["status", "actual_cost"];

      const hasForbiddenField = bodyKeys.some(
        (key) => !allowedMemberKeys.includes(key),
      );

      if (hasForbiddenField) {
        return res.status(403).json({
          message: "Sadece proje lideri task detaylarını düzenleyebilir.",
        });
      }

      if (status !== undefined && !isAssignedUser) {
        return res.status(403).json({
          message: "Bu task sana atanmadığı için durumunu değiştiremezsin.",
        });
      }
    }

    // DONE yapılacaksa dependency kontrolü
    if (status === "DONE") {
      const deps = await pool.query(
        `
        SELECT
          t.id,
          t.title,
          t.status
        FROM task_dependencies td
        JOIN tasks t ON t.id = td.depends_on_task_id
        WHERE td.task_id = $1
        `,
        [taskId],
      );

      const notDone = deps.rows.filter((d) => d.status !== "DONE");

      if (notDone.length > 0) {
        return res.status(400).json({
          message: "Bu task tamamlanamaz",
          blocking_dependencies: notDone.map((d) => ({
            id: d.id,
            title: d.title,
            status: d.status,
          })),
        });
      }
    }

    // assignee_ids değişiyorsa sadece LEADER
    if (assignee_ids !== undefined) {
      if (!isLeader) {
        return res.status(403).json({
          message: "Only LEADER can change assignees",
        });
      }

      const allAssignable = await ensureAssignableMembers(
        before.project_id,
        normalizedAssigneeIds,
      );

      if (!allAssignable) {
        return res.status(400).json({
          message: "One or more assigned users are not members of this project",
        });
      }
    }

    const fields = [];
    const values = [];
    let i = 1;

    if (title !== undefined) {
      fields.push(`title = $${i++}`);
      values.push(normalizedTitle);
    }

    if (description !== undefined) {
      fields.push(`description = $${i++}`);
      values.push(normalizedDescription);
    }

    if (status !== undefined) {
      fields.push(`status = $${i++}`);
      values.push(status);
    }

    if (priority !== undefined) {
      fields.push(`priority = $${i++}`);
      values.push(priority);
    }

    if (start_date !== undefined) {
      fields.push(`start_date = $${i++}`);
      values.push(normalizedStartDate);
    }

    if (due_date !== undefined) {
      fields.push(`due_date = $${i++}`);
      values.push(normalizedDueDate);
    }

    if (assignee_ids !== undefined) {
      fields.push(`assigned_to = $${i++}`);
      values.push(primaryAssignedTo);
    }

    if (estimated_cost !== undefined) {
      fields.push(`estimated_cost = $${i++}`);
      values.push(normalizedEstimatedCost);
    }

    if (actual_cost !== undefined) {
      if (status === "DONE" || before.status === "DONE") {
        fields.push(`actual_cost = $${i++}`);
        values.push(normalizedActualCost);
      } else {
        fields.push(`actual_cost = $${i++}`);
        values.push(null);
      }
    }

    if (cost_note !== undefined) {
      fields.push(`cost_note = $${i++}`);
      values.push(normalizedCostNote);
    }

    if (!fields.length) {
      return res.status(400).json({ message: "No fields to update" });
    }

    fields.push(`updated_at = NOW()`);

    values.push(taskId);
    const taskIdParam = i++;

    values.push(before.project_id);
    const projectIdParam = i++;

    const updated = await pool.query(
      `UPDATE tasks
       SET ${fields.join(", ")}
       WHERE id = $${taskIdParam}
         AND project_id = $${projectIdParam}
       RETURNING id`,
      values,
    );

    if (!updated.rows.length) {
      return res
        .status(404)
        .json({ message: "Task not found in this project" });
    }

    if (assignee_ids !== undefined) {
      await replaceTaskAssignees(taskId, normalizedAssigneeIds);
    }

    const after = await getFullTask(taskId);

    if (status !== undefined && before.status !== after.status) {
      const statusNotificationUserIds = Array.isArray(after.assignee_ids)
        ? after.assignee_ids.map(String)
        : after.assigned_to
          ? [String(after.assigned_to)]
          : [];

      for (const userId of statusNotificationUserIds) {
        if (String(userId) === String(req.user.userId)) continue;

        await createNotification({
          userId,
          type: "TASK_STATUS_CHANGED",
          title: "Task durumun güncellendi",
          body: `${after.title} (${before.status} → ${after.status})`,
          projectId: after.project_id,
          taskId: after.id,
          triggeredBy: req.user.userId,
        });
      }

      await addLog({
        projectId: after.project_id,
        taskId: after.id,
        actorId: req.user.userId,
        action: "STATUS_CHANGED",
        message: `Task durumu değişti: "${after.title}" (${before.status} → ${after.status})`,
        meta: { from: before.status, to: after.status },
      });
    }

    const titleChanged = title !== undefined && before.title !== after.title;

    const descChanged =
      description !== undefined &&
      (before.description || null) !== (after.description || null);

    const priorityChanged =
      priority !== undefined && before.priority !== after.priority;

    const startDateChanged =
      start_date !== undefined &&
      String(before.start_date || null) !== String(after.start_date || null);

    const dueDateChanged =
      due_date !== undefined &&
      String(before.due_date || null) !== String(after.due_date || null);

    const estimatedCostChanged =
      estimated_cost !== undefined &&
      Number(before.estimated_cost || 0) !== Number(after.estimated_cost || 0);

    const actualCostChanged =
      actual_cost !== undefined &&
      Number(before.actual_cost || 0) !== Number(after.actual_cost || 0);

    const costNoteChanged =
      cost_note !== undefined &&
      String(before.cost_note || "") !== String(after.cost_note || "");

    if (
      titleChanged ||
      descChanged ||
      priorityChanged ||
      startDateChanged ||
      dueDateChanged ||
      estimatedCostChanged ||
      actualCostChanged ||
      costNoteChanged
    ) {
      await addLog({
        projectId: after.project_id,
        taskId: after.id,
        actorId: req.user.userId,
        action: "TASK_UPDATED",
        message: `Task güncellendi: "${after.title}"`,
        meta: {
          titleChanged,
          descChanged,
          priorityChanged,
          startDateChanged,
          dueDateChanged,
          estimatedCostChanged,
          actualCostChanged,
          costNoteChanged,
        },
      });
    }

    const afterAssigneeIds = Array.isArray(after?.assignee_ids)
      ? after.assignee_ids.map(String)
      : [];

    const assigneeChanged =
      assignee_ids !== undefined &&
      JSON.stringify([...beforeAssigneeIds].sort()) !==
        JSON.stringify([...afterAssigneeIds].sort());

    if (assigneeChanged) {
      await notifyNewAssignees({
        beforeIds: beforeAssigneeIds,
        afterIds: afterAssigneeIds,
        task: after,
        triggeredBy: req.user.userId,
      });

      await addLog({
        projectId: after.project_id,
        taskId: after.id,
        actorId: req.user.userId,
        action: "TASK_ASSIGNED",
        message: `Task ataması değişti: "${after.title}"`,
        meta: {
          from: beforeAssigneeIds,
          to: afterAssigneeIds,
        },
      });
    }

    emitProjectEvent(after.project_id, "project:task-updated", {
      task: after,
    });

    return res.json(after);
  } catch (err) {
    console.error("UPDATE TASK ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function assignTask(req, res) {
  const { taskId } = req.params;
  const { assignee_ids } = req.body;

  try {
    const before = await getTaskBase(taskId);
    if (!before) {
      return res.status(404).json({ message: "Task not found" });
    }

    const authz = await ensureLeader(before.project_id, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res
          .status(403)
          .json({ message: "Not a member of this project" });
      }
      return res.status(403).json({ message: "Only LEADER can assign tasks" });
    }

    const beforeFull = await getFullTask(taskId);
    const normalizedAssigneeIds = normalizeAssigneeIds(assignee_ids);

    const allAssignable = await ensureAssignableMembers(
      before.project_id,
      normalizedAssigneeIds,
    );

    if (!allAssignable) {
      return res.status(400).json({
        message: "One or more assigned users are not members of this project",
      });
    }

    const primaryAssignedTo = normalizedAssigneeIds[0] || null;

    await pool.query(
      `UPDATE tasks
       SET assigned_to = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [primaryAssignedTo, taskId],
    );

    await replaceTaskAssignees(taskId, normalizedAssigneeIds);

    const after = await getFullTask(taskId);

    const beforeAssigneeIds = beforeFull?.assignee_ids || [];
    const afterAssigneeIds = after?.assignee_ids || [];

    const assigneeChanged =
      JSON.stringify([...beforeAssigneeIds].sort()) !==
      JSON.stringify([...afterAssigneeIds].sort());

    if (assigneeChanged) {
      await notifyNewAssignees({
        beforeIds: beforeAssigneeIds,
        afterIds: afterAssigneeIds,
        task: after,
        triggeredBy: req.user.userId,
      });

      await addLog({
        projectId: after.project_id,
        taskId: after.id,
        actorId: req.user.userId,
        action: "TASK_ASSIGNED",
        message: `Task ataması değişti: "${after.title}"`,
        meta: {
          from: beforeAssigneeIds,
          to: afterAssigneeIds,
        },
      });
    }

    emitProjectEvent(after.project_id, "project:task-updated", {
      task: after,
    });

    return res.json({ task: after });
  } catch (err) {
    console.error("ASSIGN TASK ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function deleteTask(req, res) {
  const { taskId } = req.params;

  try {
    const task = await getTaskBase(taskId);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const authz = await ensureLeader(task.project_id, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res
          .status(403)
          .json({ message: "Not a member of this project" });
      }
      return res.status(403).json({ message: "Only LEADER can delete tasks" });
    }

    await addLog({
      projectId: task.project_id,
      taskId: task.id,
      actorId: req.user.userId,
      action: "TASK_DELETED",
      message: `Task silindi: "${task.title}"`,
      meta: { title: task.title },
    });

    await pool.query(`DELETE FROM tasks WHERE id = $1`, [taskId]);

    emitProjectEvent(task.project_id, "project:task-deleted", {
      taskId,
    });

    return res.json({ message: "Deleted" });
  } catch (err) {
    console.error("DELETE TASK ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getProjectActivity(req, res) {
  const { id } = req.params;

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  try {
    const membership = await ensureProjectMember(id, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM task_logs
       WHERE project_id = $1`,
      [id],
    );

    const result = await pool.query(
      `SELECT
          l.id,
          l.project_id,
          l.task_id,
          l.action,
          l.message,
          l.meta,
          l.created_at,

          u.id AS actor_id,
          u.full_name AS actor_name,
          u.email AS actor_email,

          t.title AS task_title
       FROM task_logs l
       JOIN users u ON u.id = l.actor_id
       LEFT JOIN tasks t ON t.id = l.task_id
       WHERE l.project_id = $1
       ORDER BY l.created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset],
    );

    const total = totalResult.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return res.json({
      logs: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error("GET ACTIVITY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getBacklogCount(req, res) {
  const { id } = req.params;

  try {
    const membership = await ensureProjectMember(id, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const q = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM tasks
       WHERE project_id = $1 AND sprint_id IS NULL`,
      [id],
    );

    return res.json({ count: q.rows[0].count });
  } catch (err) {
    console.error("GET BACKLOG COUNT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getBacklogTasks(req, res) {
  const { id } = req.params;

  try {
    const membership = await ensureProjectMember(id, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const q = await pool.query(
      `
      SELECT
        id,
        title,
        description,
        status,
        priority,
        start_date,
        due_date,
        estimated_cost,
        actual_cost,
        cost_note,
        subtasks,
        acceptance_criteria,
        created_at,
        updated_at
      FROM tasks
      WHERE project_id = $1
        AND sprint_id IS NULL
      ORDER BY created_at DESC
      `,
      [id],
    );

    return res.json({ tasks: q.rows });
  } catch (err) {
    console.error("GET BACKLOG TASKS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getProjectActivity,
  getTaskById,
  getBacklogCount,
  getBacklogTasks,
  assignTask,
  getDependencies,
  setDependencies,
  getProjectTaskDependencyGraph,
};
