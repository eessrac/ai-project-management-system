const pool = require("../config/db");

// transaction client ile çalışacak
async function createSprintArchiveSnapshot(client, { projectId, sprintId }) {
  // 1. sprint bilgisini çek
  const sprintQ = await client.query(
    `SELECT id, name, start_date, end_date
     FROM sprints
     WHERE id = $1 AND project_id = $2`,
    [sprintId, projectId]
  );

  if (!sprintQ.rows.length) {
    throw new Error("Sprint not found for archive");
  }

  const sprint = sprintQ.rows[0];

  // 2. taskları çek
  const tasksQ = await client.query(
    `SELECT
       t.id,
       t.title,
       t.description,
       t.status,
       t.priority,
       t.due_date,
       t.assigned_to,
       u1.full_name AS assigned_to_name,
       t.created_by,
       u2.full_name AS created_by_name,
       t.estimated_cost,
       t.actual_cost,
       t.cost_note,
       t.created_at,
       t.updated_at
     FROM tasks t
     LEFT JOIN users u1 ON u1.id = t.assigned_to
     LEFT JOIN users u2 ON u2.id = t.created_by
     WHERE t.project_id = $1 AND t.sprint_id = $2`,
    [projectId, sprintId]
  );

  const tasks = tasksQ.rows;

  // 3. metrik hesapla
  let done = 0;
  let todo = 0;
  let inProgress = 0;
  let overdue = 0;

  const today = new Date();

  for (const t of tasks) {
    if (t.status === "DONE") done++;
    else if (t.status === "TODO") todo++;
    else inProgress++;

    if (t.due_date && new Date(t.due_date) < today && t.status !== "DONE") {
      overdue++;
    }
  }

  const total = tasks.length;
  const completionRate = total === 0 ? 0 : (done / total) * 100;

  // 4. archive ana kaydı oluştur
  const archiveQ = await client.query(
    `INSERT INTO sprint_archives
     (sprint_id, project_id, sprint_name, start_date, end_date,
      total_task_count, done_task_count, todo_task_count,
      in_progress_task_count, overdue_task_count, completion_rate)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id`,
    [
      sprint.id,
      projectId,
      sprint.name,
      sprint.start_date,
      sprint.end_date,
      total,
      done,
      todo,
      inProgress,
      overdue,
      completionRate,
    ]
  );

  const archiveId = archiveQ.rows[0].id;

  // 5. task snapshot kaydet
  for (const t of tasks) {
    const insertTaskQ = await client.query(
      `INSERT INTO sprint_archive_tasks
       (archive_id, original_task_id, project_id, sprint_id,
        title, description, status, priority, due_date,
        assigned_to, assigned_to_name,
        created_by, created_by_name,
        estimated_cost, actual_cost, cost_note,
        original_created_at, original_updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [
        archiveId,
        t.id,
        projectId,
        sprintId,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.due_date,
        t.assigned_to,
        t.assigned_to_name,
        t.created_by,
        t.created_by_name,
        t.estimated_cost,
        t.actual_cost,
        t.cost_note,
        t.created_at,
        t.updated_at,
      ]
    );

    const archiveTaskId = insertTaskQ.rows[0].id;

    // 6. yorum snapshot
    const commentsQ = await client.query(
      `SELECT c.id, c.body, c.created_at,
              c.author_id,
              u.full_name AS author_name
       FROM task_comments c
       LEFT JOIN users u ON u.id = c.author_id
       WHERE c.task_id = $1`,
      [t.id]
    );

    for (const c of commentsQ.rows) {
      await client.query(
        `INSERT INTO sprint_archive_comments
         (archive_task_id, original_comment_id, author_id, author_name, body, created_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          archiveTaskId,
          c.id,
          c.author_id,
          c.author_name,
          c.body,
          c.created_at,
        ]
      );
    }

    // 7. activity snapshot
    const logsQ = await client.query(
      `SELECT l.id, l.action, l.message, l.meta, l.created_at,
              l.actor_id,
              u.full_name AS actor_name
       FROM task_logs l
       LEFT JOIN users u ON u.id = l.actor_id
       WHERE l.task_id = $1`,
      [t.id]
    );

    for (const log of logsQ.rows) {
      await client.query(
        `INSERT INTO sprint_archive_activities
         (archive_task_id, original_log_id, actor_id, actor_name,
          action, message, meta, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          archiveTaskId,
          log.id,
          log.actor_id,
          log.actor_name,
          log.action,
          log.message,
          log.meta,
          log.created_at,
        ]
      );
    }
  }

  console.log("SNAPSHOT CREATED:", {
    sprintId,
    archiveId,
    totalTasks: total,
  });

  return archiveId;
}

module.exports = {
  createSprintArchiveSnapshot,
};