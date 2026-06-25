// Bu sayfa kullanıcıların şablon seçerek yeni proje oluşturmasını ve proje ayarlarını yapılandırmasını sağlar.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getToken } from "../api";
import { useTheme } from "../context/ThemeContext.jsx";

const LIGHT_COLORS = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  cardSoft: "#F8FAFC",
  header: "rgba(248,250,252,0.88)",
  border: "#E2E8F0",
  borderSoft: "#EEF2F7",
  text: "#0F172A",
  textSoft: "#475569",
  textMuted: "#94A3B8",
  inputBg: "#FFFFFF",
  primary: "#4F46E5",
  primarySoft: "#EEF2FF",
  purple: "#8B5CF6",
  danger: "#EF4444",
  dangerSoft: "#FEF2F2",
  dangerBorder: "#FECACA",
  dangerText: "#7F1D1D",
  success: "#10B981",
  successSoft: "#ECFDF5",
  successBorder: "#A7F3D0",
  successText: "#065F46",
  shadow: "0 6px 20px rgba(15,23,42,0.04)",
  buttonDisabled: "#A5B4FC",
};

const DARK_COLORS = {
  bg: "#0B1020",
  card: "#111827",
  cardSoft: "#0F172A",
  header: "rgba(11,16,32,0.88)",
  border: "#1E293B",
  borderSoft: "#1E293B",
  text: "#F8FAFC",
  textSoft: "#CBD5E1",
  textMuted: "#94A3B8",
  inputBg: "#0F172A",
  primary: "#818CF8",
  primarySoft: "rgba(129,140,248,0.14)",
  purple: "#A78BFA",
  danger: "#F87171",
  dangerSoft: "rgba(239,68,68,0.14)",
  dangerBorder: "rgba(248,113,113,0.35)",
  dangerText: "#FCA5A5",
  success: "#34D399",
  successSoft: "rgba(16,185,129,0.14)",
  successBorder: "rgba(52,211,153,0.35)",
  successText: "#6EE7B7",
  shadow: "0 14px 35px rgba(0,0,0,0.28)",
  buttonDisabled: "#475569",
};

const NAME_MAX = 60;
const DESC_MAX = 3000;

const SWATCHES = [
  "#4F46E5",
  "#8B5CF6",
  "#EC4899",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#0EA5E9",
  "#64748B",
];

const SPRINT_DURATIONS = [
  { label: "1 hafta", value: 7, desc: "Kısa ve hızlı sprint" },
  { label: "2 hafta", value: 14, desc: "Scrum için klasik süre" },
  { label: "10 gün", value: 10, desc: "Orta uzunlukta sprint" },
  { label: "1 ay", value: 30, desc: "Uzun planlama dönemi" },
];

const TEMPLATES = [
  {
    key: "blank",
    icon: "✨",
    title: "Boş Proje",
    desc: "Sıfırdan başla ve kendi proje yapını oluştur.",
    sprintDays: 14,
    fill: "",
  },
  {
    key: "web_app",
    icon: "🌐",
    title: "Web Uygulaması",
    desc: "Frontend, backend ve veritabanı odaklı.",
    sprintDays: 14,
    fill:
      "Proje Türü: Web Uygulaması\n\nModüller:\n- Authentication sistemi\n- Dashboard ekranı\n- Backend API\n- Veritabanı entegrasyonu\n- Responsive UI\n\nHedef:\nÇalışan ve deploy edilmiş bir web platformu oluşturmak.",
  },
  {
    key: "mobile_app",
    icon: "📱",
    title: "Mobil Uygulama",
    desc: "Mobil ekranlar, API ve bildirim sistemi.",
    sprintDays: 14,
    fill:
      "Proje Türü: Mobil Uygulama\n\nÖzellikler:\n- Login/Register ekranı\n- API entegrasyonu\n- Push notification sistemi\n- Mobil UI/UX\n- Yayınlama süreci\n\nHedef:\nAndroid/iOS için çalışan mobil uygulama geliştirmek.",
  },
  {
    key: "ai_project",
    icon: "🤖",
    title: "Yapay Zekâ Projesi",
    desc: "LLM, veri analizi ve AI entegrasyonu.",
    sprintDays: 14,
    fill:
      "Proje Türü: Yapay Zekâ Sistemi\n\nKapsam:\n- Veri toplama\n- Model/API entegrasyonu\n- Prompt sistemi\n- Tahmin/analiz ekranları\n- Sonuç görselleştirme\n\nHedef:\nAI destekli çalışan akıllı sistem geliştirmek.",
  },
  {
    key: "ecommerce",
    icon: "🛒",
    title: "E-Ticaret Sistemi",
    desc: "Ürün, sipariş ve ödeme süreçleri.",
    sprintDays: 7,
    fill:
      "Kullanıcıların ürünleri görüntüleyebildiği, kategori ve arama filtreleriyle ürünlere ulaşabildiği, ürünleri sepete ekleyerek sipariş oluşturabildiği web tabanlı bir e-ticaret platformu geliştirilecektir. Sistem müşteri ve yönetici rollerini destekleyecek; kullanıcı yönetimi, ürün ve kategori yönetimi, sepet işlemleri, sipariş takibi, ödeme süreci ve raporlama modüllerini içerecektir.\n\nProje kapsamında modern ve responsive kullanıcı arayüzleri tasarlanacak, ürün listeleme ve detay sayfaları geliştirilecek, REST API mimarisi ile frontend ve backend entegrasyonu sağlanacaktır. Veritabanında kullanıcı, ürün, kategori, sepet ve sipariş verileri saklanacaktır. Geliştirme süreci analiz, veritabanı tasarımı, kullanıcı işlemleri, ürün yönetimi, sipariş süreçleri, admin paneli, test ve optimizasyon aşamalarından oluşacaktır.",
  },
  {
    key: "management",
    icon: "📊",
    title: "Yönetim Sistemi",
    desc: "Dashboard, rapor ve kullanıcı yönetimi.",
    sprintDays: 14,
    fill:
      "Proje Türü: Yönetim Sistemi\n\nModüller:\n- Rol bazlı kullanıcı sistemi\n- Dashboard & raporlar\n- CRUD işlemleri\n- Bildirim sistemi\n- Veri analizi\n\nHedef:\nKurumsal süreçleri yöneten web sistemi oluşturmak.",
  },
  {
    key: "backend_api",
    icon: "⚙️",
    title: "API / Backend",
    desc: "REST API ve servis geliştirme.",
    sprintDays: 10,
    fill:
      "Proje Türü: Backend API Sistemi\n\nİçerik:\n- REST API geliştirme\n- JWT Authentication\n- PostgreSQL entegrasyonu\n- Swagger dokümantasyonu\n- Rate limit & security\n\nHedef:\nÖlçeklenebilir backend servis altyapısı geliştirmek.",
  },
];

function sprintDurationLabel(days) {
  const found = SPRINT_DURATIONS.find((x) => x.value === Number(days));
  return found ? found.label : `${days} gün`;
}

function initialsOf(s) {
  const t = (s || "").trim();
  if (!t) return "P";

  return (
    t
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "P"
  );
}

function useIsNarrow() {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 1150);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 1150);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isNarrow;
}

// Kullanıcının yeni proje oluşturmasını sağlayan sayfa.
export default function NewProjectPage() {
  const navigate = useNavigate();
  const token = getToken();
  const { isDark } = useTheme();
  const COLORS = isDark ? DARK_COLORS : LIGHT_COLORS;
  const isNarrow = useIsNarrow();

  useEffect(() => {
    if (!token) navigate("/login", { replace: true });
  }, [token, navigate]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [visibility, setVisibility] = useState("team");
  const [dueDate, setDueDate] = useState("");
  const [sprintDurationDays, setSprintDurationDays] = useState(14);
  const [template, setTemplate] = useState("blank");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const nameTrim = name.trim();
  const canSubmit = !!nameTrim && !creating;
  const initials = useMemo(() => initialsOf(nameTrim), [nameTrim]);

  // Proje şablonunu seçerek açıklama ve sprint bilgilerini otomatik doldurur.
  function applyTemplate(key) {
    setTemplate(key);

    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;

    setDescription(t.fill || "");

    if (t.sprintDays) {
      setSprintDurationDays(t.sprintDays);
    }
  }

  // Girilen bilgiler ile yeni proje oluşturur.
  async function handleCreateProject(e) {
    if (e?.preventDefault) e.preventDefault();

    setError("");
    setOkMsg("");

    if (!nameTrim) {
      setError("Proje adı boş olamaz.");
      return;
    }

    if (nameTrim.length > NAME_MAX) {
      setError(`Proje adı en fazla ${NAME_MAX} karakter olmalı.`);
      return;
    }

    try {
      setCreating(true);

      await apiFetch("/projects", {
        method: "POST",
        token,
        body: {
          name: nameTrim,
          description: description.trim(),
          sprint_duration_days: sprintDurationDays,
          color,
          template_type: template,
        },
      });

      setOkMsg("Proje başarıyla oluşturuldu. Yönlendiriliyorsun…");
      setTimeout(() => navigate("/projects", { replace: true }), 600);
    } catch (err) {
      console.error("handleCreateProject:", err);
      setError(err?.message || "Proje oluşturulamadı.");
    } finally {
      setCreating(false);
    }
  }

  // Ctrl + Enter kısayolu ile proje oluşturulmasını sağlar.
  function onKeyDownAny(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
      handleCreateProject();
    }
  }

  if (!token) return null;

  return (
    <div
      onKeyDown={onKeyDownAny}
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        transition: "background .2s ease, color .2s ease",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          background: COLORS.header,
          backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1380,
            margin: "0 auto",
            padding: "14px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button
              onClick={() => navigate("/projects")}
              title="Projelere dön"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.card,
                color: COLORS.text,
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ←
            </button>

            <div style={{ fontSize: 12, color: COLORS.textMuted }}>
              Projeler <span style={{ margin: "0 6px" }}>›</span>
              <span style={{ color: COLORS.text, fontWeight: 700 }}>Yeni Proje</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => navigate("/projects")}
              style={secondaryButton(COLORS)}
            >
              Vazgeç
            </button>

            <button
              onClick={handleCreateProject}
              disabled={!canSubmit}
              style={primaryButton(COLORS, canSubmit)}
            >
              {creating ? "Oluşturuluyor…" : "Projeyi Oluştur"}
            </button>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleCreateProject}
        style={{
          maxWidth: 1380,
          margin: "0 auto",
          padding: "28px 28px 56px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isNarrow ? "1fr" : "minmax(0, 1.25fr) minmax(420px, 0.75fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ marginBottom: 4 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: COLORS.primary,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  marginBottom: 8,
                }}
              >
                Yeni proje
              </div>

              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: COLORS.text }}>
                Projeni oluştur
              </h1>

              <p style={{ margin: "8px 0 0", fontSize: 14, color: COLORS.textMuted }}>
                Şablon seç, bilgileri gir ve sprint planını hazırla.
              </p>
            </div>

            <Card C={COLORS} title="Şablon seç" subtitle="Hızlı başlamak için bir proje tipi seçebilirsin.">
              <TemplateGrid
                C={COLORS}
                template={template}
                applyTemplate={applyTemplate}
                isNarrow={isNarrow}
              />
            </Card>

            <Card C={COLORS} title="Temel bilgiler">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isNarrow ? "1fr" : "1fr",
                  gap: 14,
                }}
              >
                <Field C={COLORS} label="Proje adı" hint={`${nameTrim.length}/${NAME_MAX}`} required>
                  <Input
                    C={COLORS}
                    value={name}
                    maxLength={NAME_MAX}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Örn: E-Ticaret ve Sipariş Takip Sistemi"
                    autoFocus
                  />
                </Field>

                <Field C={COLORS} label="Açıklama" hint={`${description.length}/${DESC_MAX}`}>
                  <TextArea
                    C={COLORS}
                    value={description}
                    maxLength={DESC_MAX}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Proje hakkında kısa bir açıklama yaz..."
                    rows={8}
                  />
                </Field>
              </div>
            </Card>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              position: isNarrow ? "static" : "sticky",
              top: 86,
            }}
          >
            <Card
              C={COLORS}
              title="Sprint ve görünüm"
              subtitle="Sprint süresi, renk, görünürlük ve tarih ayarları."
            >
              <Field C={COLORS} label="Sprint süresi">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {SPRINT_DURATIONS.map((item) => {
                    const active = Number(sprintDurationDays) === item.value;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setSprintDurationDays(item.value)}
                        style={{
                          textAlign: "left",
                          padding: 12,
                          borderRadius: 12,
                          border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                          background: active ? COLORS.primarySoft : COLORS.cardSoft,
                          cursor: "pointer",
                          color: COLORS.text,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800 }}>{item.label}</div>
                        <div style={{ marginTop: 3, fontSize: 12, color: COLORS.textMuted }}>
                          {item.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field C={COLORS} label="Özel süre (1-60 gün)">
                <Input
                  C={COLORS}
                  type="number"
                  min="1"
                  max="60"
                  value={sprintDurationDays}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v)) {
                      setSprintDurationDays(Math.min(60, Math.max(1, v)));
                    }
                  }}
                />
              </Field>

              <Field C={COLORS} label="Proje rengi">
                <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                  {SWATCHES.map((c) => {
                    const active = c === color;

                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        title={c}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 11,
                          background: c,
                          cursor: "pointer",
                          border: active ? `2px solid ${COLORS.text}` : "2px solid transparent",
                          boxShadow: active ? `0 0 0 3px ${COLORS.primarySoft}` : "none",
                        }}
                      />
                    );
                  })}
                </div>
              </Field>

              <Field C={COLORS} label="Görünürlük">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { key: "team", icon: "👥", title: "Ekip", desc: "Ekip üyeleri görebilir." },
                    { key: "private", icon: "🔒", title: "Özel", desc: "Yalnızca sen görebilirsin." },
                  ].map((v) => {
                    const active = visibility === v.key;

                    return (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => setVisibility(v.key)}
                        style={{
                          textAlign: "left",
                          padding: 12,
                          borderRadius: 12,
                          border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                          background: active ? COLORS.primarySoft : COLORS.cardSoft,
                          color: COLORS.text,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontSize: 16 }}>{v.icon}</div>
                        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 800 }}>{v.title}</div>
                        <div style={{ fontSize: 12, color: COLORS.textMuted }}>{v.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field C={COLORS} label="Tahmini bitiş tarihi (opsiyonel)">
                <Input
                  C={COLORS}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            </Card>

            <Card C={COLORS} title="Önizleme" subtitle="Projen liste ekranında böyle görünecek.">
              <ProjectPreview
                C={COLORS}
                color={color}
                initials={initials}
                nameTrim={nameTrim}
                visibility={visibility}
                sprintDurationDays={sprintDurationDays}
                dueDate={dueDate}
                description={description}
              />
            </Card>

            <Card C={COLORS} title="Sonra ne olacak?">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <MiniStep C={COLORS} icon="🏃" text={`İlk sprintini oluştur`} />
                <MiniStep C={COLORS} icon="👥" text="Ekibini davet et" />
                <MiniStep C={COLORS} icon="📌" text="Görevleri planla" />
                <MiniStep C={COLORS} icon="🔔" text="Bildirimleri ayarla" />
              </div>
            </Card>
          </div>
        </div>

        {(error || okMsg) && (
          <div style={{ marginTop: 18 }}>
            {error && (
              <Banner C={COLORS} tone="danger" icon="⚠️">
                {error}
              </Banner>
            )}

            {okMsg && (
              <Banner C={COLORS} tone="success" icon="✅">
                {okMsg}
              </Banner>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            borderRadius: 16,
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            boxShadow: COLORS.shadow,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>
            İpucu: <b style={{ color: COLORS.textSoft }}>Ctrl + Enter</b> ile hızlıca oluştur.
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => navigate("/projects")} style={secondaryButton(COLORS)}>
              Vazgeç
            </button>

            <button type="submit" disabled={!canSubmit} style={primaryButton(COLORS, canSubmit)}>
              {creating ? "Oluşturuluyor…" : "Projeyi Oluştur"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Proje oluşturma sırasında kullanılacak şablonları listeler.
function TemplateGrid({ C, template, applyTemplate, isNarrow }) {
  const blank = TEMPLATES.find((t) => t.key === "blank");
  const others = TEMPLATES.filter((t) => t.key !== "blank");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <TemplateButton C={C} item={blank} active={template === blank.key} onClick={() => applyTemplate(blank.key)} big />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isNarrow ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
          gap: 10,
        }}
      >
        {others.map((t) => (
          <TemplateButton
            key={t.key}
            C={C}
            item={t}
            active={template === t.key}
            onClick={() => applyTemplate(t.key)}
          />
        ))}
      </div>
    </div>
  );
}

// Tek bir proje şablon kartını görüntüler.
function TemplateButton({ C, item, active, onClick, big }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: big ? 16 : 14,
        borderRadius: big ? 14 : 12,
        border: `1px solid ${active ? C.primary : C.border}`,
        background: active ? C.primarySoft : C.cardSoft,
        cursor: "pointer",
        transition: "all .15s ease",
        color: C.text,
        minHeight: big ? 82 : 116,
      }}
    >
      <div style={{ display: "flex", gap: big ? 14 : 8, alignItems: big ? "center" : "flex-start" }}>
        <div style={{ fontSize: big ? 24 : 20 }}>{item.icon}</div>

        <div>
          <div style={{ fontSize: big ? 15 : 14, fontWeight: 800 }}>{item.title}</div>
          <div style={{ marginTop: 5, fontSize: 12, color: C.textMuted, lineHeight: 1.45 }}>
            {item.desc}
          </div>
        </div>
      </div>
    </button>
  );
}

// Oluşturulacak projenin önizlemesini gösterir.
function ProjectPreview({
  C,
  color,
  initials,
  nameTrim,
  visibility,
  sprintDurationDays,
  dueDate,
  description,
}) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: 16,
        background: C.cardSoft,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 15,
            background: `linear-gradient(135deg, ${color}, ${C.purple})`,
            color: "#fff",
            fontWeight: 900,
            fontSize: 17,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            letterSpacing: 0.5,
          }}
        >
          {initials}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: C.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {nameTrim || "Proje adı"}
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <Tag C={C}>{visibility === "private" ? "🔒 Özel" : "👥 Ekip"}</Tag>
            <Tag C={C}>🗓️ Sprint: {sprintDurationLabel(sprintDurationDays)}</Tag>
            {dueDate && <Tag C={C}>📅 {dueDate}</Tag>}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          fontSize: 13,
          color: C.textSoft,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          display: "-webkit-box",
          WebkitLineClamp: 5,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {description.trim() || "Proje açıklaman burada görünecek."}
      </div>
    </div>
  );
}

function Card({ C, title, subtitle, children }) {
  return (
    <section
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        padding: 20,
        boxShadow: C.shadow,
      }}
    >
      {(title || subtitle) && (
        <header style={{ marginBottom: 16 }}>
          {title && <div style={{ fontSize: 15, fontWeight: 900, color: C.text }}>{title}</div>}
          {subtitle && <div style={{ marginTop: 4, fontSize: 12, color: C.textMuted }}>{subtitle}</div>}
        </header>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </section>
  );
}

function Field({ C, label, hint, required, children }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
        <label
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: C.textSoft,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {label}
          {required && <span style={{ color: C.danger, marginLeft: 4 }}>*</span>}
        </label>

        {hint && <span style={{ fontSize: 11, color: C.textMuted }}>{hint}</span>}
      </div>

      {children}
    </div>
  );
}

function Input({ C, ...props }) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: C.inputBg,
        fontSize: 14,
        color: C.text,
        outline: "none",
        transition: "border-color .15s ease, box-shadow .15s ease",
        ...(props.style || {}),
      }}
      onFocus={(e) => {
        e.target.style.borderColor = C.primary;
        e.target.style.boxShadow = `0 0 0 3px ${C.primarySoft}`;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.target.style.borderColor = C.border;
        e.target.style.boxShadow = "none";
        props.onBlur?.(e);
      }}
    />
  );
}

function TextArea({ C, ...props }) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: C.inputBg,
        fontSize: 14,
        color: C.text,
        outline: "none",
        resize: "vertical",
        fontFamily: "inherit",
        lineHeight: 1.5,
        transition: "border-color .15s ease, box-shadow .15s ease",
        ...(props.style || {}),
      }}
      onFocus={(e) => {
        e.target.style.borderColor = C.primary;
        e.target.style.boxShadow = `0 0 0 3px ${C.primarySoft}`;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.target.style.borderColor = C.border;
        e.target.style.boxShadow = "none";
        props.onBlur?.(e);
      }}
    />
  );
}

function Tag({ C, children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        borderRadius: 999,
        background: C.borderSoft,
        color: C.textSoft,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function MiniStep({ C, icon, text }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: C.cardSoft,
        color: C.textSoft,
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      <span style={{ marginRight: 6 }}>{icon}</span>
      {text}
    </div>
  );
}

function Banner({ C, tone, icon, children }) {
  const map = {
    danger: {
      bg: C.dangerSoft,
      bd: C.dangerBorder,
      fg: C.dangerText,
    },
    success: {
      bg: C.successSoft,
      bd: C.successBorder,
      fg: C.successText,
    },
  };

  const t = map[tone] || map.danger;

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        padding: "11px 13px",
        borderRadius: 12,
        background: t.bg,
        border: `1px solid ${t.bd}`,
        color: t.fg,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <span>{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function primaryButton(C, enabled) {
  return {
    padding: "10px 18px",
    borderRadius: 12,
    border: "none",
    cursor: enabled ? "pointer" : "not-allowed",
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    background: enabled ? `linear-gradient(135deg, ${C.primary}, ${C.purple})` : C.buttonDisabled,
    boxShadow: enabled ? "0 6px 18px rgba(79,70,229,0.30)" : "none",
  };
}

function secondaryButton(C) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    background: C.card,
    fontSize: 13,
    fontWeight: 700,
    color: C.textSoft,
    cursor: "pointer",
  };
}