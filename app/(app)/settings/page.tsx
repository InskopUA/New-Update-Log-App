import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        description="Company-level controls will live here as the product grows."
        title="Settings"
      />
      <Panel title="Workspace settings">
        <div className="empty">Company profile, billing, and preferences will be added here.</div>
      </Panel>
    </>
  );
}
