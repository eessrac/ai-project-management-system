const pool = require("../config/db.js"); // .js ekle (resolve karmaşasını bitirir)
const generateJoinCode = require("../utils/joinCode");
const { ensureProjectMember, ensureLeader } = require("../utils/projectAuth");
const { createNotification } = require("../utils/notification");
const { sendMail } = require("../utils/mailer");
const { askAI } = require("../services/qwen.service");

/**
 * Bu controller, proje yönetimi işlemlerini yönetir.
 * Proje oluşturma, güncelleme, arşivleme, üye yönetimi, katılım istekleri,
 * iş yükü analizi ve proje özetlerinin oluşturulması gibi işlemleri gerçekleştirir.
 */

async function createProject(req, res) {
  const { name, description, sprint_duration_days, color, template_type } =
    req.body;

  const safeTemplateType = String(template_type || "blank").trim();
  const durationDays = Number(sprint_duration_days || 14);
  const projectColor = color || "#4F46E5";

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "name required" });
  }

  try {
    // Çakışma olursa tekrar dene (pratik + güvenli çözüm)
    let join_code = generateJoinCode(8);
    let ok = false;

    for (let i = 0; i < 5; i++) {
      const exists = await pool.query(
        "SELECT id FROM projects WHERE join_code=$1",
        [join_code],
      );
      if (!exists.rows.length) {
        ok = true;
        break;
      }
      join_code = generateJoinCode(8);
    }

    if (!ok) {
      return res
        .status(500)
        .json({ message: "Could not generate unique join code" });
    }

    const projectIns = await pool.query(
      `INSERT INTO projects 
        (name, description, join_code, created_by, sprint_duration_days, color, template_type)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING 
        id, name, description, join_code, created_at, created_by,
        sprint_duration_days, color, template_type`,
      [
        String(name).trim(),
        description && String(description).trim()
          ? String(description).trim()
          : null,
        join_code,
        req.user.userId,
        durationDays,
        projectColor,
        safeTemplateType,
      ],
    );

    const project = projectIns.rows[0];

    await pool.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1,$2,'LEADER')`,
      [project.id, req.user.userId],
    );

    return res.status(201).json({ project });
  } catch (err) {
    console.error("CREATE PROJECT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function myProjects(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        p.description,
        p.color,
        p.sprint_duration_days,
        p.template_type,
        CASE WHEN pm.role = 'LEADER' THEN p.join_code ELSE NULL END AS join_code,
        pm.role AS my_role,
        p.created_at,

        (SELECT COUNT(*)::int
         FROM project_members pm2
         WHERE pm2.project_id = p.id) AS member_count,

        -- Sprint sayısı
        (SELECT COUNT(*)::int
         FROM sprints s
         WHERE s.project_id = p.id) AS sprint_count,

        -- Aktif sprint adı
        (SELECT s.name
         FROM sprints s
         WHERE s.project_id = p.id
           AND s.status = 'ACTIVE'
         ORDER BY s.start_date DESC
         LIMIT 1) AS active_sprint_name,

        -- Tüm proje görev sayısı
        (SELECT COUNT(*)::int
         FROM tasks t
         WHERE t.project_id = p.id) AS project_task_total,

        -- Tamamlanan görev sayısı
        (SELECT COUNT(*)::int
         FROM tasks t
         WHERE t.project_id = p.id
           AND t.status = 'DONE') AS project_task_done,

        -- Frontend uyumluluğu için aynı değer
        (SELECT COUNT(*)::int
         FROM tasks t
         WHERE t.project_id = p.id
           AND t.status = 'DONE') AS done_task_count,

        -- İlerleme yüzdesi
        CASE
          WHEN (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) = 0 THEN 0
          ELSE ROUND(
            (
              (SELECT COUNT(*)::numeric
               FROM tasks t
               WHERE t.project_id = p.id
                 AND t.status = 'DONE')
              /
              (SELECT COUNT(*)::numeric
               FROM tasks t
               WHERE t.project_id = p.id)
            ) * 100
          )::int
        END AS progress,

        (SELECT COUNT(*)::int
         FROM tasks t
         WHERE t.project_id = p.id
           AND t.due_date IS NOT NULL
           AND t.due_date < NOW()
           AND t.status <> 'DONE') AS project_overdue_count,

        (SELECT COUNT(*)::int
         FROM tasks t
         WHERE t.project_id = p.id
           AND t.due_date IS NOT NULL
           AND t.due_date >= NOW()
           AND t.due_date < (NOW() + INTERVAL '2 days')
           AND t.status <> 'DONE') AS project_due_soon_count,

        (SELECT COUNT(*)::int
         FROM tasks t
         WHERE t.project_id = p.id
           AND t.assigned_to = $1
           AND t.status <> 'DONE') AS project_assigned_to_me_count,

        -- Aktif sprint toplam görev
        (SELECT COUNT(*)::int
         FROM tasks t
         WHERE t.project_id = p.id
           AND t.sprint_id = (
             SELECT s.id
             FROM sprints s
             WHERE s.project_id = p.id
               AND s.status = 'ACTIVE'
             ORDER BY s.start_date DESC
             LIMIT 1
           )
        ) AS active_task_total,

        -- Aktif sprint tamamlanan görev
        (SELECT COUNT(*)::int
         FROM tasks t
         WHERE t.project_id = p.id
           AND t.status = 'DONE'
           AND t.sprint_id = (
             SELECT s.id
             FROM sprints s
             WHERE s.project_id = p.id
               AND s.status = 'ACTIVE'
             ORDER BY s.start_date DESC
             LIMIT 1
           )
        ) AS active_task_done,

        (SELECT COUNT(*)::int
         FROM tasks t
         WHERE t.project_id = p.id
           AND t.sprint_id = (
             SELECT s.id
             FROM sprints s
             WHERE s.project_id = p.id
               AND s.status = 'ACTIVE'
             ORDER BY s.start_date DESC
             LIMIT 1
           )
           AND t.due_date IS NOT NULL
           AND t.due_date < NOW()
           AND t.status <> 'DONE'
        ) AS active_overdue_count,

        (SELECT COUNT(*)::int
         FROM tasks t
         WHERE t.project_id = p.id
           AND t.sprint_id = (
             SELECT s.id
             FROM sprints s
             WHERE s.project_id = p.id
               AND s.status = 'ACTIVE'
             ORDER BY s.start_date DESC
             LIMIT 1
           )
           AND t.due_date IS NOT NULL
           AND t.due_date >= NOW()
           AND t.due_date < (NOW() + INTERVAL '2 days')
           AND t.status <> 'DONE'
        ) AS active_due_soon_count,

        (SELECT COUNT(*)::int
         FROM tasks t
         WHERE t.project_id = p.id
           AND t.sprint_id = (
             SELECT s.id
             FROM sprints s
             WHERE s.project_id = p.id
               AND s.status = 'ACTIVE'
             ORDER BY s.start_date DESC
             LIMIT 1
           )
           AND t.assigned_to = $1
           AND t.status <> 'DONE'
        ) AS active_assigned_to_me_count,
         -- Son aktivite tarihi
        (SELECT MAX(tl.created_at)
        FROM task_logs tl
        WHERE tl.project_id = p.id) AS last_activity_at,

        -- Son 7 gündeki aktivite sayısı
        (SELECT COUNT(*)::int
        FROM task_logs tl
        WHERE tl.project_id = p.id
          AND tl.created_at >= NOW() - INTERVAL '7 days') AS activity_count

      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = $1
        AND p.is_archived = FALSE
      ORDER BY p.created_at DESC
      `,
      [req.user.userId],
    );

    return res.json({ projects: result.rows });
  } catch (err) {
    console.error("MY PROJECTS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function joinProject(req, res) {
  const { join_code } = req.body;
  const code = String(join_code || "")
    .trim()
    .toUpperCase();
  const currentUserId = req.user.userId;

  if (!code) {
    return res.status(400).json({ message: "join_code required" });
  }

  try {
    const projectQ = await pool.query(
      `
      SELECT id, name, description, join_code, created_at, created_by, is_archived
      FROM projects
      WHERE join_code = $1
      `,
      [code],
    );

    if (!projectQ.rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    const project = projectQ.rows[0];

    if (project.is_archived) {
      return res
        .status(400)
        .json({ message: "Archived project cannot accept join requests" });
    }

    // Zaten üye mi?
    const membershipQ = await pool.query(
      `
      SELECT role
      FROM project_members
      WHERE project_id = $1 AND user_id = $2
      `,
      [project.id, currentUserId],
    );

    if (membershipQ.rows.length) {
      return res.json({
        message: "Zaten bu projenin üyesisin",
        project,
        my_role: membershipQ.rows[0].role,
      });
    }

    // Proje sahibi kendi koduyla istek atmasın
    if (String(project.created_by) === String(currentUserId)) {
      return res
        .status(400)
        .json({ message: "Project owner is already part of the project" });
    }

    // Bekleyen istek var mı?
    const pendingQ = await pool.query(
      `
      SELECT id, status, created_at
      FROM project_join_requests
      WHERE project_id = $1
        AND requester_id = $2
        AND status = 'PENDING'
      LIMIT 1
      `,
      [project.id, currentUserId],
    );

    if (pendingQ.rows.length) {
      return res.status(400).json({
        message: "Bu proje için zaten bekleyen bir katılım isteğin var",
        request: pendingQ.rows[0],
      });
    }

    const userQ = await pool.query(
      `SELECT id, full_name, email FROM users WHERE id = $1`,
      [currentUserId],
    );

    const requester = userQ.rows[0];

    const requestIns = await pool.query(
      `
      INSERT INTO project_join_requests (project_id, requester_id, join_code, status)
      VALUES ($1, $2, $3, 'PENDING')
      RETURNING *
      `,
      [project.id, currentUserId, code],
    );

    const joinRequest = requestIns.rows[0];

    await pool.query(
      `INSERT INTO task_logs (project_id, task_id, action, message, meta, actor_id)
       VALUES ($1, NULL, $2, $3, $4, $5)`,
      [
        project.id,
        "JOIN_REQUEST_CREATED",
        `Katılım isteği gönderildi: "${requester.full_name}"`,
        JSON.stringify({
          request_id: joinRequest.id,
          requester_id: requester.id,
          requester_name: requester.full_name,
          requester_email: requester.email,
        }),
        currentUserId,
      ],
    );

    // Liderlere bildirim
    const leadersQ = await pool.query(
      `
      SELECT pm.user_id
      FROM project_members pm
      WHERE pm.project_id = $1
        AND pm.role = 'LEADER'
      `,
      [project.id],
    );

    for (const leader of leadersQ.rows) {
      await createNotification({
        userId: leader.user_id,
        type: "PROJECT_JOIN_REQUEST",
        title: "Yeni katılım isteği",
        body: `${requester.full_name} projeye katılmak istiyor`,
        projectId: project.id,
        triggeredBy: currentUserId,
      });
    }

    const appUrl = process.env.APP_URL || "http://localhost:5173";
    const projectSettingsUrl = `${appUrl}/projects/${project.id}/settings`;

    const leaderEmailsQ = await pool.query(
      `
      SELECT u.email, u.full_name
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1
        AND pm.role = 'LEADER'
        AND u.email IS NOT NULL
      `,
      [project.id],
    );

    for (const leader of leaderEmailsQ.rows) {
      try {
        await sendMail({
          to: leader.email,
          fromName: `${requester.full_name} via PGT`,
          subject: `Yeni katılım isteği • ${project.name}`,
          text:
            `${requester.full_name} (${requester.email}) "${project.name}" projesine katılmak istiyor.\n\n` +
            `İstekleri görmek için: ${projectSettingsUrl}`,
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6">
              <h2>Yeni katılım isteği</h2>
              <p><strong>${requester.full_name}</strong> (${requester.email}) adlı kullanıcı
              <strong>${project.name}</strong> projesine katılmak istiyor.</p>
              <p>
                <a href="${projectSettingsUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">
                  İstekleri Gör
                </a>
              </p>
            </div>
          `,
        });
      } catch (mailErr) {
        console.error("JOIN REQUEST MAIL ERROR:", mailErr);
      }
    }

    return res.status(201).json({
      message: "Katılım isteği başarıyla gönderildi",
      request: joinRequest,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        created_at: project.created_at,
      },
    });
  } catch (err) {
    console.error("JOIN PROJECT REQUEST ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getProjectJoinRequests(req, res) {
  const { id } = req.params;

  try {
    const authz = await ensureLeader(id, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res
          .status(403)
          .json({ message: "Not a member of this project" });
      }
      return res
        .status(403)
        .json({ message: "Only LEADER can view join requests" });
    }

    const result = await pool.query(
      `
      SELECT
        pjr.id,
        pjr.project_id,
        pjr.requester_id,
        pjr.join_code,
        pjr.status,
        pjr.reviewed_by,
        pjr.reviewed_at,
        pjr.created_at,
        u.full_name AS requester_name,
        u.email AS requester_email
      FROM project_join_requests pjr
      JOIN users u ON u.id = pjr.requester_id
      WHERE pjr.project_id = $1
      ORDER BY
        CASE WHEN pjr.status = 'PENDING' THEN 0 ELSE 1 END,
        pjr.created_at DESC
      `,
      [id],
    );

    return res.json({ requests: result.rows });
  } catch (err) {
    console.error("GET PROJECT JOIN REQUESTS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function approveProjectJoinRequest(req, res) {
  const { requestId } = req.params;
  const currentUserId = req.user.userId;
  const actorQ = await pool.query(
    `SELECT full_name, email FROM users WHERE id = $1`,
    [currentUserId],
  );

  const actorName = actorQ.rows[0]?.full_name || "PGT Proje Sistemi";

  try {
    const requestQ = await pool.query(
      `
      SELECT
        pjr.*,
        p.name AS project_name,
        p.is_archived,
        u.full_name AS requester_name,
        u.email AS requester_email
      FROM project_join_requests pjr
      JOIN projects p ON p.id = pjr.project_id
      JOIN users u ON u.id = pjr.requester_id
      WHERE pjr.id = $1
      `,
      [requestId],
    );

    if (!requestQ.rows.length) {
      return res.status(404).json({ message: "Join request not found" });
    }

    const request = requestQ.rows[0];

    const authz = await ensureLeader(request.project_id, currentUserId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res
          .status(403)
          .json({ message: "Not a member of this project" });
      }
      return res
        .status(403)
        .json({ message: "Only LEADER can approve join requests" });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        message: `This request is already ${request.status.toLowerCase()}`,
      });
    }

    if (request.is_archived) {
      return res
        .status(400)
        .json({ message: "Archived project cannot accept new members" });
    }

    const alreadyMemberQ = await pool.query(
      `
      SELECT role
      FROM project_members
      WHERE project_id = $1 AND user_id = $2
      `,
      [request.project_id, request.requester_id],
    );

    if (alreadyMemberQ.rows.length) {
      await pool.query(
        `
        UPDATE project_join_requests
        SET status = 'APPROVED',
            reviewed_by = $2,
            reviewed_at = NOW()
        WHERE id = $1
        `,
        [requestId, currentUserId],
      );

      return res.json({
        message: "User is already a member; request marked as approved",
      });
    }

    await pool.query("BEGIN");

    await pool.query(
      `
      INSERT INTO project_members (project_id, user_id, role)
      VALUES ($1, $2, 'MEMBER')
      `,
      [request.project_id, request.requester_id],
    );

    await pool.query(
      `
      UPDATE project_join_requests
      SET status = 'APPROVED',
          reviewed_by = $2,
          reviewed_at = NOW()
      WHERE id = $1
      `,
      [requestId, currentUserId],
    );

    await pool.query(
      `INSERT INTO task_logs (project_id, task_id, action, message, meta, actor_id)
       VALUES ($1, NULL, $2, $3, $4, $5)`,
      [
        request.project_id,
        "JOIN_REQUEST_APPROVED",
        `Katılım isteği onaylandı: "${request.requester_name}"`,
        JSON.stringify({
          request_id: request.id,
          requester_id: request.requester_id,
          requester_name: request.requester_name,
          requester_email: request.requester_email,
        }),
        currentUserId,
      ],
    );

    await createNotification({
      userId: request.requester_id,
      type: "PROJECT_JOIN_REQUEST_APPROVED",
      title: "Katılım isteğin onaylandı",
      body: request.project_name,
      projectId: request.project_id,
      triggeredBy: currentUserId,
    });

    const appUrl = process.env.APP_URL || "http://localhost:5173";
    const projectUrl = `${appUrl}/projects/${request.project_id}`;

    try {
      await sendMail({
        to: request.requester_email,
        fromName: `${actorName} via PGT`,
        subject: `Katılım isteğin onaylandı • ${request.project_name}`,
        text:
          `"${request.project_name}" projesine katılım isteğin onaylandı.\n\n` +
          `Projeye git: ${projectUrl}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6">
            <h2>Katılım isteğin onaylandı</h2>
            <p><strong>${request.project_name}</strong> projesine katılım isteğin onaylandı.</p>
            <p>
              <a href="${projectUrl}" style="display:inline-block;padding:10px 16px;background:#166534;color:#fff;text-decoration:none;border-radius:8px;">
                Projeye Git
              </a>
            </p>
          </div>
        `,
      });
    } catch (mailErr) {
      console.error("APPROVE JOIN REQUEST MAIL ERROR:", mailErr);
    }

    await pool.query("COMMIT");

    return res.json({
      message: "Katılım isteği başarıyla onaylandı",
      approved_user: {
        id: request.requester_id,
        full_name: request.requester_name,
        email: request.requester_email,
        role: "MEMBER",
      },
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("APPROVE PROJECT JOIN REQUEST ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function rejectProjectJoinRequest(req, res) {
  const { requestId } = req.params;
  const currentUserId = req.user.userId;
  const actorQ = await pool.query(
    `SELECT full_name, email FROM users WHERE id = $1`,
    [currentUserId],
  );

  const actorName = actorQ.rows[0]?.full_name || "PGT Proje Sistemi";

  try {
    const requestQ = await pool.query(
      `
      SELECT
        pjr.*,
        p.name AS project_name,
        u.full_name AS requester_name,
        u.email AS requester_email
      FROM project_join_requests pjr
      JOIN projects p ON p.id = pjr.project_id
      JOIN users u ON u.id = pjr.requester_id
      WHERE pjr.id = $1
      `,
      [requestId],
    );

    if (!requestQ.rows.length) {
      return res.status(404).json({ message: "Join request not found" });
    }

    const request = requestQ.rows[0];

    const authz = await ensureLeader(request.project_id, currentUserId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res
          .status(403)
          .json({ message: "Not a member of this project" });
      }
      return res
        .status(403)
        .json({ message: "Only LEADER can reject join requests" });
    }

    if (request.status !== "PENDING") {
      return res.status(400).json({
        message: `This request is already ${request.status.toLowerCase()}`,
      });
    }

    await pool.query(
      `
      UPDATE project_join_requests
      SET status = 'REJECTED',
          reviewed_by = $2,
          reviewed_at = NOW()
      WHERE id = $1
      `,
      [requestId, currentUserId],
    );

    await pool.query(
      `INSERT INTO task_logs (project_id, task_id, action, message, meta, actor_id)
       VALUES ($1, NULL, $2, $3, $4, $5)`,
      [
        request.project_id,
        "JOIN_REQUEST_REJECTED",
        `Katılım isteği reddedildi: "${request.requester_name}"`,
        JSON.stringify({
          request_id: request.id,
          requester_id: request.requester_id,
          requester_name: request.requester_name,
          requester_email: request.requester_email,
        }),
        currentUserId,
      ],
    );

    await createNotification({
      userId: request.requester_id,
      type: "PROJECT_JOIN_REQUEST_REJECTED",
      title: "Katılım isteğin reddedildi",
      body: request.project_name,
      projectId: request.project_id,
      triggeredBy: currentUserId,
    });

    try {
      await sendMail({
        to: request.requester_email,
        fromName: `${actorName} via PGT`,
        subject: `Katılım isteğin reddedildi • ${request.project_name}`,
        text: `"${request.project_name}" projesine katılım isteğin reddedildi.`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6">
            <h2>Katılım isteğin reddedildi</h2>
            <p><strong>${request.project_name}</strong> projesine katılım isteğin reddedildi.</p>
          </div>
        `,
      });
    } catch (mailErr) {
      console.error("REJECT JOIN REQUEST MAIL ERROR:", mailErr);
    }

    return res.json({
      message: "Katılım isteği başarıyla reddedildi",
    });
  } catch (err) {
    console.error("REJECT PROJECT JOIN REQUEST ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function myJoinRequests(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        pjr.id,
        pjr.project_id,
        pjr.join_code,
        pjr.status,
        pjr.reviewed_by,
        pjr.reviewed_at,
        pjr.created_at,
        p.name AS project_name
      FROM project_join_requests pjr
      JOIN projects p ON p.id = pjr.project_id
      WHERE pjr.requester_id = $1
      ORDER BY pjr.created_at DESC
      `,
      [req.user.userId],
    );

    return res.json({ requests: result.rows });
  } catch (err) {
    console.error("MY JOIN REQUESTS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function regenerateJoinCode(req, res) {
  const { id } = req.params;

  try {
    const authz = await ensureLeader(id, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res
          .status(403)
          .json({ message: "Not a member of this project" });
      }
      return res
        .status(403)
        .json({ message: "Only LEADER can regenerate join code" });
    }

    const projectQ = await pool.query(
      `SELECT id, name, join_code
       FROM projects
       WHERE id = $1`,
      [id],
    );

    if (!projectQ.rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    let nextJoinCode = generateJoinCode(8);
    let ok = false;

    for (let i = 0; i < 5; i++) {
      const exists = await pool.query(
        `SELECT id FROM projects WHERE join_code = $1`,
        [nextJoinCode],
      );

      if (!exists.rows.length) {
        ok = true;
        break;
      }

      nextJoinCode = generateJoinCode(8);
    }

    if (!ok) {
      return res
        .status(500)
        .json({ message: "Could not generate unique join code" });
    }

    const updated = await pool.query(
      `UPDATE projects
       SET join_code = $1
       WHERE id = $2
       RETURNING id, name, description, join_code, created_by, created_at`,
      [nextJoinCode, id],
    );

    await pool.query(
      `INSERT INTO task_logs (project_id, task_id, action, message, meta, actor_id)
      VALUES ($1, NULL, $2, $3, $4, $5)`,
      [
        id,
        "JOIN_CODE_REGENERATED",
        `Projenin join code'u yenilendi`,
        JSON.stringify({
          old_join_code: projectQ.rows[0].join_code,
          new_join_code: updated.rows[0].join_code,
        }),
        req.user.userId,
      ],
    );

    return res.json({
      message: "Join code regenerated successfully",
      project: updated.rows[0],
    });
  } catch (err) {
    console.error("REGENERATE JOIN CODE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getProject(req, res) {
  const { id } = req.params;

  try {
    const membership = await ensureProjectMember(id, req.user.userId);

    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const myRole = membership.role;

    const project = await pool.query(
      `
      SELECT
        id,
        name,
        description,
        color,
        sprint_duration_days,
        template_type,
        CASE WHEN $2 = 'LEADER' THEN join_code ELSE NULL END AS join_code,
        created_by,
        created_at,
        is_archived,
        archived_at,
        archived_by
      FROM projects
      WHERE id = $1
      `,
      [id, myRole]
    );

    if (!project.rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.json({ project: project.rows[0], my_role: myRole });
  } catch (err) {
    console.error("GET PROJECT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getMembers(req, res) {
  const { id } = req.params;

  try {
    const membership = await ensureProjectMember(id, req.user.userId);

    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const members = await pool.query(
      `SELECT u.id, u.full_name, u.email, pm.role, pm.joined_at
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY pm.role DESC, pm.joined_at ASC`,
      [id],
    );

    return res.json({ members: members.rows });
  } catch (err) {
    console.error("GET MEMBERS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function updateProject(req, res) {
  const { id } = req.params;
  const { name, description, sprint_duration_days, color } = req.body;

  const hasName = Object.prototype.hasOwnProperty.call(req.body, "name");
  const hasDescription = Object.prototype.hasOwnProperty.call(
    req.body,
    "description",
  );
  const hasColor = Object.prototype.hasOwnProperty.call(req.body, "color");
  const hasSprintDuration = Object.prototype.hasOwnProperty.call(
    req.body,
    "sprint_duration_days",
  );

  try {
    // 1) proje + kullanıcının rolü + proje sahibi bilgisi
    const projectQ = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        p.description,
        p.color,
        p.sprint_duration_days,
        p.created_by,
        p.is_archived,
        pm.role AS my_role
      FROM projects p
      LEFT JOIN project_members pm
        ON pm.project_id = p.id
       AND pm.user_id = $2
      WHERE p.id = $1
      `,
      [id, req.user.userId],
    );

    if (!projectQ.rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    const project = projectQ.rows[0];

    // 2) üye mi?
    if (!project.my_role) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    // 3) yetki kontrolü
    const isOwner = String(project.created_by) === String(req.user.userId);
    const isLeader = String(project.my_role) === "LEADER";

    if (!isOwner && !isLeader) {
      return res.status(403).json({
        message: "Only the project leader can update project details",
      });
    }

    // 4) archived proje düzenlenmesin
    if (project.is_archived) {
      return res.status(400).json({
        message: "Archived project cannot be updated",
      });
    }

    // 5) normalize
    const normalizedName = hasName ? String(name || "").trim() : undefined;

    let normalizedDescription;
    if (hasDescription) {
      if (description === null) {
        normalizedDescription = null;
      } else {
        normalizedDescription = String(description || "").trim();
      }
    }

    // 6) final validasyon
    if (hasName && !normalizedName) {
      return res.status(400).json({ message: "Project name cannot be empty" });
    }

    // 7) gerçekten değişen alanları bul
    const updates = [];
    const values = [];
    const changes = {};

    if (hasName && normalizedName !== project.name) {
      values.push(normalizedName);
      updates.push(`name = $${values.length}`);
      changes.old_name = project.name;
      changes.new_name = normalizedName;
    }

    const oldDescription = project.description ?? null;
    const newDescription = hasDescription ? normalizedDescription : undefined;

    if (hasDescription && newDescription !== oldDescription) {
      values.push(newDescription);
      updates.push(`description = $${values.length}`);
      changes.old_description = oldDescription;
      changes.new_description = newDescription;
    }

    if (hasColor && color !== project.color) {
      values.push(color);
      updates.push(`color = $${values.length}`);
      changes.old_color = project.color;
      changes.new_color = color;
    }

    if (
      hasSprintDuration &&
      Number(sprint_duration_days) !== Number(project.sprint_duration_days)
    ) {
      values.push(Number(sprint_duration_days));
      updates.push(`sprint_duration_days = $${values.length}`);
      changes.old_sprint_duration_days = project.sprint_duration_days;
      changes.new_sprint_duration_days = Number(sprint_duration_days);
    }

    // hiç değişiklik yoksa
    if (!updates.length) {
      return res.status(200).json({
        message: "No changes detected",
        project,
      });
    }

    // updated_at varsa bunu ekle
    updates.push(`updated_at = now()`);

    values.push(id);

    const upd = await pool.query(
      `
      UPDATE projects
      SET ${updates.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, name, description, color, sprint_duration_days, join_code, created_by, created_at, updated_at, is_archived, archived_at, archived_by
      `,
      values,
    );

    const updatedProject = upd.rows[0];

    // 8) log message oluştur
    let logMessage = "Proje güncellendi";

    if (
      changes.old_name !== undefined &&
      changes.old_description !== undefined
    ) {
      logMessage = `Proje adı ve açıklaması güncellendi: "${updatedProject.name}"`;
    } else if (changes.old_name !== undefined) {
      logMessage = `Proje adı değiştirildi: "${changes.old_name}" → "${changes.new_name}"`;
    } else if (changes.old_description !== undefined) {
      if (changes.new_description === null) {
        logMessage = `Proje açıklaması kaldırıldı`;
      } else if (!changes.old_description) {
        logMessage = `Projeye açıklama eklendi`;
      } else {
        logMessage = `Proje açıklaması güncellendi`;
      }
    }

    // 9) log
    await pool.query(
      `INSERT INTO task_logs (project_id, task_id, action, message, meta, actor_id)
      VALUES ($1, NULL, $2, $3, $4, $5)`,
      [
        updatedProject.id,
        "PROJECT_UPDATED",
        logMessage,
        JSON.stringify(changes),
        req.user.userId,
      ],
    );

    return res.json({
      message: "Project updated successfully",
      project: updatedProject,
    });
  } catch (err) {
    console.error("UPDATE PROJECT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function archiveProject(req, res) {
  const { id } = req.params;

  try {
    const authz = await ensureLeader(id, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res
          .status(403)
          .json({ message: "Not a member of this project" });
      }
      return res
        .status(403)
        .json({ message: "Only LEADER can archive project" });
    }

    const updated = await pool.query(
      `UPDATE projects
       SET is_archived = TRUE,
           archived_at = NOW(),
           archived_by = $2
       WHERE id = $1
       RETURNING id, name, description, join_code, created_by, created_at, is_archived, archived_at, archived_by`,
      [id, req.user.userId],
    );

    if (!updated.rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.json({
      message: "Project archived successfully",
      project: updated.rows[0],
    });
  } catch (err) {
    console.error("ARCHIVE PROJECT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function unarchiveProject(req, res) {
  const { id } = req.params;

  try {
    const authz = await ensureLeader(id, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res
          .status(403)
          .json({ message: "Not a member of this project" });
      }
      return res
        .status(403)
        .json({ message: "Only LEADER can unarchive project" });
    }

    const updated = await pool.query(
      `UPDATE projects
       SET is_archived = FALSE,
           archived_at = NULL,
           archived_by = NULL
       WHERE id = $1
       RETURNING id, name, description, join_code, created_by, created_at, is_archived, archived_at, archived_by`,
      [id],
    );

    if (!updated.rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.json({
      message: "Project unarchived successfully",
      project: updated.rows[0],
    });
  } catch (err) {
    console.error("UNARCHIVE PROJECT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function myArchivedProjects(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        p.description,
        CASE WHEN pm.role = 'LEADER' THEN p.join_code ELSE NULL END AS join_code,
        pm.role AS my_role,
        p.created_at,
        p.is_archived,
        p.archived_at,
        p.archived_by
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = $1
        AND p.is_archived = TRUE
      ORDER BY p.archived_at DESC NULLS LAST
      `,
      [req.user.userId],
    );

    return res.json({ projects: result.rows });
  } catch (err) {
    console.error("MY ARCHIVED PROJECTS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function deleteProject(req, res) {
  const { id } = req.params;

  try {
    const authz = await ensureLeader(id, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res
          .status(403)
          .json({ message: "Not a member of this project" });
      }
      return res
        .status(403)
        .json({ message: "Only LEADER can delete project" });
    }

    const projectQ = await pool.query(
      `SELECT id, name FROM projects WHERE id=$1`,
      [id],
    );

    if (!projectQ.rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    await pool.query("BEGIN");

    await pool.query(
      `DELETE FROM task_logs 
       WHERE task_id IN (SELECT id FROM tasks WHERE project_id=$1)`,
      [id],
    );

    await pool.query(
      `DELETE FROM task_comments 
       WHERE task_id IN (SELECT id FROM tasks WHERE project_id=$1)`,
      [id],
    );

    await pool.query(`DELETE FROM tasks WHERE project_id=$1`, [id]);
    await pool.query(`DELETE FROM sprints WHERE project_id=$1`, [id]);
    await pool.query(`DELETE FROM project_members WHERE project_id=$1`, [id]);
    await pool.query(`DELETE FROM projects WHERE id=$1`, [id]);

    await pool.query("COMMIT");

    return res.json({
      message: "Project deleted successfully",
      project: projectQ.rows[0],
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("DELETE PROJECT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

function cleanActivityMessage(message = "") {
  return String(message)
    .replace(/^Task\s+/i, "")
    .replace(/^Görev\s+/i, "")
    .trim();
}

async function getProjectSummary(req, res) {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const membership = await pool.query(
      `
      SELECT role
      FROM project_members
      WHERE project_id = $1 AND user_id = $2
      `,
      [id, userId],
    );

    if (!membership.rows.length) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const result = await pool.query(
      `
      WITH active_sprint AS (
        SELECT s.id, s.name
        FROM sprints s
        WHERE s.project_id = $1
          AND s.status = 'ACTIVE'
        ORDER BY s.start_date DESC
        LIMIT 1
      ),
      active_tasks AS (
        SELECT t.*
        FROM tasks t
        JOIN active_sprint s ON s.id = t.sprint_id
      ),
      project_tasks AS (
        SELECT t.*
        FROM tasks t
        WHERE t.project_id = $1
      ),
      sprint_counts AS (
        SELECT COUNT(*) AS sprint_count
        FROM sprints
        WHERE project_id = $1
      )
      SELECT
        $1::uuid AS project_id,
        $2::text AS my_role,

        EXISTS (SELECT 1 FROM active_sprint) AS has_active_sprint,

        (SELECT name FROM active_sprint LIMIT 1) AS active_sprint_name,

        (SELECT sprint_count FROM sprint_counts) AS sprint_count,

        -- aktif sprint
        (SELECT COUNT(*) FROM active_tasks) AS active_task_count,
        (SELECT COUNT(*) FROM active_tasks WHERE status = 'DONE') AS active_done_count,
        (SELECT COUNT(*) FROM active_tasks WHERE status = 'TODO') AS active_todo_count,
        (SELECT COUNT(*) FROM active_tasks WHERE status IN ('IN_PROGRESS', 'DOING')) AS active_in_progress_count,
        (
          SELECT COUNT(*)
          FROM active_tasks
          WHERE due_date < CURRENT_DATE
            AND status != 'DONE'
        ) AS active_overdue_count,
        (
          SELECT COUNT(*)
          FROM active_tasks
          WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 2
            AND status != 'DONE'
        ) AS active_due_soon_count,
        (
          SELECT COUNT(*)
          FROM active_tasks
          WHERE assigned_to = $3
            AND status != 'DONE'
        ) AS active_assigned_to_me_count,

        -- tüm proje
        (SELECT COUNT(*) FROM project_tasks) AS project_task_count,
        (SELECT COUNT(*) FROM project_tasks WHERE status = 'DONE') AS project_done_count,
        (SELECT COUNT(*) FROM project_tasks WHERE status = 'TODO') AS project_todo_count,
        (SELECT COUNT(*) FROM project_tasks WHERE status IN ('IN_PROGRESS', 'DOING')) AS project_in_progress_count,
        (
          SELECT COUNT(*)
          FROM project_tasks
          WHERE due_date < CURRENT_DATE
            AND status != 'DONE'
        ) AS project_overdue_count,
        (
          SELECT COUNT(*)
          FROM project_tasks
          WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 2
            AND status != 'DONE'
        ) AS project_due_soon_count,
        (
          SELECT COUNT(*)
          FROM project_tasks
          WHERE assigned_to = $3
            AND status != 'DONE'
        ) AS project_assigned_to_me_count
      `,
      [id, membership.rows[0].role, userId],
    );

    // ======================================================
    // HAFTALIK AKTİVİTE
    // ======================================================

    const weeklyActivityResult = await pool.query(
      `
      WITH days AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      )
      SELECT
        CASE EXTRACT(DOW FROM days.day)
          WHEN 1 THEN 'Pzt'
          WHEN 2 THEN 'Sal'
          WHEN 3 THEN 'Çar'
          WHEN 4 THEN 'Per'
          WHEN 5 THEN 'Cum'
          WHEN 6 THEN 'Cmt'
          WHEN 0 THEN 'Paz'
        END AS day,

        COALESCE(COUNT(t.id), 0)::int AS tasks

      FROM days

      LEFT JOIN tasks t
        ON DATE(t.updated_at) = days.day
        AND t.project_id = $1
        AND t.status = 'DONE'

      GROUP BY days.day
      ORDER BY days.day
      `,
      [id],
    );

    // ======================================================
    // ÜYE İŞ YÜKÜ
    // ======================================================

    const memberWorkloadResult = await pool.query(
      `
      WITH active_sprint AS (
        SELECT s.id
        FROM sprints s
        WHERE s.project_id = $1
          AND s.status = 'ACTIVE'
        ORDER BY s.start_date DESC
        LIMIT 1
      ),

      active_tasks AS (
        SELECT t.*
        FROM tasks t
        WHERE t.project_id = $1
          AND t.sprint_id = (SELECT id FROM active_sprint)
      ),

      task_people AS (
        SELECT DISTINCT
          t.id AS task_id,
          ta.user_id,
          t.status,
          t.due_date

        FROM active_tasks t

        JOIN task_assignees ta
          ON ta.task_id = t.id
      ),

      assigned_workload AS (
        SELECT
          COALESCE(u.full_name, u.email, 'Kullanıcı') AS name,

          COUNT(
            CASE WHEN tp.status = 'DONE' THEN 1 END
          )::int AS done,

          COUNT(
            CASE
              WHEN tp.status != 'DONE'
              AND (
                tp.due_date IS NULL
                OR tp.due_date >= CURRENT_DATE
              )
              THEN 1
            END
          )::int AS todo,

          COUNT(
            CASE
              WHEN tp.status != 'DONE'
              AND tp.due_date IS NOT NULL
              AND tp.due_date < CURRENT_DATE
              THEN 1
            END
          )::int AS overdue

        FROM task_people tp
        JOIN users u ON u.id = tp.user_id
        GROUP BY u.id, u.full_name, u.email
      ),

      unassigned_workload AS (
        SELECT
          'Atanmamış' AS name,

          COUNT(
            CASE WHEN t.status = 'DONE' THEN 1 END
          )::int AS done,

          COUNT(
            CASE
              WHEN t.status != 'DONE'
              AND (
                t.due_date IS NULL
                OR t.due_date >= CURRENT_DATE
              )
              THEN 1
            END
          )::int AS todo,

          COUNT(
            CASE
              WHEN t.status != 'DONE'
              AND t.due_date IS NOT NULL
              AND t.due_date < CURRENT_DATE
              THEN 1
            END
          )::int AS overdue

        FROM active_tasks t
        WHERE t.assigned_to IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM task_assignees ta
            WHERE ta.task_id = t.id
          )
      )

      SELECT *
      FROM assigned_workload

      UNION ALL

      SELECT *
      FROM unassigned_workload
      WHERE done > 0 OR todo > 0 OR overdue > 0

      ORDER BY overdue DESC, todo DESC, done DESC
      `,
      [id],
    );

    // ======================================================
    // SON AKTİVİTELER
    // ======================================================

    const recentActivityResult = await pool.query(
      `
      SELECT
        tl.id,
        tl.action,
        tl.message,
        tl.created_at,
        tl.actor_id,
        COALESCE(u.full_name, u.email, 'Sistem') AS actor_name

      FROM task_logs tl

      LEFT JOIN users u
        ON u.id = tl.actor_id

      WHERE tl.project_id = $1

      ORDER BY tl.created_at DESC

      LIMIT 8
      `,
      [id],
    );

    const summary = result.rows[0];

    summary.weekly_activity = weeklyActivityResult.rows;

    summary.member_workload = memberWorkloadResult.rows;

    summary.recent_activity = recentActivityResult.rows.map((a) => ({
      id: a.id,
      user: a.actor_name || "Sistem",
      action: cleanActivityMessage(a.message || a.action || "Bir işlem yaptı"),
      created_at: a.created_at,
      time: new Date(a.created_at).toLocaleString("tr-TR"),
    }));

    return res.json({
      summary,
    });
  } catch (err) {
    console.error("GET PROJECT SUMMARY ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getWorkloadAnalysis(req, res) {
  try {
    const projectId = req.params.id;
    const userId = req.user.userId;

    const roleResult = await pool.query(
      `
      SELECT role
      FROM project_members
      WHERE project_id = $1 AND user_id = $2
      `,
      [projectId, userId],
    );

    if (roleResult.rows.length === 0) {
      return res.status(403).json({
        message: "Bu projeye erişim yetkin yok.",
      });
    }

    const myRole = roleResult.rows[0].role;
    const isLeader = myRole === "LEADER";

    const result = await pool.query(
      `
      WITH active_sprint AS (
        SELECT id
        FROM sprints
        WHERE project_id = $1
          AND status = 'ACTIVE'
        ORDER BY start_date DESC
        LIMIT 1
      ),

      active_tasks AS (
        SELECT *
        FROM tasks
        WHERE project_id = $1
          AND sprint_id = (SELECT id FROM active_sprint)
      ),

      assigned_pairs AS (
        SELECT ta.task_id, ta.user_id
        FROM task_assignees ta
        JOIN active_tasks t ON t.id = ta.task_id

        UNION

        SELECT t.id AS task_id, t.assigned_to AS user_id
        FROM active_tasks t
        WHERE t.assigned_to IS NOT NULL
      )

      SELECT
        u.id AS user_id,
        u.full_name,
        u.email,
        pm.role,

        COUNT(t.id)::int AS total_tasks,

        COUNT(CASE WHEN t.status != 'DONE' THEN 1 END)::int AS open_tasks,

        COUNT(CASE WHEN t.status = 'TODO' THEN 1 END)::int AS todo_tasks,

        COUNT(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 END)::int AS in_progress_tasks,

        COUNT(CASE WHEN t.status = 'DONE' THEN 1 END)::int AS done_tasks,

        COUNT(
          CASE
            WHEN t.status != 'DONE'
              AND t.due_date IS NOT NULL
              AND t.due_date < CURRENT_DATE
            THEN 1
          END
        )::int AS overdue_tasks,

        COUNT(
          CASE
            WHEN t.status != 'DONE'
              AND t.priority = 'HIGH'
            THEN 1
          END
        )::int AS high_priority_open_tasks

      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      LEFT JOIN assigned_pairs ap ON ap.user_id = u.id
      LEFT JOIN active_tasks t ON t.id = ap.task_id
      WHERE pm.project_id = $1
      GROUP BY u.id, u.full_name, u.email, pm.role
      ORDER BY open_tasks DESC, overdue_tasks DESC, full_name ASC
      `,
      [projectId],
    );

    let analysis = result.rows.map((r) => {
      const open = Number(r.open_tasks || 0);
      const overdue = Number(r.overdue_tasks || 0);
      const high = Number(r.high_priority_open_tasks || 0);

      let workloadLevel = "LOW";
      let workloadLabel = "Rahat";
      let workloadMessage = "İş yükü düşük görünüyor.";

      if (open >= 6 || overdue >= 2 || high >= 3) {
        workloadLevel = "OVERLOAD";
        workloadLabel = "Aşırı Yüklü";
        workloadMessage = "Bu kullanıcıda aşırı iş yükü tespit edildi.";
      } else if (open >= 4 || overdue >= 1 || high >= 2) {
        workloadLevel = "HIGH";
        workloadLabel = "Yoğun";
        workloadMessage = "Bu kullanıcının iş yükü yüksek görünüyor.";
      } else if (open >= 2) {
        workloadLevel = "NORMAL";
        workloadLabel = "Dengeli";
        workloadMessage = "İş yükü dengeli görünüyor.";
      }

      return {
        ...r,
        workload_level: workloadLevel,
        workload_label: workloadLabel,
        workload_message: workloadMessage,
        transfer_suggestion: null,
      };
    });

    if (isLeader) {
      const transferableTasksResult = await pool.query(
        `
        WITH active_sprint AS (
          SELECT id
          FROM sprints
          WHERE project_id = $1
            AND status = 'ACTIVE'
          ORDER BY start_date DESC
          LIMIT 1
        ),

        active_tasks AS (
          SELECT *
          FROM tasks
          WHERE project_id = $1
            AND sprint_id = (SELECT id FROM active_sprint)
            AND status != 'DONE'
        ),

        assigned_pairs AS (
          SELECT ta.task_id, ta.user_id
          FROM task_assignees ta
          JOIN active_tasks t ON t.id = ta.task_id

          UNION

          SELECT t.id AS task_id, t.assigned_to AS user_id
          FROM active_tasks t
          WHERE t.assigned_to IS NOT NULL
        )

        SELECT
          t.id AS task_id,
          t.title AS task_title,
          t.priority,
          t.status,
          t.due_date,
          ap.user_id AS current_user_id
        FROM active_tasks t
        JOIN assigned_pairs ap ON ap.task_id = t.id
        ORDER BY
          CASE WHEN t.priority = 'HIGH' THEN 1
               WHEN t.priority = 'MEDIUM' THEN 2
               ELSE 3
          END,
          t.due_date ASC NULLS LAST,
          t.created_at ASC
        `,
        [projectId],
      );

      const taskByUser = new Map();

      for (const task of transferableTasksResult.rows) {
        const uid = String(task.current_user_id);

        if (!taskByUser.has(uid)) {
          taskByUser.set(uid, []);
        }

        taskByUser.get(uid).push(task);
      }

      analysis = analysis.map((member) => {
        if (member.workload_level !== "OVERLOAD") return member;

        const overloadedUserId = String(member.user_id);

        const targetMember = analysis
          .filter((x) => String(x.user_id) !== overloadedUserId)
          .filter(
            (x) => x.workload_level === "LOW" || x.workload_level === "NORMAL",
          )
          .sort((a, b) => {
            const openA = Number(a.open_tasks || 0);
            const openB = Number(b.open_tasks || 0);
            const overdueA = Number(a.overdue_tasks || 0);
            const overdueB = Number(b.overdue_tasks || 0);

            if (openA !== openB) return openA - openB;
            return overdueA - overdueB;
          })[0];

        const candidateTask = taskByUser.get(overloadedUserId)?.[0];

        if (!targetMember || !candidateTask) {
          return {
            ...member,
            transfer_suggestion: {
              available: false,
              message:
                "Aktarılabilecek uygun görev veya düşük yoğunluklu ekip üyesi bulunamadı.",
            },
          };
        }

        return {
          ...member,
          transfer_suggestion: {
            available: true,
            task_id: candidateTask.task_id,
            task_title: candidateTask.task_title,
            from_user_id: member.user_id,
            from_user_name: member.full_name || member.email,
            to_user_id: targetMember.user_id,
            to_user_name: targetMember.full_name || targetMember.email,
            reason:
              Number(member.overdue_tasks || 0) > 0
                ? "Yoğun kullanıcıda geciken görevler bulunduğu için görev aktarımı önerildi."
                : Number(member.high_priority_open_tasks || 0) > 1
                  ? "Yoğun kullanıcıda birden fazla kritik görev bulunduğu için görev aktarımı önerildi."
                  : "Yoğun kullanıcının aktif görev sayısı yüksek olduğu için görev aktarımı önerildi.",
          },
        };
      });
    }

    if (!isLeader) {
      analysis = analysis.filter((x) => String(x.user_id) === String(userId));
    }

    const overloadedUsers = analysis.filter(
      (x) => x.workload_level === "OVERLOAD",
    );

    return res.json({
      my_role: myRole,
      is_leader: isLeader,
      analysis,
      summary: {
        total_members: analysis.length,
        overloaded_count: overloadedUsers.length,
        has_overload: overloadedUsers.length > 0,
      },
    });
  } catch (err) {
    console.error("WORKLOAD ANALYSIS ERROR:", err);
    return res.status(500).json({
      message: "İş yükü analizi alınamadı.",
    });
  }
}

async function getArchivedProjectAiSummary(req, res) {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const memberQ = await pool.query(
      `
      SELECT pm.role, p.name, p.description, p.is_archived
      FROM project_members pm
      JOIN projects p ON p.id = pm.project_id
      WHERE pm.project_id = $1 AND pm.user_id = $2
      `,
      [id, userId]
    );

    if (!memberQ.rows.length) {
      return res.status(403).json({ message: "Bu projeye erişim yetkin yok." });
    }

    const project = memberQ.rows[0];

    const statsQ = await pool.query(
      `
      SELECT
        (SELECT COUNT(*) FROM sprints WHERE project_id = $1)::int AS sprint_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = $1)::int AS total_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = $1 AND status = 'DONE')::int AS done_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = $1 AND status = 'IN_PROGRESS')::int AS in_progress_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = $1 AND status = 'TODO')::int AS todo_tasks,
        (SELECT COUNT(*) FROM tasks WHERE project_id = $1 AND due_date < CURRENT_DATE AND status != 'DONE')::int AS overdue_tasks
      `,
      [id]
    );

    const sprintsQ = await pool.query(
      `
      SELECT
        s.id,
        s.name,
        s.status,
        s.start_date,
        s.end_date,
        COUNT(t.id)::int AS task_count,
        COUNT(CASE WHEN t.status = 'DONE' THEN 1 END)::int AS done_count,
        COUNT(CASE WHEN t.status != 'DONE' THEN 1 END)::int AS open_count
      FROM sprints s
      LEFT JOIN tasks t ON t.sprint_id = s.id
      WHERE s.project_id = $1
      GROUP BY s.id
      ORDER BY s.start_date ASC
      `,
      [id]
    );

    const membersQ = await pool.query(
      `
      SELECT
        COALESCE(u.full_name, u.email, 'Kullanıcı') AS name,
        pm.role,
        COUNT(t.id)::int AS assigned_tasks,
        COUNT(CASE WHEN t.status = 'DONE' THEN 1 END)::int AS done_tasks
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      LEFT JOIN task_assignees ta ON ta.user_id = u.id
      LEFT JOIN tasks t ON t.id = ta.task_id AND t.project_id = pm.project_id
      WHERE pm.project_id = $1
      GROUP BY u.id, u.full_name, u.email, pm.role
      ORDER BY assigned_tasks DESC
      `,
      [id]
    );

    const stats = statsQ.rows[0];

    const prompt = `
Proje adı: ${project.name}
Proje açıklaması: ${project.description || "Yok"}

Genel istatistikler:
- Sprint sayısı: ${stats.sprint_count}
- Toplam görev: ${stats.total_tasks}
- Tamamlanan görev: ${stats.done_tasks}
- Devam eden görev: ${stats.in_progress_tasks}
- Yapılacak görev: ${stats.todo_tasks}
- Geciken görev: ${stats.overdue_tasks}

Sprintler:
${sprintsQ.rows
  .map(
    (s) =>
      `- ${s.name} (${s.status}): ${s.task_count} görev, ${s.done_count} tamamlandı, ${s.open_count} açık`
  )
  .join("\n")}

Ekip iş yükü:
${membersQ.rows
  .map(
    (m) =>
      `- ${m.name} (${m.role}): ${m.assigned_tasks} görev, ${m.done_tasks} tamamlandı`
  )
  .join("\n")}

Bu verilere göre Türkçe, kısa ama profesyonel bir proje kapanış AI özeti hazırla.
Şu başlıkları kullan:
1. Genel Durum
2. Sprint Performansı
3. Ekip Katkısı
4. Riskler ve Eksikler
5. Sonuç ve Gelecek Projeler İçin Öneriler
`;

    const summary = await askAI({
      systemPrompt:
        "Sen Türkçe cevap veren profesyonel bir proje yönetimi analiz asistanısın.",
      userPrompt: prompt,
    });

    return res.json({
      project: {
        id,
        name: project.name,
      },
      summary,
    });
  } catch (err) {
    console.error("ARCHIVED PROJECT AI SUMMARY ERROR:", err);
    return res.status(500).json({
      message: "AI proje özeti oluşturulamadı.",
    });
  }
}

async function removeMember(req, res) {
  const { id, userId } = req.params;

  try {
    const authz = await ensureLeader(id, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res
          .status(403)
          .json({ message: "Not a member of this project" });
      }
      return res
        .status(403)
        .json({ message: "Only LEADER can remove members" });
    }

    // Projedeki kişi var mı?
    const memberQ = await pool.query(
      `SELECT pm.project_id, pm.user_id, pm.role, u.full_name, u.email
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [id, userId],
    );

    if (!memberQ.rows.length) {
      return res
        .status(404)
        .json({ message: "Member not found in this project" });
    }

    const member = memberQ.rows[0];

    // Leader kendini çıkaramasın
    if (String(userId) === String(req.user.userId)) {
      return res
        .status(400)
        .json({ message: "Leader cannot remove themselves" });
    }

    // Leader başka leader'ı çıkaramasın (ileride çoklu leader olursa güvenli kalsın)
    if (member.role === "LEADER") {
      return res.status(400).json({ message: "Leader cannot be removed" });
    }

    await createNotification({
      userId: member.user_id,
      type: "REMOVED_FROM_PROJECT",
      title: "Projeden çıkarıldın",
      body: member.full_name,
      projectId: id,
      triggeredBy: req.user.userId,
    });

    await pool.query(
      `DELETE FROM project_members
       WHERE project_id = $1 AND user_id = $2`,
      [id, userId],
    );

    await pool.query(
      `INSERT INTO task_logs (project_id, task_id, action, message, meta, actor_id)
      VALUES ($1, NULL, $2, $3, $4, $5)`,
      [
        id,
        "MEMBER_REMOVED",
        `Projeden üye çıkarıldı: "${member.full_name}"`,
        JSON.stringify({
          removed_user_id: member.user_id,
          removed_user_name: member.full_name,
          removed_user_email: member.email,
          removed_user_role: member.role,
        }),
        req.user.userId,
      ],
    );

    return res.json({
      message: "Member removed successfully",
      removed_member: {
        id: member.user_id,
        full_name: member.full_name,
        email: member.email,
        role: member.role,
      },
    });
  } catch (err) {
    console.error("REMOVE MEMBER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function changeMemberRole(req, res) {
  const { id, userId } = req.params;
  const { role } = req.body;

  const nextRole = String(role || "")
    .trim()
    .toUpperCase();
  const ALLOWED_ROLES = new Set(["LEADER", "MEMBER"]);

  if (!ALLOWED_ROLES.has(nextRole)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  try {
    const authz = await ensureLeader(id, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res
          .status(403)
          .json({ message: "Not a member of this project" });
      }
      return res
        .status(403)
        .json({ message: "Only LEADER can change member roles" });
    }

    const memberQ = await pool.query(
      `SELECT pm.project_id, pm.user_id, pm.role, u.full_name, u.email
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [id, userId],
    );

    if (!memberQ.rows.length) {
      return res
        .status(404)
        .json({ message: "Member not found in this project" });
    }

    const member = memberQ.rows[0];
    const currentRole = member.role;

    if (currentRole === nextRole) {
      return res.json({
        message: "Role unchanged",
        member: {
          id: member.user_id,
          full_name: member.full_name,
          email: member.email,
          role: currentRole,
        },
      });
    }

    // Son leader'ı MEMBER yapmayı engelle
    if (currentRole === "LEADER" && nextRole === "MEMBER") {
      const leaderCountQ = await pool.query(
        `SELECT COUNT(*)::int AS leader_count
         FROM project_members
         WHERE project_id = $1 AND role = 'LEADER'`,
        [id],
      );

      const leaderCount = leaderCountQ.rows[0]?.leader_count || 0;

      if (leaderCount <= 1) {
        return res.status(400).json({
          message: "Project must have at least one LEADER",
        });
      }
    }

    const updated = await pool.query(
      `UPDATE project_members
       SET role = $1
       WHERE project_id = $2 AND user_id = $3
       RETURNING project_id, user_id, role, joined_at`,
      [nextRole, id, userId],
    );

    await pool.query(
      `INSERT INTO task_logs (project_id, task_id, action, message, meta, actor_id)
      VALUES ($1, NULL, $2, $3, $4, $5)`,
      [
        id,
        "MEMBER_ROLE_CHANGED",
        `Üye rolü değiştirildi: "${member.full_name}" (${currentRole} → ${updated.rows[0].role})`,
        JSON.stringify({
          target_user_id: member.user_id,
          target_user_name: member.full_name,
          target_user_email: member.email,
          from: currentRole,
          to: updated.rows[0].role,
        }),
        req.user.userId,
      ],
    );

    if (String(member.user_id) !== String(req.user.userId)) {
      await createNotification({
        userId: member.user_id,
        type: "MEMBER_ROLE_CHANGED",
        title: "Rolün değiştirildi",
        body: `${currentRole} → ${updated.rows[0].role}`,
        projectId: id,
        triggeredBy: req.user.userId,
      });
    }

    return res.json({
      message: "Member role updated successfully",
      member: {
        id: member.user_id,
        full_name: member.full_name,
        email: member.email,
        role: updated.rows[0].role,
        joined_at: updated.rows[0].joined_at,
      },
    });
  } catch (err) {
    console.error("CHANGE MEMBER ROLE ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function leaveProject(req, res) {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const membership = await ensureProjectMember(id, userId);

    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    // Leader ayrılmasın; önce başka leader atansın
    if (membership.role === "LEADER") {
      const leaderCountQ = await pool.query(
        `SELECT COUNT(*)::int AS leader_count
         FROM project_members
         WHERE project_id = $1 AND role = 'LEADER'`,
        [id],
      );

      const leaderCount = leaderCountQ.rows[0]?.leader_count || 0;

      if (leaderCount <= 1) {
        return res.status(400).json({
          message: "Last LEADER cannot leave the project",
        });
      }
    }

    const meQ = await pool.query(
      `SELECT u.id, u.full_name, u.email, pm.role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [id, userId],
    );

    if (!meQ.rows.length) {
      return res.status(404).json({ message: "Membership not found" });
    }

    const me = meQ.rows[0];

    const leadersQ = await pool.query(
      `
      SELECT user_id
      FROM project_members
      WHERE project_id = $1
        AND role = 'LEADER'
        AND user_id <> $2
      `,
      [id, userId]
    );

    for (const leader of leadersQ.rows) {
      await createNotification({
        userId: leader.user_id,
        type: "MEMBER_LEFT_PROJECT",
        title: "Bir üye projeden ayrıldı",
        body: `${me.full_name || me.email} projeden ayrıldı`,
        projectId: id,
        triggeredBy: userId,
      });
    }

    await pool.query(
      `DELETE FROM project_members
       WHERE project_id = $1 AND user_id = $2`,
      [id, userId],
    );

    return res.json({
      message: "You left the project successfully",
      left_member: {
        id: me.id,
        full_name: me.full_name,
        email: me.email,
        role: me.role,
      },
    });
  } catch (err) {
    console.error("LEAVE PROJECT ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function transferLeadership(req, res) {
  const { id } = req.params;
  const { newLeaderUserId } = req.body;
  const currentUserId = req.user.userId;

  if (!newLeaderUserId) {
    return res.status(400).json({ message: "newLeaderUserId required" });
  }

  try {
    const membership = await ensureProjectMember(id, currentUserId);

    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    if (membership.role !== "LEADER") {
      return res
        .status(403)
        .json({ message: "Only LEADER can transfer leadership" });
    }

    if (String(newLeaderUserId) === String(currentUserId)) {
      return res.status(400).json({ message: "You are already the leader" });
    }

    const leaderCountQ = await pool.query(
      `SELECT COUNT(*)::int AS leader_count
       FROM project_members
       WHERE project_id = $1 AND role = 'LEADER'`,
      [id],
    );

    const leaderCount = leaderCountQ.rows[0]?.leader_count || 0;

    if (leaderCount > 1) {
      return res.status(400).json({
        message:
          "Leadership transfer is only required when there is a single LEADER",
      });
    }

    const targetQ = await pool.query(
      `SELECT pm.user_id, pm.role, u.full_name, u.email
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [id, newLeaderUserId],
    );

    if (!targetQ.rows.length) {
      return res
        .status(404)
        .json({ message: "Selected member not found in this project" });
    }

    const target = targetQ.rows[0];

    await pool.query("BEGIN");

    await pool.query(
      `UPDATE project_members
       SET role = 'LEADER'
       WHERE project_id = $1 AND user_id = $2`,
      [id, newLeaderUserId],
    );

    await pool.query(
      `UPDATE project_members
       SET role = 'MEMBER'
       WHERE project_id = $1 AND user_id = $2`,
      [id, currentUserId],
    );

    await pool.query(
      `INSERT INTO task_logs (project_id, task_id, action, message, meta, actor_id)
      VALUES ($1, NULL, $2, $3, $4, $5)`,
      [
        id,
        "LEADERSHIP_TRANSFERRED",
        `Proje liderliği devredildi: yeni lider "${target.full_name}" oldu`,
        JSON.stringify({
          previous_leader_user_id: currentUserId,
          new_leader_user_id: newLeaderUserId,
          new_leader_name: target.full_name,
          new_leader_email: target.email,
        }),
        currentUserId,
      ],
    );

    await createNotification({
      userId: newLeaderUserId,
      type: "LEADERSHIP_TRANSFERRED",
      title: "Proje liderliği sana geçti",
      body: target.full_name,
      projectId: id,
      triggeredBy: currentUserId,
    });

    await pool.query("COMMIT");

    return res.json({
      message: "Leadership transferred successfully",
      new_leader: {
        id: target.user_id,
        full_name: target.full_name,
        email: target.email,
        role: "LEADER",
      },
      previous_leader: {
        id: currentUserId,
        role: "MEMBER",
      },
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("TRANSFER LEADERSHIP ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function addMember(req, res) {
  const { id } = req.params;
  const { userId, role } = req.body;

  const nextRole = String(role || "MEMBER")
    .trim()
    .toUpperCase();

  if (!userId) {
    return res.status(400).json({ message: "userId required" });
  }

  if (nextRole !== "MEMBER" && nextRole !== "LEADER") {
    return res.status(400).json({ message: "Invalid role" });
  }

  try {
    const authz = await ensureLeader(id, req.user.userId);

    if (!authz.ok) {
      if (authz.reason === "NOT_MEMBER") {
        return res
          .status(403)
          .json({ message: "Not a member of this project" });
      }
      return res.status(403).json({ message: "Only LEADER can add members" });
    }

    // 🔹 proje bilgisi
    const projectQ = await pool.query(
      `SELECT id, name FROM projects WHERE id = $1`,
      [id],
    );

    const project = projectQ.rows[0];

    // 🔹 eklenen kullanıcı
    const userQ = await pool.query(
      `SELECT id, full_name, email FROM users WHERE id = $1`,
      [userId],
    );

    if (!userQ.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetUser = userQ.rows[0];

    // 🔹 ekleyen kişi
    const actorQ = await pool.query(
      `SELECT id, full_name, email FROM users WHERE id = $1`,
      [req.user.userId],
    );

    const actor = actorQ.rows[0];

    const existsQ = await pool.query(
      `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [id, userId],
    );

    if (existsQ.rows.length) {
      return res
        .status(400)
        .json({ message: "User is already a member of this project" });
    }

    await pool.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [id, userId, nextRole],
    );

    await pool.query(
      `INSERT INTO task_logs (project_id, task_id, action, message, meta, actor_id)
       VALUES ($1, NULL, $2, $3, $4, $5)`,
      [
        id,
        "MEMBER_ADDED",
        `Projeye üye eklendi: "${targetUser.full_name}"`,
        JSON.stringify({
          added_user_id: targetUser.id,
          added_user_name: targetUser.full_name,
          added_user_email: targetUser.email,
          role: nextRole,
        }),
        req.user.userId,
      ],
    );

    await createNotification({
      userId: targetUser.id,
      type: "ADDED_TO_PROJECT",
      title: "Bir projeye eklendin",
      body: project.name,
      projectId: id,
      triggeredBy: req.user.userId,
    });

    // 🔥 MAIL EKLENDİ
    const appUrl = process.env.APP_URL || "http://localhost:5173";
    const projectUrl = `${appUrl}/projects/${id}`;

    try {
      await sendMail({
        to: targetUser.email,
        fromName: `${actor?.full_name || "PGT"} via PGT`,
        subject: `Bir projeye eklendin • ${project.name}`,
        text:
          `${actor?.full_name} seni "${project.name}" projesine ekledi.\n\n` +
          `Rolün: ${nextRole}\n` +
          `Projeye git: ${projectUrl}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6">
            <h2>Bir projeye eklendin</h2>
            <p>
              <strong>${actor?.full_name}</strong> seni 
              <strong>${project.name}</strong> projesine ekledi.
            </p>
            <p>Rolün: <strong>${nextRole}</strong></p>
            <p>
              <a href="${projectUrl}" target="_blank"
                 style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">
                Projeye Git
              </a>
            </p>
          </div>
        `,
      });
    } catch (mailErr) {
      console.error("ADD MEMBER MAIL ERROR:", mailErr);
    }

    return res.status(201).json({
      message: "Member added successfully",
      member: {
        id: targetUser.id,
        full_name: targetUser.full_name,
        email: targetUser.email,
        role: nextRole,
      },
    });
  } catch (err) {
    console.error("ADD MEMBER ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = {
  createProject,
  myProjects,
  joinProject,
  getProject,
  getMembers,
  removeMember,
  changeMemberRole,
  leaveProject,
  transferLeadership,
  regenerateJoinCode,
  updateProject,
  archiveProject,
  unarchiveProject,
  myArchivedProjects,
  deleteProject,
  getProjectSummary,
  addMember,
  getProjectJoinRequests,
  approveProjectJoinRequest,
  rejectProjectJoinRequest,
  myJoinRequests,
  getWorkloadAnalysis,
  getArchivedProjectAiSummary,
};
