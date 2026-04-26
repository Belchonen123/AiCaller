import { CloneAgentTemplateClient } from "@/app/dashboard/agents/clone/clone-agent-template-client";

export default function CloneAgentTemplatePage() {
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Clone agent template</h1>
        <p className="text-sm text-muted-foreground">
          Save exported Retell JSON, dashboard-built agents, or future share links as reusable
          agency templates.
        </p>
      </div>
      <CloneAgentTemplateClient />
    </div>
  );
}
