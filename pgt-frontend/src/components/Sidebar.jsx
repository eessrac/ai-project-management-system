import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  clearToken,
  getToken,
  apiFetch,
  getUnreadNotificationCount,
} from "../api";
import Swal from "sweetalert2";

// Uygulama içerisindeki yan menüyü (sidebar) yönetir.
// Kullanıcı bilgileri, menü navigasyonu ve bildirim işlemlerini içerir.
export default function Sidebar({ open, onToggle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const token = getToken();

  const [user, setUser] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [query, setQuery] = useState("");

  const [showNotificationBadge, setShowNotificationBadge] = useState(
    localStorage.getItem("show_notification_badge") !== "false"
  );

  useEffect(() => {
    if (!token) return;
    loadUser();
    loadUnread();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadUnread();
  }, [location.pathname, token]);

  useEffect(() => {
    function handleNotificationsUpdated(e) {
      const nextUnread = e?.detail?.unread_count;
      if (typeof nextUnread === "number") {
        setUnreadCount(nextUnread);
      } else {
        loadUnread();
      }
    }
    window.addEventListener("notifications-updated", handleNotificationsUpdated);
    return () => {
      window.removeEventListener("notifications-updated", handleNotificationsUpdated);
    };
  }, []);

  useEffect(() => {
    function handleSettingsUpdated() {
      setShowNotificationBadge(
        localStorage.getItem("show_notification_badge") !== "false"
      );
    }
    window.addEventListener("settings-updated", handleSettingsUpdated);
    return () => {
      window.removeEventListener("settings-updated", handleSettingsUpdated);
    };
  }, []);

  async function loadUser() {
    try {
      const data = await apiFetch("/users/me", { token });
      setUser(data.user || null);
    } catch (e) {
      console.error("Sidebar user error:", e);
    }
  }

  async function loadUnread() {
    try {
      const data = await getUnreadNotificationCount();
      setUnreadCount(Number(data?.unread_count || 0));
    } catch (e) {
      console.error("Sidebar unread error:", e);
    }
  }

  // Kullanıcının sistemden güvenli şekilde çıkış yapmasını sağlar.
  async function handleLogout() {
    const result = await Swal.fire({
      title: "Çıkış Yap",
      html: `
        <div style="color:#8a5ff5">
          Hesabından çıkış yapmak istediğine emin misin?
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Çıkış Yap",
      cancelButtonText: "Vazgeç",
      reverseButtons: true,
      customClass: {
        popup: "logout-popup",
        confirmButton: "custom-swal-confirm",
        cancelButton: "custom-swal-cancel",
      },
    });

    if (!result.isConfirmed) return;

    clearToken();
    navigate("/login", { replace: true });
  }

  /* Menü gruplandırması */
  const navGroups = useMemo(
    () => [
      {
        title: "Genel",
        items: [
          { to: "/", label: "Ana Sayfa", end: true, icon: "🏠", desc: "Özet & hızlı işlemler" },
        ],
      },
      {
        title: "Çalışma Alanı",
        items: [
          { to: "/projects", label: "Projelerim", icon: "📁", desc: "Aktif projeler" },
          { to: "/projects/archived", label: "Arşiv", icon: "🗂️", desc: "Tamamlanan projeler" },
        ],
      },
      {
        title: "Hesap",
        items: [
          {
            to: "/notifications",
            label: "Bildirimler",
            icon: "🔔",
            desc: "Güncellemeler",
            badge: showNotificationBadge && unreadCount > 0 ? unreadCount : null,
          },
          { to: "/profile", label: "Profil", icon: "👤", desc: "Hesap bilgilerin" },
          { to: "/settings", label: "Ayarlar", icon: "⚙️", desc: "Tercihler" },
        ],
      },
    ],
    [showNotificationBadge, unreadCount]
  );

  /* Hızlı arama filtresi  */
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navGroups;
    return navGroups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  }, [navGroups, query]);

  const initials = getInitials(user?.full_name || user?.name || "Kullanıcı");

  return (
    <aside
      className={`fixed left-0 top-0 z-50 h-screen overflow-hidden border-r border-slate-200 bg-white/95 text-slate-900 backdrop-blur-xl shadow-xl shadow-slate-200/40 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dark:border-slate-800 dark:bg-[#0F172A]/95 dark:text-white dark:shadow-black/20 ${
        open ? "w-64" : "w-20"
      }`}
    >
      {/* Dekoratif gradient */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-50/80 to-transparent dark:from-indigo-500/10" />

      <div className="relative flex h-full flex-col px-3 py-4">
        {/* ───────── Marka ───────── */}
        <div className="mb-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark />

              <div
                className={`min-w-0 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  open ? "w-44 opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-2"
                }`}
              >
                <h1 className="truncate text-base font-black tracking-tight text-slate-900 dark:text-white">
                  Taskly
                </h1>
                <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  AI Destekli Proje Yönetimi
                </p>
              </div>
            </div>

            <button
              onClick={onToggle}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-all duration-300 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              title={open ? "Daralt" : "Genişlet"}
            >
              <span
                className={`inline-block transition-transform duration-500 ${
                  open ? "rotate-0" : "rotate-180"
                }`}
              >
                ←
              </span>
            </button>
          </div>       
        </div>

        {/* ───────── Hızlı Arama ───────── */}
        {open && (
          <div className="mb-4">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">🔍</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Menüde ara..."
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-500/20"
              />
            </div>
          </div>
        )}

        {/* ───────── Navigasyon ───────── */}
        <nav className="flex-1 space-y-4 overflow-y-auto pr-1">
          {filteredGroups.map((group) => (
            <div key={group.title}>
              {open && (
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                  {group.title}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        "group relative flex items-center rounded-xl px-3 text-sm font-medium transition-all",
                        open ? "h-11 justify-start gap-3" : "h-11 justify-center",
                        isActive
                          ? "bg-gradient-to-r from-indigo-500/15 to-violet-500/10 text-indigo-700 shadow-sm dark:from-indigo-500/25 dark:to-violet-500/15 dark:text-indigo-200"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white",
                      ].join(" ")
                    }
                    title={!open ? item.label : ""}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                        )}

                        <span
                          className={[
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base transition",
                            isActive
                              ? "bg-white/70 shadow-sm dark:bg-slate-900/40"
                              : "bg-slate-100/70 group-hover:bg-white dark:bg-slate-800/60 dark:group-hover:bg-slate-700/70",
                          ].join(" ")}
                        >
                          {item.icon}
                        </span>

                        <div
                          className={`flex min-w-0 flex-1 flex-col overflow-hidden leading-tight transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            open ? "w-36 opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-2"
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          <span className="truncate text-[10px] font-normal text-slate-400 dark:text-slate-500">
                            {item.desc}
                          </span>
                        </div>

                        {open && item.badge && (
                          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-rose-200 dark:shadow-rose-950/40">
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        )}

                        {/* Daraltılmış modda küçük badge noktası */}
                        {!open && item.badge && (
                          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0F172A]" />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          {open && filteredGroups.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-700">
              "{query}" için sonuç yok
            </div>
          )}
        </nav>

        {/* ───────── Alt — Kullanıcı + Çıkış ───────── */}
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          {open ? (
            <div className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50">
              <div className="relative">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-sm">
                  {initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-800" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {user?.full_name || user?.name || "Kullanıcı"}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {user?.email || "Çevrimiçi"}
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-2 flex justify-center">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-semibold text-white shadow-sm">
                  {initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0F172A]" />
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`flex h-11 w-full items-center rounded-xl px-3 text-sm font-medium text-rose-600 transition-all hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 ${
              open ? "justify-start gap-3" : "justify-center"
            }`}
            title={!open ? "Çıkış Yap" : ""}
          >
            <span className="text-lg">🚪</span>
            {open && <span className="leading-none">Çıkış Yap</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}

// Uygulamanın logosunu görüntüleyen bileşen.
function BrandMark() {
  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 text-lg font-bold text-white shadow-md shadow-indigo-200 dark:shadow-indigo-950/40">
      <span className="relative z-10">T</span>
      <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-[8px] shadow ring-2 ring-white dark:ring-[#0F172A]">
        ✦
      </span>
    </div>
  );
}

// Kullanıcının adından profil avatarı için baş harfleri oluşturur.
function getInitials(name = "") {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}