import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        description="The first operational surface. Business modules will plug into this layout without changing the foundation."
        title="Dashboard"
      />

      <div className="grid grid-3">
        <section className="panel stat">
          <div className="stat-label">Daily updates</div>
          <div className="stat-value">0</div>
          <div className="stat-note">Waiting for the Daily Update module.</div>
        </section>
        <section className="panel stat">
          <div className="stat-label">Active trucks</div>
          <div className="stat-value">0</div>
          <div className="stat-note">Truck setup comes next.</div>
        </section>
        <section className="panel stat">
          <div className="stat-label">Open issues</div>
          <div className="stat-value">0</div>
          <div className="stat-note">Downtime and repair tracking will feed this.</div>
        </section>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title="Foundation status">
          <table className="table">
            <tbody>
              <tr>
                <td>Authentication</td>
                <td>
                  <span className="badge">Ready</span>
                </td>
              </tr>
              <tr>
                <td>Company workspace</td>
                <td>
                  <span className="badge">Ready</span>
                </td>
              </tr>
              <tr>
                <td>Role model</td>
                <td>
                  <span className="badge">Ready</span>
                </td>
              </tr>
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
