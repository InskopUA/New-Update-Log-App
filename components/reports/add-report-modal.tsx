"use client";

import { useMemo, useState } from "react";
import { CircleEllipsis, Package, Plus, Truck, UserRound, X } from "lucide-react";
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

const categoryDetails = {
  truck_status: {
    description: "Breakdowns, service, damage, tires, brakes, engine, trailer.",
    icon: Truck
  },
  driver: {
    description: "No answer, late, sick, overslept, missed plan, behavior, accident.",
    icon: UserRound
  },
  load: {
    description: "Cancelled load, cheap load, bad area, detention, broker or facility issue.",
    icon: Package
  },
  other: {
    description: "Weather, inspection, traffic, documents, customer or dispatcher issue.",
    icon: CircleEllipsis
  }
} satisfies Record<ReportCategory, { description: string; icon: typeof Truck }>;

const severityDetails = {
  low: "Minor note",
  medium: "Needs attention",
  high: "Money or service risk",
  critical: "Major loss or safety risk"
};

export function AddReportModal({ companyId, drivers, trucks }: AddReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory>("truck_status");
  const [issueType, setIssueType] = useState<string>(reportIssueTypes.truck_status[0].value);
  const [severity, setSeverity] = useState("medium");
  const issueTypes = useMemo(() => reportIssueTypes[category], [category]);

  function selectCategory(nextCategory: ReportCategory) {
    setCategory(nextCategory);
    setIssueType(reportIssueTypes[nextCategory][0].value);
  }

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
              <input name="category" type="hidden" value={category} />
              <input name="issue_type" type="hidden" value={issueType} />
              <input name="severity" type="hidden" value={severity} />

              <label className="field">
                <span className="label">Date</span>
                <input className="input" defaultValue={today()} name="report_date" type="date" />
              </label>

              <div className="field">
                <span className="label">Report category</span>
                <div className="category-grid">
                  {reportCategories.map((item) => {
                    const Icon = categoryDetails[item.value].icon;
                    const isActive = category === item.value;

                    return (
                      <button
                        className={`category-card ${isActive ? "category-card-active" : ""}`}
                        key={item.value}
                        onClick={() => selectCategory(item.value)}
                        type="button"
                      >
                        <span className="category-icon">
                          <Icon size={18} strokeWidth={2.2} />
                        </span>
                        <span className="category-copy">
                          <span className="category-title">{item.label}</span>
                          <span className="category-description">
                            {categoryDetails[item.value].description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field">
                <span className="label">Problem</span>
                <div className="issue-grid">
                  {issueTypes.map((item) => (
                    <button
                      className={`issue-option ${issueType === item.value ? "issue-option-active" : ""}`}
                      key={item.value}
                      onClick={() => setIssueType(item.value)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span className="label">Impact level</span>
                <div className="severity-grid">
                  {reportSeverities.map((item) => (
                    <button
                      className={`severity-option severity-${item.value} ${
                        severity === item.value ? "severity-option-active" : ""
                      }`}
                      key={item.value}
                      onClick={() => setSeverity(item.value)}
                      type="button"
                    >
                      <span>{item.label}</span>
                      <small>{severityDetails[item.value]}</small>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-3">
                <label className="field">
                  <span className="label">Driver {category === "driver" ? "*" : ""}</span>
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
                  <span className="label">Truck {category === "truck_status" ? "*" : ""}</span>
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
                <span className="label">Load reference {category === "load" ? "*" : ""}</span>
                <input
                  className="input"
                  name="load_reference"
                  placeholder="Optional load ID, broker, lane, or pickup city"
                  required={category === "load"}
                  type="text"
                />
              </label>

              <label className="field">
                <span className="label">Dispatcher explanation *</span>
                <textarea
                  className="textarea"
                  minLength={10}
                  name="explanation"
                  placeholder="What happened, why it happened, who was involved, and what needs attention?"
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
