-- MF Colombia · Supabase · esquema v3
-- Se pega en Supabase > SQL Editor > New query > Run. Es idempotente: se puede ejecutar varias veces
-- (también sobre una base ya creada con la versión anterior; conserva tus pedidos y productos).

create table if not exists productos (
  id text primary key,
  nombre text not null,
  precio bigint not null check (precio > 0),                                   -- pesos COP enteros
  stock jsonb not null default '{}' check (jsonb_typeof(stock) = 'object'),    -- {"36":3,"37":2}
  visible boolean not null default true
);

create table if not exists pedidos (
  id bigint generated always as identity primary key,
  referencia text unique not null,
  token text unique not null default replace(gen_random_uuid()::text, '-', ''),  -- enlace de seguimiento privado
  estado_pago text not null default 'PENDING'
    check (estado_pago in ('PENDING','APPROVED','DECLINED','VOIDED','ERROR')),
  estado_envio text not null default 'PREPARANDO'
    check (estado_envio in ('PREPARANDO','EN_CAMINO','ENTREGADO','DEVUELTO')),
  transportadora text,
  guia text,
  monto_centavos bigint not null check (monto_centavos > 0),
  metodo text,
  wompi_tx text,
  items jsonb not null,
  cliente jsonb not null,
  consent_wa boolean not null default false,   -- casilla de WhatsApp marcada por el cliente
  meta jsonb not null default '{}',            -- fbp, fbc, ua, ip, event_id (para Meta CAPI)
  notificado jsonb not null default '{}',      -- plantillas ya enviadas (evita duplicados)
  alerta text,                                 -- algo que revisar a mano (stock, monto, anulación...)
  creado_en timestamptz not null default now(),
  pagado_en timestamptz,
  enviado_en timestamptz,
  entregado_en timestamptz
);

-- Para bases creadas con la versión anterior
alter table pedidos add column if not exists alerta text;

create index if not exists pedidos_wompi_tx on pedidos (wompi_tx);
create index if not exists pedidos_creado_en on pedidos (creado_en desc);
create index if not exists pedidos_ip_reciente on pedidos ((meta->>'ip'), creado_en);

-- Seguridad: nadie con la llave pública (anon) ni usuarios logueados puede leer ni escribir.
-- Solo el servidor, con la service key (rol service_role), accede.
alter table productos enable row level security;
alter table pedidos enable row level security;
revoke all on table productos, pedidos from anon, authenticated;
grant all on table productos, pedidos to service_role;

-- Aprobación atómica y sin duplicados. Devuelve:
--   APROBADO       primera vez: marca el pedido como pagado y descuenta el stock
--   YA_APROBADO    el evento llegó repetido: no hace nada
--   NO_ENCONTRADO  no existe esa referencia
--   MONTO_DISTINTO el monto pagado no coincide con el del pedido (no se aprueba; queda alerta)
-- Si el stock no alcanza al aprobar (dos clientes pagaron la última talla) el pago se registra igual,
-- el stock queda en 0 y el pedido queda con alerta STOCK_INSUFICIENTE para resolverlo con la clienta.
drop function if exists aprobar_pedido(text, text, bigint, text);
create function aprobar_pedido(p_ref text, p_tx text, p_monto bigint, p_metodo text)
returns text
language plpgsql
set search_path = public
as $$
declare
  p pedidos;
  it jsonb;
  v_talla text;
  v_cant int;
  v_actual int;
  v_falta boolean := false;
begin
  select * into p from pedidos where referencia = p_ref for update;   -- bloquea la fila: sin carreras
  if not found then return 'NO_ENCONTRADO'; end if;
  if p.estado_pago = 'APPROVED' then return 'YA_APROBADO'; end if;

  if p.monto_centavos <> p_monto then
    update pedidos set alerta = 'MONTO_DISTINTO: esperado ' || p.monto_centavos || ' recibido ' || p_monto where id = p.id;
    return 'MONTO_DISTINTO';
  end if;

  update pedidos set estado_pago = 'APPROVED', wompi_tx = p_tx, metodo = p_metodo, pagado_en = now() where id = p.id;

  for it in select * from jsonb_array_elements(p.items) loop
    v_talla := it->>'talla';
    v_cant := (it->>'cant')::int;
    select coalesce((stock->>v_talla)::int, 0) into v_actual from productos where id = it->>'id' for update;
    if not found then v_falta := true; continue; end if;
    if v_actual < v_cant then v_falta := true; end if;
    update productos
       set stock = jsonb_set(stock, array[v_talla], to_jsonb(greatest(0, v_actual - v_cant)), true)
     where id = it->>'id';
  end loop;

  if v_falta then update pedidos set alerta = 'STOCK_INSUFICIENTE' where id = p.id; end if;
  return 'APROBADO';
end $$;

-- Solo el servidor puede ejecutarla (en Supabase las funciones nuevas quedan abiertas a anon por defecto)
revoke execute on function aprobar_pedido(text, text, bigint, text) from public, anon, authenticated;
grant execute on function aprobar_pedido(text, text, bigint, text) to service_role;
