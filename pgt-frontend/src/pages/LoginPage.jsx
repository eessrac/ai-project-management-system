import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, setToken } from "../api";



const COLORS = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  borderSoft: "#EEF2F7",
  text: "#0F172A",
  textSoft: "#475569",
  textMuted: "#94A3B8",
  primary: "#4F46E5",
  primarySoft: "#EEF2FF",
  purple: "#8B5CF6",
  danger: "#EF4444",
  dangerSoft: "#FEF2F2",
  success: "#10B981",
};

// Form alanlarında kullanılan ortak giriş bileşenini oluşturur.
function Input(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        background: "#fff",
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

// Kullanıcının sisteme giriş yapmasını sağlayan giriş sayfası.
export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [switching, setSwitching] = useState(false);

  // Kullanıcıyı kayıt olma sayfasına yönlendirir.
  function goRegister() {
    setSwitching(true);

    setTimeout(() => {
      navigate("/register");
    }, 450);
  }

  // Kullanıcı giriş bilgilerini doğrular ve oturum açma işlemini gerçekleştirir.
  async function login() {
    const emailClean = email.trim().toLowerCase();
    setError("");

    if (!emailClean) { setError("Email zorunlu."); return; }
    if (!password) { setError("Şifre zorunlu."); return; }

    try {
      setLoading(true);
      const data = await loginUser(emailClean, password);

      if (data?.token) {
        setToken(data.token);
      }

      const defaultLandingPage =
        localStorage.getItem("default_landing_page") || "/projects";

      navigate(defaultLandingPage, { replace: true });
    } catch (e) {
      setError(e?.message || "Giriş başarısız.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(1200px 600px at 10% -10%, ${COLORS.primarySoft}, transparent 60%), radial-gradient(900px 500px at 110% 110%, #F5F3FF, transparent 55%), ${COLORS.bg}`,
        color: COLORS.text,
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr",
        alignItems: "stretch",
        opacity: switching ? 0 : 1,
        transform: switching ? "translateX(-40px) scale(0.98)" : "translateX(0) scale(1)",
        transition: "opacity .42s ease, transform .42s ease",
      }}
    >
      {/* Sol panel — marka / tanıtım */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 56px",
          background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.purple} 100%)`,
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute", inset: 0,
            background:
              "radial-gradient(600px 300px at 80% 10%, rgba(255,255,255,.18), transparent 60%), radial-gradient(500px 300px at 10% 90%, rgba(255,255,255,.12), transparent 60%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, fontWeight: 800, backdropFilter: "blur(6px)",
            }}>◆</div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.3 }}>ProjeYönetim</div>
          </div>

          <h1 style={{ fontSize: 38, lineHeight: 1.15, margin: 0, fontWeight: 800 }}>
            Ekibinle birlikte<br/>daha verimli çalış.
          </h1>
          <p style={{ marginTop: 16, fontSize: 15, opacity: 0.9, maxWidth: 420, lineHeight: 1.6 }}>
            Sprintleri planla, taskları yönet, ilerlemeyi takip et. Tek panelde tüm ekibinin akışı.
          </p>
        </div>

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { ic: "🚀", t: "Hızlı sprint planlaması" },
            { ic: "📊", t: "Görsel Gantt & board takibi" },
            { ic: "🔔", t: "Anlık bildirimler" },
          ].map((f) => (
            <div key={f.t} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", borderRadius: 12,
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
              backdropFilter: "blur(6px)",
              fontSize: 14, fontWeight: 600,
            }}>
              <span style={{ fontSize: 18 }}>{f.ic}</span>{f.t}
            </div>
          ))}
          <div style={{ marginTop: 16, fontSize: 12, opacity: 0.75 }}>
            © {new Date().getFullYear()} ProjeYönetim · Tüm hakları saklıdır.
          </div>
        </div>
      </div>

      {/* Sağ panel — form */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          transition: "transform .45s cubic-bezier(.22,1,.36,1), opacity .35s ease",
          transform: switching
            ? "translateX(140px) scale(.96)"
            : "translateX(0)",
          opacity: switching ? 0 : 1,
        }}
      >
        <div style={{
          width: "100%", maxWidth: 440,
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 20,
          padding: 32,
          boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 12, fontWeight: 700, color: COLORS.primary,
              textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8,
            }}>Hoş geldin</div>
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: COLORS.text }}>Hesabına Giriş Yap</h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: COLORS.textMuted }}>
              Devam etmek için bilgilerini gir.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSoft, textTransform: "uppercase", letterSpacing: 0.4 }}>
                E-posta
              </label>
              <div style={{ marginTop: 6 }}>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@mail.com"
                  type="email"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSoft, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  Şifre
                </label>
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  style={{ background: "none", border: "none", color: COLORS.primary, fontSize: 12, cursor: "pointer", fontWeight: 600 }}
                >
                  {showPw ? "Gizle" : "Göster"}
                </button>
              </div>
              <div style={{ marginTop: 6 }}>
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  onKeyDown={(e) => { if (e.key === "Enter" && !loading) login(); }}
                />
              </div>
            </div>

            {error && (
              <div style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "10px 12px", borderRadius: 12,
                background: COLORS.dangerSoft, border: `1px solid #FECACA`,
                color: "#7F1D1D", fontSize: 13, fontWeight: 500,
              }}>
                <span>⚠️</span><span>{error}</span>
              </div>
            )}

            <button
              onClick={login}
              disabled={loading}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "12px 16px",
                borderRadius: 12,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                color: "#fff",
                fontSize: 14, fontWeight: 700, letterSpacing: 0.2,
                background: loading
                  ? "#A5B4FC"
                  : `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.purple})`,
                boxShadow: loading ? "none" : "0 6px 18px rgba(79,70,229,0.35)",
                transition: "transform .1s ease, box-shadow .15s ease",
              }}
              onMouseDown={(e) => { if (!loading) e.currentTarget.style.transform = "translateY(1px)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>

            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              margin: "8px 0 4px", color: COLORS.textMuted, fontSize: 12,
            }}>
              <div style={{ flex: 1, height: 1, background: COLORS.border }} />
              <span>veya</span>
              <div style={{ flex: 1, height: 1, background: COLORS.border }} />
            </div>

            <div style={{
              textAlign: "center", fontSize: 13, color: COLORS.textSoft,
            }}>
              Hesabın yok mu?{" "}
              <button
                type="button"
                onClick={goRegister}
                style={{
                  border: "none",
                  background: "transparent",
                  color: COLORS.primary,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                  fontSize: 13,
                }}
              >
                Kayıt Ol
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}