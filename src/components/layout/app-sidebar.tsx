import { Link, useRouterState } from "@tanstack/react-router";
import {
  Boxes,
  ClipboardList,
  CookingPot,
  LayoutDashboard,
  ListOrdered,
  Package,
  Receipt,
  Settings,
  Store,
  Tags,
  Wallet,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV_GROUPS = [
  {
    label: "Огляд",
    items: [{ title: "Панель", url: "/panel/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Продажі",
    items: [
      { title: "Чеки", url: "/panel/orders", icon: Receipt },
      { title: "Транзакції", url: "/panel/transactions", icon: Wallet },
      { title: "Касові зміни", url: "/panel/cash-shifts", icon: ListOrdered },
    ],
  },
  {
    label: "Каталог",
    items: [
      { title: "Товари", url: "/panel/products", icon: Package },
      { title: "Страви", url: "/panel/dishes", icon: CookingPot },
      { title: "Інгредієнти", url: "/panel/ingredients", icon: Boxes },
      { title: "Меню", url: "/panel/menu", icon: Store },
      { title: "Категорії", url: "/panel/categories", icon: Tags },
    ],
  },
  {
    label: "Склад",
    items: [{ title: "Інвентаризація", url: "/panel/inventory", icon: ClipboardList }],
  },
  {
    label: "Адміністрування",
    items: [{ title: "Налаштування", url: "/panel/settings", icon: Settings }],
  },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (router) => router.location.pathname });

  const isActive = (url: string) => pathname === url || pathname.startsWith(`${url}/`);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            Б
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold">Бістро та магазин</p>
            <p className="truncate text-xs text-muted-foreground">Адмін-панель</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
