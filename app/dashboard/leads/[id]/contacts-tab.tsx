"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addContact,
  updateContactField,
} from "@/app/dashboard/leads/[id]/actions";
import type { Contact } from "@/app/dashboard/leads/[id]/types";
import {
  AutoSaveCheckbox,
  AutoSaveField,
  AutoSaveSelect,
  type FieldValue,
} from "@/app/dashboard/leads/[id]/field-components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const relationships = [
  ["self", "Self"],
  ["spouse", "Spouse"],
  ["adult_child", "Adult child"],
  ["parent", "Parent"],
  ["sibling", "Sibling"],
  ["other_family", "Other family"],
  ["friend", "Friend"],
  ["case_manager", "Case manager"],
  ["hospital_social_worker", "Hospital social worker"],
  ["referral_source", "Referral source"],
  ["poa_financial", "POA financial"],
  ["poa_medical", "POA medical"],
  ["guardian", "Guardian"],
  ["caregiver_applicant", "Caregiver applicant"],
  ["other", "Other"],
  ["unknown", "Unknown"],
] as const;

const methods = [
  ["phone", "Phone"],
  ["text", "Text"],
  ["email", "Email"],
  ["no_preference", "No preference"],
] as const;

export function ContactsTab({
  leadId,
  contacts,
}: {
  leadId: string;
  contacts: Contact[];
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await addContact({ leadId, fullName, phone });
      if (result.ok) {
        toast.success(result.message);
        setFullName("");
        setPhone("");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold">Add Contact</h2>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input
            value={fullName}
            placeholder="Full name"
            onChange={(event) => setFullName(event.target.value)}
          />
          <Input
            value={phone}
            placeholder="Phone"
            onChange={(event) => setPhone(event.target.value)}
          />
          <Button disabled={pending} onClick={submit}>
            Add contact
          </Button>
        </div>
      </section>

      {contacts.map((contact) => (
        <section
          key={contact.id}
          className="grid gap-4 rounded-xl border bg-background p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{contact.full_name || "Unnamed contact"}</h3>
            {contact.is_primary_contact ? <Badge>Primary</Badge> : null}
          </div>
          <ContactFields leadId={leadId} contact={contact} />
        </section>
      ))}
    </div>
  );
}

function ContactFields({ leadId, contact }: { leadId: string; contact: Contact }) {
  async function save(field: string, value: FieldValue) {
    return updateContactField({
      leadId,
      contactId: contact.id,
      field,
      value,
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AutoSaveField field="full_name" label="Name" value={contact.full_name} onSave={save} />
      <AutoSaveField field="phone" label="Phone" value={contact.phone} onSave={save} />
      <AutoSaveField field="email" label="Email" type="email" value={contact.email} onSave={save} />
      <AutoSaveSelect field="relationship_to_client" label="Relationship" value={contact.relationship_to_client} options={relationships} onSave={save} />
      <AutoSaveCheckbox field="is_primary_contact" label="Primary contact" value={contact.is_primary_contact} onSave={save} />
      <AutoSaveCheckbox field="is_poa" label="POA" value={contact.is_poa} onSave={save} />
      <AutoSaveCheckbox field="is_emergency_contact" label="Emergency contact" value={contact.is_emergency_contact} onSave={save} />
      <AutoSaveSelect field="preferred_contact_method" label="Preferred method" value={contact.preferred_contact_method} options={methods} onSave={save} />
      <AutoSaveField field="best_time_to_reach" label="Best time" value={contact.best_time_to_reach} onSave={save} />
      <AutoSaveField field="notes" label="Notes" type="textarea" value={contact.notes} onSave={save} />
    </div>
  );
}
