import { useState, useEffect } from "react";
import { useHashRoute } from "./hooks/use-hash-route";
import type { HashRoute } from "./hooks/use-hash-route";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { ChatPage } from "./pages/ChatPage";
import { BookDetail } from "./pages/BookDetail";
import { ChapterReader } from "./pages/ChapterReader";
import { Analytics } from "./pages/Analytics";
import { ServiceListPage } from "./pages/ServiceListPage";
import { ServiceDetailPage } from "./pages/ServiceDetailPage";
import { TruthFiles } from "./pages/TruthFiles";
import { DaemonControl } from "./pages/DaemonControl";
import { LogViewer } from "./pages/LogViewer";
import { GenreManager } from "./pages/GenreManager";
import { StyleManager } from "./pages/StyleManager";
import { ImportManager } from "./pages/ImportManager";
import { RadarView } from "./pages/RadarView";
import { DoctorView } from "./pages/DoctorView";
import { LanguageSelector } from "./pages/LanguageSelector";
import { LoginPage } from "./pages/LoginPage";
import { AdminPanel } from "./pages/AdminPanel";
import { BookSidebar, BookSidebarToggle } from "./components/chat/BookSidebar";
import { useSSE } from "./hooks/use-sse";
import { useSessionEvents } from "./hooks/use-session-events";
import { useTheme } from "./hooks/use-theme";
import { useI18n } from "./hooks/use-i18n";
import { useAuth } from "./hooks/use-auth";
import { postApi, putApi, useApi } from "./hooks/use-api";
import {
  Sun,
  Moon,
  LogOut,
  House,
  Library,
  SquarePen,
  MessageSquareText,
  Wrench,
  Settings,
} from "lucide-react";

export type { HashRoute as Route } from "./hooks/use-hash-route";

export function deriveActiveBookId(route: HashRoute): string | undefined {
  if ("bookId" in route) return route.bookId;
  return undefined;
}

export function isBookCreateChatRoute(route: HashRoute): boolean {
  return route.page === "book-create";
}

export function App() {
  const auth = useAuth();
  const { route, setRoute } = useHashRoute();
  const sse = useSSE();
  const { theme, setTheme } = useTheme();
  const { t, lang: currentLang } = useI18n();
  const { data: project, refetch: refetchProject } = useApi<{ language: string; languageExplicit: boolean }>(
    auth.user ? "/project" : "",
  );
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [ready, setReady] = useState(false);

  const isDark = theme === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => {
    if (!auth.user) {
      setReady(false);
      setShowLanguageSelector(false);
      return;
    }
    if (project) {
      if (!project.languageExplicit) {
        setShowLanguageSelector(true);
      }
      setReady(true);
    }
  }, [auth.user, project]);

  useSessionEvents(sse, route, setRoute);

  const nav = {
    toDashboard: () => setRoute({ page: "dashboard" }),
    toChat: () => setRoute({ page: "chat" }),
    toBook: (bookId: string) => setRoute({ page: "book", bookId }),
    toBookSettings: (bookId: string) => setRoute({ page: "book-settings", bookId }),
    toBookCreate: () => setRoute({ page: "book-create" }),
    toChapter: (bookId: string, chapterNumber: number) =>
      setRoute({ page: "chapter", bookId, chapterNumber }),
    toAnalytics: (bookId: string) => setRoute({ page: "analytics", bookId }),
    toServices: () => setRoute({ page: "services" }),
    toServiceDetail: (id: string) => setRoute({ page: "service-detail", serviceId: id }),
    toTruth: (bookId: string) => setRoute({ page: "truth", bookId }),
    toDaemon: () => setRoute({ page: "daemon" }),
    toLogs: () => setRoute({ page: "logs" }),
    toGenres: () => setRoute({ page: "genres" }),
    toStyle: () => setRoute({ page: "style" }),
    toImport: () => setRoute({ page: "import" }),
    toRadar: () => setRoute({ page: "radar" }),
    toDoctor: () => setRoute({ page: "doctor" }),
    toAdmin: () => setRoute({ page: "admin" }),
  };

  const activeBookId = deriveActiveBookId(route);
  const activePage =
    activeBookId
      ? `book:${activeBookId}`
      : route.page === "service-detail"
        ? "services"
        : route.page;

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!auth.user) {
    return <LoginPage auth={auth} />;
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (showLanguageSelector) {
    return (
      <LanguageSelector
        onSelect={async (lang) => {
          await postApi("/project/language", { language: lang });
          setShowLanguageSelector(false);
          refetchProject();
        }}
      />
    );
  }

  return (
    <div className="h-screen bg-background text-foreground flex overflow-hidden font-sans">
      {/* Left Sidebar */}
      <div className="hidden h-full shrink-0 md:flex">
        <Sidebar nav={nav} activePage={activePage} sse={sse} t={t} />
      </div>

      {/* Center Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/30 backdrop-blur-sm">
        {/* Header Strip */}
        <header className="hidden h-14 shrink-0 items-center justify-between px-8 border-b border-border/40 md:flex">
          <div className="flex items-center gap-2">
             <button
               onClick={nav.toDashboard}
               className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-card/70 px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-secondary/50 transition-colors"
             >
               <House size={14} />
               <span>首页</span>
               <span className="text-muted-foreground/70">/</span>
               <span className="font-serif">YANGYANG 小说 Agent</span>
             </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-0.5 bg-muted/50 rounded-md p-0.5">
              <button
                onClick={async () => {
                  await putApi("/project", { language: "zh" });
                  refetchProject();
                }}
                className={`text-xs px-2 py-0.5 rounded ${currentLang === "zh" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                中
              </button>
              <button
                onClick={async () => {
                  await putApi("/project", { language: "en" });
                  refetchProject();
                }}
                className={`text-xs px-2 py-0.5 rounded ${currentLang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                EN
              </button>
            </div>

            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <div className="flex items-center gap-2 pl-3 border-l border-border/40">
              <span className="text-xs text-muted-foreground hidden sm:inline">{auth.user.username}</span>
              {auth.user.role === "admin" && (
                <button
                  onClick={() => setRoute({ page: "admin" })}
                  className="text-xs underline text-muted-foreground hover:text-foreground transition-colors"
                  title="用户管理"
                >
                  管理
                </button>
              )}
              <button
                onClick={() => { void auth.logout(); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="退出登录"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="mobile-main flex-1 relative overflow-y-auto scroll-smooth">
          {route.page === "dashboard" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <Dashboard nav={nav} sse={sse} theme={theme} t={t} />
            </div>
          )}
          {isBookCreateChatRoute(route) && (
            <div className="mobile-chat-route absolute inset-0 flex min-w-0">
              <ChatPage
                mode="book-create"
                nav={nav}
                theme={theme}
                t={t}
                sse={sse}
              />
            </div>
          )}
          {route.page === "chat" && (
            <div className="mobile-chat-route absolute inset-0 flex min-w-0">
              <ChatPage
                mode="project-chat"
                nav={nav}
                theme={theme}
                t={t}
                sse={sse}
              />
            </div>
          )}
          {route.page === "book" && (
            <div className="mobile-chat-route absolute inset-0 flex min-w-0">
              <ChatPage
                activeBookId={route.bookId}
                mode="book"
                nav={nav}
                theme={theme}
                t={t}
                sse={sse}
              />
              <BookSidebar bookId={route.bookId} theme={theme} t={t} sse={sse} />
              <BookSidebarToggle bookId={route.bookId} theme={theme} t={t} sse={sse} />
            </div>
          )}
          {route.page === "book-settings" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <BookDetail bookId={route.bookId} nav={nav} theme={theme} t={t} sse={sse} />
            </div>
          )}
          {route.page === "chapter" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <ChapterReader bookId={route.bookId} chapterNumber={route.chapterNumber} nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "analytics" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <Analytics bookId={route.bookId} nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "services" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <ServiceListPage nav={nav} />
            </div>
          )}
          {route.page === "service-detail" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <ServiceDetailPage serviceId={route.serviceId} nav={nav} />
            </div>
          )}
          {route.page === "truth" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <TruthFiles bookId={route.bookId} nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "daemon" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <DaemonControl nav={nav} theme={theme} t={t} sse={sse} />
            </div>
          )}
          {route.page === "logs" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <LogViewer nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "genres" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <GenreManager nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "style" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <StyleManager nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "import" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <ImportManager nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "radar" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <RadarView nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "doctor" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <DoctorView nav={nav} theme={theme} t={t} />
            </div>
          )}
          {route.page === "admin" && auth.user.role === "admin" && (
            <div className="max-w-4xl mx-auto px-6 py-12 md:px-12 lg:py-16 fade-in">
              <AdminPanel currentUser={auth.user} />
            </div>
          )}
        </main>
        <MobileBottomNav nav={nav} activePage={activePage} lang={currentLang} />
      </div>
    </div>
  );
}

function MobileBottomNav({
  nav,
  activePage,
  lang,
}: {
  nav: {
    toDashboard: () => void;
    toBookCreate: () => void;
    toChat: () => void;
    toStyle: () => void;
    toServices: () => void;
  };
  activePage: string;
  lang: string;
}) {
  const isZh = lang !== "en";
  const items = [
    {
      key: "dashboard",
      label: isZh ? "书架" : "Books",
      icon: Library,
      active: activePage === "dashboard",
      onClick: nav.toDashboard,
    },
    {
      key: "create",
      label: isZh ? "新建" : "Create",
      icon: SquarePen,
      active: activePage === "book-create",
      onClick: nav.toBookCreate,
      primary: true,
    },
    {
      key: "chapter",
      label: isZh ? "创作" : "Write",
      icon: MessageSquareText,
      active: activePage === "chat" || activePage.startsWith("book:"),
      onClick: nav.toChat,
    },
    {
      key: "tools",
      label: isZh ? "工具" : "Tools",
      icon: Wrench,
      active: ["style", "import", "radar", "doctor", "genres"].includes(activePage),
      onClick: nav.toStyle,
    },
    {
      key: "settings",
      label: isZh ? "设置" : "Settings",
      icon: Settings,
      active: activePage === "services" || activePage === "service-detail",
      onClick: nav.toServices,
    },
  ];

  return (
    <nav className="mobile-bottom-nav md:hidden" aria-label={isZh ? "底部导航" : "Bottom navigation"}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={item.onClick}
            className={`mobile-bottom-nav__item ${item.active ? "is-active" : ""} ${item.primary ? "is-primary" : ""}`}
          >
            <Icon size={20} strokeWidth={2} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
