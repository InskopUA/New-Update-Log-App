import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
};

export function Panel({ children, title, action }: PanelProps) {
  return (
    <section className="panel">
      {title || action ? (
        <div className="panel-header">
          {title ? <h2 className="panel-title">{title}</h2> : <span />}
          {action}
        </div>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  );
}
