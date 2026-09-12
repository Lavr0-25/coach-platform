import type { ReactNode } from "react";
import {
  BookText,
  Bot,
  GraduationCap,
  Home,
  IdCard,
  Mail,
  MessageCircle,
  Palette,
  Shield,
  Users,
  Wallet,
  ChartColumn,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import CabinetHelp from "./cabinet";
import LessonsHelp from "./lessons";
import CoursesHelp from "./courses";
import SubscribersHelp from "./subscribers";
import SubscriptionsHelp from "./subscriptions";
import MessagesHelp from "./messages";
import AnalyticsHelp from "./analytics";
import ProfileHelp from "./profile";
import AiHelp from "./ai";
import FeedbackHelp from "./feedback";
import AdminHelp from "./admin";
import ModerationHelp from "./moderation";
import ThemeHelp from "./theme";

// Реестр разделов Справочника. Новый раздел = новый файл-компонент в
// content/help/ + строка здесь. pages — адреса, с которых иконка «Как здесь
// работать?» должна открывать именно этот раздел (функция получает путь
// страницы и решает, тот ли это раздел).
export type HelpSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  content: ReactNode;
};

export const SECTIONS: HelpSection[] = [
  {
    id: "cabinet",
    title: "Кабинет автора",
    icon: Home,
    match: (p) => p === "/dashboard/mentor",
    content: <CabinetHelp />,
  },
  {
    id: "lessons",
    title: "Мои материалы",
    icon: BookText,
    match: (p) => p.startsWith("/dashboard/mentor/lessons"),
    content: <LessonsHelp />,
  },
  {
    id: "courses",
    title: "Мои курсы",
    icon: GraduationCap,
    match: (p) => p.startsWith("/dashboard/mentor/courses"),
    content: <CoursesHelp />,
  },
  {
    id: "subscribers",
    title: "Подписчики",
    icon: Users,
    match: (p) => p === "/dashboard/mentor/subscribers",
    content: <SubscribersHelp />,
  },
  {
    id: "analytics",
    title: "Аналитика",
    icon: ChartColumn,
    match: (p) => p.startsWith("/mentor/analytics"),
    content: <AnalyticsHelp />,
  },
  {
    id: "subscriptions",
    title: "Платные подписки",
    icon: Wallet,
    // Профиль автора (кроме аналитики), уроки и курсы — там кнопка подписки
    match: (p) =>
      (p.startsWith("/mentor/") && !p.startsWith("/mentor/analytics")) ||
      p.startsWith("/lesson/") ||
      p.startsWith("/course/"),
    content: <SubscriptionsHelp />,
  },
  {
    id: "messages",
    title: "Личные сообщения",
    icon: MessageCircle,
    match: (p) => p === "/messages" || p.startsWith("/messages/"),
    content: <MessagesHelp />,
  },
  {
    id: "profile",
    title: "Профиль автора",
    icon: IdCard,
    match: (p) => p === "/dashboard/mentor/profile",
    content: <ProfileHelp />,
  },
  {
    id: "ai",
    title: "Управление с ИИ",
    icon: Bot,
    match: (p) => p.startsWith("/dashboard/ai"),
    content: <AiHelp />,
  },
  {
    id: "feedback",
    title: "Мои обращения",
    icon: Mail,
    match: (p) => p === "/feedback",
    content: <FeedbackHelp />,
  },
  {
    id: "admin",
    title: "Админ-панель",
    icon: Wrench,
    match: (p) =>
      ["/admin", "/admin/users", "/admin/lessons", "/admin/coaches"].includes(
        p,
      ),
    content: <AdminHelp />,
  },
  {
    id: "moderation",
    title: "Модерация (админ)",
    icon: Shield,
    match: (p) =>
      [
        "/admin/feedback",
        "/admin/reports",
        "/admin/stop-list",
        "/admin/banned-words",
      ].includes(p),
    content: <ModerationHelp />,
  },
  {
    id: "theme",
    title: "Настройки интерфейса",
    icon: Palette,
    // Открывается только вручную: /help?раздел=theme
    match: () => false,
    content: <ThemeHelp />,
  },
];

// Раздел по адресу страницы (иконка передаёт текущий путь в ?из=…)
export function sectionForPath(path: string): HelpSection | undefined {
  return SECTIONS.find((s) => s.match(path));
}

// Раздел по id (/help?раздел=…)
export function sectionById(id: string): HelpSection | undefined {
  return SECTIONS.find((s) => s.id === id);
}