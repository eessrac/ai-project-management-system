import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, getToken } from "../api";

const COLORS = {
  bg: "var(--settings-bg)",
  card: "var(--settings-card)",
  cardSoft: "var(--settings-card-soft)",
  border: "var(--settings-border)",
  borderSoft: "var(--settings-border-soft)",
  text: "var(--settings-text)",
  textSoft: "var(--settings-text-soft)",
  textMuted: "var(--settings-text-muted)",
  primary: "var(--settings-primary)",
  primarySoft: "var(--settings-primary-soft)",
  success: "var(--settings-success)",
  successSoft: "var(--settings-success-soft)",
  warn: "var(--settings-warn)",
  warnSoft: "var(--settings-warn-soft)",
  danger: "var(--settings-danger)",
  dangerSoft: "var(--settings-danger-soft)",
  info: "var(--settings-info)",
  infoSoft: "var(--settings-info-soft)",
  purple: "var(--settings-purple)",
  purpleSoft: "var(--settings-purple-soft)",
  header: "var(--settings-header)",
  shadow: "var(--settings-shadow)",
};

const SETTINGS_THEME_STYLE = `
  .settings-theme-page {
    --settings-bg: #F8FAFC;
    --settings-card: #FFFFFF;
    --settings-card-soft: #FAFBFD;
    --settings-border: #E2E8F0;
    --settings-border-soft: #EEF2F7;
    --settings-text: #0F172A;
    --settings-text-soft: #475569;
    --settings-text-muted: #94A3B8;
    --settings-primary: #4F46E5;
    --settings-primary-soft: #EEF2FF;
    --settings-success: #10B981;
    --settings-success-soft: #ECFDF5;
    --settings-warn: #F59E0B;
    --settings-warn-soft: #FFFBEB;
    --settings-danger: #EF4444;
    --settings-danger-soft: #FEF2F2;
    --settings-info: #0EA5E9;
    --settings-info-soft: #E0F2FE;
    --settings-purple: #8B5CF6;
    --settings-purple-soft: #F5F3FF;
    --settings-header: rgba(255,255,255,0.85);
    --settings-shadow: 0 1px 2px rgba(15,23,42,0.04);
  }

  .dark .settings-theme-page {
    --settings-bg: #0B1020;
    --settings-card: #111827;
    --settings-card-soft: #0F172A;
    --settings-border: #263244;
    --settings-border-soft: #1F2937;
    --settings-text: #F8FAFC;
    --settings-text-soft: #CBD5E1;
    --settings-text-muted: #94A3B8;
    --settings-primary: #8B5CF6;
    --settings-primary-soft: rgba(139,92,246,0.16);
    --settings-success: #10B981;
    --settings-success-soft: rgba(16,185,129,0.14);
    --settings-warn: #F59E0B;
    --settings-warn-soft: rgba(245,158,11,0.14);
    --settings-danger: #EF4444;
    --settings-danger-soft: rgba(239,68,68,0.14);
    --settings-info: #38BDF8;
    --settings-info-soft: rgba(14,165,233,0.14);
    --settings-purple: #A78BFA;
    --settings-purple-soft: rgba(124,58,237,0.18);
    --settings-header: rgba(11,16,32,0.88);
    --settings-shadow: 0 18px 40px rgba(0,0,0,0.28);
  }

  .settings-theme-page input,
  .settings-theme-page select {
    color-scheme: light;
  }

  .dark .settings-theme-page input,
  .dark .settings-theme-page select {
    color-scheme: dark;
  }

  .settings-theme-page input::placeholder {
    color: var(--settings-text-muted);
  }
`;

function Card({ children, padding = 20, style }) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 16,
        padding,
        boxShadow: COLORS.shadow,
        color: COLORS.text,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Btn({
  children,
  onClick,
  type = "button",
  variant = "ghost",
  disabled,
  style,
}) {
  const styles = {
    primary: {
      background: disabled ? COLORS.borderSoft : COLORS.primary,
      color: disabled ? COLORS.textMuted : "#fff",
      border: `1px solid ${disabled ? COLORS.border : COLORS.primary}`,
    },
    ghost: {
      background: COLORS.card,
      color: COLORS.text,
      border: `1px solid ${COLORS.border}`,
    },
    danger: {
      background: COLORS.dangerSoft,
      color: COLORS.danger,
      border: `1px solid ${COLORS.danger}`,
    },
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles,
        padding: "10px 16px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all .15s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children, right }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <label
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: COLORS.textSoft,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {label}
        </label>
        {right}
      </div>

      {children}

      {hint && (
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 6 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.cardSoft,
        fontSize: 14,
        color: COLORS.text,
        outline: "none",
        transition: "border-color .15s ease, box-shadow .15s ease",
        ...(props.style || {}),
      }}
      onFocus={(e) => {
        e.target.style.borderColor = COLORS.primary;
        e.target.style.boxShadow = `0 0 0 3px ${COLORS.primarySoft}`;
      }}
      onBlur={(e) => {
        e.target.style.borderColor = COLORS.border;
        e.target.style.boxShadow = "none";
      }}
    />
  );
}

function SelectInput({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        minWidth: 180,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.card,
        color: COLORS.text,
        borderRadius: 10,
        padding: "9px 12px",
        fontSize: 12,
        fontWeight: 800,
        outline: "none",
        cursor: "pointer",
      }}
    >
      {children}
    </select>
  );
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <label
      style={{
        width: 52,
        height: 28,
        borderRadius: 999,
        background: checked ? COLORS.primary : COLORS.borderSoft,
        border: `1px solid ${checked ? COLORS.primary : COLORS.border}`,
        cursor: "pointer",
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        padding: 3,
        boxSizing: "border-box",
        transition: "all .2s ease",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          opacity: 0,
          position: "absolute",
          inset: 0,
          cursor: "pointer",
        }}
      />

      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transform: checked ? "translateX(22px)" : "translateX(0)",
          transition: "transform .2s ease",
          boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
        }}
      />
    </label>
  );
}

function PreferenceRow({ icon, title, description, children }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${COLORS.borderSoft}`,
        background: COLORS.cardSoft,
        gap: 12,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: COLORS.primarySoft,
            color: COLORS.primary,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: COLORS.text }}>
            {title}
          </div>

          <div
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {description}
          </div>
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: "—", color: COLORS.textMuted };

  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;

  const map = [
    { label: "Çok zayıf", color: COLORS.danger },
    { label: "Zayıf", color: COLORS.danger },
    { label: "Orta", color: COLORS.warn },
    { label: "İyi", color: COLORS.info },
    { label: "Güçlü", color: COLORS.success },
    { label: "Çok güçlü", color: COLORS.success },
  ];

  return { score: s, ...map[s] };
}

function initialsOf(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function userSettingKey(userId, key) {
  return `settings_${userId}_${key}`;
}

function getUserSetting(userId, key, fallback) {
  if (!userId) return fallback;
  return localStorage.getItem(userSettingKey(userId, key)) || fallback;
}

function setUserSetting(userId, key, value) {
  if (!userId) return;

  localStorage.setItem(userSettingKey(userId, key), String(value));

  // Aktif kullanıcı için uygulamanın diğer sayfalarının okuduğu genel key
  localStorage.setItem(key, String(value));

  window.dispatchEvent(
    new CustomEvent("settings-updated", {
      detail: {
        key,
        value,
        userId,
      },
    })
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const token = getToken();

  useEffect(() => {
    if (!token) navigate("/login", { replace: true });
  }, [token, navigate]);

  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [activeSection, setActiveSection] = useState("profile");

  const [defaultLandingPage, setDefaultLandingPage] = useState("/projects");
  const [showNotificationBadge, setShowNotificationBadge] = useState(true);
  const [defaultTaskView, setDefaultTaskView] = useState("KANBAN");
  const [activityLimit, setActivityLimit] = useState("5");

  function loadUserPreferences(currentUser) {
    const userId = currentUser?.id;
    if (!userId) return;

    const landing = getUserSetting(userId, "default_landing_page", "/projects");
    const badge = getUserSetting(userId, "show_notification_badge", "true") !== "false";
    const taskView = getUserSetting(userId, "default_task_view", "KANBAN");
    const limit = getUserSetting(userId, "activity_limit", "5");

    setDefaultLandingPage(landing);
    setShowNotificationBadge(badge);
    setDefaultTaskView(taskView);
    setActivityLimit(limit);

    localStorage.setItem("default_landing_page", landing);
    localStorage.setItem("show_notification_badge", String(badge));
    localStorage.setItem("default_task_view", taskView);
    localStorage.setItem("activity_limit", limit);
  }

  function handleDefaultLandingPage(value) {
    setDefaultLandingPage(value);
    setUserSetting(user?.id, "default_landing_page", value);
  }

  function handleNotificationBadge(value) {
    setShowNotificationBadge(value);
    setUserSetting(user?.id, "show_notification_badge", value);
  }

  function handleDefaultTaskView(value) {
    setDefaultTaskView(value);
    setUserSetting(user?.id, "default_task_view", value);
  }

  function handleActivityLimit(value) {
    setActivityLimit(value);
    setUserSetting(user?.id, "activity_limit", value);
  }

  async function loadMe() {
    try {
      if (!token) return;

      setLoading(true);

      const data = await apiFetch("/users/me", { token });
      const currentUser = data.user || null;

      setUser(currentUser);
      setFullName(currentUser?.full_name || "");
      setEmail(currentUser?.email || "");
      loadUserPreferences(currentUser);
    } catch (e) {
      console.error("loadMe:", e);
      alert("Kullanıcı bilgileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveProfile(e) {
    e.preventDefault();

    const normalizedFullName = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedFullName) {
      alert("Ad Soyad boş olamaz.");
      return;
    }

    if (!normalizedEmail) {
      alert("Email boş olamaz.");
      return;
    }

    try {
      setSavingProfile(true);

      await apiFetch("/users/me", {
        method: "PATCH",
        token,
        body: { full_name: normalizedFullName },
      });

      await apiFetch("/users/me/email", {
        method: "PATCH",
        token,
        body: { email: normalizedEmail },
      });

      alert("Profil bilgileri güncellendi.");
      await loadMe();
    } catch (e) {
      console.error("handleSaveProfile:", e);
      alert(e?.message || "Profil güncellenemedi.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();

    if (!currentPassword || !newPassword) {
      alert("Şifre alanlarını doldur.");
      return;
    }

    if (newPassword.length < 6) {
      alert("Yeni şifre en az 6 karakter olmalı.");
      return;
    }

    try {
      setSavingPassword(true);

      await apiFetch("/users/change-password", {
        method: "PATCH",
        token,
        body: { currentPassword, newPassword },
      });

      alert("Şifre başarıyla değiştirildi.");
      setCurrentPassword("");
      setNewPassword("");
    } catch (e) {
      console.error("handleChangePassword:", e);
      alert(e?.message || "Şifre değiştirilemedi.");
    } finally {
      setSavingPassword(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  const profileDirty = useMemo(() => {
    return (
      fullName.trim() !== (user?.full_name || "") ||
      email.trim().toLowerCase() !== (user?.email || "").toLowerCase()
    );
  }, [fullName, email, user]);

  const pwStrength = passwordStrength(newPassword);

  const sections = [
    { id: "profile", label: "Profil", icon: "👤" },
    { id: "security", label: "Güvenlik", icon: "🔐" },
    { id: "preferences", label: "Tercihler", icon: "⚙️" },
    { id: "danger", label: "Tehlikeli Bölge", icon: "⚠️" },
  ];

  if (loading) {
    return (
      <div
        className="settings-theme-page"
        style={{ minHeight: "100vh", background: COLORS.bg, padding: 24 }}
      >
        <style>{SETTINGS_THEME_STYLE}</style>
        <Card>
          <p style={{ color: COLORS.textSoft, margin: 0 }}>Yükleniyor...</p>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="settings-theme-page"
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        transition: "background .25s ease, color .25s ease",
      }}
    >
      <style>{SETTINGS_THEME_STYLE}</style>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: COLORS.header,
          backdropFilter: "saturate(180%) blur(10px)",
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button
              onClick={() => navigate("/projects")}
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
              title="Geri"
            >
              ←
            </button>

            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 800 }}>
                Hesap
              </div>

              <div style={{ fontSize: 18, fontWeight: 900, color: COLORS.text }}>
                Ayarlar
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Btn variant="ghost" onClick={() => navigate("/profile")}>
              Profilim
            </Btn>

            <Btn variant="ghost" onClick={() => navigate("/projects")}>
              Projelere Dön
            </Btn>

            <Btn variant="danger" onClick={handleLogout}>
              Çıkış Yap
            </Btn>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: 24,
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card padding={16}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.purple})`,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 16,
                }}
              >
                {initialsOf(user?.full_name)}
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: COLORS.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user?.full_name || "Kullanıcı"}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: COLORS.textMuted,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user?.email || "-"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {sections.map((s) => {
                const active = activeSection === s.id;

                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: active
                        ? `1px solid ${COLORS.primary}`
                        : "1px solid transparent",
                      background: active ? COLORS.primarySoft : "transparent",
                      color: active ? COLORS.primary : COLORS.text,
                      fontWeight: active ? 900 : 700,
                      fontSize: 13,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{s.icon}</span>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Card>

          <Card padding={16}>
            <div
              style={{
                fontSize: 11,
                color: COLORS.textMuted,
                fontWeight: 900,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              İpucu
            </div>

            <div style={{ fontSize: 12, color: COLORS.textSoft, lineHeight: 1.5 }}>
              Hesabını güvende tutmak için düzenli olarak şifreni güncelle ve güçlü
              bir parola kullan.
            </div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {activeSection === "profile" && (
            <Card>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 16,
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
                    Hesap Bilgileri
                  </h3>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
                    Diğer üyelerin gördüğü temel bilgileri buradan yönet.
                  </div>
                </div>

                {profileDirty && (
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: COLORS.warnSoft,
                      color: COLORS.warn,
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    KAYDEDİLMEMİŞ
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveProfile}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                    gap: 16,
                  }}
                >
                  <Field label="Ad Soyad">
                    <Input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ad Soyad"
                    />
                  </Field>

                  <Field label="E-posta" hint="">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ornek@mail.com"
                    />
                  </Field>
                </div>

                <Field label="Kullanıcı ID">
                  <div
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 12,
                      color: COLORS.textSoft,
                      background: COLORS.borderSoft,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    {user?.id || "-"}
                  </div>
                </Field>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    justifyContent: "flex-end",
                    marginTop: 8,
                  }}
                >
                  <Btn
                    variant="ghost"
                    onClick={() => {
                      setFullName(user?.full_name || "");
                      setEmail(user?.email || "");
                    }}
                    disabled={!profileDirty || savingProfile}
                  >
                    Sıfırla
                  </Btn>

                  <Btn type="submit" variant="primary" disabled={savingProfile || !profileDirty}>
                    {savingProfile ? "Kaydediliyor..." : "Bilgileri Kaydet"}
                  </Btn>
                </div>
              </form>
            </Card>
          )}

          {activeSection === "security" && (
            <>
              <Card>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
                  Şifre Değiştir
                </h3>

                <div
                  style={{
                    fontSize: 12,
                    color: COLORS.textMuted,
                    marginTop: 4,
                    marginBottom: 16,
                  }}
                >
                  Hesabını güvende tutmak için güçlü bir şifre kullan.
                </div>

                <form onSubmit={handleChangePassword}>
                  <Field
                    label="Mevcut Şifre"
                    right={
                      <button
                        type="button"
                        onClick={() => setShowCurrent((v) => !v)}
                        style={{
                          background: "none",
                          border: "none",
                          color: COLORS.primary,
                          fontSize: 12,
                          cursor: "pointer",
                          fontWeight: 800,
                        }}
                      >
                        {showCurrent ? "Gizle" : "Göster"}
                      </button>
                    }
                  >
                    <Input
                      type={showCurrent ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </Field>

                  <Field
                    label="Yeni Şifre"
                    right={
                      <button
                        type="button"
                        onClick={() => setShowNew((v) => !v)}
                        style={{
                          background: "none",
                          border: "none",
                          color: COLORS.primary,
                          fontSize: 12,
                          cursor: "pointer",
                          fontWeight: 800,
                        }}
                      >
                        {showNew ? "Gizle" : "Göster"}
                      </button>
                    }
                  >
                    <Input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="En az 6 karakter"
                    />

                    {newPassword && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                          {[0, 1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              style={{
                                flex: 1,
                                height: 4,
                                borderRadius: 2,
                                background:
                                  i < pwStrength.score
                                    ? pwStrength.color
                                    : COLORS.borderSoft,
                                transition: "background .2s ease",
                              }}
                            />
                          ))}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            color: pwStrength.color,
                            fontWeight: 800,
                          }}
                        >
                          Güç: {pwStrength.label}
                        </div>
                      </div>
                    )}
                  </Field>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      justifyContent: "flex-end",
                      marginTop: 8,
                    }}
                  >
                    <Btn type="submit" variant="primary" disabled={savingPassword}>
                      {savingPassword ? "Güncelleniyor..." : "Şifreyi Güncelle"}
                    </Btn>
                  </div>
                </form>
              </Card>

              <Card>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
                  Güvenlik İpuçları
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                  {[
                    { ic: "🔑", t: "Benzersiz şifre kullan", d: "Aynı şifreyi farklı sitelerde kullanma." },
                    { ic: "🛡️", t: "En az 10 karakter", d: "Büyük/küçük harf, sayı ve sembol birlikte kullan." },
                    { ic: "📵", t: "Cihazını koru", d: "Paylaşılan cihazlarda oturumu kapatmayı unutma." },
                  ].map((tip) => (
                    <div
                      key={tip.t}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        padding: 12,
                        borderRadius: 12,
                        background: COLORS.borderSoft,
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background: COLORS.card,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                        }}
                      >
                        {tip.ic}
                      </div>

                      <div>
                        <div style={{ fontSize: 13, fontWeight: 900, color: COLORS.text }}>
                          {tip.t}
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.textSoft, marginTop: 2 }}>
                          {tip.d}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {activeSection === "preferences" && (
            <Card>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
                Tercihler
              </h3>

              <div
                style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                  marginTop: 4,
                  marginBottom: 16,
                }}
              >
                Bu tercihler yalnızca bu hesaba özel olarak kaydedilir.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <PreferenceRow
                  icon="🏠"
                  title="Varsayılan Açılış Sayfası"
                  description="Girişten sonra öncelikli görmek istediğin sayfayı seç."
                >
                  <SelectInput
                    value={defaultLandingPage}
                    onChange={handleDefaultLandingPage}
                  >
                    <option value="/">Ana Sayfa</option>
                    <option value="/projects">Projelerim</option>
                    <option value="/notifications">Bildirimler</option>
                    <option value="/profile">Profil</option>
                  </SelectInput>
                </PreferenceRow>

                <PreferenceRow
                  icon="🔔"
                  title="Bildirim Rozeti"
                  description={
                    showNotificationBadge
                      ? "Sidebar üzerinde okunmamış bildirim sayısı gösterilir."
                      : "Sidebar üzerindeki bildirim sayısı gizlenir."
                  }
                >
                  <ToggleSwitch
                    checked={showNotificationBadge}
                    onChange={handleNotificationBadge}
                  />
                </PreferenceRow>

                <PreferenceRow
                  icon="🗂️"
                  title="Task Varsayılan Görünümü"
                  description={
                    defaultTaskView === "KANBAN"
                      ? "Task sayfası varsayılan olarak Kanban görünümüyle açılır."
                      : "Task sayfası varsayılan olarak Timeline görünümüyle açılır."
                  }
                >
                  <SelectInput
                    value={defaultTaskView}
                    onChange={handleDefaultTaskView}
                  >
                    <option value="KANBAN">Kanban</option>
                    <option value="TIMELINE">Timeline</option>
                  </SelectInput>
                </PreferenceRow>

                <PreferenceRow
                  icon="🕘"
                  title="Son Aktivite Sayısı"
                  description={`Proje özetlerinde son ${activityLimit} aktivite gösterilecek şekilde tercih kaydedildi.`}
                >
                  <SelectInput
                    value={activityLimit}
                    onChange={handleActivityLimit}
                  >
                    <option value="3">3 aktivite</option>
                    <option value="5">5 aktivite</option>
                    <option value="10">10 aktivite</option>
                  </SelectInput>
                </PreferenceRow>
              </div>
            </Card>
          )}

          {activeSection === "danger" && (
            <Card style={{ borderColor: COLORS.danger }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 900,
                  color: COLORS.danger,
                }}
              >
                Tehlikeli Bölge
              </h3>

              <div
                style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                  marginTop: 4,
                  marginBottom: 16,
                }}
              >
                Bu bölümdeki işlemler geri alınamaz. Dikkatli ol.
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  borderRadius: 12,
                  background: COLORS.dangerSoft,
                  border: `1px solid ${COLORS.danger}`,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      color: COLORS.danger,
                    }}
                  >
                    Oturumu Kapat
                  </div>

                  <div style={{ fontSize: 12, color: COLORS.textSoft, marginTop: 2 }}>
                    Bu cihazdaki oturumun sonlandırılır.
                  </div>
                </div>

                <Btn variant="danger" onClick={handleLogout}>
                  Çıkış Yap
                </Btn>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}