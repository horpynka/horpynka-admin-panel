import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth/actions";
import type { AuthSession } from "@/lib/auth/session";
import { initials } from "@/lib/initials";

const SEGMENT_LABELS: Record<string, string> = {
  panel: "Панель керування",
  dashboard: "Панель",
  orders: "Чеки",
  products: "Товари",
  dishes: "Страви",
  ingredients: "Інгредієнти",
  menu: "Меню",
  transactions: "Транзакції",
  "cash-shifts": "Касові зміни",
  inventory: "Інвентаризація",
  settings: "Налаштування",
  new: "Створення",
  edit: "Редагування",
};

function segmentLabel(segment: string): string {
  return SEGMENT_LABELS[segment] ?? `№ ${segment}`;
}

export function AppTopbar({ session }: { session: AuthSession }) {
  const pathname = useRouterState({ select: (router) => router.location.pathname });

  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, index) => ({
    label: segmentLabel(segment),
    href: `/${segments.slice(0, index + 1).join("/")}`,
    isLast: index === segments.length - 1,
  }));

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          {crumbs.map((crumb) => (
            <BreadcrumbItem key={crumb.href}>
              {crumb.isLast ? (
                <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
              ) : (
                <>
                  <BreadcrumbLink asChild>
                    <Link to={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                  <BreadcrumbSeparator />
                </>
              )}
            </BreadcrumbItem>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-tight">{session.email}</p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {initials(session.email)}
        </div>
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="mr-1.5 h-4 w-4" />
          Вийти
        </Button>
      </div>
    </header>
  );
}
