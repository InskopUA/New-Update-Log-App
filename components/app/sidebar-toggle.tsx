"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const storageKey = "deeptruck:sidebar-collapsed";

export function SidebarToggle() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const savedValue = window.localStorage.getItem(storageKey);
    const nextCollapsed = savedValue === "true";
    setCollapsed(nextCollapsed);
    document.documentElement.dataset.sidebar = nextCollapsed ? "collapsed" : "expanded";
  }, []);

  function toggleSidebar() {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);
    window.localStorage.setItem(storageKey, String(nextCollapsed));
    document.documentElement.dataset.sidebar = nextCollapsed ? "collapsed" : "expanded";
  }

  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <button
      aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
      className="icon-button sidebar-toggle"
      onClick={toggleSidebar}
      type="button"
    >
      <Icon size={17} />
    </button>
  );
}
