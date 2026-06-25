// Bu sayfa kullanıcıya genel proje istatistiklerini, hızlı işlemleri,
// bildirimleri ve uygulama kullanım rehberini sunar.

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  apiFetch,
  getToken,
  getDashboardSummary,
  getUnreadNotificationCount,
  sendJoinRequest,
} from "../api";


// Ana sayfa bileşeni.
// Kullanıcının genel istatistiklerini, hızlı işlemleri ve uygulama özetini görüntüler.
export default function HomePage() {
  const navigate = useNavigate();
  const token = getToken();

  const [user, setUser] = useState({ name: "Kullanıcı", email: "" });
  const [stats, setStats] = useState({
    totalProjects: 0,
    leading: 0,
    member: 0,
    myTasks: 0,
  });

  const [unreadCount, setUnreadCount] = useState(0);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) navigate("/login", { replace: true });
  }, [token, navigate]);

  useEffect(() => {
    if (!token) return;
    let mounted = true;

    // Ana sayfada gösterilecek kullanıcı ve istatistik bilgilerini yükler.
    async function loadHomeData() {
      try {
        setLoading(true);
        const meData = await apiFetch("/users/me", { token });
        const summaryData = await getDashboardSummary();
        const unreadData = await getUnreadNotificationCount();
        if (!mounted) return;
        const me = meData?.user || {};
        const summary = summaryData?.summary || {};
        setUser({
          name: me.full_name || me.name || "Kullanıcı",
          email: me.email || "",
        });
        setStats({
          totalProjects: Number(summary.project_count || 0),
          leading: Number(summary.leader_project_count || 0),
          member: Number(summary.member_project_count || 0),
          myTasks: Number(summary.assigned_to_me_count || 0),
        });
        setUnreadCount(Number(unreadData?.unread_count || 0));
      } catch (e) {
        console.error("HomePage load error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadHomeData();
    return () => { mounted = false; };
  }, [token]);

  // Davet kodu kullanarak bir projeye katılım isteği gönderir.
  async function handleJoinProject() {
    const code = joinCode.trim().toUpperCase();
    if (!code) { alert("Join code gir."); return; }
    try {
      setJoining(true);
      const data = await sendJoinRequest(code);
      setJoinCode("");
      alert(data?.message || "Katılım isteği gönderildi.");
    } catch (e) {
      console.error("handleJoinProject:", e);
      alert(e?.message || "Katılım isteği gönderilemedi.");
    } finally {
      setJoining(false);
    }
  }

  const greeting = getGreeting();

  /* Türetilmiş veriler — yeni API çağrısı yok, sadece eldeki sayılardan */
  const totalRoles = stats.leading + stats.member;
  const leaderPct = totalRoles > 0 ? Math.round((stats.leading / totalRoles) * 100) : 0;
  const memberPct = totalRoles > 0 ? 100 - leaderPct : 0;
  const initials = useMemo(() => {
    const p = String(user.name || "").trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "?";
    return (p[0][0] + (p[1]?.[0] || "")).toUpperCase();
  }, [user.name]);

  const today = new Date();
  const dateStr = today.toLocaleDateString("tr-TR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const tip = useMemo(() => TIPS[today.getDate() % TIPS.length], []);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white transition-colors dark:from-[#0B1020] dark:to-[#111827]">
      <main className="mx-auto max-w-7xl px-6 py-10">
        {/* ───────── HERO ───────── */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-8 text-white shadow-xl shadow-indigo-200/40 sm:p-10 dark:shadow-indigo-950/30">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-white/30 bg-white/15 text-xl font-bold backdrop-blur">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="mb-1 text-sm font-medium text-white/80">
                  {greeting}, hoş geldin 👋
                </p>
                <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                  Merhaba {user.name},<br className="sm:hidden" /> bugün harika işler çıkaralım.
                </h1>
                <p className="mt-2 max-w-xl text-sm text-white/85">
                  📅 {dateStr} · Tüm projelerini tek yerden yönet, ekibinle birlikte ilerle.
                </p>
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-col items-stretch gap-3 sm:items-end">
              <div className="flex flex-wrap gap-2">
                <Link to="/projects" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                  Projelerime Git →
                </Link>
                <Link to="/projects/new" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
                  ＋ Yeni Proje
                </Link>
              </div>
              {unreadCount > 0 && (
                <Link
                  to="/notifications"
                  className="inline-flex items-center gap-2 self-end rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/25"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
                  </span>
                  {unreadCount} okunmamış bildirim
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* ───────── BÖLÜM: GENEL BAKIŞ ───────── */}
        <SectionHeader emoji="📊" title="Genel Bakış" subtitle="Sayılarınla durumun" />
        <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon="📁" tone="indigo"  label="Toplam Projem"          value={stats.totalProjects} hint="Aktif çalıştığın projeler" loading={loading} />
          <StatCard icon="👑" tone="amber"   label="Lider Olduklarım"        value={stats.leading}       hint="Yönettiğin projeler"        loading={loading} />
          <StatCard icon="👥" tone="sky"     label="Üye Olduklarım"          value={stats.member}        hint="Katıldığın ekipler"         loading={loading} />
          <StatCard icon="✅" tone="emerald" label="Bana Atanan Görevler"    value={stats.myTasks}       hint="Bekleyen görev sayısı"      loading={loading} />
        </section>

        {/* Rol dağılımı + Bugün özeti */}
        <section className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827] md:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">🎯 Rol Dağılımı</h3>
              <span className="text-xs text-slate-400">Toplam {totalRoles} proje</span>
            </div>

            {totalRoles === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400 dark:border-slate-700">
                Henüz bir projede yer almıyorsun. Yeni bir proje oluştur veya kodla katıl.
              </div>
            ) : (
              <>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full bg-amber-400 transition-all" style={{ width: `${leaderPct}%` }} title={`Lider: %${leaderPct}`} />
                  <div className="h-full bg-sky-400 transition-all"   style={{ width: `${memberPct}%` }} title={`Üye: %${memberPct}`} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                  <Legend dotClass="bg-amber-400" label="Lider" value={`${stats.leading} (%${leaderPct})`} />
                  <Legend dotClass="bg-sky-400"   label="Üye"   value={`${stats.member} (%${memberPct})`} />
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">💡 Günün İpucu</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{tip}</p>
          </div>
        </section>

        {/* ───────── BÖLÜM: HIZLI İŞLEMLER ───────── */}
        <SectionHeader emoji="⚡" title="Hızlı İşlemler" subtitle="Projeye katıl, bildirimleri aç, kısayollar" />
        <section className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-[#111827]">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-800">🔑</div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Kodla Projeye Katıl</h3>
            </div>
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              Sana verilen davet kodunu gir, lidere katılım isteği gönder.
            </p>
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleJoinProject(); }}
                placeholder="Davet kodunu yapıştır"
                className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm uppercase tracking-wide text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
              />
              <button
                onClick={handleJoinProject}
                disabled={joining}
                className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-700"
              >
                {joining ? "Gönderiliyor..." : "Katıl"}
              </button>
            </div>
          </div>

          <ActionCard
            icon="📨"
            title="Bildirimler"
            desc={unreadCount > 0 ? `${unreadCount} okunmamış bildirimin var.` : "Tüm bildirimlerin okundu."}
            cta="İncele"
            to="/notifications"
            badge={unreadCount > 0 ? unreadCount : null}
          />

          <ActionCard
            icon="📊"
            title="Projelerim"
            desc="Tüm projelerini, sprintlerini ve görevlerini görüntüle."
            cta="Projeleri Aç"
            to="/projects"
          />
        </section>

        {/* Kısayol şeridi */}
        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ShortcutTile to="/projects/new" icon="➕"  label="Yeni Proje"        desc="Sıfırdan oluştur" />
          <ShortcutTile to="/projects"      icon="🗂️" label="Projelerim"         desc="Hepsini gör" />
          <ShortcutTile to="/projects/archived" icon="📦" label="Arşiv"          desc="Tamamlanan projeler" />
          <ShortcutTile to="/profile"       icon="👤"  label="Profilim"          desc="Hesap & ayarlar" />
        </section>

        {/* ───────── BÖLÜM: REHBER ───────── */}
        <SectionHeader emoji="🎥" title="Hızlı Başlangıç" subtitle="Kısa video ile özellikleri keşfet" />
        <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                🎥 Tanıtım Videosu
              </span>
              <h2 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
                Proje Takip nasıl kullanılır?
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                Proje oluşturma, görev yönetimi, sprint takibi ve AI destekli özellikleri kısa video ile keşfet.
              </p>
            </div>
            <Link
              to="/projects"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-md shadow-indigo-100 transition hover:bg-indigo-700 dark:shadow-indigo-950/30"
            >
              Projelere Git →
            </Link>
          </div>

          <details className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
            <summary className="cursor-pointer text-lg font-bold text-slate-900 dark:text-white">
              📖 Kullanım Rehberini Göster
            </summary>

            <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  📁 Projelerim
                </h4>
                <p>
                  Tüm projelerinizi görüntüleyebilir, yeni proje oluşturabilir,
                  proje detaylarına erişebilir ve ekip üyelerini yönetebilirsiniz.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  🚀 Sprint Yönetimi
                </h4>
                <p>
                  Proje içerisindeki sprintleri oluşturabilir, başlatabilir,
                  tamamlayabilir ve geçmiş sprint analizlerini inceleyebilirsiniz.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  📋 Kanban Panosu
                </h4>
                <p>
                  Görevler "Yapılacak", "Devam Ediyor" ve "Tamamlandı" sütunları altında yönetilir.
                  Görevler ekip üyelerine atanabilir, öncelikleri belirlenebilir,
                  alt görevler ve başarı kriterleri takip edilebilir.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  🤖 AI Görev Önerileri
                </h4>
                <p>
                  Yapay zeka proje açıklamasını analiz ederek görev önerileri üretir.
                  Üretilen görevler alt görevler, başarı kriterleri, önerilen sorumlu
                  kişiler ve görev bağımlılıkları ile birlikte gelir.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  📊 İş Yükü Analizi
                </h4>
                <p>
                  Takım üyelerinin görev yoğunlukları analiz edilir. Böylece görevler
                  ekip içerisinde daha dengeli şekilde dağıtılabilir.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  🔗 Görev Bağımlılık Haritası
                </h4>
                <p>
                  Görevler arasındaki ilişkileri görsel olarak inceleyebilir ve hangi
                  görevlerin birbirine bağlı olduğunu takip edebilirsiniz.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  💬 Proje Sohbeti
                </h4>
                <p>
                  Proje üyeleri kendi proje alanlarında mesajlaşabilir, ekip içi
                  iletişimi ve koordinasyonu sağlayabilir.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  🔔 Bildirimler
                </h4>
                <p>
                  Görev atamaları, yorumlar ve proje aktiviteleri anlık bildirim
                  olarak görüntülenebilir.
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white">
                  👤 Profil ve Ayarlar
                </h4>
                <p>
                  Profil bilgilerinizi güncelleyebilir, tema tercihlerinizi
                  değiştirebilir ve uygulama ayarlarınızı kişiselleştirebilirsiniz.
                </p>
              </div>

              <div className="rounded-xl bg-indigo-50 p-4 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                <strong>💡 Önerilen Kullanım Sırası:</strong>
                <br />
                Yeni Proje Oluştur → Üye Ekle → Sprint Oluştur →
                AI Görev Önerileri Üret → Kanban'a Aktar →
                Görevleri Tamamla → Sprinti Bitir → AI Analizlerini İncele
              </div>
            </div>
          </details>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-xl dark:border-slate-800">
            <video
              controls
              muted
              preload="metadata"
              poster="/tutorial-poster.png"
              className="aspect-video w-full bg-black object-cover"
            >
              <source src="/Tutorial1.mp4" type="video/mp4" />
            </video>
          </div>
        </section>

        <footer className="mt-12 pb-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Proje Takip · Bitirme Projesi
        </footer>
      </main>
    </div>
  );
}

/* ============================================================
 * UI Helpers
 * ============================================================ */
const TONES = {
  indigo:  { bg: "bg-indigo-50 dark:bg-indigo-500/15",   text: "text-indigo-600 dark:text-indigo-300",   ring: "ring-indigo-100 dark:ring-indigo-500/20" },
  amber:   { bg: "bg-amber-50 dark:bg-amber-500/15",     text: "text-amber-600 dark:text-amber-300",     ring: "ring-amber-100 dark:ring-amber-500/20" },
  sky:     { bg: "bg-sky-50 dark:bg-sky-500/15",         text: "text-sky-600 dark:text-sky-300",         ring: "ring-sky-100 dark:ring-sky-500/20" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-300", ring: "ring-emerald-100 dark:ring-emerald-500/20" },
};

// Sayfa başlıklarını görüntülemek için kullanılan yardımcı bileşen.
function SectionHeader({ emoji, title, subtitle }) {
  return (
    <div className="mt-10 flex items-center gap-3">
      <div className="text-xl">{emoji}</div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-900 dark:text-white">{title}</div>
        <div className="text-xs text-slate-400">{subtitle}</div>
      </div>
      <div className="ml-2 h-px flex-1 bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

// Genel istatistik kartlarını görüntülemek için kullanılır.
function StatCard({ icon, tone = "indigo", label, value, hint, loading }) {
  const t = TONES[tone];
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-[#111827]">
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${t.bg} ${t.text} ring-4 ${t.ring} text-xl`}>{icon}</div>
        <span className="text-xs text-slate-400">↗</span>
      </div>
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
      ) : (
        <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{value ?? 0}</p>
      )}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

// Hızlı işlem kartlarını görüntülemek için kullanılan bileşen.
function ActionCard({ icon, title, desc, cta, to, badge }) {
  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-[#111827]">
      {badge != null && (
        <span className="absolute right-4 top-4 inline-flex min-w-[22px] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold text-white">
          {badge}
        </span>
      )}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-800">{icon}</div>
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{desc}</p>
      <Link
        to={to ?? "#"}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-indigo-500/30 dark:bg-indigo-500/20 dark:text-white dark:hover:bg-indigo-500/30"
      >
        {cta} →
      </Link>
    </div>
  );
}

// Uygulama içerisindeki hızlı erişim bağlantılarını oluşturur.
function ShortcutTile({ to, icon, label, desc }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-[#111827] dark:hover:border-indigo-500/50"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-50 text-xl transition group-hover:bg-indigo-50 dark:bg-slate-800 dark:group-hover:bg-indigo-500/15">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">{label}</div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
      <div className="ml-auto text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500">→</div>
    </Link>
  );
}

// Rol dağılımı grafiğinde kullanılan açıklama bileşeni.
function Legend({ dotClass, label, value }) {
  return (
    <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <span className="font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// Günün saatine göre kullanıcıya uygun karşılama mesajını oluşturur.
function getGreeting() {
  const h = new Date().getHours();
  if (h < 6)  return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "İyi günler";
  return "İyi akşamlar";
}

const TIPS = [
  "Görevleri küçük parçalara böl; ilerleme görmek motivasyonu artırır.",
  "Her sprintin başında hedeflerini netleştir, sonunda kısa bir retrospektif yap.",
  "Bana atananlar listesini her sabah kontrol et; öncelikleri en üste taşı.",
  "Davet kodunu paylaşırken proje rolünü de söyle: lider mi, üye mi?",
  "AI önerilerini ham haliyle kabul etme — düzenleyip kendi diline çevir.",
  "Bağımlılıkları doğru tanımla; bir görev biterken diğerini otomatik açabilirsin.",
  "Yorum yazarken @ ile etiketle; ekip arkadaşlarına bildirim gider.",
  "Yoğun günlerde 'Sadece benim tasklarım' filtresini açık tut.",
];