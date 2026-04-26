create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  name text not null,
  description text,
  purpose text not null default 'test' check (purpose in ('reengagement','followup','referral_followup','caregiver_recruitment','eligibility_check','general_outreach','test')),
  agent_id text not null,
  from_phone text not null,
  script_variables jsonb default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','running','paused','completed','cancelled')),
  max_concurrent int not null default 1,
  max_attempts_per_task int not null default 3,
  retry_delay_minutes int not null default 60,
  call_window_start time default '09:00:00',
  call_window_end time default '20:00:00',
  call_window_timezone text default 'America/Detroit',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table public.call_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  to_phone text not null,
  to_phone_raw text,
  contact_name text,
  merge_fields jsonb default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','scheduled','in_progress','completed','failed','voicemail','no_answer','busy','cancelled','skipped_window')),
  attempts int not null default 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  last_retell_call_id text,
  disposition text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.call_upload_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  uploaded_by uuid references public.profiles(id),
  filename text,
  row_count_total int not null default 0,
  row_count_accepted int not null default 0,
  row_count_rejected int not null default 0,
  rejected_rows jsonb,
  created_at timestamptz default now()
);

alter table public.leads
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.intake_calls
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists call_task_id uuid references public.call_tasks(id) on delete set null;

alter table public.call_events
  alter column call_id drop not null;

create index campaigns_tenant_status_created_at_idx
  on public.campaigns (tenant_id, status, created_at desc);
create index call_tasks_tenant_campaign_status_idx
  on public.call_tasks (tenant_id, campaign_id, status);
create index call_tasks_tenant_status_next_attempt_idx
  on public.call_tasks (tenant_id, status, next_attempt_at);
create index call_tasks_tenant_to_phone_idx
  on public.call_tasks (tenant_id, to_phone);
create index call_tasks_last_retell_call_id_idx
  on public.call_tasks (last_retell_call_id)
  where last_retell_call_id is not null;
create index intake_calls_campaign_id_idx
  on public.intake_calls (campaign_id)
  where campaign_id is not null;
create index intake_calls_call_task_id_idx
  on public.intake_calls (call_task_id)
  where call_task_id is not null;
create index call_upload_batches_tenant_created_at_idx
  on public.call_upload_batches (tenant_id, created_at desc);

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row
  execute function public.set_updated_at();

create trigger call_tasks_set_updated_at
  before update on public.call_tasks
  for each row
  execute function public.set_updated_at();

alter table public.campaigns enable row level security;
alter table public.call_tasks enable row level security;
alter table public.call_upload_batches enable row level security;

create policy "tenant members can select campaigns"
  on public.campaigns for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can insert campaigns"
  on public.campaigns for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can update campaigns"
  on public.campaigns for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can delete campaigns"
  on public.campaigns for delete
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can select call tasks"
  on public.call_tasks for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can insert call tasks"
  on public.call_tasks for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can update call tasks"
  on public.call_tasks for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can delete call tasks"
  on public.call_tasks for delete
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can select call upload batches"
  on public.call_upload_batches for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can insert call upload batches"
  on public.call_upload_batches for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can update call upload batches"
  on public.call_upload_batches for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can delete call upload batches"
  on public.call_upload_batches for delete
  using (tenant_id = public.current_tenant_id());

create or replace function public.record_campaign_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.call_events (
    tenant_id,
    call_id,
    lead_id,
    event_type,
    payload
  )
  values (
    new.tenant_id,
    null,
    null,
    'campaign_status_change',
    jsonb_build_object(
      'from', old.status,
      'to', new.status,
      'campaign_id', new.id
    )
  );

  return new;
end;
$$;

create trigger campaigns_record_status_change
  after update on public.campaigns
  for each row
  when (old.status is distinct from new.status)
  execute function public.record_campaign_status_change();

create or replace function public.claim_next_call_tasks(
  p_tenant_id uuid,
  p_campaign_id uuid,
  p_limit int
)
returns setof public.call_tasks
language sql
security definer
set search_path = public
as $$
  with candidates as (
    select id
    from public.call_tasks
    where tenant_id = p_tenant_id
      and campaign_id = p_campaign_id
      and (
        status = 'queued'
        or (status = 'scheduled' and next_attempt_at <= now())
      )
    order by coalesce(next_attempt_at, created_at), created_at
    limit greatest(p_limit, 0)
    for update skip locked
  ),
  claimed as (
    update public.call_tasks task
    set status = 'in_progress',
        attempts = task.attempts + 1,
        last_attempt_at = now(),
        updated_at = now()
    from candidates
    where task.id = candidates.id
    returning task.*
  )
  select *
  from claimed;
$$;

revoke all on function public.claim_next_call_tasks(uuid, uuid, int) from public;
grant execute on function public.claim_next_call_tasks(uuid, uuid, int) to service_role;

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
  v_call_task_disposition text;
  v_effective_campaign_id uuid;
  v_task_campaign_id uuid;
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
    v_effective_campaign_id := v_call.campaign_id;
    v_call_task_disposition := case
      when v_call.disconnect_reason is null then 'answered_completed'
      when lower(v_call.disconnect_reason) like '%voicemail%' then 'voicemail_left'
      when lower(v_call.disconnect_reason) like '%busy%' then 'busy'
      when lower(v_call.disconnect_reason) like '%no%answer%' then 'no_answer'
      when lower(v_call.disconnect_reason) like '%invalid%'
        or lower(v_call.disconnect_reason) like '%bad%number%' then 'bad_number'
      else lower(regexp_replace(v_call.disconnect_reason, '[^a-zA-Z0-9]+', '_', 'g'))
    end;

    if v_call.call_task_id is not null then
      select campaign_id
      into v_task_campaign_id
      from public.call_tasks
      where id = v_call.call_task_id
        and tenant_id = p_tenant_id;

      v_effective_campaign_id := coalesce(v_effective_campaign_id, v_task_campaign_id);
    end if;

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
          campaign_id = coalesce(campaign_id, v_effective_campaign_id),
          status = 'merged_into_lead'
      where id = p_call_id
        and tenant_id = p_tenant_id;

      if v_call.call_task_id is not null then
        update public.leads
        set metadata = coalesce(metadata, '{}'::jsonb)
            || jsonb_build_object(
              'campaign_id', v_effective_campaign_id,
              'call_task_id', v_call.call_task_id
            )
        where id = v_matched_lead_id
          and tenant_id = p_tenant_id;

        update public.call_tasks
        set lead_id = v_matched_lead_id,
            status = 'completed',
            disposition = v_call_task_disposition,
            last_retell_call_id = coalesce(v_call.retell_call_id, last_retell_call_id),
            updated_at = now()
        where id = v_call.call_task_id
          and tenant_id = p_tenant_id;
      end if;

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
        campaign_id = coalesce(campaign_id, v_effective_campaign_id),
        status = 'merged_into_lead'
    where id = p_call_id
      and tenant_id = p_tenant_id;

    if v_call.call_task_id is not null then
      update public.leads
      set metadata = coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'campaign_id', v_effective_campaign_id,
            'call_task_id', v_call.call_task_id
          )
      where id = v_matched_lead_id
        and tenant_id = p_tenant_id;

      update public.call_tasks
      set lead_id = v_matched_lead_id,
          status = 'completed',
          disposition = v_call_task_disposition,
          last_retell_call_id = coalesce(v_call.retell_call_id, last_retell_call_id),
          updated_at = now()
      where id = v_call.call_task_id
        and tenant_id = p_tenant_id;
    end if;

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
