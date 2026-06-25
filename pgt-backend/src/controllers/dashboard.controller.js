const pool = require("../config/db.js");

/**
 * Bu controller, kullanıcıya ait gösterge paneli verilerini oluşturur.
 * Kullanıcının proje, görev ve aktif sprint istatistiklerini analiz ederek özet bilgiler döndürür.
 */

async function getDashboardSummary(req, res) {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `
      WITH my_projects AS (
        SELECT p.id, pm.role
        FROM project_members pm
        JOIN projects p ON p.id = pm.project_id
        WHERE pm.user_id = $1
          AND p.is_archived = false
      ),
      active_sprints AS (
        SELECT s.id, s.project_id
        FROM sprints s
        JOIN my_projects mp ON mp.id = s.project_id
        WHERE s.status = 'ACTIVE'
      ),
      active_tasks AS (
        SELECT t.*
        FROM tasks t
        JOIN active_sprints s ON s.id = t.sprint_id
      ),
      all_tasks AS (
        SELECT t.*
        FROM tasks t
        JOIN my_projects mp ON mp.id = t.project_id
      )
      SELECT
        (SELECT COUNT(*) FROM my_projects) AS project_count,

        (SELECT COUNT(*) FROM my_projects WHERE role = 'LEADER') AS leader_project_count,

        (SELECT COUNT(*) FROM my_projects WHERE role = 'MEMBER') AS member_project_count,

        (
          SELECT COUNT(*)
          FROM all_tasks
          WHERE assigned_to = $1
            AND status != 'DONE'
        ) AS assigned_to_me_count,

        EXISTS (SELECT 1 FROM active_sprints) AS has_active_sprint,

        (SELECT COUNT(*) FROM active_tasks) AS active_sprint_task_count,

        (
          SELECT COUNT(*)
          FROM active_tasks
          WHERE status = 'DONE'
        ) AS active_sprint_done_count,

        (
          SELECT COUNT(*)
          FROM active_tasks
          WHERE status = 'TODO'
        ) AS active_sprint_todo_count,

        (
          SELECT COUNT(*)
          FROM active_tasks
          WHERE status IN ('IN_PROGRESS', 'DOING')
        ) AS active_sprint_in_progress_count,

        (
          SELECT COUNT(*)
          FROM active_tasks
          WHERE due_date < CURRENT_DATE
            AND status != 'DONE'
        ) AS active_sprint_overdue_count,

        (
          SELECT COUNT(*)
          FROM active_tasks
          WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 2
            AND status != 'DONE'
        ) AS active_sprint_due_soon_count,

        -- fallback için tüm proje verileri
        (SELECT COUNT(*) FROM all_tasks) AS project_task_count,

        (
          SELECT COUNT(*)
          FROM all_tasks
          WHERE status = 'DONE'
        ) AS project_done_count,

        (
          SELECT COUNT(*)
          FROM all_tasks
          WHERE status = 'TODO'
        ) AS project_todo_count,

        (
          SELECT COUNT(*)
          FROM all_tasks
          WHERE status IN ('IN_PROGRESS', 'DOING')
        ) AS project_in_progress_count,

        (
          SELECT COUNT(*)
          FROM all_tasks
          WHERE due_date < CURRENT_DATE
            AND status != 'DONE'
        ) AS project_overdue_count,

        (
          SELECT COUNT(*)
          FROM all_tasks
          WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 2
            AND status != 'DONE'
        ) AS project_due_soon_count
      `,
      [userId]
    );

    return res.json({
      summary: result.rows[0],
    });
  } catch (err) {
    console.error("DASHBOARD SUMMARY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = { getDashboardSummary };