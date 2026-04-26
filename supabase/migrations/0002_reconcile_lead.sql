alter table public.contacts
  add column if not exists updated_at timestamptz default now();

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row
  execute function public.set_updated_at();

create or replace function public.jsonb_populated_fields(
  p_table_name text,
  p_payload jsonb
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
  from jsonb_each(coalesce(p_payload, '{}'::jsonb)) as entry(key, value)
  where entry.value <> 'null'::jsonb
    and entry.value <> '""'::jsonb
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = p_table_name
        and column_name = entry.key
        and column_name not in ('id', 'tenant_id', 'lead_id', 'created_at', 'updated_at')
    )
$$;

create or replace function public.mask_value_if_phi(
  p_field_name text,
  p_value jsonb
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_text text;
  v_last4 text;
begin
  if p_value is null or p_value = 'null'::jsonb then
    return '';
  end if;

  v_text := trim(both '"' from p_value::text);

  if p_field_name in ('date_of_birth', 'dob') then
    return 'REDACTED';
  end if;

  if p_field_name in ('medicaid_id', 'medicare_id') then
    v_last4 := right(regexp_replace(v_text, '\D', '', 'g'), 4);
    return 'XXXX' || v_last4;
  end if;

  if p_field_name in (
    'address_street',
    'address_unit',
    'address_zip',
    'address',
    'home_address'
  ) then
    return 'REDACTED';
  end if;

  if p_field_name in ('phone', 'phone_alt', 'caller_phone', 'pcp_phone') then
    v_last4 := right(regexp_replace(v_text, '\D', '', 'g'), 4);
    return '(***) ***-' || v_last4;
  end if;

  return v_text;
end;
$$;

create or replace function public.merge_jsonb_null_fields(
  p_table_name text,
  p_row_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patch jsonb := public.jsonb_populated_fields(p_table_name, p_payload);
  v_entry record;
  v_existing jsonb;
  v_changed jsonb := '{}'::jsonb;
begin
  execute format('select to_jsonb(t) from public.%I t where id = $1', p_table_name)
    into v_existing
    using p_row_id;

  if v_existing is null then
    return v_changed;
  end if;

  for v_entry in select key, value from jsonb_each(v_patch)
  loop
    if v_existing -> v_entry.key = 'null'::jsonb then
      execute format(
        'update public.%I set %I = (jsonb_populate_record(null::public.%I, jsonb_build_object(%L, $1))).%I where id = $2 and %I is null',
        p_table_name,
        v_entry.key,
        p_table_name,
        v_entry.key,
        v_entry.key,
        v_entry.key
      )
      using v_entry.value, p_row_id;

      v_changed := v_changed || jsonb_build_object(v_entry.key, v_entry.value);
    end if;
  end loop;

  return v_changed;
end;
$$;

create or replace function public.insert_field_activity_rows(
  p_tenant_id uuid,
  p_lead_id uuid,
  p_changed_fields jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry record;
begin
  for v_entry in select key, value from jsonb_each(coalesce(p_changed_fields, '{}'::jsonb))
  loop
    insert into public.lead_activities (
      tenant_id,
      lead_id,
      activity_type,
      summary,
      detail
    )
    values (
      p_tenant_id,
      p_lead_id,
      'field_updated',
      v_entry.key || ' captured: ' || public.mask_value_if_phi(v_entry.key, v_entry.value),
      jsonb_build_object('field', v_entry.key)
    );
  end loop;
end;
$$;

create or replace function public.apply_reconciliation_flags(
  p_tenant_id uuid,
  p_lead_id uuid,
  p_red_flags jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(coalesce(p_red_flags, '[]'::jsonb)) = 'array'
    and jsonb_array_length(coalesce(p_red_flags, '[]'::jsonb)) > 0 then
    insert into public.lead_activities (
      tenant_id,
      lead_id,
      activity_type,
      summary,
      detail
    )
    values (
      p_tenant_id,
      p_lead_id,
      'flagged',
      'Red flags captured from call',
      jsonb_build_object('red_flags', p_red_flags)
    );

    update public.leads
    set urgency = coalesce(urgency, 'urgent')
    where id = p_lead_id
      and tenant_id = p_tenant_id
      and urgency is null;
  end if;
end;
$$;

create or replace function public.reconcile_lead_from_call(
  p_call_id uuid,
  p_tenant_id uuid,
  p_normalized_phone text default null
)
returns table (
  lead_id uuid,
  action text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_call public.intake_calls%rowtype;
  v_extraction jsonb;
  v_contact jsonb;
  v_prospective_client jsonb;
  v_caregiver_applicant jsonb;
  v_red_flags jsonb;
  v_summary text;
  v_lead_type text;
  v_urgency text;
  v_caller_phone text;
  v_contact_phone text;
  v_matched_lead_id uuid;
  v_contact_id uuid;
  v_client_id uuid;
  v_caregiver_id uuid;
  v_changed jsonb;
begin
  begin
    select *
    into v_call
    from public.intake_calls
    where id = p_call_id
      and tenant_id = p_tenant_id
    for update;

    if not found then
      raise exception 'intake call not found';
    end if;

    if v_call.extraction is null then
      raise exception 'extraction required';
    end if;

    v_extraction := v_call.extraction;
    v_contact := coalesce(v_extraction -> 'contact', '{}'::jsonb);
    v_prospective_client := coalesce(v_extraction -> 'prospective_client', '{}'::jsonb);
    v_caregiver_applicant := coalesce(v_extraction -> 'caregiver_applicant', '{}'::jsonb);
    v_red_flags := coalesce(v_extraction -> 'red_flags', '[]'::jsonb);
    v_summary := coalesce(nullif(v_extraction ->> 'summary', ''), 'Call received');
    v_lead_type := coalesce(nullif(v_extraction ->> 'lead_type', ''), 'other');
    v_urgency := nullif(v_extraction ->> 'urgency', '');
    v_caller_phone := coalesce(nullif(p_normalized_phone, ''), nullif(v_call.caller_phone_normalized, ''), nullif(v_call.caller_phone, ''));
    v_contact_phone := coalesce(nullif(p_normalized_phone, ''), nullif(v_contact ->> 'phone', ''), v_caller_phone);

    if v_lead_type not in ('client_referral', 'caregiver_applicant', 'existing_client', 'other') then
      v_lead_type := 'other';
    end if;

    if v_urgency not in ('emergent', 'urgent', 'routine', 'informational') then
      v_urgency := null;
    end if;

    if v_caller_phone is not null then
      select c.lead_id
      into v_matched_lead_id
      from public.contacts c
      where c.tenant_id = p_tenant_id
        and (c.phone = v_caller_phone or c.phone_alt = v_caller_phone)
        and greatest(c.created_at, coalesce(c.updated_at, c.created_at)) >= now() - interval '90 days'
      order by greatest(c.created_at, coalesce(c.updated_at, c.created_at)) desc
      limit 1;
    end if;

    if v_matched_lead_id is null
      and v_prospective_client <> '{}'::jsonb then
      if nullif(v_prospective_client ->> 'first_name', '') is not null
        and nullif(v_prospective_client ->> 'last_name', '') is not null
        and nullif(v_prospective_client ->> 'date_of_birth', '') is not null then
        select pc.lead_id
        into v_matched_lead_id
        from public.prospective_clients pc
        where pc.tenant_id = p_tenant_id
          and lower(pc.first_name) = lower(v_prospective_client ->> 'first_name')
          and lower(pc.last_name) = lower(v_prospective_client ->> 'last_name')
          and pc.date_of_birth = (v_prospective_client ->> 'date_of_birth')::date
        limit 1;
      elsif nullif(v_prospective_client ->> 'last_name', '') is not null
        and nullif(v_prospective_client ->> 'address_zip', '') is not null then
        select pc.lead_id
        into v_matched_lead_id
        from public.prospective_clients pc
        where pc.tenant_id = p_tenant_id
          and lower(pc.last_name) = lower(v_prospective_client ->> 'last_name')
          and pc.address_zip = v_prospective_client ->> 'address_zip'
        limit 1;
      end if;
    end if;

    if v_matched_lead_id is null then
      insert into public.leads (
        tenant_id,
        lead_type,
        lead_status,
        source,
        urgency,
        first_contact_at,
        last_contact_at
      )
      values (
        p_tenant_id,
        v_lead_type,
        'new',
        'phone_inbound',
        v_urgency,
        v_call.call_started_at,
        v_call.call_started_at
      )
      returning id into v_matched_lead_id;

      insert into public.contacts (
        tenant_id,
        lead_id,
        full_name,
        phone,
        phone_alt,
        email,
        relationship_to_client,
        is_primary_contact,
        is_poa,
        is_emergency_contact,
        preferred_contact_method,
        best_time_to_reach,
        notes
      )
      select
        p_tenant_id,
        v_matched_lead_id,
        nullif(v_contact ->> 'full_name', ''),
        v_contact_phone,
        nullif(v_contact ->> 'phone_alt', ''),
        nullif(v_contact ->> 'email', ''),
        nullif(v_contact ->> 'relationship_to_client', ''),
        true,
        coalesce(nullif(v_contact ->> 'is_poa', '')::boolean, false),
        coalesce(nullif(v_contact ->> 'is_emergency_contact', '')::boolean, false),
        nullif(v_contact ->> 'preferred_contact_method', ''),
        nullif(v_contact ->> 'best_time_to_reach', ''),
        nullif(v_contact ->> 'notes', '')
      where v_contact <> '{}'::jsonb or v_contact_phone is not null;

      if v_lead_type in ('client_referral', 'existing_client')
        and v_prospective_client <> '{}'::jsonb then
        insert into public.prospective_clients
        select *
        from jsonb_populate_record(
          null::public.prospective_clients,
          public.jsonb_populated_fields('prospective_clients', v_prospective_client)
          || jsonb_build_object('id', gen_random_uuid(), 'tenant_id', p_tenant_id, 'lead_id', v_matched_lead_id)
        );
      end if;

      if v_lead_type = 'caregiver_applicant'
        and v_caregiver_applicant <> '{}'::jsonb then
        insert into public.caregiver_applicants
        select *
        from jsonb_populate_record(
          null::public.caregiver_applicants,
          public.jsonb_populated_fields('caregiver_applicants', v_caregiver_applicant)
          || jsonb_build_object('id', gen_random_uuid(), 'tenant_id', p_tenant_id, 'lead_id', v_matched_lead_id)
        );
      end if;

      update public.intake_calls
      set lead_id = v_matched_lead_id,
          status = 'merged_into_lead'
      where id = p_call_id
        and tenant_id = p_tenant_id;

      insert into public.lead_activities (
        tenant_id,
        lead_id,
        activity_type,
        summary
      )
      values (
        p_tenant_id,
        v_matched_lead_id,
        'call_received',
        v_summary
      );

      perform public.apply_reconciliation_flags(p_tenant_id, v_matched_lead_id, v_red_flags);

      lead_id := v_matched_lead_id;
      action := 'created';
      return next;
      return;
    end if;

    update public.leads
    set last_contact_at = v_call.call_started_at
    where id = v_matched_lead_id
      and tenant_id = p_tenant_id;

    if v_caller_phone is not null then
      select id
      into v_contact_id
      from public.contacts
      where tenant_id = p_tenant_id
        and lead_id = v_matched_lead_id
        and (phone = v_caller_phone or phone_alt = v_caller_phone)
      order by created_at desc
      limit 1;

      if v_contact_id is null then
        insert into public.contacts (
          tenant_id,
          lead_id,
          full_name,
          phone,
          phone_alt,
          email,
          relationship_to_client,
          is_primary_contact,
          is_poa,
          is_emergency_contact,
          preferred_contact_method,
          best_time_to_reach,
          notes
        )
        select
          p_tenant_id,
          v_matched_lead_id,
          nullif(v_contact ->> 'full_name', ''),
          coalesce(v_contact_phone, v_caller_phone),
          nullif(v_contact ->> 'phone_alt', ''),
          nullif(v_contact ->> 'email', ''),
          nullif(v_contact ->> 'relationship_to_client', ''),
          false,
          coalesce(nullif(v_contact ->> 'is_poa', '')::boolean, false),
          coalesce(nullif(v_contact ->> 'is_emergency_contact', '')::boolean, false),
          nullif(v_contact ->> 'preferred_contact_method', ''),
          nullif(v_contact ->> 'best_time_to_reach', ''),
          nullif(v_contact ->> 'notes', '');
      else
        v_changed := public.merge_jsonb_null_fields(
          'contacts',
          v_contact_id,
          v_contact || jsonb_build_object('phone', v_caller_phone)
        );
        perform public.insert_field_activity_rows(p_tenant_id, v_matched_lead_id, v_changed);
      end if;
    end if;

    if v_prospective_client <> '{}'::jsonb then
      select id
      into v_client_id
      from public.prospective_clients
      where tenant_id = p_tenant_id
        and lead_id = v_matched_lead_id
      limit 1;

      if v_client_id is null then
        insert into public.prospective_clients
        select *
        from jsonb_populate_record(
          null::public.prospective_clients,
          public.jsonb_populated_fields('prospective_clients', v_prospective_client)
          || jsonb_build_object('id', gen_random_uuid(), 'tenant_id', p_tenant_id, 'lead_id', v_matched_lead_id)
        );
      else
        v_changed := public.merge_jsonb_null_fields(
          'prospective_clients',
          v_client_id,
          v_prospective_client
        );
        perform public.insert_field_activity_rows(p_tenant_id, v_matched_lead_id, v_changed);
      end if;
    end if;

    if v_caregiver_applicant <> '{}'::jsonb then
      select id
      into v_caregiver_id
      from public.caregiver_applicants
      where tenant_id = p_tenant_id
        and lead_id = v_matched_lead_id
      limit 1;

      if v_caregiver_id is null then
        insert into public.caregiver_applicants
        select *
        from jsonb_populate_record(
          null::public.caregiver_applicants,
          public.jsonb_populated_fields('caregiver_applicants', v_caregiver_applicant)
          || jsonb_build_object('id', gen_random_uuid(), 'tenant_id', p_tenant_id, 'lead_id', v_matched_lead_id)
        );
      else
        v_changed := public.merge_jsonb_null_fields(
          'caregiver_applicants',
          v_caregiver_id,
          v_caregiver_applicant
        );
        perform public.insert_field_activity_rows(p_tenant_id, v_matched_lead_id, v_changed);
      end if;
    end if;

    update public.intake_calls
    set lead_id = v_matched_lead_id,
        status = 'merged_into_lead'
    where id = p_call_id
      and tenant_id = p_tenant_id;

    insert into public.lead_activities (
      tenant_id,
      lead_id,
      activity_type,
      summary
    )
    values (
      p_tenant_id,
      v_matched_lead_id,
      'call_received',
      v_summary
    );

    perform public.apply_reconciliation_flags(p_tenant_id, v_matched_lead_id, v_red_flags);

    lead_id := v_matched_lead_id;
    action := 'merged';
    return next;
    return;
  exception
    when others then
      insert into public.call_events (
        tenant_id,
        call_id,
        lead_id,
        event_type,
        payload
      )
      values (
        p_tenant_id,
        p_call_id,
        v_matched_lead_id,
        'reconciliation_failed',
        jsonb_build_object('error', left(sqlerrm, 500))
      );

      return;
  end;
end;
$$;

revoke all on function public.reconcile_lead_from_call(uuid, uuid, text) from public;
grant execute on function public.reconcile_lead_from_call(uuid, uuid, text) to service_role;
