import { Library, MessageSquareText, Settings, SquarePen, Wrench } from "lucide-react";

export type MobileBottomNavActions = {
  toDashboard: () => void;
  toBookCreate: () => void;
  toChat: () => void;
  toStyle: () => void;
  toServices: () => void;
};

export function MobileBottomNav({
  nav,
  activePage,
  lang,
}: {
  nav: MobileBottomNavActions;
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
