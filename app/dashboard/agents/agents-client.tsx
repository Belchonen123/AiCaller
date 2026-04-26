"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { FlaskConicalIcon, PhoneIncomingIcon, PhoneOutgoingIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import {
  deleteTemplate,
  duplicateTemplate,
  exportTemplate,
  saveRetellAgentAsTemplate,
  saveUploadedTemplate,
} from "@/app/dashboard/agents/actions";
import type {
  AgentTemplateRow,
  RetellAgentSummary,
  RetellVoiceSummary,
} from "@/app/dashboard/agents/types";
import { ImportTemplateDialog } from "@/app/dashboard/agents/import-dialog";
import { UploadTemplateDialog } from "@/app/dashboard/agents/upload-template-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type DialogMode =
  | "details"
  | "import"
  | "live-agents"
  | null;

type FilterOption = {
  value: string;
  label: string;
};

type AgentsClientProps = {
  systemTemplates: AgentTemplateRow[];
  tenantTemplates: AgentTemplateRow[];
  retellAgents: RetellAgentSummary[];
  retellVoices: RetellVoiceSummary[];
  tenantName: string;
  webhookBaseUrl: string;
};

function titleCase(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ") : "Unspecified";
}

function TemplateIcon({ category }: { category: string }) {
  const normalized = category.toLowerCase();
  const Icon = normalized.includes("outbound")
    ? PhoneOutgoingIcon
    : normalized.includes("test")
      ? FlaskConicalIcon
      : normalized.includes("special")
        ? SparklesIcon
        : PhoneIncomingIcon;

  return (
    <span className="grid size-10 place-items-center rounded-xl bg-bg-emphasis text-accent-primary">
      <Icon className="size-5" />
    </span>
  );
}

function prettyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function useTemplateFilters(templates: AgentTemplateRow[]) {
  const categories = useMemo(
    () => uniq(templates.map((template) => template.category)),
    [templates]
  );
  const purposes = useMemo(
    () => uniq(templates.map((template) => template.purpose)),
    [templates]
  );
  const tags = useMemo(
    () => uniq(templates.flatMap((template) => template.tags ?? [])),
    [templates]
  );

  return { categories, purposes, tags };
}

function filterTemplates(
  templates: AgentTemplateRow[],
  filters: {
    search: string;
    categories: string[];
    purposes: string[];
    tags: string[];
  }
) {
  const search = filters.search.trim().toLowerCase();

  return templates.filter((template) => {
    const haystack = [
      template.name,
      template.slug,
      template.description ?? "",
      ...(template.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();

    if (search && !haystack.includes(search)) {
      return false;
    }

    if (filters.categories.length && !filters.categories.includes(template.category)) {
      return false;
    }

    if (
      filters.purposes.length &&
      (!template.purpose || !filters.purposes.includes(template.purpose))
    ) {
      return false;
    }

    if (
      filters.tags.length &&
      !filters.tags.every((tag) => (template.tags ?? []).includes(tag))
    ) {
      return false;
    }

    return true;
  });
}

function MultiFilter({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (!options.length) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TemplateFilters({
  templates,
  search,
  setSearch,
  categories,
  setCategories,
  purposes,
  setPurposes,
  tags,
  setTags,
}: {
  templates: AgentTemplateRow[];
  search: string;
  setSearch: (value: string) => void;
  categories: string[];
  setCategories: (value: string[]) => void;
  purposes: string[];
  setPurposes: (value: string[]) => void;
  tags: string[];
  setTags: (value: string[]) => void;
}) {
  const options = useTemplateFilters(templates);
  const toggle = (values: string[], setter: (next: string[]) => void, value: string) => {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  return (
    <Card className="grid gap-3 p-4">
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search templates by name, slug, description, or tag"
      />
      <div className="grid gap-3 lg:grid-cols-3">
        <MultiFilter
          label="Category"
          options={options.categories.map((value) => ({ value, label: titleCase(value) }))}
          selected={categories}
          onToggle={(value) => toggle(categories, setCategories, value)}
        />
        <MultiFilter
          label="Purpose"
          options={options.purposes.map((value) => ({ value, label: titleCase(value) }))}
          selected={purposes}
          onToggle={(value) => toggle(purposes, setPurposes, value)}
        />
        <MultiFilter
          label="Tags"
          options={options.tags.map((value) => ({ value, label: value }))}
          selected={tags}
          onToggle={(value) => toggle(tags, setTags, value)}
        />
      </div>
    </Card>
  );
}

function TemplateCard({
  template,
  isCustom,
  onOpen,
  onExport,
  onDuplicate,
  onEdit,
  onDelete,
}: {
  template: AgentTemplateRow;
  isCustom: boolean;
  onOpen: (template: AgentTemplateRow, mode: DialogMode) => void;
  onExport: (template: AgentTemplateRow) => void;
  onDuplicate: (template: AgentTemplateRow) => void;
  onEdit: (template: AgentTemplateRow) => void;
  onDelete: (template: AgentTemplateRow) => void;
}) {
  const liveAgentCount = template.imported_agent_ids?.length ?? 0;

  return (
    <Card interactive elevation="raised" padding="compact" className="flex h-full flex-col gap-4 hover:-translate-y-0.5 hover:shadow-md">
      <div className="grid gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <TemplateIcon category={template.category} />
            <div className="min-w-0">
            <h3 className="font-medium">{template.name}</h3>
            <p className="font-mono text-xs text-muted-foreground">{template.slug}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {template.is_system ? <Badge variant="accent">OFFICIAL</Badge> : null}
            <Badge variant="neutral">v{template.version}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="neutral">{titleCase(template.category)}</Badge>
          <Badge variant="neutral">{titleCase(template.purpose)}</Badge>
          {liveAgentCount ? (
            <button type="button" onClick={() => onOpen(template, "live-agents")}>
              <Badge variant="success">
                Imported ({liveAgentCount})
              </Badge>
            </button>
          ) : null}
        </div>
      </div>
      <p className="line-clamp-3 text-sm text-muted-foreground">
        {template.description ?? "No description provided."}
      </p>
      <div className="flex flex-wrap gap-1">
        {(template.tags ?? []).map((tag) => (
          <Badge key={tag} variant="ghost">
            {tag}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {(template.required_variables ?? []).length} required variables
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => onOpen(template, "details")}>
          View
        </Button>
        <Button size="sm" onClick={() => onOpen(template, "import")}>
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={() => onDuplicate(template)}>
          Duplicate
        </Button>
        <Button variant="outline" size="sm" onClick={() => onExport(template)}>
          Export JSON
        </Button>
        {isCustom ? (
          <>
            <Button variant="outline" size="sm" onClick={() => onEdit(template)}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDelete(template)}>
              Delete
            </Button>
          </>
        ) : null}
      </div>
    </Card>
  );
}

function TemplateGrid({
  templates,
  isCustom,
  empty,
  onOpen,
  onExport,
  onDuplicate,
  onEdit,
  onDelete,
  emptyAction,
}: {
  templates: AgentTemplateRow[];
  isCustom: boolean;
  empty: string;
  onOpen: (template: AgentTemplateRow, mode: DialogMode) => void;
  onExport: (template: AgentTemplateRow) => void;
  onDuplicate: (template: AgentTemplateRow) => void;
  onEdit: (template: AgentTemplateRow) => void;
  onDelete: (template: AgentTemplateRow) => void;
  emptyAction?: ReactNode;
}) {
  if (!templates.length) {
    return (
      <Card className="items-center p-8 text-center">
        <SparklesIcon className="size-10 text-accent-primary" />
        <p className="font-medium">No templates yet</p>
        <p className="max-w-md text-sm text-muted-foreground">{empty}</p>
        {emptyAction ? <div className="mt-2 flex flex-wrap justify-center gap-2">{emptyAction}</div> : null}
      </Card>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          isCustom={isCustom}
          onOpen={onOpen}
          onExport={onExport}
          onDuplicate={onDuplicate}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function TemplateDetails({ template }: { template: AgentTemplateRow }) {
  return (
    <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Description</p>
        <p className="text-sm">{template.description ?? "No description provided."}</p>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Required variables</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {(template.required_variables ?? []).length ? (
              (template.required_variables ?? []).map((variable) => (
                <Badge key={variable} variant="outline">
                  {variable}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">None</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Default variables</p>
          <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-muted p-3 text-xs">
            {prettyJson(template.default_variables)}
          </pre>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Retell payload</p>
        <pre className="mt-1 max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs">
          {prettyJson(template.retell_payload)}
        </pre>
      </div>
    </div>
  );
}

function TemplateDialog({
  mode,
  template,
  onClose,
}: {
  mode: DialogMode;
  template: AgentTemplateRow | null;
  onClose: () => void;
}) {
  const open = Boolean(mode && mode !== "import" && template);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "details" && template?.name}
            {mode === "import" && "Import system template"}
            {mode === "live-agents" && "Live Retell agents"}
          </DialogTitle>
          <DialogDescription>{template?.slug}</DialogDescription>
        </DialogHeader>

        {template && mode === "details" ? <TemplateDetails template={template} /> : null}

        {template && mode === "live-agents" ? (
          <div className="grid gap-2">
            {(template.imported_agent_ids ?? []).map((agentId) => (
              <div
                key={agentId}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <span className="font-mono text-xs">{agentId}</span>
                <Badge variant="outline">Status check pending</Badge>
              </div>
            ))}
          </div>
        ) : null}

      </DialogContent>
    </Dialog>
  );
}

function NewTemplateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
          <DialogDescription>Create an agency-owned Retell template.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Input placeholder="Template name" />
          <Input placeholder="Slug, e.g. my-custom-agent" />
          <Textarea placeholder="Description" />
          <Textarea className="min-h-48 font-mono" placeholder="Paste Retell import-agent JSON" />
        </div>
        <DialogFooter>
          <Button onClick={() => toast.info("Template creation will run in the next step.")}>
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveRetellAgentDialog({
  open,
  onOpenChange,
  retellAgents,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retellAgents: RetellAgentSummary[];
}) {
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [pending, startTransition] = useTransition();
  const [payloadText, setPayloadText] = useState("");
  const [suggestedVariables, setSuggestedVariables] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("inbound");
  const [purpose, setPurpose] = useState("general");
  const [tags, setTags] = useState("retell,exported");
  const hasPreview = Boolean(payloadText);

  function parseTags(value: string) {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  function previewAgent() {
    startTransition(async () => {
      try {
        const result = await saveRetellAgentAsTemplate({
          retell_agent_id: selectedAgentId,
        });
        setPayloadText(JSON.stringify(result.payload, null, 2));
        setSuggestedVariables(result.suggested_variables);
        setIssues(result.issues);
        setName(result.metadata.name);
        setDescription(result.metadata.description);
        setCategory(result.metadata.category);
        setPurpose(result.metadata.purpose);
        setTags(result.metadata.tags.join(", "));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to export Retell agent.");
      }
    });
  }

  function saveTemplate() {
    startTransition(async () => {
      try {
        const payload = JSON.parse(payloadText) as unknown;
        await saveUploadedTemplate({
          metadata: {
            name,
            description,
            category,
            purpose,
            tags: parseTags(tags),
          },
          payload,
          required_variables: suggestedVariables.filter(
            (variable) => variable !== "webhook_base_url"
          ),
          default_variables: {},
        });
        toast.success("Template saved. You can now import it to Retell.");
        onOpenChange(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save template.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Save existing Retell agent</DialogTitle>
          <DialogDescription>
            Pick an existing Retell agent to export and save as an agency template.
          </DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
          {!hasPreview && retellAgents.length ? (
            retellAgents.map((agent) => (
              <label
                key={agent.agent_id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm"
              >
                <input
                  type="radio"
                  name="retellAgent"
                  value={agent.agent_id}
                  checked={selectedAgentId === agent.agent_id}
                  onChange={() => setSelectedAgentId(agent.agent_id)}
                />
                <span>
                  <span className="block font-medium">
                    {agent.agent_name ?? agent.agent_id}
                  </span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {agent.agent_id}
                  </span>
                </span>
              </label>
            ))
          ) : null}
          {!hasPreview && !retellAgents.length ? (
            <Card className="p-4 text-sm text-muted-foreground">
              No Retell agents were available from the API.
            </Card>
          ) : null}
          {hasPreview ? (
            <>
              {issues.length ? (
                <Card className="grid gap-1 p-3 text-sm text-muted-foreground">
                  {issues.map((issue) => (
                    <p key={issue}>{issue}</p>
                  ))}
                </Card>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={name} onChange={(event) => setName(event.target.value)} />
                <Input value={tags} onChange={(event) => setTags(event.target.value)} />
                <select
                  className="h-9 rounded-lg border bg-background px-2 text-sm"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                >
                  {["inbound", "outbound", "test", "specialty"].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <Input value={purpose} onChange={(event) => setPurpose(event.target.value)} />
              </div>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Description"
              />
              <div className="flex flex-wrap gap-1">
                {suggestedVariables.map((variable) => (
                  <Badge key={variable} variant="outline">
                    {variable}
                  </Badge>
                ))}
              </div>
              <Textarea
                className="min-h-72 font-mono text-xs"
                value={payloadText}
                onChange={(event) => setPayloadText(event.target.value)}
              />
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={!selectedAgentId}
            variant={hasPreview ? "outline" : "default"}
            onClick={hasPreview ? () => setPayloadText("") : previewAgent}
          >
            {hasPreview ? "Back" : pending ? "Exporting..." : "Export selected agent"}
          </Button>
          {hasPreview ? (
            <Button disabled={pending || !name.trim()} onClick={saveTemplate}>
              {pending ? "Saving..." : "Save as template"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTemplateDialog({
  template,
  open,
  onOpenChange,
}: {
  template: AgentTemplateRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [deleteRetellAgents, setDeleteRetellAgents] = useState(false);
  const [pending, startTransition] = useTransition();
  const count = template?.imported_agent_ids?.length ?? 0;

  function submit() {
    if (!template) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteTemplate({
          template_id: template.id,
          delete_retell_agents: deleteRetellAgents,
        });
        toast.success("Template deleted.");
        onOpenChange(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to delete template.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete template</DialogTitle>
          <DialogDescription>
            Linked Retell agents are not deleted automatically unless you choose that option.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <p className="text-sm">
            Delete <span className="font-medium">{template?.name}</span>? This cannot be undone.
          </p>
          {count ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={deleteRetellAgents}
                onChange={(event) => setDeleteRetellAgents(event.target.checked)}
              />
              Also delete the {count} Retell {count === 1 ? "agent" : "agents"} imported from
              this template
            </label>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={submit}>
            {pending ? "Deleting..." : "Delete template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AgentsClient({
  systemTemplates,
  tenantTemplates,
  retellAgents,
  retellVoices,
  tenantName,
  webhookBaseUrl,
}: AgentsClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplateRow | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgentTemplateRow | null>(null);
  const [systemSearch, setSystemSearch] = useState("");
  const [systemCategories, setSystemCategories] = useState<string[]>([]);
  const [systemPurposes, setSystemPurposes] = useState<string[]>([]);
  const [systemTags, setSystemTags] = useState<string[]>([]);
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantCategories, setTenantCategories] = useState<string[]>([]);
  const [tenantPurposes, setTenantPurposes] = useState<string[]>([]);
  const [tenantTags, setTenantTags] = useState<string[]>([]);
  const [newTemplateOpen, setNewTemplateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [saveRetellOpen, setSaveRetellOpen] = useState(false);

  const filteredSystemTemplates = useMemo(
    () =>
      filterTemplates(systemTemplates, {
        search: systemSearch,
        categories: systemCategories,
        purposes: systemPurposes,
        tags: systemTags,
      }),
    [systemCategories, systemPurposes, systemSearch, systemTags, systemTemplates]
  );
  const filteredTenantTemplates = useMemo(
    () =>
      filterTemplates(tenantTemplates, {
        search: tenantSearch,
        categories: tenantCategories,
        purposes: tenantPurposes,
        tags: tenantTags,
      }),
    [tenantCategories, tenantPurposes, tenantSearch, tenantTags, tenantTemplates]
  );

  function openTemplate(template: AgentTemplateRow, mode: DialogMode) {
    setSelectedTemplate(template);
    setDialogMode(mode);
  }

  function closeTemplateDialog() {
    setSelectedTemplate(null);
    setDialogMode(null);
  }

  function exportTemplateJson(template: AgentTemplateRow) {
    startTransition(async () => {
      try {
        const result = await exportTemplate({ template_id: template.id });
        const blob = new Blob([prettyJson(result.payload)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${template.slug}-v${template.version}.json`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to export template.");
      }
    });
  }

  function duplicateTemplateCard(template: AgentTemplateRow) {
    startTransition(async () => {
      try {
        const result = await duplicateTemplate({ template_id: template.id });
        toast.success("Template duplicated.");
        router.push(`/dashboard/agents/${result.template_id}/edit`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to duplicate template.");
      }
    });
  }

  function editTemplate(template: AgentTemplateRow) {
    router.push(`/dashboard/agents/${template.id}/edit`);
  }

  return (
    <div className="grid gap-8">
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold">System templates</h2>
          <p className="text-sm text-muted-foreground">
            Read-only templates seeded by Anthropic and available to every agency.
          </p>
        </div>
        <TemplateFilters
          templates={systemTemplates}
          search={systemSearch}
          setSearch={setSystemSearch}
          categories={systemCategories}
          setCategories={setSystemCategories}
          purposes={systemPurposes}
          setPurposes={setSystemPurposes}
          tags={systemTags}
          setTags={setSystemTags}
        />
        <TemplateGrid
          templates={filteredSystemTemplates}
          isCustom={false}
          empty="No system templates match the current filters."
          onOpen={openTemplate}
          onExport={exportTemplateJson}
          onDuplicate={duplicateTemplateCard}
          onEdit={editTemplate}
          onDelete={setDeleteTarget}
        />
      </section>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">My templates</h2>
            <p className="text-sm text-muted-foreground">
              Agency-owned templates you can edit, duplicate, import, and export.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(true)}>
              Import from JSON file
            </Button>
            <Button variant="outline" onClick={() => setSaveRetellOpen(true)}>
              Save a Retell agent as template
            </Button>
            <Button onClick={() => setNewTemplateOpen(true)}>New template</Button>
          </div>
        </div>
        <TemplateFilters
          templates={tenantTemplates}
          search={tenantSearch}
          setSearch={setTenantSearch}
          categories={tenantCategories}
          setCategories={setTenantCategories}
          purposes={tenantPurposes}
          setPurposes={setTenantPurposes}
          tags={tenantTags}
          setTags={setTenantTags}
        />
        <TemplateGrid
          templates={filteredTenantTemplates}
          isCustom
          empty="Import one of the system templates or upload your own JSON file."
          onOpen={openTemplate}
          onExport={exportTemplateJson}
          onDuplicate={duplicateTemplateCard}
          onEdit={editTemplate}
          onDelete={setDeleteTarget}
          emptyAction={
            <>
              <Button variant="secondary" onClick={() => setUploadOpen(true)}>
                Import JSON
              </Button>
              <Button onClick={() => setNewTemplateOpen(true)}>New template</Button>
            </>
          }
        />
      </section>

      <TemplateDialog
        mode={dialogMode}
        template={selectedTemplate}
        onClose={closeTemplateDialog}
      />
      <ImportTemplateDialog
        open={dialogMode === "import"}
        onOpenChange={(open) => {
          if (!open) {
            closeTemplateDialog();
          }
        }}
        template={selectedTemplate}
        tenantName={tenantName}
        webhookBaseUrl={webhookBaseUrl}
        voices={retellVoices}
      />
      <NewTemplateDialog open={newTemplateOpen} onOpenChange={setNewTemplateOpen} />
      <UploadTemplateDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onImportSavedTemplate={(template) => openTemplate(template, "import")}
      />
      <SaveRetellAgentDialog
        open={saveRetellOpen}
        onOpenChange={setSaveRetellOpen}
        retellAgents={retellAgents}
      />
      <DeleteTemplateDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        template={deleteTarget}
      />
      {pending ? <span className="sr-only">Template action in progress</span> : null}
    </div>
  );
}
