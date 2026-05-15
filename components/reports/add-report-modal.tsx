"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { createReport } from "@/lib/reports/actions";
import {
  reportCategories,
  reportIssueTypes,
  reportSeverities,
  type ReportCategory
} from "@/lib/reports/taxonomy";
import { Button } from "@/components/ui/button";

type ReportOption = {
  id: string;
  label: string;
  status: string;
};

type AddReportModalProps = {
  companyId: string;
  drivers: ReportOption[];
  trucks: ReportOption[];
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AddReportModal({ companyId, drivers, trucks }: AddReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory>("truck_status");
  const issueTypes = useMemo(() => reportIssueTypes[category], [category]);

  return (
    <>
      <Button type="button" onClick={() => setIsOpen(true)}>
        <Plus size={16} />
        Add report
      </Button>

      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="modal" role="dialog">
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Add report</h2>
                <p className="modal-description">
                  Log a real event. Explanation is required for future summaries and scoring.
                </p>
              </div>
              <button
                aria-label="Close"
                className="icon-button"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X size={17} />
              </button>
            </div>

            <form action={createReport} className="form">
              <input name="company_id" type="hidden" value={companyId} />

              <div className="grid grid-3">
                <label className="field">
                  <span className="label">Date</span>
                  <input className="input" defaultValue={today()} name="report_date" type="date" />
                </label>
                <label className="field">
                  <span className="label">Report type</span>
                  <select
                    className="select"
                    name="category"
                    onChange={(event) => setCategory(event.target.value as ReportCategory)}
                    value={category}
                  >
                    {reportCategories.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">Severity</span>
                  <select className="select" defaultValue="medium" name="severity">
                    {reportSeverities.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <span className="label">Problem</span>
                <select className="select" name="issue_type" key={category}>
                  {issueTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-3">
                <label className="field">
                  <span className="label">Driver</span>
                  <select
                    className="select"
                    name="driver_id"
                    required={category === "driver"}
                  >
                    <option value="">Not selected</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">Truck</span>
                  <select
                    className="select"
                    name="truck_id"
                    required={category === "truck_status"}
                  >
                    <option value="">Not selected</option>
                    {trucks.map((truck) => (
                      <option key={truck.id} value={truck.id}>
                        {truck.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="label">Downtime hours</span>
                  <input
                    className="input"
                    defaultValue="0"
                    min="0"
                    name="downtime_hours"
                    step="0.25"
                    type="number"
                  />
                </label>
              </div>

              <label className="field">
                <span className="label">Load reference</span>
                <input
                  className="input"
                  name="load_reference"
                  placeholder="Optional load ID, broker, lane, or pickup city"
                  type="text"
                />
              </label>

              <label className="field">
                <span className="label">Explanation</span>
                <textarea
                  className="textarea"
                  minLength={10}
                  name="explanation"
                  placeholder="What happened, why it happened, and what needs attention?"
                  required
                />
              </label>

              <div className="modal-actions">
                <Button type="submit">Save report</Button>
                <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
