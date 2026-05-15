"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type DriverFilterOption = {
  id: string;
  label: string;
};

type ReportRangeFiltersProps = {
  activeRange: string;
  basePath: "/dashboard" | "/reports";
  drivers: DriverFilterOption[];
  endDate?: string | null;
  selectedDriverIds: string[];
  startDate?: string | null;
};

const quickFilters = [
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["90d", "90 days"],
  ["all", "All time"]
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return date.toISOString().slice(0, 10);
}

export function ReportRangeFilters({
  activeRange,
  basePath,
  drivers,
  endDate,
  selectedDriverIds,
  startDate
}: ReportRangeFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(startDate ?? thirtyDaysAgo());
  const [customEndDate, setCustomEndDate] = useState(endDate ?? today());
  const [driverIds, setDriverIds] = useState<string[]>(selectedDriverIds);
  const customActive = activeRange === "custom";

  function toggleDriver(driverId: string) {
    setDriverIds((current) =>
      current.includes(driverId)
        ? current.filter((id) => id !== driverId)
        : [...current, driverId]
    );
  }

  function applyCustomFilter() {
    const params = new URLSearchParams({
      end_date: customEndDate,
      range: "custom",
      start_date: customStartDate
    });

    if (driverIds.length) {
      params.set("driver_ids", driverIds.join(","));
    }

    window.location.href = `${basePath}?${params.toString()}`;
  }

  return (
    <>
      <div className="filters">
        {quickFilters.map(([value, label]) => (
          <Link
            className={`filter-link ${activeRange === value ? "filter-link-active" : ""}`}
            href={`${basePath}?range=${value}`}
            key={value}
          >
            {label}
          </Link>
        ))}
        <button
          className={`filter-link ${customActive ? "filter-link-active" : ""}`}
          onClick={() => setIsOpen(true)}
          type="button"
        >
          Custom
        </button>
      </div>

      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div aria-modal="true" className="modal filter-modal" role="dialog">
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Custom filter</h2>
                <p className="modal-description">
                  Select a date range and one, multiple, or all drivers.
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

            <div className="form">
              <div className="grid grid-2">
                <label className="field">
                  <span className="label">Start date</span>
                  <input
                    className="input"
                    onChange={(event) => setCustomStartDate(event.target.value)}
                    type="date"
                    value={customStartDate}
                  />
                </label>
                <label className="field">
                  <span className="label">End date</span>
                  <input
                    className="input"
                    onChange={(event) => setCustomEndDate(event.target.value)}
                    type="date"
                    value={customEndDate}
                  />
                </label>
              </div>

              <div className="field">
                <div className="field-row">
                  <span className="label">Drivers</span>
                  <button
                    className="inline-action"
                    onClick={() => setDriverIds([])}
                    type="button"
                  >
                    All drivers
                  </button>
                </div>
                <div className="driver-filter-list">
                  {drivers.map((driver) => (
                    <label className="check-row" key={driver.id}>
                      <input
                        checked={driverIds.includes(driver.id)}
                        onChange={() => toggleDriver(driver.id)}
                        type="checkbox"
                      />
                      <span>{driver.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <Button type="button" onClick={applyCustomFilter}>
                  Apply filter
                </Button>
                <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
