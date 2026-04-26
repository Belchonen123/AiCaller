import * as Papa from "papaparse";
import { normalizePhone } from "@/lib/phone";

const DEFAULT_MAX_ROWS = 5000;
const PHONE_COLUMN_CANDIDATES = ["phone", "to_phone", "number", "phone_number", "mobile", "cell"];
const NAME_COLUMN_CANDIDATES = ["name", "full_name", "contact_name", "client_name"];

export type ParsedCallTaskRow = {
  row_number: number;
  raw: Record<string, string>;
  to_phone: string | null;
  to_phone_raw: string;
  contact_name: string | null;
  merge_fields: Record<string, string>;
  errors: string[];
};

export type ParseResult = {
  rows: ParsedCallTaskRow[];
  accepted_count: number;
  rejected_count: number;
  headers: string[];
  warnings: string[];
};

type ParseOptions = {
  phone_column?: string;
  name_column?: string;
  max_rows?: number;
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function toMergeFieldKey(value: string) {
  return normalizeHeader(value).replace(/\s+/g, "_");
}

function resolveColumn(headers: string[], requested: string | undefined, candidates: string[]) {
  const normalizedHeaders = new Map(headers.map((header) => [normalizeHeader(header), header]));

  if (requested) {
    return normalizedHeaders.get(normalizeHeader(requested)) ?? null;
  }

  for (const candidate of candidates) {
    const match = normalizedHeaders.get(candidate);
    if (match) {
      return match;
    }
  }

  return null;
}

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, value === null || value === undefined ? "" : String(value)])
  );
}

function nameMergeFields(contactName: string | null) {
  if (!contactName) {
    return {};
  }

  const parts = contactName.trim().split(/\s+/).filter(Boolean);
  return {
    contact_name: contactName,
    full_name: contactName,
    first_name: parts[0] ?? contactName,
    last_name: parts.length > 1 ? parts.slice(1).join(" ") : "",
    client_name: contactName,
  };
}

export async function parseCallListCsv(
  csvText: string,
  options: ParseOptions = {}
): Promise<ParseResult> {
  const maxRows = options.max_rows ?? DEFAULT_MAX_ROWS;
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  const data = parsed.data ?? [];

  if (data.length > maxRows) {
    return {
      rows: [],
      accepted_count: 0,
      rejected_count: 0,
      headers: [],
      warnings: ["File exceeds max rows limit"],
    };
  }

  const headers = (parsed.meta.fields ?? []).filter(Boolean);
  const phoneColumn = resolveColumn(headers, options.phone_column, PHONE_COLUMN_CANDIDATES);
  const nameColumn = resolveColumn(headers, options.name_column, NAME_COLUMN_CANDIDATES);
  const warnings: string[] = [];
  const seenPhones = new Set<string>();
  let nonUsPhoneDetected = false;
  let missingNameCount = 0;

  if (!phoneColumn) {
    warnings.push(
      `No phone column detected - expected one of: ${PHONE_COLUMN_CANDIDATES.join(", ")}`
    );
  }

  const rows = data.map((row, index): ParsedCallTaskRow => {
    const raw = normalizeRow(row);
    const toPhoneRaw = phoneColumn ? raw[phoneColumn] ?? "" : "";
    const toPhone = toPhoneRaw ? normalizePhone(toPhoneRaw) : null;
    const contactName = nameColumn ? raw[nameColumn]?.trim() || null : null;
    const errors: string[] = [];

    if (!contactName) {
      missingNameCount += 1;
    }

    if (!toPhone) {
      errors.push("invalid phone");
    } else {
      if (seenPhones.has(toPhone)) {
        errors.push("duplicate in file");
      } else {
        seenPhones.add(toPhone);
      }

      if (!toPhone.startsWith("+1")) {
        nonUsPhoneDetected = true;
      }
    }

    const excludedColumns = new Set([phoneColumn, nameColumn].filter(Boolean));
    const mergeFields = Object.fromEntries(
      Object.entries(raw)
        .filter(([key]) => !excludedColumns.has(key))
        .map(([key, value]) => [toMergeFieldKey(key), value])
    );
    Object.assign(mergeFields, nameMergeFields(contactName));

    return {
      row_number: index + 1,
      raw,
      to_phone: toPhone,
      to_phone_raw: toPhoneRaw,
      contact_name: contactName,
      merge_fields: mergeFields,
      errors,
    };
  });

  if (nonUsPhoneDetected) {
    warnings.push("Non-US phone numbers detected");
  }

  if (rows.length > 0 && missingNameCount / rows.length > 0.1) {
    warnings.push(`${missingNameCount} rows missing names`);
  }

  return {
    rows,
    accepted_count: rows.filter((row) => row.errors.length === 0).length,
    rejected_count: rows.filter((row) => row.errors.length > 0).length,
    headers,
    warnings,
  };
}
