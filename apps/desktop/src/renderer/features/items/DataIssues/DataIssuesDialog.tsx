import { useState } from "react";
import { Dialog, Tabs } from "@radix-ui/themes";
import type { ExceptionStatus } from "@shopos/core";
import { StatusMessage } from "../../../shared/components/StatusMessage";
import { uiText } from "../../../shared/text/strings";
import { IssueTable } from "./components/IssueTable";
import { useDataIssues } from "./hooks/useDataIssues";
import { useResolveIssue } from "./hooks/useResolveIssue";
import type { IDataIssuesDialogProps } from "./types";

/** Open and resolved data issues; resolve one with a note (spec 002 T052). */
export function DataIssuesDialog({ onClose }: IDataIssuesDialogProps) {
  const text = uiText.dataIssues;
  const [status, setStatus] = useState<ExceptionStatus>("open");
  const issues = useDataIssues(status);
  const resolving = useResolveIssue(() => void issues.load());
  const error = resolving.error ?? issues.error;
  return (
    <Dialog.Root open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Content maxWidth="820px">
        <Dialog.Title>{text.title}</Dialog.Title>
        <Dialog.Description size="2" mb="3">
          {text.description}
        </Dialog.Description>
        {error && (
          <StatusMessage role="danger" label={text.errorLabel}>
            {error}
          </StatusMessage>
        )}
        <Tabs.Root value={status} onValueChange={(value) => setStatus(value as ExceptionStatus)}>
          <Tabs.List>
            <Tabs.Trigger value="open">{text.openTab}</Tabs.Trigger>
            <Tabs.Trigger value="resolved">{text.resolvedTab}</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        <IssueTable
          events={issues.events}
          resolving={resolving}
          emptyText={status === "open" ? text.emptyOpen : text.emptyResolved}
        />
      </Dialog.Content>
    </Dialog.Root>
  );
}
