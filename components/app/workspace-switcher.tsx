"use client";

import { useTransition } from "react";
import { switchWorkspace } from "@/lib/auth/actions";
import type { Membership } from "@/lib/auth/session";

type WorkspaceSwitcherProps = {
  activeCompanyId: string;
  memberships: Membership[];
};

export function WorkspaceSwitcher({
  activeCompanyId,
  memberships
}: WorkspaceSwitcherProps) {
  const [, startTransition] = useTransition();

  return (
    <form action={switchWorkspace} className="workspace-switcher">
      <select
        aria-label="Switch workspace"
        defaultValue={activeCompanyId}
        name="company_id"
        onChange={(event) => {
          const form = event.currentTarget.form;

          if (form) {
            startTransition(() => form.requestSubmit());
          }
        }}
      >
        {memberships.map((membership) => (
          <option key={membership.id} value={membership.company_id}>
            {membership.company.name}
          </option>
        ))}
      </select>
    </form>
  );
}
