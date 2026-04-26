create table public.agent_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  category text not null default 'inbound' check (category in ('inbound','outbound','test','specialty')),
  purpose text check (purpose in ('client_intake','caregiver_recruitment','reengagement','eligibility_followup','appointment_reminder','satisfaction_survey','general','test')),
  tags text[] default array[]::text[],
  version int not null default 1,
  retell_payload jsonb not null,
  default_voice text,
  default_llm_model text default 'claude-sonnet-4-6',
  required_variables text[] default array[]::text[],
  default_variables jsonb default '{}'::jsonb,
  imported_agent_ids text[] default array[]::text[],
  is_system boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, slug),
  constraint agent_templates_system_tenant_check
    check (not is_system or tenant_id is null)
);

create table public.agent_template_imports (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  template_id uuid not null references public.agent_templates(id),
  imported_by uuid references public.profiles(id),
  retell_agent_id text,
  retell_response jsonb,
  status text not null check (status in ('pending','success','failed')),
  error_message text,
  created_at timestamptz default now()
);

create index agent_templates_tenant_category_idx
  on public.agent_templates (tenant_id, category);
create index agent_templates_system_idx
  on public.agent_templates (is_system)
  where is_system = true;
create index agent_templates_tags_idx
  on public.agent_templates using gin (tags);

create index agent_template_imports_tenant_created_at_idx
  on public.agent_template_imports (tenant_id, created_at desc);

create trigger agent_templates_set_updated_at
  before update on public.agent_templates
  for each row
  execute function public.set_updated_at();

alter table public.agent_templates enable row level security;
alter table public.agent_template_imports enable row level security;

create policy "tenant members can select agent templates"
  on public.agent_templates for select
  using (
    is_system = true
    or tenant_id = public.current_tenant_id()
  );

create policy "tenant members can insert agent templates"
  on public.agent_templates for insert
  with check (
    tenant_id = public.current_tenant_id()
    and is_system = false
  );

create policy "tenant members can update agent templates"
  on public.agent_templates for update
  using (
    tenant_id = public.current_tenant_id()
    and is_system = false
  )
  with check (
    tenant_id = public.current_tenant_id()
    and is_system = false
  );

create policy "tenant members can delete agent templates"
  on public.agent_templates for delete
  using (
    tenant_id = public.current_tenant_id()
    and is_system = false
  );

create policy "tenant members can select agent template imports"
  on public.agent_template_imports for select
  using (tenant_id = public.current_tenant_id());

create policy "tenant members can insert agent template imports"
  on public.agent_template_imports for insert
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can update agent template imports"
  on public.agent_template_imports for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant members can delete agent template imports"
  on public.agent_template_imports for delete
  using (tenant_id = public.current_tenant_id());
