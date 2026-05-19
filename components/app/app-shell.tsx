import { BarChart3, ClipboardCheck, ClipboardList, IdCard, Settings, Truck, UsersRound, Wrench } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/lib/auth/actions";
import { roleLabel } from "@/lib/permissions";
import type { Membership } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { AddReportModal } from "@/components/reports/add-report-modal";
import { SidebarToggle } from "@/components/app/sidebar-toggle";

type AppShellProps = {
  children: React.ReactNode;
  email: string;
  activeMembership: Membership;
  reportDrivers: Array<{
    assignedTruckLabel: string | null;
    id: string;
    label: string;
    status: string;
  }>;
};

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: BarChart3
  },
  {
    href: "/drivers",
    label: "Drivers",
    icon: IdCard
  },
  {
    href: "/trucks",
    label: "Trucks",
    icon: Truck
  },
  {
    href: "/reports",
    label: "Reports",
    icon: ClipboardList
  },
  {
    href: "/actions",
    label: "Actions",
    icon: ClipboardCheck
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    icon: Wrench
  },
  {
    href: "/settings/team",
    label: "Team",
    icon: UsersRound
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings
  }
];

export function AppShell({
  children,
  email,
  activeMembership,
  reportDrivers
}: AppShellProps) {
  const canCreateReports = ["owner", "admin", "dispatcher"].includes(activeMembership.role);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <Link className="brand" href="/dashboard">
            <span className="brand-mark">
              <Truck size={17} strokeWidth={2.4} />
            </span>
            <span className="brand-text">
              <span className="brand-name">DeepTruck</span>
              <span className="brand-subtitle">{activeMembership.company.name}</span>
            </span>
          </Link>
          <SidebarToggle />
        </div>

        <nav className="nav" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="nav-link" href={item.href} key={item.href}>
                <Icon size={17} strokeWidth={2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-meta">
            <span className="user-email">{email}</span>
            <span className="user-role">{roleLabel(activeMembership.role)}</span>
          </div>
          <form action={signOut}>
            <Button fullWidth type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <div className="topbar-title">{activeMembership.company.name}</div>
          </div>
          {canCreateReports ? (
            <AddReportModal
              companyId={activeMembership.company.id}
              drivers={reportDrivers}
            />
          ) : null}
        </div>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
