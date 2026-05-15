"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { Check, CircleEllipsis, Package, Plus, Truck, UserRound, X } from "lucide-react";
import { createReport } from "@/lib/reports/actions";
import {
  isNoProblemIssue,
  reportCategories,
  reportIssueTypes,
  reportSeverities,
  type ReportCategory
} from "@/lib/reports/taxonomy";
import { Button } from "@/components/ui/button";

type ReportDriverOption = {
  assignedTruckId: string | null;
  assignedTruckLabel: string | null;
  id: string;
  label: string;
  status: string;
};

type ReportTruckOption = {
  currentDriverId: string | null;
  id: string;
  label: string;
  status: string;
};

type AddReportModalProps = {
  companyId: string;
  drivers: ReportDriverOption[];
  trucks: ReportTruckOption[];
};

type CategoryState = {
  completed: boolean;
  downtimeHours: string;
  explanation: string;
  issueType: string;
  severity: string;
  touched: boolean;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const categoryDetails = {
  truck_status: {
    description: "Truck condition, breakdowns, repairs, service, damage.",
    icon: Truck
  },
  driver: {
    description: "Driver behavior, timing, health, communication, execution.",
    icon: UserRound
  },
  load: {
    description: "Load quality, cancellation, broker, detention, bad area.",
    icon: Package
  },
  other: {
    description: "Weather, inspection, traffic, documents, customer issues.",
    icon: CircleEllipsis
  }
} satisfies Record<ReportCategory, { description: string; icon: LucideIcon }>;

const severityDetails = {
  low: "Minor note",
  medium: "Needs attention",
  high: "Money or service risk",
  critical: "Major loss or safety risk"
};

const categoryOrder = reportCategories.map((category) => category.value);

function createInitialSections(): Record<ReportCategory, CategoryState> {
  return {
    driver: createInitialSection("driver"),
    load: createInitialSection("load"),
    other: createInitialSection("other"),
    truck_status: createInitialSection("truck_status")
  };
}

function createInitialSection(category: ReportCategory): CategoryState {
  return {
    completed: false,
    downtimeHours: "0",
    explanation: "",
    issueType: reportIssueTypes[category][0].value,
    severity: "medium",
    touched: false
  };
}

function getSectionError(section: CategoryState) {
  if (!section.issueType) {
    return "Choose a problem or No problems.";
  }

  if (!isNoProblemIssue(section.issueType) && section.explanation.trim().length < 10) {
    return "Add at least 10 characters of explanation.";
  }

  return "";
}

export function AddReportModal({ companyId, drivers, trucks }: AddReportModalProps) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ReportCategory>("truck_status");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [fallbackTruckId, setFallbackTruckId] = useState("");
  const [sections, setSections] = useState(createInitialSections);
  const activeSection = sections[activeCategory];
  const issueTypes = useMemo(() => reportIssueTypes[activeCategory], [activeCategory]);
  const selectedDriver = drivers.find((driver) => driver.id === selectedDriverId);
  const assignedTruckId = selectedDriver?.assignedTruckId ?? "";
  const assignedTruckLabel = selectedDriver?.assignedTruckLabel ?? "";
  const selectedTruckId = assignedTruckId || fallbackTruckId;
  const availableFallbackTrucks = trucks.filter(
    (truck) => !truck.currentDriverId || truck.currentDriverId === selectedDriverId
  );
  const currentSectionError = getSectionError(activeSection);
  const allSectionsCompleted = categoryOrder.every((category) => sections[category].completed);
  const canSaveReport = Boolean(selectedDriverId && selectedTruckId && allSectionsCompleted);

  useEffect(() => {
    setMounted(true);
  }, []);

  function resetModal() {
    setActiveCategory("truck_status");
    setSelectedDriverId("");
    setFallbackTruckId("");
    setSections(createInitialSections());
  }

  function closeModal() {
    setIsOpen(false);
    resetModal();
  }

  function updateActiveSection(updates: Partial<CategoryState>) {
    setSections((current) => ({
      ...current,
      [activeCategory]: {
        ...current[activeCategory],
        ...updates,
        completed: updates.completed ?? false,
        touched: true
      }
    }));
  }

  function completeActiveSection() {
    if (currentSectionError) {
      setSections((current) => ({
        ...current,
        [activeCategory]: {
          ...current[activeCategory],
          touched: true
        }
      }));
      return false;
    }

    setSections((current) => ({
      ...current,
      [activeCategory]: {
        ...current[activeCategory],
        completed: true,
        touched: true
      }
    }));
    return true;
  }

  function selectCategory(nextCategory: ReportCategory) {
    if (nextCategory === activeCategory) {
      return;
    }

    const activeDirty = activeSection.touched && !activeSection.completed;
    if (activeDirty) {
      const shouldSave = window.confirm("Save current category before switching?");

      if (shouldSave && !completeActiveSection()) {
        return;
      }
    }

    setActiveCategory(nextCategory);
  }

  function selectIssue(issueType: string) {
    updateActiveSection({
      downtimeHours: isNoProblemIssue(issueType) ? "0" : activeSection.downtimeHours,
      issueType,
      severity: isNoProblemIssue(issueType) ? "low" : activeSection.severity
    });
  }

  function handleDriverChange(driverId: string) {
    setSelectedDriverId(driverId);
    setFallbackTruckId("");
  }

  const modal = (
    <div className="modal-backdrop" role="presentation">
      <div aria-modal="true" className="modal report-modal" role="dialog">
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Add report</h2>
            <p className="modal-description">
              Complete all four categories. Mark clean sections as No problems so the dashboard can
              count good days too.
            </p>
          </div>
          <button aria-label="Close" className="icon-button" onClick={closeModal} type="button">
            <X size={17} />
          </button>
        </div>

        <form action={createReport} className="form report-form">
          <input name="company_id" type="hidden" value={companyId} />
          <input name="driver_id" type="hidden" value={selectedDriverId} />
          <input name="truck_id" type="hidden" value={selectedTruckId} />
          {categoryOrder.map((category) => (
            <div key={category}>
              <input
                name={`${category}_issue_type`}
                type="hidden"
                value={sections[category].issueType}
              />
              <input
                name={`${category}_severity`}
                type="hidden"
                value={sections[category].severity}
              />
              <input
                name={`${category}_downtime_hours`}
                type="hidden"
                value={sections[category].downtimeHours}
              />
              <input
                name={`${category}_explanation`}
                type="hidden"
                value={sections[category].explanation}
              />
            </div>
          ))}

          <div className="grid grid-3">
            <label className="field">
              <span className="label">Date</span>
              <input className="input" defaultValue={today()} name="report_date" type="date" />
            </label>
            <label className="field">
              <span className="label">Driver *</span>
              <select
                className="select"
                onChange={(event) => handleDriverChange(event.target.value)}
                required
                value={selectedDriverId}
              >
                <option value="">Select driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.label}
                  </option>
                ))}
              </select>
            </label>
            {assignedTruckId ? (
              <div className="field">
                <span className="label">Truck</span>
                <div className="locked-field">Truck {assignedTruckLabel}</div>
              </div>
            ) : (
              <label className="field">
                <span className="label">Truck *</span>
                <select
                  className="select"
                  onChange={(event) => setFallbackTruckId(event.target.value)}
                  required
                  value={fallbackTruckId}
                >
                  <option value="">Select truck</option>
                  {availableFallbackTrucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
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

          <div className="field">
            <span className="label">Report categories</span>
            <div className="category-grid report-category-grid">
              {reportCategories.map((item) => {
                const Icon = categoryDetails[item.value].icon;
                const isActive = activeCategory === item.value;
                const isComplete = sections[item.value].completed;

                return (
                  <button
                    className={`category-card ${isActive ? "category-card-active" : ""} ${
                      isComplete ? "category-card-complete" : ""
                    }`}
                    key={item.value}
                    onClick={() => selectCategory(item.value)}
                    type="button"
                  >
                    <span className="category-icon">
                      {isComplete ? <Check size={18} strokeWidth={2.4} /> : <Icon size={18} />}
                    </span>
                    <span className="category-copy">
                      <span className="category-title">{item.label}</span>
                      <span className="category-description">
                        {isComplete ? "Completed" : categoryDetails[item.value].description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="report-section">
            <div className="report-section-header">
              <div>
                <div className="report-section-title">
                  {reportCategories.find((item) => item.value === activeCategory)?.label}
                </div>
                <div className="report-section-note">
                  Choose No problems if this area was clean today.
                </div>
              </div>
              {activeSection.completed ? <span className="complete-pill">Completed</span> : null}
            </div>

            <div className="field">
              <span className="label">Problem</span>
              <div className="issue-grid">
                {issueTypes.map((item) => (
                  <button
                    className={`issue-option ${
                      activeSection.issueType === item.value ? "issue-option-active" : ""
                    } ${isNoProblemIssue(item.value) ? "issue-option-clean" : ""}`}
                    key={item.value}
                    onClick={() => selectIssue(item.value)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {!isNoProblemIssue(activeSection.issueType) ? (
              <>
                <div className="field">
                  <span className="label">Impact level</span>
                  <div className="severity-grid">
                    {reportSeverities.map((item) => (
                      <button
                        className={`severity-option severity-${item.value} ${
                          activeSection.severity === item.value ? "severity-option-active" : ""
                        }`}
                        key={item.value}
                        onClick={() => updateActiveSection({ severity: item.value })}
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
                    <span className="label">Downtime hours</span>
                    <input
                      className="input"
                      min="0"
                      onChange={(event) =>
                        updateActiveSection({ downtimeHours: event.target.value })
                      }
                      step="0.25"
                      type="number"
                      value={activeSection.downtimeHours}
                    />
                  </label>
                </div>

                <label className="field">
                  <span className="label">Dispatcher explanation *</span>
                  <textarea
                    className="textarea"
                    minLength={10}
                    onChange={(event) => updateActiveSection({ explanation: event.target.value })}
                    placeholder="What happened, why it happened, who was involved, and what needs attention?"
                    required
                    value={activeSection.explanation}
                  />
                </label>
              </>
            ) : (
              <div className="clean-state">
                No issue will be recorded for this category. This still counts as a clean check.
              </div>
            )}

            {activeSection.touched && currentSectionError ? (
              <div className="field-error">{currentSectionError}</div>
            ) : null}

            <div className="section-actions">
              <Button type="button" variant="secondary" onClick={completeActiveSection}>
                Mark category complete
              </Button>
            </div>
          </section>

          <div className="modal-actions report-modal-actions">
            <Button type="submit" disabled={!canSaveReport}>
              Save full report
            </Button>
            <span className="save-note">
              {allSectionsCompleted
                ? selectedDriverId && selectedTruckId
                  ? "Ready to save"
                  : "Select driver and truck"
                : "Complete all four categories"}
            </span>
            <Button type="button" variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <Button type="button" onClick={() => setIsOpen(true)}>
        <Plus size={16} />
        Add report
      </Button>

      {isOpen && mounted ? createPortal(modal, document.body) : null}
    </>
  );
}
