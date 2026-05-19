"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";

type SummaryRange = {
  items: string[];
  label: string;
  value: string;
};

type OperationsSummaryModalProps = {
  ranges: SummaryRange[];
};

export function OperationsSummaryModal({ ranges }: OperationsSummaryModalProps) {
  const [open, setOpen] = useState(false);
  const [activeRange, setActiveRange] = useState(ranges[0]?.value ?? "30d");
  const activeSummary = ranges.find((range) => range.value === activeRange) ?? ranges[0];

  return (
    <>
      <button className="summary-trigger" onClick={() => setOpen(true)} type="button">
        <Sparkles size={16} />
        <span>Summary</span>
      </button>

      {open ? (
        <div className="summary-modal-backdrop" role="presentation">
          <section aria-modal="true" className="summary-modal" role="dialog">
            <div className="summary-modal-header">
              <div>
                <span>Operations Summary</span>
                <strong>{activeSummary?.label ?? "Selected period"}</strong>
              </div>
              <button aria-label="Close summary" className="icon-button" onClick={() => setOpen(false)} type="button">
                <X size={16} />
              </button>
            </div>

            <div className="summary-range-tabs">
              {ranges.map((range) => (
                <button
                  className={range.value === activeRange ? "active" : ""}
                  key={range.value}
                  onClick={() => setActiveRange(range.value)}
                  type="button"
                >
                  {range.label}
                </button>
              ))}
            </div>

            <div className="summary-modal-body">
              {(activeSummary?.items ?? []).map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
