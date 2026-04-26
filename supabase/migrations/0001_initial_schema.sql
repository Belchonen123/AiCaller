create extension if not exists pgcrypto;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  agency_phone text,
  agency_address text,
  created_at timestamptz default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id),
  full_name text,
  email text not null,
  role text not null default 'staff' check (role in ('owner','admin','intake','scheduler','hr','staff')),
  created_at timestamptz default now(),
  unique (id, tenant_id)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  lead_type text not null default 'client_referral' check (lead_type in ('client_referral','caregiver_applicant','existing_client','other')),
  lead_status text not null default 'new' check (lead_status in ('new','contacted','info_gathering','pending_eligibility','scheduled_assessment','assessment_complete','pending_auth','authorized','enrolled','disqualified','lost','on_hold')),
  source text check (source in ('phone_inbound','web_form','referral_partner','case_manager','hospital_discharge','family_referral','returning_client','other','unknown')),
  referral_partner_name text,
  urgency text check (urgency in ('emergent','urgent','routine','informational')),
  assigned_to uuid references public.profiles(id),
  next_followup_at timestamptz,
  first_contact_at timestamptz default now(),
  last_contact_at timestamptz default now(),
  disqualified_reason text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (id, tenant_id),
  constraint leads_assigned_to_tenant_fk
    foreign key (assigned_to, tenant_id) references public.profiles(id, tenant_id)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  lead_id uuid not null references public.leads(id) on delete cascade,
  full_name text,
  phone text,
  phone_alt text,
  email text,
  relationship_to_client text check (relationship_to_client in ('self','spouse','adult_child','parent','sibling','other_family','friend','case_manager','hospital_social_worker','referral_source','poa_financial','poa_medical','guardian','caregiver_applicant','other','unknown')),
  is_primary_contact boolean default false,
  is_poa boolean default false,
  is_emergency_contact boolean default false,
  preferred_contact_method text check (preferred_contact_method in ('phone','text','email','no_preference')),
  best_time_to_reach text,
  notes text,
  created_at timestamptz default now(),
  constraint contacts_lead_tenant_fk
    foreign key (lead_id, tenant_id) references public.leads(id, tenant_id) on delete cascade
);

create table public.prospective_clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  first_name text,
  last_name text,
  preferred_name text,
  date_of_birth date,
  age int check (age is null or age >= 0),
  gender text check (gender in ('male','female','nonbinary','prefer_not_to_say','unknown')),
  marital_status text check (marital_status in ('single','married','partnered','divorced','widowed','separated','unknown')),
  primary_language text,
  requires_interpreter boolean default false,
  interpreter_language text,
  ethnicity text,
  veteran_status boolean,
  address_street text,
  address_unit text,
  address_city text,
  address_state text default 'MI',
  address_zip text,
  county text,
  lives_with text,
  home_type text check (home_type in ('house','apartment','condo','mobile_home','assisted_living','adult_foster_care','group_home','family_home','other','unknown')),
  stairs_to_enter boolean,
  pets_in_home text,
  smoking_in_home boolean,
  home_safety_concerns text,
  medicaid_id text,
  medicare_id text,
  ssn_last4 text check (ssn_last4 is null or ssn_last4 ~ '^[0-9]{4}$'),
  ss_benefits_receiving boolean,
  has_pcp boolean,
  pcp_name text,
  pcp_phone text,
  pcp_practice text,
  recent_hospitalization boolean,
  recent_hospitalization_detail text,
  primary_payer text check (primary_payer in ('medicaid_home_help','mi_choice_waiver','mco_meridian','mco_molina','mco_hap','mco_aetna_better_health','mco_priority_health','mco_united_community','mco_bcbs_complete','mco_other','medicare','medicare_advantage','private_pay','ltc_insurance','va','dual_eligible','self_pay_pending_medicaid','unknown','not_discussed')),
  mco_plan_name text,
  medicaid_active boolean,
  medicaid_pending boolean,
  has_mi_choice_waiver boolean,
  has_medicare_advantage boolean,
  ltc_policy_carrier text,
  va_benefits boolean,
  estimated_monthly_budget_private_pay numeric check (estimated_monthly_budget_private_pay is null or estimated_monthly_budget_private_pay >= 0),
  adl_bathing text check (adl_bathing in ('independent','supervision','partial_assist','total_assist','unknown')),
  adl_dressing text check (adl_dressing in ('independent','supervision','partial_assist','total_assist','unknown')),
  adl_grooming text check (adl_grooming in ('independent','supervision','partial_assist','total_assist','unknown')),
  adl_toileting text check (adl_toileting in ('independent','supervision','partial_assist','total_assist','unknown')),
  adl_transferring text check (adl_transferring in ('independent','supervision','partial_assist','total_assist','unknown')),
  adl_eating text check (adl_eating in ('independent','supervision','partial_assist','total_assist','unknown')),
  continence_bladder text check (continence_bladder in ('continent','occasional_incontinence','frequent_incontinence','total_incontinence','catheter','ostomy','unknown')),
  continence_bowel text check (continence_bowel in ('continent','occasional_incontinence','frequent_incontinence','total_incontinence','ostomy','unknown')),
  iadl_meal_prep text check (iadl_meal_prep in ('independent','needs_help','total_assist','unknown')),
  iadl_light_housework text check (iadl_light_housework in ('independent','needs_help','total_assist','unknown')),
  iadl_laundry text check (iadl_laundry in ('independent','needs_help','total_assist','unknown')),
  iadl_shopping text check (iadl_shopping in ('independent','needs_help','total_assist','unknown')),
  iadl_medication_reminders text check (iadl_medication_reminders in ('independent','needs_help','total_assist','unknown')),
  iadl_transportation text check (iadl_transportation in ('independent','needs_help','total_assist','unknown')),
  mobility_status text check (mobility_status in ('ambulatory','cane','walker','wheelchair_manual','wheelchair_power','bed_bound','unknown')),
  uses_oxygen boolean,
  fall_risk boolean,
  falls_last_90_days int check (falls_last_90_days is null or falls_last_90_days >= 0),
  medical_equipment text,
  cognitive_status text check (cognitive_status in ('intact','mild_impairment','moderate_impairment','severe_impairment','unknown')),
  has_dementia_diagnosis boolean,
  behavioral_concerns text,
  mental_health_history text,
  primary_diagnosis text,
  secondary_diagnoses text,
  medications_count int check (medications_count is null or medications_count >= 0),
  medication_list text,
  requested_services text[] check (
    requested_services is null
    or requested_services <@ array['personal_care','meal_prep','light_housework','laundry','shopping','medication_reminders','transportation','companionship','respite_care','other']::text[]
  ),
  requested_hours_per_week numeric check (requested_hours_per_week is null or requested_hours_per_week >= 0),
  requested_start_date date,
  preferred_schedule text,
  preferred_caregiver_gender text check (preferred_caregiver_gender in ('female','male','no_preference')),
  preferred_caregiver_language text,
  caregiver_notes text,
  family_caregiver_available boolean,
  family_caregiver_relationship text,
  family_caregiver_wants_to_be_paid boolean,
  currently_receiving_services boolean,
  current_agency_name text,
  reason_for_change text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint prospective_clients_lead_tenant_fk
    foreign key (lead_id, tenant_id) references public.leads(id, tenant_id) on delete cascade
);

create table public.caregiver_applicants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  email text,
  address_city text,
  address_state text default 'MI',
  address_zip text,
  date_of_birth date,
  has_drivers_license boolean,
  has_reliable_transportation boolean,
  willing_to_travel_miles int check (willing_to_travel_miles is null or willing_to_travel_miles >= 0),
  years_experience numeric check (years_experience is null or years_experience >= 0),
  experience_types text[] check (
    experience_types is null
    or experience_types <@ array['personal_care','dementia','hospice','pediatric','behavioral','companion']::text[]
  ),
  cna_certified boolean,
  hha_certified boolean,
  cpr_certified boolean,
  first_aid_certified boolean,
  languages_spoken text[],
  hours_per_week_sought int check (hours_per_week_sought is null or hours_per_week_sought >= 0),
  availability text,
  has_been_in_champs boolean,
  willing_to_enroll_in_champs boolean,
  referred_by text,
  relationship_to_prospective_client text,
  willing_background_check boolean,
  status text default 'new' check (status in ('new','phone_screened','interview_scheduled','interview_complete','background_pending','cleared','hired','rejected','withdrew')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint caregiver_applicants_lead_tenant_fk
    foreign key (lead_id, tenant_id) references public.leads(id, tenant_id) on delete cascade
);

create table public.intake_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  lead_id uuid references public.leads(id) on delete set null,
  retell_call_id text unique not null,
  caller_phone text,
  caller_phone_normalized text,
  call_started_at timestamptz,
  call_ended_at timestamptz,
  duration_seconds int check (duration_seconds is null or duration_seconds >= 0),
  transcript text,
  recording_url text,
  disconnect_reason text,
  call_direction text default 'inbound' check (call_direction in ('inbound','outbound')),
  status text not null default 'received' check (status in ('received','extracted','reviewed','merged_into_lead')),
  extraction jsonb,
  extraction_confidence text check (extraction_confidence in ('high','medium','low')),
  manually_edited boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (id, tenant_id),
  constraint intake_calls_lead_tenant_fk
    foreign key (lead_id, tenant_id) references public.leads(id, tenant_id) on delete set null (lead_id)
);

create table public.call_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  call_id uuid references public.intake_calls(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  event_type text not null,
  payload jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  constraint call_events_call_tenant_fk
    foreign key (call_id, tenant_id) references public.intake_calls(id, tenant_id) on delete cascade,
  constraint call_events_lead_tenant_fk
    foreign key (lead_id, tenant_id) references public.leads(id, tenant_id) on delete cascade,
  constraint call_events_created_by_tenant_fk
    foreign key (created_by, tenant_id) references public.profiles(id, tenant_id)
);

create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  lead_id uuid not null references public.leads(id) on delete cascade,
  activity_type text not null check (activity_type in ('status_change','note','assignment','call_received','call_made','email_sent','sms_sent','document_received','field_updated','merged','flagged')),
  summary text not null,
  detail jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  constraint lead_activities_lead_tenant_fk
    foreign key (lead_id, tenant_id) references public.leads(id, tenant_id) on delete cascade,
  constraint lead_activities_created_by_tenant_fk
    foreign key (created_by, tenant_id) references public.profiles(id, tenant_id)
);

create index leads_tenant_status_last_contact_idx
  on public.leads (tenant_id, lead_status, last_contact_at desc);
create index leads_tenant_type_status_idx
  on public.leads (tenant_id, lead_type, lead_status);
create index leads_tenant_assigned_to_idx
  on public.leads (tenant_id, assigned_to);
create index leads_tenant_next_followup_idx
  on public.leads (tenant_id, next_followup_at)
  where next_followup_at is not null;
create index contacts_lead_id_idx
  on public.contacts (lead_id);
create index contacts_tenant_phone_idx
  on public.contacts (tenant_id, phone);
create index prospective_clients_lead_id_idx
  on public.prospective_clients (lead_id);
create index caregiver_applicants_lead_id_idx
  on public.caregiver_applicants (lead_id);
create index intake_calls_tenant_created_at_idx
  on public.intake_calls (tenant_id, created_at desc);
create index intake_calls_lead_id_idx
  on public.intake_calls (lead_id);
create index intake_calls_retell_call_id_idx
  on public.intake_calls (retell_call_id);
create index intake_calls_caller_phone_normalized_idx
  on public.intake_calls (caller_phone_normalized);
create index lead_activities_lead_created_at_idx
  on public.lead_activities (lead_id, created_at desc);

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.create_owner_account(
  p_agency_name text,
  p_full_name text,
  p_email text
)
returns table (
  tenant_id uuid,
  profile_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
begin
  if v_user_id is null then
    raise exception 'authenticated user required';
  end if;

  if nullif(btrim(p_agency_name), '') is null then
    raise exception 'agency name is required';
  end if;

  if exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'profile already exists';
  end if;

  insert into public.tenants (name)
  values (btrim(p_agency_name))
  returning id into v_tenant_id;

  insert into public.profiles (id, tenant_id, full_name, email, role)
  values (
    v_user_id,
    v_tenant_id,
    nullif(btrim(p_full_name), ''),
    lower(btrim(p_email)),
    'owner'
  );

  return query select v_tenant_id, v_user_id;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
  before update on public.leads
  for each row
  execute function public.set_updated_at();

create trigger prospective_clients_set_updated_at
  before update on public.prospective_clients
  for each row
  execute function public.set_updated_at();

create trigger caregiver_applicants_set_updated_at
  before update on public.caregiver_applicants
  for each row
  execute function public.set_updated_at();

create trigger intake_calls_set_updated_at
  before update on public.intake_calls
  for each row
  execute function public.set_updated_at();

create or replace function public.record_lead_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := public.current_profile_id();
begin
  if old.lead_status is distinct from new.lead_status then
    insert into public.lead_activities (
      tenant_id,
      lead_id,
      activity_type,
      summary,
      detail,
      created_by
    )
    values (
      new.tenant_id,
      new.id,
      'status_change',
      'Status changed from ' || old.lead_status || ' to ' || new.lead_status,
      jsonb_build_object('from', old.lead_status, 'to', new.lead_status),
      actor_id
    );
  end if;

  if old.assigned_to is distinct from new.assigned_to then
    insert into public.lead_activities (
      tenant_id,
      lead_id,
      activity_type,
      summary,
      detail,
      created_by
    )
    values (
      new.tenant_id,
      new.id,
      'assignment',
      'Assignment changed',
      jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to),
      actor_id
    );
  end if;

  return new;
end;
$$;

create trigger leads_record_changes
  after update on public.leads
  for each row
  when (
    old.lead_status is distinct from new.lead_status
    or old.assigned_to is distinct from new.assigned_to
  )
  execute function public.record_lead_changes();

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.contacts enable row level security;
alter table public.prospective_clients enable row level security;
alter table public.caregiver_applicants enable row level security;
alter table public.intake_calls enable row level security;
alter table public.call_events enable row level security;
alter table public.lead_activities enable row level security;

create policy "tenant members can select tenant"
  on public.tenants for select
  using (id = public.current_tenant_id());

create policy "tenant members can insert tenant"
  on public.tenants for insert
  with check (id = public.current_tenant_id());

create policy "tenant members can update tenant"
  on public.tenants for update
  using (id = public.current_tenant_id())
  with check (id = public.current_tenant_id());

create policy "tenant members can select profiles"
  on public.profiles for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can insert profiles"
  on public.profiles for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can update profiles"
  on public.profiles for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can select leads"
  on public.leads for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can insert leads"
  on public.leads for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can update leads"
  on public.leads for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can select contacts"
  on public.contacts for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can insert contacts"
  on public.contacts for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can update contacts"
  on public.contacts for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can select prospective clients"
  on public.prospective_clients for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can insert prospective clients"
  on public.prospective_clients for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can update prospective clients"
  on public.prospective_clients for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can select caregiver applicants"
  on public.caregiver_applicants for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can insert caregiver applicants"
  on public.caregiver_applicants for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can update caregiver applicants"
  on public.caregiver_applicants for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can select intake calls"
  on public.intake_calls for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can insert intake calls"
  on public.intake_calls for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can update intake calls"
  on public.intake_calls for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can select call events"
  on public.call_events for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can insert call events"
  on public.call_events for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can update call events"
  on public.call_events for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can select lead activities"
  on public.lead_activities for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can insert lead activities"
  on public.lead_activities for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can update lead activities"
  on public.lead_activities for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

revoke all on function public.create_owner_account(text, text, text) from public;
grant execute on function public.create_owner_account(text, text, text) to authenticated;

/*
Seed data for local demo setup.

Uncomment after first signup and replace the profile id/email with the
synthetic demo user created in Supabase Auth.

with demo_tenant as (
  insert into public.tenants (id, name, agency_phone, agency_address)
  values (
    '00000000-0000-0000-0000-000000000001',
    'Demo Home Care Agency',
    '+15550101000',
    '100 Demo Street, Lansing, MI 48933'
  )
  returning id
),
demo_owner as (
  insert into public.profiles (id, tenant_id, full_name, email, role)
  values (
    '00000000-0000-0000-0000-000000000010',
    (select id from demo_tenant),
    'Demo Owner',
    'demo-owner@example.com',
    'owner'
  )
  returning tenant_id
),
sample_leads as (
  insert into public.leads (
    tenant_id,
    lead_type,
    lead_status,
    source,
    urgency,
    notes
  )
  values
    ((select tenant_id from demo_owner), 'client_referral', 'new', 'phone_inbound', 'routine', 'Synthetic demo referral.'),
    ((select tenant_id from demo_owner), 'client_referral', 'info_gathering', 'case_manager', 'urgent', 'Synthetic case manager referral.'),
    ((select tenant_id from demo_owner), 'caregiver_applicant', 'new', 'web_form', 'informational', 'Synthetic caregiver applicant.')
  returning id, tenant_id, lead_type
)
insert into public.prospective_clients (
  tenant_id,
  lead_id,
  first_name,
  last_name,
  age,
  county,
  primary_payer,
  adl_bathing,
  adl_dressing,
  iadl_meal_prep,
  requested_services,
  requested_hours_per_week
)
select
  tenant_id,
  id,
  case row_number() over (order by id)
    when 1 then 'Alex'
    else 'Jordan'
  end,
  'Demo',
  case row_number() over (order by id)
    when 1 then 78
    else 66
  end,
  'Ingham',
  case row_number() over (order by id)
    when 1 then 'medicaid_home_help'
    else 'mi_choice_waiver'
  end,
  'partial_assist',
  'supervision',
  'needs_help',
  array['personal_care','meal_prep','light_housework']::text[],
  18
from sample_leads
where lead_type = 'client_referral';
*/
