-- GASTOS Y GANANCIAS · MF Colombia (Finanzas del panel). Idempotente: se puede ejecutar varias veces.
-- Se pega en Supabase > SQL Editor > New query > Run. No toca pedidos, productos ni pagos.
create table if not exists gastos (
  id bigint generated always as identity primary key,
  fecha date not null default ((now() at time zone 'America/Bogota')::date),
  categoria text not null check (categoria in ('MERCANCIA','INSUMOS','ENVIOS','COMISIONES','PUBLICIDAD','SERVICIOS','PERSONAL','OTROS')),
  descripcion text,
  monto bigint not null check (monto > 0),     -- pesos COP
  creado_en timestamptz not null default now()
);
create index if not exists gastos_fecha on gastos (fecha desc, id desc);
alter table gastos enable row level security;
revoke all on table gastos from anon, authenticated;
grant all on table gastos to service_role;
