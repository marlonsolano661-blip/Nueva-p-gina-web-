-- Pedidos que llegan por WhatsApp (los registra Marlon a mano desde el panel). Idempotente: se puede ejecutar varias veces.
-- Se pega en Supabase > SQL Editor > New query > Run. No toca pedidos, productos ni pagos existentes.
create table if not exists ventas_whatsapp (
  id bigint generated always as identity primary key,
  fecha date not null default ((now() at time zone 'America/Bogota')::date),
  cliente text not null,
  telefono text,
  ciudad text,
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array'),   -- [{"nombre":"Plataforma Luna","talla":"37","color":"Negro","cant":1,"precio":189900}]  (pesos COP)
  envio bigint not null default 0 check (envio >= 0),
  descuento bigint not null default 0 check (descuento >= 0),
  total bigint not null check (total >= 0),                                  -- productos + envío - descuento (lo calcula el servidor)
  metodo_pago text not null default 'Transferencia',
  estado_pago text not null default 'PAGADO' check (estado_pago in ('PAGADO','PENDIENTE','CANCELADO')),
  estado_envio text not null default 'PREPARANDO' check (estado_envio in ('PREPARANDO','EN_CAMINO','ENTREGADO','DEVUELTO')),
  guia text,
  nota text,
  creado_en timestamptz not null default now()
);
create index if not exists ventas_whatsapp_fecha on ventas_whatsapp (fecha desc, id desc);
alter table ventas_whatsapp enable row level security;
revoke all on table ventas_whatsapp from anon, authenticated;
grant all on table ventas_whatsapp to service_role;
