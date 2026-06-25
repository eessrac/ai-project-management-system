const express = require("express");
const cors = require("cors");
const multer = require("multer");
const pool = require("./config/db");
const authMiddleware = require("./middleware/auth");
const { askAI } = require("./services/qwen.service");

/**
 * Bu dosya uygulamanın ana sunucu yapılandırmasını içerir.
 * API yönlendirmeleri, güvenlik ayarları, kod teslim işlemleri,
 * yapay zekâ destekli proje asistanı ve genel middleware yapılandırmalarını yönetir.
 */

const codeUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 2,
  },
});
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const projectRoutes = require("./routes/project.routes");
const tasksRoutes = require("./routes/task.routes");
const projectChatRoutes = require("./routes/projectChat.routes");

const app = express();

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replaceAll("ı", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function detectProjectChatIntent(message) {
  const text = normalizeText(message);

  if (
    hasAny(text, [
      "benim adim",
      "adim ne",
      "ben kimim",
      "ismim ne",
      "adimi soyle",
    ])
  ) {
    return "CURRENT_USER_NAME";
  }

  if (
    hasAny(text, [
      "lider miyim",
      "uye miyim",
      "rolum ne",
      "yetkim ne",
      "bu projede neyim",
      "benim rolum",
    ])
  ) {
    return "CURRENT_USER_ROLE";
  }

  if (
    text.includes("sprint") &&
    (
      text.includes("analiz") ||
      text.includes("durum") ||
      text.includes("nasil") ||
      text.includes("gidiyor") ||
      text.includes("ilerleme") ||
      text.includes("tamamlanma") ||
      text.includes("yuzde") ||
      text.includes("%") ||
      text.includes("oran")
    )
  ) {
    return "SPRINT_ANALYSIS";
  }

  if (
    hasAny(text, [
      "genel ilerleme",
      "proje ilerleme",
      "projenin ilerlemesi",
      "proje yuzde",
      "proje yüzde",
      "genel durum yuzde",
      "tamamlanma yuzdesi",
    ])
  ) {
    return "PROJECT_PROGRESS";
  }

  if (
    hasAny(text, [
      "hangi sprint",
      "aktif sprint",
      "sprintteyiz",
      "sprintteyi",
      "sprinteyiz",
      "su an sprint",
      "sprint kac",
      "hangi sprinte",
      "hangi sprintteyim",
      "hangi sprintteyiz",
    ])
  ) {
    return "ACTIVE_SPRINT";
  }

  if (
    hasAny(text, [
      "kac kisi",
      "toplam kisi",
      "ekip kac kisi",
      "projede kac uye",
      "kac uye var",
      "ekipte kimler var",
      "projede kimler var",
    ])
  ) {
    return "MEMBER_COUNT";
  }

  if (
    hasAny(text, [
      "en yogun kisi",
      "kim yogun",
      "is yuku en fazla",
      "en cok gorev kimde",
      "kim daha yogun",
      "en yogun kim",
      "en cok kim calisiyor",
    ])
  ) {
    return "BUSIEST_MEMBER";
  }

  if (
    hasAny(text, [
      "geciken gorev",
      "geciken is",
      "suresi gecen",
      "deadline gecen",
      "teslim tarihi gecen",
      "gecikmis gorev",
      "hangi gorevler gecikti",
    ])
  ) {
    return "OVERDUE_TASKS";
  }

  

  if (
    text.includes("is yuku") ||
    text.includes("gorev dagilimi") ||
    text.includes("ekip yogunlugu") ||
    text.includes("is dagilimi")
  ) {
    return "WORKLOAD_ANALYSIS";
  }

  if (
    hasAny(text, [
      "projenin amaci",
      "projenin konusu",
      "konusu ve amaci",
      "bu proje ne",
      "ne icin yapiliyor",
      "proje ne hakkinda",
      "bu projenin amaci",
      "bu projenin konusu",
    ])
  ) {
    return "PROJECT_PURPOSE";
  }

  if (
    hasAny(text, [
      "kac gorevim var",
      "benim gorevlerim",
      "bana atanan gorev",
      "bende kac gorev",
      "bu sprintte gorevim",
      "bana kac gorev atanmis",
    ])
  ) {
    return "MY_ACTIVE_SPRINT_TASKS";
  }

  return "AI_ANALYSIS";
}

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
  "https://genically-multivariate-renita.ngrok-free.dev",
  "https://pgt-frontend.vercel.app",
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("CORS policy: This origin is not allowed"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "ngrok-skip-browser-warning",
  ],
};

app.set("trust proxy", 1);

app.use((req, res, next) => {
  console.log("ORIGIN:", req.headers.origin);
  next();
});

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

app.use(cors(corsOptions));

// Express v5 için "*" yerine regex kullanıyoruz
app.options(/.*/, cors(corsOptions));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests, please try again later.",
  },
});

app.use(globalLimiter);

app.use(express.json({ limit: "10mb" }));

app.use((req, res, next) => {
  console.log("REQ:", req.method, req.url);
  next();
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.get("/tasks/:taskId/code-submissions", authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;

    const result = await pool.query(
      `
      SELECT 
        tcs.*,
        u.full_name AS uploaded_by_name,
        u.email AS uploaded_by_email
      FROM task_code_submissions tcs
      LEFT JOIN users u ON u.id = tcs.uploaded_by
      WHERE tcs.task_id = $1
      ORDER BY tcs.created_at DESC
      `,
      [taskId],
    );

    res.json({ submissions: result.rows });
  } catch (err) {
    console.error("Code submissions list error:", err);
    res.status(500).json({ error: "Kod teslimleri getirilemedi." });
  }
});

app.get("/projects/:projectId/code-submissions", authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.userId;

    const accessQ = await pool.query(
      `
      SELECT role
      FROM project_members
      WHERE project_id = $1 AND user_id = $2
      `,
      [projectId, userId]
    );

    if (accessQ.rows.length === 0) {
      return res.status(403).json({ error: "Bu projeye erişim yetkin yok." });
    }

    const result = await pool.query(
      `
      SELECT 
        tcs.*,
        t.title AS task_title,
        t.status AS task_status,
        t.assigned_to,
        u.full_name AS uploaded_by_name,
        u.email AS uploaded_by_email
      FROM task_code_submissions tcs
      INNER JOIN tasks t ON t.id = tcs.task_id
      LEFT JOIN users u ON u.id = tcs.uploaded_by
      WHERE tcs.project_id = $1
      ORDER BY tcs.created_at DESC
      `,
      [projectId]
    );

    res.json({ submissions: result.rows });
  } catch (err) {
    console.error("Project code submissions list error:", err);
    res.status(500).json({ error: "Proje kod teslimleri getirilemedi." });
  }
});

app.post(
  "/tasks/:taskId/code-submissions",
  authMiddleware,
  codeUpload.single("file"),
  async (req, res) => {
    try {
      const { taskId } = req.params;
      const userId = req.user.userId;
      const { description } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "Dosya seçilmedi." });
      }

      const allowedExtensions = [
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".css",
        ".html",
        ".json",
      ];
      const originalName = req.file.originalname || "";
      const lowerName = originalName.toLowerCase();

      const isAllowed = allowedExtensions.some((ext) =>
        lowerName.endsWith(ext),
      );

      if (!isAllowed) {
        return res.status(400).json({
          error:
            "Sadece .js, .jsx, .ts, .tsx, .css, .html ve .json dosyaları yüklenebilir.",
        });
      }

      const taskResult = await pool.query(
        `
        SELECT t.id, t.project_id
        FROM tasks t
        INNER JOIN project_members pm 
          ON pm.project_id = t.project_id
        WHERE t.id = $1 AND pm.user_id = $2
        `,
        [taskId, userId],
      );

      if (taskResult.rows.length === 0) {
        return res.status(403).json({ error: "Bu task için yetkin yok." });
      }

      const projectId = taskResult.rows[0].project_id;
      const codeContent = req.file.buffer.toString("utf-8");

      const versionResult = await pool.query(
        `
        SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version
        FROM task_code_submissions
        WHERE task_id = $1
        `,
        [taskId],
      );

      const nextVersion = versionResult.rows[0].next_version;

      const insertResult = await pool.query(
        `
        INSERT INTO task_code_submissions (
          task_id,
          project_id,
          uploaded_by,
          file_name,
          file_type,
          mime_type,
          code_content,
          description,
          version_no
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
        `,
        [
          taskId,
          projectId,
          userId,
          originalName,
          lowerName.split(".").pop()?.toUpperCase() || "CODE",
          req.file.mimetype,
          codeContent,
          description || null,
          nextVersion,
        ],
      );

      res.status(201).json({ submission: insertResult.rows[0] });
    } catch (err) {
      console.error("Code submission upload error:", err);
      res.status(500).json({ error: "Kod dosyası yüklenemedi." });
    }
  },
);

app.delete(
  "/code-submissions/:submissionId",
  authMiddleware,
  async (req, res) => {
    try {
      const { submissionId } = req.params;
      const userId = req.user.userId;

      const checkResult = await pool.query(
        `
      SELECT 
        tcs.id,
        tcs.uploaded_by,
        pm.role
      FROM task_code_submissions tcs
      INNER JOIN project_members pm 
        ON pm.project_id = tcs.project_id
       AND pm.user_id = $2
      WHERE tcs.id = $1
      `,
        [submissionId, userId],
      );

      if (checkResult.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Bu kod teslimine erişim yetkin yok." });
      }

      const row = checkResult.rows[0];

      if (row.role !== "LEADER" && String(row.uploaded_by) !== String(userId)) {
        return res
          .status(403)
          .json({ error: "Bu kod teslimini silme yetkin yok." });
      }

      await pool.query(`DELETE FROM task_code_submissions WHERE id = $1`, [
        submissionId,
      ]);

      res.json({ success: true });
    } catch (err) {
      console.error("Code submission delete error:", err);
      res.status(500).json({ error: "Kod teslimi silinemedi." });
    }
  },
);

app.get(
  "/code-submissions/:submissionId/download",
  authMiddleware,
  async (req, res) => {
    try {
      const { submissionId } = req.params;
      const userId = req.user.userId;

      const result = await pool.query(
        `
      SELECT 
        tcs.*
      FROM task_code_submissions tcs
      INNER JOIN project_members pm
        ON pm.project_id = tcs.project_id
       AND pm.user_id = $2
      WHERE tcs.id = $1
      `,
        [submissionId, userId],
      );

      if (result.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Bu kod dosyasına erişim yetkin yok." });
      }

      const file = result.rows[0];

      res.setHeader(
        "Content-Type",
        file.mime_type || "text/plain; charset=utf-8",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(file.file_name)}"`,
      );

      return res.send(file.code_content || "");
    } catch (err) {
      console.error("Code submission download error:", err);
      res.status(500).json({ error: "Kod dosyası indirilemedi." });
    }
  },
);

app.post(
  "/code-submissions/:submissionId/summarize",
  authMiddleware,
  async (req, res) => {
    try {
      const { submissionId } = req.params;
      const userId = req.user.userId;

      const result = await pool.query(
        `
      SELECT tcs.*
      FROM task_code_submissions tcs
      INNER JOIN project_members pm
        ON pm.project_id = tcs.project_id
       AND pm.user_id = $2
      WHERE tcs.id = $1
      `,
        [submissionId, userId],
      );

      if (result.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Bu kod teslimine erişim yetkin yok." });
      }

      const submission = result.rows[0];

      const summary = await askAI({
        systemPrompt:
          "Sen yazılım proje yönetim sisteminde kod teslimlerini özetleyen bir asistansın. Türkçe, kısa ve anlaşılır cevap ver.",
        userPrompt: `
Aşağıdaki kod dosyasını incele ve özetle.

Dosya adı: ${submission.file_name}

Açıklama:
${submission.description || "-"}

Kod:
${submission.code_content}

Lütfen şu formatta yaz:
1. Bu dosyada ne yapılmış?
2. Hangi önemli bileşenler/fonksiyonlar var?
3. Bu task açısından çıktı nedir?
      `,
      });

      const updateResult = await pool.query(
        `
      UPDATE task_code_submissions
      SET ai_summary = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
      `,
        [summary, submissionId],
      );

      res.json({
        success: true,
        submission: updateResult.rows[0],
      });
    } catch (err) {
      console.error("Code summary error:", err);
      res.status(500).json({ error: "Kod özeti oluşturulamadı." });
    }
  },
);

app.post(
  "/code-submissions/:submissionId/generate-commit",
  authMiddleware,
  async (req, res) => {
    try {
      const { submissionId } = req.params;
      const userId = req.user.userId;

      const result = await pool.query(
        `
        SELECT tcs.*
        FROM task_code_submissions tcs
        INNER JOIN project_members pm
          ON pm.project_id = tcs.project_id
         AND pm.user_id = $2
        WHERE tcs.id = $1
        `,
        [submissionId, userId],
      );

      if (result.rows.length === 0) {
        return res.status(403).json({
          error: "Bu kod teslimine erişim yetkin yok.",
        });
      }

      const submission = result.rows[0];

      const commitSummary = await askAI({
        systemPrompt:
          "Sen deneyimli bir yazılım geliştiricisin. Koddan profesyonel commit mesajları üret.",
        userPrompt: `
Dosya: ${submission.file_name}

Açıklama:
${submission.description || "-"}

Kod:
${submission.code_content}

Bu dosyanın genel amacını anlatma.
Sadece bu task kapsamında yapılan geliştirmeleri özetle.
En fazla 5 madde üret.
Her madde kısa olsun.
Git commit açıklaması gibi yaz.
Git commit formatında üret.
Markdown kullanma.
\`\`\` işareti koyma.
Sadece düz metin döndür.

Örnek:

feat(projects):
- Proje kartları yeniden tasarlandı
- İş yükü analizi eklendi
- Dark mode desteği geliştirildi
  `,
      });

      const cleanedCommit = String(commitSummary || "")
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const updateResult = await pool.query(
        `
        UPDATE task_code_submissions
        SET ai_commit_summary = $1
        WHERE id = $2
        RETURNING *
        `,
        [cleanedCommit, submissionId],
      );

      res.json({
        success: true,
        submission: updateResult.rows[0],
      });
    } catch (err) {
      console.error("Commit summary error:", err);
      res.status(500).json({
        error: "Commit özeti oluşturulamadı.",
      });
    }
  },
);

app.post("/ai/test", async (req, res) => {
  try {
    const { message } = req.body;

    const result = await askAI({
      systemPrompt:
        "Sen Türkçe cevap veren yardımcı bir proje yönetim asistanısın.",
      userPrompt: message || "Merhaba, kendini kısaca tanıt.",
    });

    res.json({ success: true, result });
  } catch (err) {
    console.error("QWEN TEST ERROR:", err);
    res.status(500).json({ error: "Qwen bağlantısı başarısız oldu" });
  }
});

app.post("/projects/:id/ai-chat", authMiddleware, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.userId;
    const { message } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "Mesaj boş olamaz." });
    }

    const memberCheck = await pool.query(
      `
      SELECT role
      FROM project_members
      WHERE project_id = $1 AND user_id = $2
      `,
      [projectId, userId],
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({
        message: "Bu projeye erişim yetkin yok.",
      });
    }

    const projectResult = await pool.query(
      `
      SELECT 
        id,
        name,
        description,
        created_at,
        is_archived,
        archived_at,
        sprint_duration_days,
        template_type
      FROM projects
      WHERE id = $1
      `,
      [projectId],
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        message: "Proje bulunamadı.",
      });
    }

    const tasksResult = await pool.query(
      `
      SELECT 
        t.id,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.start_date,
        t.due_date,
        t.estimated_cost,
        t.actual_cost,
        t.cost_note,
        t.created_at,
        s.name AS sprint_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', u.id,
              'name', COALESCE(u.full_name, u.email),
              'email', u.email
            )
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS assignees
      FROM tasks t
      LEFT JOIN sprints s ON s.id = t.sprint_id
      LEFT JOIN task_assignees ta ON ta.task_id = t.id
      LEFT JOIN users u ON u.id = ta.user_id
      WHERE t.project_id = $1
      GROUP BY t.id, s.name
      ORDER BY t.created_at DESC
      LIMIT 80
      `,
      [projectId],
    );

    const sprintsResult = await pool.query(
      `
      SELECT id, name, start_date, end_date, status, created_at
      FROM sprints
      WHERE project_id = $1
      ORDER BY start_date DESC
      LIMIT 10
      `,
      [projectId],
    );

    const membersResult = await pool.query(
      `
      SELECT 
        pm.role,
        u.id,
        COALESCE(u.full_name, u.email) AS name,
        u.email
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1
      ORDER BY pm.role DESC, name ASC
      `,
      [projectId],
    );

    const dependenciesResult = await pool.query(
      `
      SELECT 
        td.task_id,
        t1.title AS task_title,
        td.depends_on_task_id,
        t2.title AS depends_on_title
      FROM task_dependencies td
      JOIN tasks t1 ON t1.id = td.task_id
      JOIN tasks t2 ON t2.id = td.depends_on_task_id
      WHERE t1.project_id = $1
      LIMIT 80
      `,
      [projectId],
    );

    const workloadResult = await pool.query(
      `
      WITH active_sprint AS (
        SELECT id
        FROM sprints
        WHERE project_id = $1
          AND status = 'ACTIVE'
        ORDER BY start_date DESC
        LIMIT 1
      )
      SELECT
        u.id,
        u.full_name,
        u.email,
        pm.role,
        COUNT(t.id) FILTER (
          WHERE t.status IN ('TODO', 'IN_PROGRESS')
        ) AS active_tasks,
        COUNT(t.id) FILTER (
          WHERE t.status IN ('TODO', 'IN_PROGRESS')
            AND t.due_date < CURRENT_DATE
        ) AS overdue_tasks,
        COUNT(t.id) FILTER (
          WHERE t.priority = 'HIGH' AND t.status IN ('TODO', 'IN_PROGRESS')
        ) AS critical_tasks,
        COUNT(t.id) AS total_tasks,
        COUNT(t.id) FILTER (
          WHERE t.status = 'DONE'
        ) AS completed_tasks
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      LEFT JOIN task_assignees ta ON ta.user_id = u.id
      LEFT JOIN tasks t 
        ON t.id = ta.task_id
      AND t.project_id = pm.project_id
      AND t.sprint_id = (SELECT id FROM active_sprint)
      WHERE pm.project_id = $1
      GROUP BY u.id, u.full_name, u.email, pm.role
      ORDER BY active_tasks DESC, overdue_tasks DESC, critical_tasks DESC
      `,
      [projectId],
    );

    const activeSprintStatsResult = await pool.query(
      `
      WITH active_sprint AS (
        SELECT id, name, start_date, end_date
        FROM sprints
        WHERE project_id = $1
          AND status = 'ACTIVE'
        ORDER BY start_date DESC
        LIMIT 1
      )
      SELECT
        a.id AS sprint_id,
        a.name AS sprint_name,
        a.start_date,
        a.end_date,
        COUNT(t.id)::int AS total_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'TODO')::int AS todo_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'IN_PROGRESS')::int AS in_progress_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'DONE')::int AS done_tasks,
        COUNT(t.id) FILTER (
          WHERE t.status IN ('TODO', 'IN_PROGRESS')
            AND t.due_date < CURRENT_DATE
        )::int AS overdue_tasks,
        COUNT(t.id) FILTER (
          WHERE t.status IN ('TODO', 'IN_PROGRESS')
            AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 day'
        )::int AS due_soon_tasks
      FROM active_sprint a
      LEFT JOIN tasks t ON t.sprint_id = a.id
      GROUP BY a.id, a.name, a.start_date, a.end_date
      `,
      [projectId]
    );

    const activeSprintStats = activeSprintStatsResult.rows[0] || null;

    const activeSprintProgress =
      activeSprintStats && Number(activeSprintStats.total_tasks) > 0
        ? Math.round(
            (Number(activeSprintStats.done_tasks) /
              Number(activeSprintStats.total_tasks)) *
              100
          )
        : 0;

    const currentUserResult = await pool.query(
      `
      SELECT
        id,
        full_name,
        email
      FROM users
      WHERE id = $1
      `,
      [userId],
    );

    const context = {
      current_user: currentUserResult.rows[0],
      project: projectResult.rows[0],
      sprints: sprintsResult.rows,
      active_sprint_stats: activeSprintStats
        ? {
            ...activeSprintStats,
            progress_percent: activeSprintProgress,
          }
        : null,
      members: membersResult.rows,
      active_sprint_workload_summary: workloadResult.rows,
      tasks: tasksResult.rows,
      dependencies: dependenciesResult.rows,
    };

    const intent = detectProjectChatIntent(message);
    console.log("INTENT:", intent);

    const activeSprint = context.sprints.find((s) => s.status === "ACTIVE");

    const formatDate = (dateValue) => {
      if (!dateValue) return "-";
      return new Date(dateValue).toLocaleDateString("tr-TR");
    };

    if (intent === "CURRENT_USER_NAME") {
      return res.json({
        success: true,
        answer: `Adınız ${context.current_user.full_name}.`,
      });
    }

    if (intent === "CURRENT_USER_ROLE") {
      const myMember = context.members.find(
        (m) => String(m.id) === String(userId),
      );

      return res.json({
        success: true,
        answer:
          myMember?.role === "LEADER"
            ? "Bu projede lider rolündesiniz."
            : "Bu projede üye rolündesiniz.",
      });
    }

    if (intent === "PROJECT_PROGRESS") {

      const totalTasks = context.tasks.length;

      const doneTasks = context.tasks.filter(
        (t) => t.status === "DONE"
      ).length;

      const percentage =
        totalTasks > 0
          ? Math.round((doneTasks / totalTasks) * 100)
          : 0;

      return res.json({
        success: true,
        answer: `Projenin genel ilerleme oranı %${percentage}. Toplam ${totalTasks} görevin ${doneTasks} tanesi tamamlanmış durumda.`
      });
    }

    if (intent === "ACTIVE_SPRINT") {
      return res.json({
        success: true,
        answer: activeSprint
          ? `Şu anda aktif sprint ${activeSprint.name}. Başlangıç tarihi ${formatDate(
              activeSprint.start_date,
            )}, bitiş tarihi ${formatDate(activeSprint.end_date)}.`
          : "Bu projede şu anda aktif sprint bulunmuyor.",
      });
    }

    if (intent === "MEMBER_COUNT") {
      const names = context.members.map((m) => m.name).join(", ");

      return res.json({
        success: true,
        answer: `Bu projede toplam ${context.members.length} kişi var. Ekip üyeleri: ${names}.`,
      });
    }

    if (intent === "BUSIEST_MEMBER") {
      const sorted = [...context.active_sprint_workload_summary].sort(
        (a, b) => {
          return (
            Number(b.active_tasks) - Number(a.active_tasks) ||
            Number(b.overdue_tasks) - Number(a.overdue_tasks) ||
            Number(b.critical_tasks) - Number(a.critical_tasks)
          );
        },
      );

      const busiest = sorted[0];

      if (!busiest || Number(busiest.active_tasks) === 0) {
        return res.json({
          success: true,
          answer:
            "Aktif sprintte şu anda aktif görevi olan bir ekip üyesi görünmüyor.",
        });
      }

      return res.json({
        success: true,
        answer: `Aktif sprintte en yoğun kişi ${busiest.full_name}. Aktif görev sayısı ${busiest.active_tasks}, geciken görev sayısı ${busiest.overdue_tasks}.`,
      });
    }

    if (intent === "OVERDUE_TASKS") {
      const overdueTasks = context.tasks.filter((t) => {
        if (!activeSprint) return false;
        const isActiveStatus = ["TODO", "IN_PROGRESS"].includes(t.status);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueDate = new Date(t.due_date);
        dueDate.setHours(0, 0, 0, 0);

        const isOverdue = t.due_date && dueDate < today;
        return (
          t.sprint_name === activeSprint.name && isActiveStatus && isOverdue
        );
      });

      if (overdueTasks.length === 0) {
        return res.json({
          success: true,
          answer: "Aktif sprintte geciken görev görünmüyor.",
        });
      }

      const text = overdueTasks
        .map((t) => {
          const assignees =
            Array.isArray(t.assignees) && t.assignees.length > 0
              ? t.assignees.map((a) => a.name).join(", ")
              : "Atanmamış";

          return `- ${t.title} | Atanan: ${assignees} | Son tarih: ${formatDate(
            t.due_date,
          )}`;
        })
        .join("\n");

      return res.json({
        success: true,
        answer: `Aktif sprintte ${overdueTasks.length} geciken görev var:\n${text}`,
      });
    }

    if (intent === "MY_ACTIVE_SPRINT_TASKS") {
      const myTasks = context.tasks.filter((t) => {
        if (!activeSprint) return false;
        const assignees = Array.isArray(t.assignees) ? t.assignees : [];
        return (
          t.sprint_name === activeSprint.name &&
          assignees.some((a) => String(a.id) === String(userId))
        );
      });

      return res.json({
        success: true,
        answer: activeSprint
          ? `${activeSprint.name} içinde size atanmış ${myTasks.length} görev var.`
          : "Aktif sprint olmadığı için sprint görev sayınız hesaplanamadı.",
      });
    }

    if (intent === "WORKLOAD_ANALYSIS") {
      const rows = context.active_sprint_workload_summary || [];

      if (rows.length === 0) {
        return res.json({
          success: true,
          answer: "Aktif sprint için iş yükü bilgisi bulunamadı.",
        });
      }

      const busiest = [...rows].sort((a, b) => {
        return (
          Number(b.active_tasks) - Number(a.active_tasks) ||
          Number(b.overdue_tasks) - Number(a.overdue_tasks) ||
          Number(b.critical_tasks) - Number(a.critical_tasks)
        );
      })[0];

      const memberLines = rows
        .map(
          (m) =>
            `${m.full_name}: ${m.active_tasks} aktif görev, ${m.overdue_tasks} geciken görev`
        )
        .join("\n");

      return res.json({
        success: true,
        answer:
          `Aktif sprint iş yükü:\n` +
          `${memberLines}\n` +
          `En yoğun kişi: ${busiest.full_name}`,
      });
    }

    if (intent === "SPRINT_ANALYSIS") {
      if (!activeSprint) {
        return res.json({
          success: true,
          answer: "Bu projede şu anda aktif sprint bulunmuyor.",
        });
      }


      const sprintTasks = context.tasks.filter(
        (t) => t.sprint_name === activeSprint.name,
      );

      const todoCount = sprintTasks.filter((t) => t.status === "TODO").length;
      const inProgressCount = sprintTasks.filter(
        (t) => t.status === "IN_PROGRESS",
      ).length;
      const doneCount = sprintTasks.filter((t) => t.status === "DONE").length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const overdueCount = sprintTasks.filter((t) => {
        if (!["TODO", "IN_PROGRESS"].includes(t.status)) return false;
        if (!t.due_date) return false;

        const dueDate = new Date(t.due_date);
        dueDate.setHours(0, 0, 0, 0);

        return dueDate < today;
      }).length;

      const totalCount = sprintTasks.length;
      const completionRate =
        totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

      let comment = "Sprint genel olarak takip edilebilir durumda.";
      if (overdueCount > 0) {
        comment =
          "Sprintte geciken görev bulunduğu için bu görevlerin öncelikli takip edilmesi önerilir.";
      } else if (completionRate >= 75) {
        comment = "Sprint ilerlemesi iyi görünüyor.";
      } else if (completionRate < 50) {
        comment =
          "Sprint ilerlemesi düşük görünüyor, kalan görevlerin yeniden değerlendirilmesi önerilir.";
      }

      return res.json({
        success: true,
        answer:
          `${activeSprint.name} aktif olarak devam ediyor.\n` +
          `Toplam görev: ${totalCount}\n` +
          `Yapılacak: ${todoCount}\n` +
          `Devam eden: ${inProgressCount}\n` +
          `Tamamlanan: ${doneCount}\n` +
          `Geciken görev: ${overdueCount}\n` +
          `Tamamlanma oranı: %${completionRate}\n` +
          `${comment}`,
      });
    }

    const activeSprintStatsText = context.active_sprint_stats
  ? `
KESİN AKTİF SPRINT İSTATİSTİKLERİ:
- Aktif sprint: ${context.active_sprint_stats.sprint_name}
- Toplam görev: ${context.active_sprint_stats.total_tasks}
- Yapılacak görev: ${context.active_sprint_stats.todo_tasks}
- Devam eden görev: ${context.active_sprint_stats.in_progress_tasks}
- Tamamlanan görev: ${context.active_sprint_stats.done_tasks}
- Geciken görev: ${context.active_sprint_stats.overdue_tasks}
- 3 gün içinde teslim: ${context.active_sprint_stats.due_soon_tasks}
- Genel ilerleme: %${context.active_sprint_stats.progress_percent}

Bu istatistikler kesin veridir.
`
  : "KESİN AKTİF SPRINT İSTATİSTİKLERİ: Aktif sprint bulunmuyor.";

    const userPrompt = `
Aşağıdaki proje verilerine göre kullanıcının sorusunu cevapla.

Kurallar:

Sen bu proje için çalışan AI proje asistanısın.
Cevapların proje yöneticisi gibi kısa, anlaşılır ve veriye dayalı olmalı.

Genel kurallar:
- Sadece verilen proje verilerine göre cevap ver.
- Veri yoksa uydurma.
- Türkçe cevap ver.
- Teknik ID, UUID, kolon adı veya raw JSON gösterme.
- Görevlerden bahsederken görev adlarını kullan.
- Kullanıcının yazım hatalarını anlayarak yorumla.
- Cevapları gereksiz uzatma.
- Normal sorularda 3-5 cümle yeterli.
- Kullanıcı özellikle detay isterse en fazla 2 kısa paragraf yaz.
- Markdown başlıkları kullanma.
- Çok uzun liste yapma.
- Sayısal değerler için öncelikle active_sprint_stats alanını kullan.
- Aktif sprint toplam görev, yapılacak, devam eden, tamamlanan, geciken, 3 gün içinde teslim ve ilerleme yüzdesi sorulursa active_sprint_stats dışına çıkma.
- active_sprint_stats içindeki sayılar kesin veridir. Bu sayıları tahmin etme, değiştirme veya yeniden hesaplama.

Proje amacı / konusu sorulursa:
- Sadece project.description metnini aynen tekrar etme.
- Project name, description ve görevlerden anlam çıkar.
- Projenin ne için yapıldığını, hangi problemi çözdüğünü ve hangi modülleri içerdiğini açıkla.
- Cevap 4-6 cümle olsun.

Proje gidişatı / liderlik sorulursa:
- Liderin sadece kendi görevlerine odaklanma.
- Projenin genel durumunu değerlendir.
- Aktif sprintteki toplam görev, tamamlanan görev, devam eden görev, geciken görev ve iş yükü dağılımını dikkate al.
- Liderliği; proje ilerlemesi, gecikmelerin takibi, ekip iş yükü ve sprint sağlığı üzerinden yorumla.
- Cevap dengeli olsun: iyi gidenleri ve dikkat edilmesi gerekenleri birlikte söyle.
- Lideri gereksiz övme.
- En fazla 6-8 cümle yaz.
- Kullanıcı "şu an neye odaklanırdın" derse tamamlanmış görevleri değil, TODO veya IN_PROGRESS görevleri dikkate al.

İş yükü sorulursa:
- active_sprint_workload_summary verisini kullan.
- Aktif görev, geciken görev ve kritik görev sayılarına göre yorum yap.

Sprint sorulursa:
- Aktif sprintin durumunu, tamamlanma oranını, geciken görevleri ve riski yorumla.

Kullanıcı "ben", "bana", "benim" derse current_user bilgisini kullan.

Proje dışı soru sorarsa şu cevabı ver:
"Ben bu proje için çalışan AI proje asistanıyım. Proje verileri, görevler, sprintler, riskler ve ekip iş yükü hakkında yardımcı olabilirim."

${activeSprintStatsText}

PROJE VERİLERİ:
${JSON.stringify(context, null, 2)}

KULLANICI SORUSU:
${String(message).trim()}
`;

    const aiResponse = await askAI({
      systemPrompt:
  "Sen deneyimli bir Scrum Master ve proje yönetim asistanısın. Görevin proje verilerini kısa, doğal ve veriye dayalı şekilde yorumlamaktır. Cevapların ne çok kısa ne çok uzun olmalı; kullanıcıya karar destek sağlayacak kadar açıklayıcı olmalı.",
      userPrompt,
    });

    const cleanedAnswer = String(aiResponse || "")
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .replace(/\*\*/g, "")
      .replace(/###/g, "")
      .replace(/##/g, "")
      .replace(/#/g, "")
      .replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
        "",
      )
      .trim();

    return res.json({
      success: true,
      answer: cleanedAnswer,
    });
  } catch (err) {
    console.error("AI chat error:", err);
    return res.status(500).json({
      message: "AI proje asistanı cevap üretirken hata oluştu.",
    });
  }
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/projects", projectRoutes);
app.use(tasksRoutes);
app.use(require("./routes/comment.routes"));
app.use(require("./routes/attachment.routes"));
app.use("/", require("./routes/sprint.routes"));
app.use("/dashboard", require("./routes/dashboard.routes"));
app.use("/notifications", require("./routes/notification.routes"));
app.use(projectChatRoutes);

app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes("CORS policy")) {
    return res.status(403).json({ message: err.message });
  }
  next(err);
});

module.exports = app;
