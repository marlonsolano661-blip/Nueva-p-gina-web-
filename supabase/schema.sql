-- MF Colombia: esquema de pedidos para Supabase.
-- Aplicar manualmente en Supabase SQL Editor después de revisar el proyecto.
-- No crea credenciales ni activa pagos. El acceso de servidor usa SUPABASE_SERVICE_KEY.

create extension if not exists pgcrypto;

create table if not exists public.productos (
  id text primary key,
  nombre text not null,
  precio bigint not null check (precio > 0),
  stock jsonb not null default '{}'::jsonb,
  visible boolean not null default true
);

create table if not exists public.pedidos (
  id bigint generated always as identity primary key,
  referencia text unique not null,
  token text unique not null default replace(gen_random_uuid()::text, '-', ''),
  estado_pago text not null default 'PENDING'
    check (estado_pago in ('PENDING','APPROVED','DECLINED','VOIDED','ERROR')),
  estado_envio text not null default 'PREPARANDO'
    check (estado_envio in ('PREPARANDO','EN_CAMINO','ENTREGADO','DEVUELTO')),
  transportadora text,
  guia text,
  subtotal_centavos bigint,
  envio_centavos bigint not null default 1750000 check (envio_centavos >= 0),
  monto_centavos bigint not null check (monto_centavos > 0),
  metodo text,
  wompi_tx text unique,
  items jsonb not null,
  cliente jsonb not null,
  consent_wa boolean not null default false,
  meta jsonb not null default '{}'::jsonb,
  notificado jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  pagado_en timestamptz,
  enviado_en timestamptz,
  entregado_en timestamptz
);

create index if not exists pedidos_wompi_tx_idx on public.pedidos (wompi_tx);
create index if not exists pedidos_creado_en_idx on public.pedidos (creado_en desc);

alter table public.productos enable row level security;
alter table public.pedidos enable row level security;
-- No crear políticas públicas. El servidor accede con SUPABASE_SERVICE_KEY.

create or replace function public.aprobar_pedido(
  p_ref text,
  p_tx text,
  p_monto bigint,
  p_metodo text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  pedido public.pedidos;
  item jsonb;
  stock_actual integer;
  cantidad integer;
begin
  -- Bloquea el pedido para que eventos repetidos no descuenten dos veces.
  select * into pedido
    from public.pedidos
    where referencia = p_ref
    for update;

  if not found then
    return false;
  end if;

  if pedido.estado_pago = 'APPROVED' then
    return pedido.wompi_tx = p_tx and pedido.monto_centavos = p_monto;
  end if;

  if pedido.estado_pago <> 'PENDING' or pedido.monto_centavos <> p_monto then
    return false;
  end if;

  -- Valida existencias antes de descontarlas. La transacción se revierte si falta stock.
  for item in
    select jsonb_build_object('id', value->>'id', 'talla', value->>'talla',
                              'cant', sum((value->>'cant')::integer)) as line
    from jsonb_array_elements(pedido.items)
    group by value->>'id', value->>'talla'
  loop
    cantidad := (item->>'cant')::integer;
    select coalesce((stock->>(item->>'talla'))::integer, 0)
      into stock_actual
      from public.productos
      where id = item->>'id'
      for update;

    if not found or cantidad < 1 or stock_actual < cantidad then
      raise exception 'Stock insuficiente para producto %, talla %', item->>'id', item->>'talla';
    end if;
  end loop;

  for item in
    select jsonb_build_object('id', value->>'id', 'talla', value->>'talla',
                              'cant', sum((value->>'cant')::integer)) as line
    from jsonb_array_elements(pedido.items)
    group by value->>'id', value->>'talla'
  loop
    cantidad := (item->>'cant')::integer;
    update public.productos
      set stock = jsonb_set(
        stock,
        array[item->>'talla'],
        to_jsonb(coalesce((stock->>(item->>'talla'))::integer, 0) - cantidad),
        true
      )
      where id = item->>'id';
  end loop;

  update public.pedidos
    set estado_pago = 'APPROVED',
        wompi_tx = p_tx,
        metodo = p_metodo,
        pagado_en = now()
    where referencia = p_ref;

  return true;
end;
$$;

revoke all on function public.aprobar_pedido(text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.aprobar_pedido(text,text,bigint,text) to service_role;
