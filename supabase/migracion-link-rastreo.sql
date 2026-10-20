-- Ejecutar UNA vez en Supabase > SQL Editor (antes de subir los archivos nuevos). No borra nada.
alter table pedidos add column if not exists link_rastreo text;
