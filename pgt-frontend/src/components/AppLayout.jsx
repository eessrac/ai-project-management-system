import { Outlet, Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import Sidebar from "./Sidebar";
import { useTheme } from "../context/ThemeContext.jsx";
import {
  apiFetch,
  getToken,
  getNotifications,
  getUnreadNotificationCount,
} from "../api";

// Uygulamanın genel yerleşim yapısını oluşturan ana bileşen.
// Sidebar, üst menü ve sayfa içerikleri bu yapı içerisinde gösterilir.

export default function AppLayout() {
  const navigate = useNavigate();
  const token = getToken();
  const { isDark, toggleTheme } = useTheme();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState({ name: "Kullanıcı" });
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!token) return;

    // Kullanıcı bilgilerini, bildirimleri ve okunmamış bildirim sayısını yükler.
    async function loadHeaderData() {
      try {
        const meData = await apiFetch("/users/me", { token });
        const unreadData = await getUnreadNotificationCount();
        const notificationData = await getNotifications(6);

        const me = meData?.user || {};

        setUser({
          name: me.full_name || me.name || "Kullanıcı",
        });

        setUnreadCount(Number(unreadData?.unread_count || 0));
        setNotifications(notificationData?.notifications || []);
      } catch (e) {
        console.error("Header data error:", e);
      }
    }

    loadHeaderData();
  }, [token]);

  // Bildirim ve profil menüsünün dışına tıklandığında menülerin kapanmasını sağlar.
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }

      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function logout() {
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  // Üst menüdeki arama alanı üzerinden ilgili sayfalara hızlı geçiş yapılmasını sağlar.
  function handleGlobalSearch(e) {
    const value = e.target.value;
    setSearchQuery(value);

    const q = value.trim().toLowerCase();
    if (!q) return;

    if (q.includes("bildirim")) {
      navigate("/notifications");
    } else if (q.includes("ayar")) {
      navigate("/settings");
    } else if (q.includes("profil")) {
      navigate("/profile");
    } else if (q.includes("arşiv") || q.includes("arsiv")) {
      navigate("/projects/archived");
    } else if (q.includes("proje")) {
      navigate("/projects");
    } else if (q.includes("ana")) {
      navigate("/");
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 transition-colors dark:bg-[#0B1020] dark:text-white">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
      />

      <main
        className={`min-h-screen transition-all duration-300 ${
          sidebarOpen ? "ml-72" : "ml-[86px]"
        }`}
        style={{
          width: sidebarOpen ? "calc(100vw - 18rem)" : "calc(100vw - 86px)",
          maxWidth: sidebarOpen ? "calc(100vw - 18rem)" : "calc(100vw - 86px)",
          overflowX: "auto",
        }}
      >
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-[#0B1020]/80">
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
            <div className="hidden flex-1 md:block">
              <div className="relative max-w-md">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  🔍
                </span>

                <input
                  value={searchQuery}
                  onChange={handleGlobalSearch}
                  placeholder="Proje, görev veya kişi ara..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-yellow-300 dark:hover:bg-slate-700"
              >
                {isDark ? "☀️" : "🌙"}
              </button>

              <Link
                to="/projects/new"
                className="hidden h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition hover:shadow-lg hover:shadow-indigo-300 sm:inline-flex dark:shadow-indigo-950/30"
              >
                <span>＋</span> Yeni Proje
              </Link>

              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen((p) => !p)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  🔔

                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-12 z-50 w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#111827]">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Bildirimler
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Son hareketler
                        </p>
                      </div>

                      <Link
                        to="/notifications"
                        onClick={() => setNotifOpen(false)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      >
                        Tümünü Gör
                      </Link>
                    </div>

                    <div className="max-h-[420px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center">
                          <div className="mb-2 text-2xl">🔕</div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Henüz bildirim yok.
                          </p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => {
                              setNotifOpen(false);
                              navigate("/notifications");
                            }}
                            className="flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
                          >
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                              {initials(n.triggered_by_name || "S")}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-sm text-slate-700 dark:text-slate-200">
                                <span className="font-semibold">
                                  {n.triggered_by_name || "Sistem"}
                                </span>{" "}
                                {n.title || getNotificationText(n)}
                              </p>

                              <p className="mt-1 text-xs text-slate-400">
                                {formatNotificationTime(n.created_at)}
                              </p>
                            </div>

                            {!n.is_read && (
                              <div className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen((p) => !p)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
                >
                  {initials(user.name)}
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-12 z-50 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-[#111827]">
                    <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
                          {initials(user.name)}
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {user.name}
                          </p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            ● Çevrimiçi
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-2">
                      <ProfileMenuItem icon="👤" title="Profilim" desc="Hesap bilgilerini görüntüle" to="/profile" onClick={() => setProfileOpen(false)} />
                      <ProfileMenuItem icon="⚙️" title="Ayarlar" desc="Uygulama tercihlerini düzenle" to="/settings" onClick={() => setProfileOpen(false)} />
                      <ProfileMenuItem icon="📁" title="Projelerim" desc="Çalışma alanına git" to="/projects" onClick={() => setProfileOpen(false)} />
                    </div>

                    <div className="border-t border-slate-100 p-2 dark:border-slate-800">
                      <button
                        onClick={logout}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-500/10">
                          🚪
                        </span>
                        Çıkış Yap
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// Kullanıcı profil menüsünde gösterilen bağlantı bileşeni.
function ProfileMenuItem({ icon, title, desc, to, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-base dark:bg-slate-800">
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
          {desc}
        </span>
      </span>
    </Link>
  );
}


// Kullanıcının adından profil avatarında gösterilecek baş harfleri oluşturur.
function initials(name = "") {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Bildirim tarihini kullanıcı dostu zaman formatına dönüştürür.
function formatNotificationTime(value) {
  if (!value) return "az önce";

  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} sa önce`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} gün önce`;

  return date.toLocaleString("tr-TR");
}

// Bildirim türüne göre kullanıcıya gösterilecek açıklama metnini belirler.
function getNotificationText(n) {
  switch (n?.type) {
    case "MENTION":
      return "seni yorumda etiketledi";
    case "TASK_ASSIGNED":
      return "sana task atadı";
    case "COMMENT_ON_ASSIGNED_TASK":
      return "atandığın task'a yorum yaptı";
    case "MEMBER_JOINED":
      return "projeye katıldı";
    case "DUE_DATE_SOON":
      return "task son tarihi yaklaşıyor";
    case "SPRINT_STARTED":
      return "yeni sprint başladı";
    case "SPRINT_ENDED":
      return "sprint tamamlandı";
    case "ADDED_TO_PROJECT":
      return "bir projeye eklendin";
    default:
      return n?.title || "yeni bildirim";
  }
}