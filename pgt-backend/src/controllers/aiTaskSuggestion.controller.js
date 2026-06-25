const pool = require("../config/db.js");
const { ensureLeader, ensureProjectMember } = require("../utils/projectAuth");
const { askAI } = require("../services/qwen.service");
const { createNotification } = require("../utils/notification");


/**
 * Bu controller, yapay zekâ destekli görev önerileri modülünü yönetir.
 * Proje bilgilerini analiz ederek AI ile görev önerileri üretir,
 * önerileri listeler, kabul veya reddetme işlemlerini gerçekleştirir.
 * Ayrıca kabul edilen önerileri gerçek görevlere dönüştürerek
 * proje yönetim sürecine dahil eder.
 */

const STAGES = {
  planning: "Analiz ve Planlama",
  frontend: "Frontend",
  backend: "Backend",
  database: "Veritabanı",
  testing: "Test ve Deployment",
};

function normalizeText(text = "") {
  return String(text).toLowerCase().trim().replace(/\s+/g, " ");
}

function safeDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function fallbackSuggestions({ stage }) {
  const common = {
    estimated_days: 1,
    suggested_dependency_ids: [],
    suggested_dependency_reason: "",
  };

  if (stage === "planning") {
    return [
      {
        ...common,
        title: "Proje gereksinimlerini belirle",
        description:
          "Projenin temel amaçlarını, kullanıcı rollerini ve ana modüllerini netleştir.",
        category: "Analiz",
        priority: "HIGH",
        estimated_hours: 3,
      },
      {
        ...common,
        title: "Kullanıcı senaryolarını oluştur",
        description: "Sistemi kullanacak kullanıcıların temel akışlarını yaz.",
        category: "Analiz",
        priority: "MEDIUM",
        estimated_hours: 2,
      },
    ];
  }

  if (stage === "frontend") {
    return [
      {
        ...common,
        title: "Ana arayüz tasarımını oluştur",
        description:
          "Proje açıklamasına uygun temel ekranları ve kullanıcı akışını hazırla.",
        category: "Frontend",
        priority: "HIGH",
        estimated_hours: 5,
        estimated_days: 2,
      },
      {
        ...common,
        title: "Responsive tasarımı düzenle",
        description: "Sayfaların mobil ve masaüstü görünümünü kontrol et.",
        category: "Frontend",
        priority: "MEDIUM",
        estimated_hours: 3,
      },
    ];
  }

  if (stage === "backend") {
    return [
      {
        ...common,
        title: "Backend API endpointlerini oluştur",
        description:
          "Projenin ihtiyaç duyduğu temel CRUD endpointlerini geliştir.",
        category: "Backend",
        priority: "HIGH",
        estimated_hours: 5,
        estimated_days: 2,
      },
      {
        ...common,
        title: "Yetkilendirme kontrollerini ekle",
        description: "Kullanıcı rolüne göre erişim kontrolü sağla.",
        category: "Backend",
        priority: "HIGH",
        estimated_hours: 3,
      },
    ];
  }

  if (stage === "database") {
    return [
      {
        ...common,
        title: "Veritabanı tablolarını tasarla",
        description: "Proje modüllerine göre ilişkisel tablo yapısını oluştur.",
        category: "Database",
        priority: "HIGH",
        estimated_hours: 4,
      },
      {
        ...common,
        title: "Tablo ilişkilerini ve kısıtları ekle",
        description:
          "Foreign key, default değerler ve gerekli indeksleri tanımla.",
        category: "Database",
        priority: "MEDIUM",
        estimated_hours: 3,
      },
    ];
  }

  return [
    {
      ...common,
      title: "Test senaryolarını hazırla",
      description:
        "Temel kullanıcı işlemleri için manuel test senaryoları oluştur.",
      category: "Test",
      priority: "MEDIUM",
      estimated_hours: 3,
    },
    {
      ...common,
      title: "Deployment ayarlarını tamamla",
      description:
        "Frontend ve backend ortam değişkenlerini kontrol ederek yayına hazırla.",
      category: "Deployment",
      priority: "HIGH",
      estimated_hours: 4,
    },
  ];
}

function isSimilarTask(newTitle, existingTitles = []) {
  const newWords = normalizeText(newTitle)
    .split(" ")
    .filter((w) => w.length > 3);

  return existingTitles.some((title) => {
    const existingWords = normalizeText(title)
      .split(" ")
      .filter((w) => w.length > 3);

    const common = newWords.filter((w) =>
      existingWords.includes(w)
    );

    const similarity =
      common.length / Math.max(newWords.length, existingWords.length);

    return similarity >= 0.75;
  });
}

async function generateAiTaskSuggestions(req, res) {
  const { id } = req.params;
  const { stage = "planning" } = req.body;

  if (!STAGES[stage]) {
    return res.status(400).json({ message: "Invalid stage" });
  }

  try {
    const authz = await ensureLeader(id, req.user.userId);
    if (!authz.ok) {
      return res
        .status(403)
        .json({ message: "Only LEADER can generate AI task suggestions" });
    }

    const projectQ = await pool.query(
      `
      SELECT id, name, description, template_type
      FROM projects
      WHERE id = $1
      `,
      [id],
    );

    if (!projectQ.rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    const project = projectQ.rows[0];

    const membersQ = await pool.query(
      `
      SELECT u.id, u.full_name, u.email, pm.role
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = $1
      ORDER BY pm.role DESC, u.full_name ASC
      `,
      [id],
    );

    const projectMembers = membersQ.rows;

    const activeSprintQ = await pool.query(
      `
      SELECT id
      FROM sprints
      WHERE project_id = $1
        AND status = 'ACTIVE'
      ORDER BY start_date DESC, created_at DESC
      LIMIT 1
      `,
      [id],
    );

    const activeSprintId = activeSprintQ.rows[0]?.id || null;

    const existingTasksQ = await pool.query(
      `
      SELECT id, title, description, status
      FROM tasks
      WHERE project_id = $1
        AND sprint_id = $2
        AND status != 'ARCHIVED'
      ORDER BY created_at ASC
      LIMIT 25
      `,
      [id, activeSprintId],
    );

    const existingSuggestionsQ = await pool.query(
      `
      SELECT title
      FROM ai_task_suggestions
      WHERE project_id = $1
      `,
      [id],
    );

    const existingTasks = existingTasksQ.rows;

    const existingTaskTitles = [
      ...existingTasks.map((r) => r.title),
      ...existingSuggestionsQ.rows.map((r) => r.title),
    ];

    let suggestions = [];

    try {
      suggestions = await generateSuggestionsWithQwen({
        project,
        stageLabel: STAGES[stage],
        existingTaskTitles,
        existingTasks,
        projectMembers,
      });
    } catch (aiErr) {
      console.error("AI TASK SUGGESTION ERROR:", aiErr.message);
      suggestions = fallbackSuggestions({ stage });
    }

    const inserted = [];

    const existingNormalized = new Set(
      existingTaskTitles.map((t) => normalizeText(t)),
    );

    for (const s of suggestions) {

      console.log("AI önerisi:", s.title);

      const normalizedTitle = normalizeText(s.title);

      if (
        !normalizedTitle ||
        existingNormalized.has(normalizedTitle) ||
        isSimilarTask(s.title, existingTaskTitles)
      ) {
        console.log("BENZER GÖREV:", s.title);
        continue;
      }

      existingNormalized.add(normalizedTitle);

      const ins = await pool.query(
        `
        INSERT INTO ai_task_suggestions
          (
            project_id,
            title,
            description,
            category,
            task_type,
            roadmap_order,
            priority,
            estimated_hours,
            estimated_days,
            start_date,
            due_date,
            suggested_assignee_id,
            suggested_assignee_reason,
            suggested_dependency_ids,
            suggested_dependency_reason,
            subtasks,
            acceptance_criteria,
            status,
            created_by
          )
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'PENDING', $18)
        RETURNING *
        `,
        [
          id,
          s.title,
          s.description,
          s.category,
          s.task_type,
          s.roadmap_order || 1,
          s.priority,
          s.estimated_hours,
          s.estimated_days || null,
          safeDate(s.start_date),
          safeDate(s.due_date),
          s.suggested_assignee_id || null,
          s.suggested_assignee_reason || null,
          s.suggested_dependency_ids || [],
          s.suggested_dependency_reason || null,
          JSON.stringify(s.subtasks || []),
          JSON.stringify(s.acceptance_criteria || []),
          req.user.userId,
        ],
      );

      inserted.push(ins.rows[0]);
    }

    await pool.query(
      `
      INSERT INTO task_logs (project_id, task_id, action, message, meta, actor_id)
      VALUES ($1, NULL, $2, $3, $4, $5)
      `,
      [
        id,
        "AI_TASK_SUGGESTIONS_GENERATED",
        `AI görev önerileri üretildi: ${STAGES[stage]}`,
        JSON.stringify({ stage, count: inserted.length }),
        req.user.userId,
      ],
    );

    return res.status(201).json({
      message: "AI task suggestions generated",
      stage,
      suggestions: inserted,
    });
  } catch (err) {
    console.error("GENERATE AI TASK SUGGESTIONS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function getAiTaskSuggestions(req, res) {
  const { id } = req.params;

  try {
    const membership = await ensureProjectMember(id, req.user.userId);
    if (!membership) {
      return res.status(403).json({ message: "Not a member of this project" });
    }

    const result = await pool.query(
      `
      SELECT 
        ats.*,
        u.full_name AS suggested_assignee_name,
        u.email AS suggested_assignee_email,

        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', dep.id,
              'title', dep.title,
              'status', dep.status
            )
          ) FILTER (WHERE dep.id IS NOT NULL),
          '[]'
        ) AS suggested_dependencies

      FROM ai_task_suggestions ats
      LEFT JOIN users u 
        ON u.id = ats.suggested_assignee_id
      LEFT JOIN tasks dep
        ON dep.id = ANY(ats.suggested_dependency_ids)

      WHERE ats.project_id = $1

      GROUP BY ats.id, u.full_name, u.email
      ORDER BY ats.created_at DESC
      `,
      [id],
    );

    return res.json({ suggestions: result.rows });
  } catch (err) {
    console.error("GET AI TASK SUGGESTIONS ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function acceptAiTaskSuggestion(req, res) {
  const { id, suggestionId } = req.params;

  const {
    title,
    description,
    priority,
    estimated_hours,
    estimated_days,
    start_date,
    due_date,
    assignee_id,
    assignee_ids = [],
    dependency_ids,
  } = req.body || {};

  try {
    const authz = await ensureLeader(id, req.user.userId);
    if (!authz.ok) {
      return res
        .status(403)
        .json({ message: "Only LEADER can accept AI suggestions" });
    }

    const suggestionQ = await pool.query(
      `
      SELECT *
      FROM ai_task_suggestions
      WHERE id = $1 AND project_id = $2
      `,
      [suggestionId, id],
    );

    if (!suggestionQ.rows.length) {
      return res.status(404).json({ message: "Suggestion not found" });
    }

    const suggestion = suggestionQ.rows[0];

    if (suggestion.status !== "PENDING") {
      return res.status(400).json({ message: "Suggestion is not pending" });
    }

    await pool.query("BEGIN");

    const finalTitle = String(title || suggestion.title || "").trim();

    const finalDescription =
      description !== undefined
        ? String(description || "").trim()
        : suggestion.description;

    const finalSubtasks = Array.isArray(suggestion.subtasks)
      ? suggestion.subtasks
      : [];

    const finalAcceptanceCriteria = Array.isArray(suggestion.acceptance_criteria)
      ? suggestion.acceptance_criteria
      : [];

    const finalPriority = ["LOW", "MEDIUM", "HIGH"].includes(
      String(priority || suggestion.priority || "").toUpperCase(),
    )
      ? String(priority || suggestion.priority).toUpperCase()
      : "MEDIUM";

    const finalCategory =
      suggestion.category ||
      suggestion.task_category ||
      "Genel";

    const finalTaskType =
      suggestion.task_type ||
      suggestion.type ||
      null;

    const finalEstimatedHours =
      estimated_hours !== undefined
        ? Number(estimated_hours || 0)
        : Number(suggestion.estimated_hours || 0);

    const finalEstimatedDays =
      estimated_days !== undefined
        ? Number(estimated_days || 0)
        : Number(suggestion.estimated_days || 0);

    const finalStartDate =
      start_date !== undefined
        ? safeDate(start_date)
        : safeDate(suggestion.start_date);

    const finalDueDate =
      due_date !== undefined
        ? safeDate(due_date)
        : safeDate(suggestion.due_date);

    const finalAssigneeIds = Array.isArray(assignee_ids)
      ? assignee_ids.map(String).filter(Boolean)
      : assignee_id
      ? [String(assignee_id)]
      : suggestion.suggested_assignee_id
      ? [String(suggestion.suggested_assignee_id)]
      : [];

    const finalAssigneeId = finalAssigneeIds[0] || null;

    const finalDependencyIds = Array.isArray(dependency_ids)
      ? dependency_ids.map(String)
      : Array.isArray(suggestion.suggested_dependency_ids)
        ? suggestion.suggested_dependency_ids.map(String)
        : [];

    if (!finalTitle) {
      await pool.query("ROLLBACK");
      return res.status(400).json({ message: "Task title required" });
    }

    const activeSprintQ = await pool.query(
      `
      SELECT id
      FROM sprints
      WHERE project_id = $1
        AND (
          status = 'ACTIVE'
          OR status = 'active'
          OR status = 'Aktif'
        )
      ORDER BY start_date DESC, created_at DESC
      LIMIT 1
      `,
      [id],
    );

    const activeSprintId = activeSprintQ.rows[0]?.id || null;

    const taskIns = await pool.query(
      `
      INSERT INTO tasks
        (
          project_id,
          sprint_id,
          title,
          description,
          category,
          task_type,
          status,
          priority,
          created_by,
          start_date,
          due_date,
          subtasks,
          acceptance_criteria
        )
      VALUES
        ($1, $2, $3, $4, $5, $6, 'TODO', $7, $8, $9, $10, $11, $12)
      RETURNING *
      `,
      [
        id,
        activeSprintId,
        finalTitle,
        finalDescription,
        finalCategory,
        finalTaskType,
        finalPriority,
        req.user.userId,
        finalStartDate,
        finalDueDate,
        JSON.stringify(finalSubtasks),
        JSON.stringify(finalAcceptanceCriteria),
      ],
    );

    const createdTaskId = taskIns.rows[0].id;

    if (finalAssigneeId) {
      await pool.query(
        `
        UPDATE tasks
        SET assigned_to = $2
        WHERE id = $1
        `,
        [createdTaskId, finalAssigneeId],
      );
    }

    for (const assigneeId of finalAssigneeIds) {
      await pool.query(
        `
        INSERT INTO task_assignees (task_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [createdTaskId, assigneeId],
      );
    }

    for (const assigneeId of finalAssigneeIds) {
      await createNotification({
        userId: assigneeId,
        type: "TASK_ASSIGNED",
        title: "Sana yeni bir AI task atandı",
        body: finalTitle,
        projectId: id,
        taskId: createdTaskId,
        triggeredBy: req.user.userId,
      });
    }

    for (const depId of finalDependencyIds) {
      if (!depId || String(depId) === String(createdTaskId)) continue;

      await pool.query(
        `
        INSERT INTO task_dependencies (project_id, task_id, depends_on_task_id)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        `,
        [id, createdTaskId, depId],
      );
    }

    await pool.query(
      `
      UPDATE ai_task_suggestions
      SET 
        title = $2,
        description = $3,
        priority = $4,
        estimated_hours = $5,
        estimated_days = $6,
        start_date = $7,
        due_date = $8,
        suggested_assignee_id = $9,
        suggested_dependency_ids = $10,
        status = 'ACCEPTED',
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        suggestionId,
        finalTitle,
        finalDescription,
        finalPriority,
        finalEstimatedHours,
        finalEstimatedDays,
        finalStartDate,
        finalDueDate,
        finalAssigneeId,
        finalDependencyIds,
      ],
    );


    await pool.query(
      `
      INSERT INTO task_logs (project_id, task_id, action, message, meta, actor_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        id,
        createdTaskId,
        "AI_TASK_SUGGESTION_ACCEPTED",
        `AI görev önerisi kabul edildi: "${finalTitle}"`,
        JSON.stringify({
          suggestion_id: suggestionId,
          category: finalCategory,
          task_type: finalTaskType,
          estimated_hours: finalEstimatedHours,
          estimated_days: finalEstimatedDays,
          start_date: finalStartDate,
          due_date: finalDueDate,
          assignee_ids: finalAssigneeIds,
          dependency_ids: finalDependencyIds,
        }),
        req.user.userId,
      ],
    );

    await pool.query("COMMIT");

    return res.json({
      message: "AI suggestion accepted and task created",
      task: taskIns.rows[0],
    });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("ACCEPT AI TASK SUGGESTION ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function rejectAiTaskSuggestion(req, res) {
  const { id, suggestionId } = req.params;

  try {
    const authz = await ensureLeader(id, req.user.userId);
    if (!authz.ok) {
      return res
        .status(403)
        .json({ message: "Only LEADER can reject AI suggestions" });
    }

    const updated = await pool.query(
      `
      UPDATE ai_task_suggestions
      SET status = 'REJECTED', updated_at = NOW()
      WHERE id = $1 AND project_id = $2 AND status = 'PENDING'
      RETURNING *
      `,
      [suggestionId, id],
    );

    if (!updated.rows.length) {
      return res.status(404).json({ message: "Pending suggestion not found" });
    }

    return res.json({
      message: "AI suggestion rejected",
      suggestion: updated.rows[0],
    });
  } catch (err) {
    console.error("REJECT AI TASK SUGGESTION ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

async function deleteAiTaskSuggestion(req, res) {
  const { id, suggestionId } = req.params;

  try {
    const authz = await ensureLeader(id, req.user.userId);

    if (!authz.ok) {
      return res.status(403).json({
        message: "Only LEADER can delete AI suggestions",
      });
    }

    const deleted = await pool.query(
      `
      DELETE FROM ai_task_suggestions
      WHERE id = $1
        AND project_id = $2
      RETURNING *
      `,
      [suggestionId, id],
    );

    if (!deleted.rows.length) {
      return res.status(404).json({
        message: "Suggestion not found",
      });
    }

    return res.json({
      message: "AI suggestion deleted",
      suggestion: deleted.rows[0],
    });
  } catch (err) {
    console.error("DELETE AI TASK SUGGESTION ERROR:", err);

    return res.status(500).json({
      message: "Server error",
    });
  }
}

async function generateSuggestionsWithQwen({
  project,
  stageLabel,
  existingTaskTitles = [],
  existingTasks = [],
  projectMembers = [],
}) {
  const today = new Date().toISOString().slice(0, 10);

  const systemPrompt =
    "Sen yalnızca geçerli JSON döndüren bir yazılım proje yönetim asistanısın. Açıklama yazma, markdown kullanma.";

  const userPrompt = `
Sen deneyimli bir Senior Software Architect ve Agile Project Manager'sın.

Görevin:
Verilen proje bilgilerine ve seçilen aşamaya göre gerçekçi, teknik ve uygulanabilir 3 görev önerisi üretmek.

Bugünün tarihi: ${today}

Proje adı:
${project.name}

Proje türü:
${project.template_type || "blank"}

Proje açıklaması:
${project.description || "Açıklama yok"}

Seçilen aşama:
${stageLabel}

Mevcut aktif görev başlıkları:
${existingTaskTitles.join("\n") || "Yok"}

Mevcut aktif görevler:
${existingTasks
  .map(
    (t) =>
      `id:${t.id} | ${t.title} | status:${t.status}`
  )
  .join("\n")}

Proje üyeleri:
${
  projectMembers
    .map(
      (m) =>
        `- id: ${m.id} | ad: ${m.full_name || m.email} | email: ${m.email} | rol: ${m.role}`
    )
    .join("\n") || "Üye yok"
}

GENEL KURALLAR:
- SADECE 3 görev üret.
- Sadece seçilen aşamaya uygun görev üret.
- Zaten mevcut olan görevleri tekrar önerme.
- Mevcut aktif görev başlıkları listesindeki hiçbir başlığı aynı veya benzer şekilde üretme.
- Başlıkta geçen ana kavramlar aynıysa bu görev tekrar sayılır.
- Örneğin mevcut görevde "Sipariş Durumu Güncelleme" varsa, "Sipariş Durumu Güncelleme Backend Servisi" gibi benzer başlıklar üretme.
- Eğer seçilen aşamadaki temel görevler zaten varsa, aynı aşama içinde daha ileri seviye, farklı ve tamamlayıcı görevler üret.
- Yeni görevler mevcut görevlerin aynısı değil; eksik kalan yeni modül, validasyon, loglama, hata yönetimi, güvenlik, optimizasyon veya entegrasyon tarafında olmalıdır.
- Genel/generic görev üretme.
- Proje açıklamasını ve mevcut görevleri analiz ederek domain'e özel görev üret.
- Görev başlıklarında mevcut görevlerle aynı fiil + aynı modül kombinasyonunu kullanma.
Mevcut görevler zaten oluşturulmuş kabul edilsin. Senin görevin aynı görevleri tekrar yazmak değil, projede eksik kalabilecek yeni ve tamamlayıcı görevler önermektir.
- Görevler sprint içinde tamamlanabilecek küçük ve uygulanabilir tasklar olsun.
- Görev başlıkları kısa ama teknik olsun.
- Açıklamalar görevde ne yapılacağını net anlatsın.
- Her görev için 1-2 uygulanabilir subtask üret.
- Her görev için 1-2 ölçülebilir acceptance criteria üret.
- suggested_assignee_reason üret.
- suggested_dependency_reason üret.
- roadmap_order değerleri sadece 1, 2, 3 olsun.
- start_date ve due_date geçmiş tarih olmasın.
- Tarihler YYYY-MM-DD formatında olsun.
- estimated_hours ve estimated_days gerçekçi olsun.

ÖNEMLİ:

Mevcut görev başlıklarıyla %60 veya daha fazla anlamsal benzerlik taşıyan görevler tekrar kabul edilir.

Örneğin:

"Kullanıcı Rolleri Veritabanı Yapısı"
ve
"Kullanıcı Rolleri İçin Database Tasarımı"

aynı görev kabul edilir ve üretilmemelidir.

Aynı modül + aynı amaç kombinasyonunu tekrar üretme.

IMPORTANT RULES:
- Her görev için mutlaka suggested_assignee_id dolu olmalıdır.
- Eğer ekip üyesi varsa görev kesinlikle uygun bir ekip üyesine atanmalıdır.
- suggested_assignee_id asla null, boş string veya undefined olamaz.
- Görev bağımlılığı varsa dependency_ids alanına yalnızca mevcut TODO veya IN_PROGRESS durumundaki görevlerin id değerleri yazılmalıdır.
- DONE, REVIEW veya arşivlenmiş görevler dependency_ids içine eklenmemelidir.
- Eğer görev bir başka görev tamamlandıktan sonra yapılabiliyorsa dependency_ids mutlaka doldurulmalıdır.
- Bağımlılık yoksa dependency_ids boş array olmalıdır.
- Her görevde dependency_reason alanı bulunmalıdır. Bağımlılık varsa nedenini yaz, yoksa boş string döndür.

AŞAMA KURALLARI:
- Seçilen aşama "Analiz ve Planlama" ise category sadece "Analiz" olsun.
- Seçilen aşama "Frontend" ise category sadece "Frontend" olsun.
- Seçilen aşama "Backend" ise category sadece "Backend" olsun.
- Seçilen aşama "Veritabanı" ise category sadece "Database" olsun.
- Seçilen aşama "Test ve Deployment" ise category "Test" veya "Deployment" olsun.

AŞAMA DETAYLARI:
Analiz için:
- modül analizi, kullanıcı rolleri, sistem mimarisi, user flow, feature breakdown, API planı veya veri modeli analizi üret.

Frontend için:
- ekran, component, form, modal, listeleme, filtreleme, responsive tasarım ve kullanıcı akışı odaklı görev üret.

Backend için:
- API endpoint, servis mantığı, validation, authorization, logging, notification veya business logic odaklı görev üret.

Database için:
- tablo, migration, foreign key, index, constraint, enum/type, junction table veya seed data odaklı görev üret.

Test ve Deployment için:
- sadece mevcut veya geliştirilmiş modüllere uygun test/deployment görevi üret.
- henüz geliştirilmemiş özellik için test görevi üretme.

BAĞIMLILIK KURALLARI:

* suggested_dependency_ids alanına yalnızca mevcut aktif görevlerin id'lerini yaz.
* DONE durumundaki görevleri dependency olarak kullanma.
* Teknik olarak gerekli olmayan dependency üretme.
* Alakasız görevleri birbirine bağlama.
* En fazla 1-2 dependency öner.
* suggested_dependency_reason kısa ve teknik olsun.

Dependency belirlerken:

* Aynı modül içinde daha önce tamamlanması gereken aktif görevler varsa dependency öner.
* Veritabanı görevleri backend görevlerinin dependency'si olabilir.
* Backend görevleri frontend görevlerinin dependency'si olabilir.
* Authentication, authorization, token ve kullanıcı yönetimi görevleri; profil, yetkilendirme ve erişim kontrolü görevlerinin dependency'si olabilir.
* Aynı kullanıcı akışına ait görevler arasında mantıklı bir sıralama varsa dependency öner.
* Aynı özelliğin devamı niteliğindeki görevleri birbirine bağlayabilirsin.
* Dependency eklemek zorunda değilsin. Emin değilsen boş array döndür.
* Aynı dependency'yi birden fazla görev için kullanma.
* Dependency nedeni, dependency olarak seçilen görevin başlığıyla doğrudan ilişkili olmalıdır.
* Eğer neden cümlesi genel veya alakasız kalıyorsa dependency ekleme.

Önemli:

* Dependency eklerken yalnızca mevcut aktif görevleri değerlendir.
* Teknik olarak anlamlı bir ilişki varsa dependency öner.
* Gerçekten ilişkili bir görev bulunmuyorsa boş array kullan.

ÖNEMLİ:

Mevcut görevlerle aynı amaca hizmet eden görevleri tekrar üretme.

Aşağıdaki durumlar tekrar olarak kabul edilir:

- Aynı endpointin farklı isimlendirilmiş hali
- Aynı ekranın geliştirilmiş versiyonu
- Aynı CRUD işleminin farklı başlıkla yazılmış hali
- Aynı özelliğin "oluştur", "geliştir", "uygula" gibi farklı ifadelerle tekrar yazılması

Görevin amacı mevcut görevlerden biriyle aynıysa yeni görev üretme.

ATAMA KURALLARI:
- suggested_assignee_email alanına yukarıdaki proje üyelerinden birinin email adresini yaz.
- Atama nedeni ile seçilen kişi uyumlu olsun.
- "Proje lideri" diyorsan LEADER rolündeki kişinin email adresini yaz.
- Uygun kişi yoksa boş string ver.

TASK TYPE KURALLARI:
- Yeni kullanıcı özelliği: FEATURE
- Hata düzeltme: BUGFIX
- Kod iyileştirme: REFACTOR
- Güvenlik: SECURITY
- Performans: OPTIMIZATION
- Araştırma/analiz: RESEARCH

JSON KURALLARI:
- SADECE JSON array döndür.
- JSON dışında tek bir karakter bile yazma.
- Markdown kullanma.
- Açıklama yazma.
- Kod bloğu kullanma.
- Cevabı yarım bırakma.
- 3 görevden fazla üretme.

JSON formatı:
[
  {
    "title": "Görev başlığı",
    "description": "Detaylı görev açıklaması",
    "category": "Analiz | Frontend | Backend | Database | Test | Deployment",
    "task_type": "FEATURE | BUGFIX | REFACTOR | SECURITY | OPTIMIZATION | RESEARCH",
    "priority": "LOW | MEDIUM | HIGH",
    "estimated_hours": 2,
    "estimated_days": 1,
    "start_date": "YYYY-MM-DD",
    "due_date": "YYYY-MM-DD",
    "suggested_assignee_email": "Sadece verilen ekip üyelerinden birinin email adresi. Asla boş/null olamaz.",
    "suggested_assignee_reason": "Kısa atama nedeni",
    "suggested_dependency_ids": ["Sadece mevcut TODO veya IN_PROGRESS görev id değerleri. Bağımlılık yoksa boş array."],
    "suggested_dependency_reason": "Bağımlılık varsa kısa nedeni, yoksa boş string",
    "subtasks": [
      {
        "title": "Alt görev başlığı",
        "description": "Alt görev açıklaması"
      }
    ],
    "roadmap_order": 1,
    "acceptance_criteria": [
      "Ölçülebilir tamamlanma koşulu 1",
      "Ölçülebilir tamamlanma koşulu 2"
    ]
  }
]
`;

  const content = await askAI({
    systemPrompt,
    userPrompt,
    maxTokens: 4000,
  });

  const clean = String(content || "")
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(clean);
  } catch (err) {
    console.error("AI JSON PARSE ERROR:");
    console.error(clean);

    throw new Error("AI geçerli JSON döndürmedi");
  }

  const stageCategoryMap = {
    "Analiz ve Planlama": ["Analiz"],
    Frontend: ["Frontend"],
    Backend: ["Backend"],
    Veritabanı: ["Database", "Veritabanı"],
    "Test ve Deployment": ["Test", "Deployment"],
  };

  if (!Array.isArray(parsed)) {
    throw new Error("Qwen JSON array döndürmedi");
  }

  const activeTasks = existingTasks.filter(
    (t) =>
      t.status === "TODO" ||
      t.status === "IN_PROGRESS"
  );

  const validTaskIds = new Set(
    activeTasks.map((t) => String(t.id))
  );

  const allowedCategories = (stageCategoryMap[stageLabel] || []).map((x) =>
    x.toLowerCase()
  );

  const filtered = parsed.filter((item) =>
    allowedCategories.includes(
      String(item.category || "").trim().toLowerCase()
    )
  );

  return filtered
    .slice(0, 3)
    .map((item, index) => {
    const suggestedEmail = String(item.suggested_assignee_email || "")
      .trim()
      .toLowerCase();

    let matchedMember = projectMembers.find(
      (m) => String(m.email || "").toLowerCase() === suggestedEmail
    );

    // AI email döndürmezse ama "lider" diyorsa proje liderine ata
    if (!matchedMember) {
      const reason = String(item.suggested_assignee_reason || "").toLowerCase();

      if (
        reason.includes("lider") ||
        reason.includes("leader") ||
        reason.includes("proje lideri")
      ) {
        matchedMember = projectMembers.find(
          (m) => String(m.role || "").toUpperCase() === "LEADER"
        );
      }
    }

    // Hâlâ bulunamazsa boş bırak
    // AI email döndürmezse lideri ata
    if (!matchedMember && projectMembers.length > 0) {
      matchedMember =
        projectMembers.find(
          (m) => String(m.role || "").toUpperCase() === "LEADER"
        ) || projectMembers[0];
    }

    const dependencyIds = Array.isArray(item.suggested_dependency_ids)
      ? item.suggested_dependency_ids
          .map((x) => String(x).trim())
          .filter((x) => validTaskIds.has(x))
      : [];

    return {
      title: String(item.title || "").trim(),
      description: String(item.description || "").trim(),
      category: String(item.category || stageLabel || "AI").trim(),
      task_type: [
        "FEATURE",
        "BUGFIX",
        "REFACTOR",
        "SECURITY",
        "OPTIMIZATION",
        "RESEARCH",
      ].includes(String(item.task_type || "").toUpperCase())
        ? String(item.task_type).toUpperCase()
        : "FEATURE",
      roadmap_order: index + 1,
      priority: ["LOW", "MEDIUM", "HIGH"].includes(
        String(item.priority || "").toUpperCase(),
      )
        ? String(item.priority).toUpperCase()
        : "MEDIUM",
      estimated_hours: Number(item.estimated_hours || 2),
      estimated_days: Math.max(1, Math.ceil(Number(item.estimated_days || 1))),
      start_date: safeDate(item.start_date),
      due_date: safeDate(item.due_date),
      suggested_assignee_id: matchedMember?.id || null,
      suggested_assignee_reason: String(
        item.suggested_assignee_reason || "",
      ).trim(),
      suggested_dependency_ids: dependencyIds,
      suggested_dependency_reason: String(
        item.suggested_dependency_reason || "",
      ).trim(),
      subtasks: Array.isArray(item.subtasks)
        ? item.subtasks.map((sub) => ({
            title: String(sub.title || "").trim(),
            description: String(sub.description || "").trim(),
          }))
        : [],
      acceptance_criteria: Array.isArray(item.acceptance_criteria)
        ? item.acceptance_criteria.map((x) => String(x).trim()).filter(Boolean)
        : [],
    };
  });
}

module.exports = {
  generateAiTaskSuggestions,
  getAiTaskSuggestions,
  acceptAiTaskSuggestion,
  rejectAiTaskSuggestion,
  deleteAiTaskSuggestion,
};
