"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { InfoIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type FieldValue = string | number | boolean | string[] | null;

type SaveFn = (field: string, value: FieldValue) => Promise<{ ok: boolean; message: string }>;

type FieldProps = {
  field: string;
  label: string;
  value: unknown;
  onSave: SaveFn;
  type?: "text" | "email" | "tel" | "date" | "number" | "textarea";
  required?: boolean;
  masked?: boolean;
  error?: string;
  tooltip?: string;
};

function stringify(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

export function AutoSaveField({
  field,
  label,
  value,
  onSave,
  type = "text",
  required,
  masked,
  error,
  tooltip,
}: FieldProps) {
  const [currentValue, setCurrentValue] = useState(stringify(value));
  const [showMasked, setShowMasked] = useState(masked);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [pending, startTransition] = useTransition();
  const id = `field-${field}`;

  function save() {
    const nextValue =
      type === "number" && currentValue !== "" ? Number(currentValue) : currentValue;

    startTransition(async () => {
      const result = await onSave(field, nextValue);
      if (result.ok) {
        setSavedAt(new Date());
      }

      if (!result.ok) {
        toast.error(result.message);
      }
    });
  }

  const inputType = showMasked ? "password" : type === "textarea" ? "text" : type;

  return (
    <div className={cn("grid gap-1.5", error && "border-l-2 border-danger-border pl-2")} data-field={field}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="inline-flex items-center gap-1.5">
          {label}
          {required ? <span className="text-danger-fg">*</span> : null}
          {tooltip ? (
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <InfoIcon className="size-3.5 text-fg-tertiary" />
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          ) : null}
        </Label>
        <span className="text-xs text-fg-tertiary">
          {pending ? "Saving..." : savedAt ? "Saved just now" : ""}
        </span>
      </div>
      {type === "textarea" ? (
        <Textarea
          id={id}
          value={currentValue}
          aria-invalid={!!error}
          onChange={(event) => setCurrentValue(event.target.value)}
          onBlur={save}
        />
      ) : (
        <div className="flex gap-2">
          <Input
            id={id}
            type={inputType}
            value={currentValue}
            aria-invalid={!!error}
            onChange={(event) => setCurrentValue(event.target.value)}
            onBlur={save}
          />
          {masked ? (
            <button
              type="button"
              className="rounded-lg border px-2 text-xs"
              onClick={() => setShowMasked((shown) => !shown)}
            >
              {showMasked ? "Reveal" : "Hide"}
            </button>
          ) : null}
        </div>
      )}
      {error ? <p className="text-xs text-danger-fg">{error}</p> : null}
    </div>
  );
}

export function AutoSaveSelect({
  field,
  label,
  value,
  options,
  onSave,
  error,
}: {
  field: string;
  label: string;
  value: unknown;
  options: readonly (readonly [string, string])[];
  onSave: SaveFn;
  error?: string;
}) {
  const [currentValue, setCurrentValue] = useState(stringify(value));
  const [pending, startTransition] = useTransition();

  function save(nextValue: string) {
    setCurrentValue(nextValue);
    startTransition(async () => {
      const result = await onSave(field, nextValue);
      if (!result.ok) {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="grid gap-1.5" data-field={field}>
      <Label>{label}</Label>
      <select
        value={currentValue}
        aria-invalid={!!error}
        className={cn(
          "h-8 rounded-lg border border-input bg-background px-2 text-sm",
          error && "border-destructive"
        )}
        onChange={(event) => save(event.target.value)}
      >
        <option value="">Not set</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">{pending ? "Saving..." : ""}</span>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function AutoSaveCheckbox({
  field,
  label,
  value,
  onSave,
  highlight,
}: {
  field: string;
  label: string;
  value: unknown;
  onSave: SaveFn;
  highlight?: boolean;
}) {
  const [checked, setChecked] = useState(value === true);
  const [pending, startTransition] = useTransition();

  function save(nextValue: boolean) {
    setChecked(nextValue);
    startTransition(async () => {
      const result = await onSave(field, nextValue);
      if (!result.ok) {
        toast.error(result.message);
      }
    });
  }

  return (
    <label
      className={cn(
        "flex items-center gap-2 rounded-lg border p-2 text-sm",
        highlight && checked && "border-amber-400 bg-amber-50 text-amber-950"
      )}
    >
      <Checkbox checked={checked} onCheckedChange={(next) => save(next === true)} />
      <span>{label}</span>
      <span className="ml-auto text-xs text-muted-foreground">
        {pending ? "Saving..." : ""}
      </span>
    </label>
  );
}

export function AutoSaveCheckboxGroup({
  field,
  label,
  value,
  options,
  onSave,
}: {
  field: string;
  label: string;
  value: unknown;
  options: readonly (readonly [string, string])[];
  onSave: SaveFn;
}) {
  const initial = Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  const [selected, setSelected] = useState<string[]>(initial);
  const [pending, startTransition] = useTransition();

  function toggle(option: string) {
    const nextValue = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];

    setSelected(nextValue);
    startTransition(async () => {
      const result = await onSave(field, nextValue);
      if (!result.ok) {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="grid gap-2" data-field={field}>
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map(([optionValue, optionLabel]) => (
          <label key={optionValue} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(optionValue)}
              onCheckedChange={() => toggle(optionValue)}
            />
            {optionLabel}
          </label>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{pending ? "Saving..." : ""}</span>
    </div>
  );
}
