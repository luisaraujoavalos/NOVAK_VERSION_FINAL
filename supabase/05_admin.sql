-- =====================================================================
--  NOVAK · ETAPA 4 · 05_admin.sql
--  Panel admin, estadísticas, reclamaciones, mensajes, newsletter y fotos.
--
--  CÓMO USARLO: SQL Editor → New query → pega todo → Run.
--  Se puede ejecutar más de una vez.
--
--  Qué agrega:
--   1. Guardar una prenda con todas sus variantes en una sola transacción
--   2. Devolver el stock automáticamente al CANCELAR un pedido
--   3. Estadísticas: vistas/carrito (solo admin) y "más vendidos" (público)
--   4. Libro de Reclamaciones con número oficial y plazo de 15 días hábiles
--   5. Mensajes de contacto y suscriptores del newsletter
--   6. Almacenamiento de fotos (Supabase Storage)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. GUARDAR PRENDA (crear o editar) + sus variantes de talla y color
--    Todo o nada: si algo falla, la prenda queda como estaba.
-- ---------------------------------------------------------------------
create or replace function public.guardar_producto(p jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id text := p ->> 'id';
begin
    if not public.es_admin() then
        raise exception 'SOLO_ADMIN';
    end if;
    if v_id is null or v_id !~ '^[a-z0-9-]{2,60}$' then
        raise exception 'ID_INVALIDO';
    end if;
    if jsonb_typeof(p -> 'variantes') is distinct from 'array' or jsonb_array_length(p -> 'variantes') = 0 then
        raise exception 'SIN_VARIANTES';
    end if;

    insert into public.productos (id, sku, nombre, categoria_id, genero, descripcion, detalle, precio, descuento,
                                  campana_id, oferta_hasta, imagen, vista_espalda, vista_izquierda, vista_derecha,
                                  especificaciones, nuevo)
    values (v_id,
            coalesce(nullif(p ->> 'sku', ''), 'NVK-' || upper(replace(v_id, '-', ''))),
            p ->> 'nombre', p ->> 'categoria_id', coalesce(p ->> 'genero', 'hombre'),
            coalesce(p ->> 'descripcion', ''), coalesce(p ->> 'detalle', ''),
            (p ->> 'precio')::numeric, coalesce((p ->> 'descuento')::int, 0),
            nullif(p ->> 'campana_id', '')::bigint, nullif(p ->> 'oferta_hasta', '')::timestamptz,
            coalesce(p ->> 'imagen', ''), coalesce(p ->> 'vista_espalda', ''),
            coalesce(p ->> 'vista_izquierda', ''), coalesce(p ->> 'vista_derecha', ''),
            coalesce(p -> 'especificaciones', '[]'::jsonb), coalesce((p ->> 'nuevo')::boolean, false))
    on conflict (id) do update set
        nombre = excluded.nombre, categoria_id = excluded.categoria_id, genero = excluded.genero,
        descripcion = excluded.descripcion, detalle = excluded.detalle, precio = excluded.precio,
        descuento = excluded.descuento, campana_id = excluded.campana_id, oferta_hasta = excluded.oferta_hasta,
        imagen = excluded.imagen, vista_espalda = excluded.vista_espalda, vista_izquierda = excluded.vista_izquierda,
        vista_derecha = excluded.vista_derecha, especificaciones = excluded.especificaciones, nuevo = excluded.nuevo;

    -- Borra las combinaciones talla/color que el admin quitó
    delete from public.variantes v
    where v.producto_id = v_id
      and not exists (select 1 from jsonb_to_recordset(p -> 'variantes') as x(talla text, color text)
                      where x.talla = v.talla and x.color = v.color);

    -- Crea o actualiza las demás
    insert into public.variantes (producto_id, talla, color, color_hex, stock, orden_talla, orden_color)
    select v_id, x.talla, x.color, coalesce(x.color_hex, '#1b1b1f'), greatest(0, coalesce(x.stock, 0)),
           coalesce(x.orden_talla, 0), coalesce(x.orden_color, 0)
    from jsonb_to_recordset(p -> 'variantes')
         as x(talla text, color text, color_hex text, stock int, orden_talla int, orden_color int)
    on conflict (producto_id, talla, color) do update set
        stock = excluded.stock, color_hex = excluded.color_hex,
        orden_talla = excluded.orden_talla, orden_color = excluded.orden_color;
end;
$$;
revoke execute on function public.guardar_producto(jsonb) from public, anon;
grant  execute on function public.guardar_producto(jsonb) to authenticated;   -- igual revisa es_admin()


-- ---------------------------------------------------------------------
-- 2. CANCELAR UN PEDIDO DEVUELVE EL STOCK (automático, con un trigger)
--    El admin solo cambia el estado; la base devuelve cada unidad a su
--    variante. Un pedido cancelado no se puede reactivar (evita que el
--    stock se devuelva dos veces).
-- ---------------------------------------------------------------------
create or replace function public.al_cambiar_estado_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if old.estado = 'Cancelado' and new.estado <> 'Cancelado' then
        raise exception 'PEDIDO_CANCELADO';
    end if;
    if new.estado = 'Cancelado' and old.estado <> 'Cancelado' and not old.es_ejemplo then
        update public.variantes v
        set stock = v.stock + i.cantidad
        from public.pedido_items i
        where i.pedido_id = new.id
          and v.id = i.variante_id;
    end if;
    return new;
end;
$$;

drop trigger if exists pedidos_cambio_estado on public.pedidos;
create trigger pedidos_cambio_estado
    before update of estado on public.pedidos
    for each row execute function public.al_cambiar_estado_pedido();


-- ---------------------------------------------------------------------
-- 3a. ESTADÍSTICAS DE VISTAS Y CARRITO (solo admin)
--     Devuelve el mismo formato que usaba el panel:
--     { vistas: {id: n}, carrito: {id: n}, vistasCliente: {correo: {id: n}} }
-- ---------------------------------------------------------------------
create or replace function public.resumen_eventos()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not public.es_admin() then
        raise exception 'SOLO_ADMIN';
    end if;
    return jsonb_build_object(
        'vistas', coalesce((
            select jsonb_object_agg(producto_id, n) from (
                select producto_id, sum(cantidad) as n from public.eventos_producto
                where tipo = 'vista' group by producto_id) x), '{}'::jsonb),
        'carrito', coalesce((
            select jsonb_object_agg(producto_id, n) from (
                select producto_id, sum(cantidad) as n from public.eventos_producto
                where tipo = 'carrito' group by producto_id) x), '{}'::jsonb),
        'vistasCliente', coalesce((
            select jsonb_object_agg(correo, mapa) from (
                select c.correo, jsonb_object_agg(e.producto_id, e.n) as mapa
                from (select cliente_id, producto_id, sum(cantidad) as n from public.eventos_producto
                      where tipo = 'vista' and cliente_id is not null
                      group by cliente_id, producto_id) e
                join public.clientes c on c.id = e.cliente_id
                group by c.correo) y), '{}'::jsonb)
    );
end;
$$;
revoke execute on function public.resumen_eventos() from public, anon;
grant  execute on function public.resumen_eventos() to authenticated;


-- ---------------------------------------------------------------------
-- 3b. MÁS VENDIDOS (público): solo totales por prenda, sin datos personales
-- ---------------------------------------------------------------------
create or replace function public.mas_vendidos(p_dias int default 90, p_limite int default 24)
returns table (producto_id text, unidades bigint)
language sql
stable
security definer
set search_path = ''
as $$
    select i.producto_id, sum(i.cantidad)::bigint
    from public.pedido_items i
    join public.pedidos p on p.id = i.pedido_id
    where p.estado <> 'Cancelado'
      and not p.es_ejemplo
      and i.producto_id is not null
      and p.fecha >= now() - make_interval(days => greatest(1, least(coalesce(p_dias, 90), 365)))
    group by i.producto_id
    order by 2 desc
    limit greatest(1, least(coalesce(p_limite, 24), 100));
$$;
revoke execute on function public.mas_vendidos(int, int) from public;
grant  execute on function public.mas_vendidos(int, int) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. LIBRO DE RECLAMACIONES
--    La base asigna el número RC-AAAA-000001 y calcula el plazo legal de
--    15 días hábiles (lunes a viernes, hora de Lima).
-- ---------------------------------------------------------------------
alter table public.reclamaciones add column if not exists fecha_respuesta timestamptz;

create or replace function public.registrar_reclamo(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_limite timestamptz := now();
    v_dias   int := 0;
    v_fila   public.reclamaciones%rowtype;
begin
    if char_length(trim(coalesce(p ->> 'nombre', ''))) < 3
       or coalesce(p ->> 'documento', '') !~ '^\d{8,12}$'
       or char_length(trim(coalesce(p ->> 'domicilio', ''))) < 5
       or coalesce(p ->> 'correo', '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
       or char_length(trim(coalesce(p ->> 'descripcionBien', ''))) < 3
       or char_length(trim(coalesce(p ->> 'detalle', ''))) < 15
       or char_length(trim(coalesce(p ->> 'pedido', ''))) < 5 then
        raise exception 'DATOS_INCOMPLETOS';
    end if;

    while v_dias < 15 loop
        v_limite := v_limite + interval '1 day';
        if extract(isodow from v_limite at time zone 'America/Lima') < 6 then
            v_dias := v_dias + 1;
        end if;
    end loop;

    insert into public.reclamaciones (limite, nombre, tipo_documento, documento, domicilio, telefono, correo,
                                      apoderado, tipo_bien, monto, numero_pedido, descripcion_bien, tipo,
                                      detalle, pedido, cliente_id)
    values (v_limite,
            left(trim(p ->> 'nombre'), 120), left(coalesce(p ->> 'tipoDocumento', 'DNI'), 20),
            p ->> 'documento', left(trim(p ->> 'domicilio'), 200), left(coalesce(p ->> 'telefono', ''), 20),
            left(trim(p ->> 'correo'), 120), left(coalesce(p ->> 'apoderado', ''), 120),
            left(coalesce(p ->> 'tipoBien', ''), 20), left(coalesce(p ->> 'monto', ''), 20),
            left(coalesce(p ->> 'numeroPedido', ''), 20), left(trim(p ->> 'descripcionBien'), 300),
            case when p ->> 'tipo' = 'queja' then 'queja' else 'reclamo' end,
            left(trim(p ->> 'detalle'), 3000), left(trim(p ->> 'pedido'), 1000), auth.uid())
    returning * into v_fila;

    return jsonb_build_object('numero', v_fila.numero, 'fecha', v_fila.fecha, 'limite', v_fila.limite);
end;
$$;
revoke execute on function public.registrar_reclamo(jsonb) from public;
grant  execute on function public.registrar_reclamo(jsonb) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5a. MENSAJES DE CONTACTO
-- ---------------------------------------------------------------------
create sequence if not exists public.mensajes_numero_seq start 1;

create table if not exists public.mensajes (
    numero      text primary key,                    -- MSG-000001 o REC-000001
    nombre      text not null,
    correo      text not null,
    motivo      text not null default '',
    mensaje     text not null,
    leido       boolean not null default false,
    fecha       timestamptz not null default now(),
    cliente_id  uuid references public.clientes (id) on delete set null
);
alter table public.mensajes enable row level security;

drop policy if exists "mensajes: admin lee"       on public.mensajes;
drop policy if exists "mensajes: admin actualiza" on public.mensajes;
create policy "mensajes: admin lee" on public.mensajes for select to authenticated
    using ((select public.es_admin()));
create policy "mensajes: admin actualiza" on public.mensajes for update to authenticated
    using ((select public.es_admin())) with check ((select public.es_admin()));
grant select, update on public.mensajes to authenticated;

-- Cualquiera envía un mensaje (con o sin cuenta) y recibe su número de atención
create or replace function public.enviar_mensaje(p_nombre text, p_correo text, p_motivo text, p_mensaje text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_numero text;
begin
    if char_length(trim(coalesce(p_nombre, ''))) < 3
       or coalesce(p_correo, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
       or char_length(trim(coalesce(p_mensaje, ''))) < 10 then
        raise exception 'DATOS_INCOMPLETOS';
    end if;
    v_numero := (case when p_motivo = 'reclamo' then 'REC-' else 'MSG-' end)
                || lpad(nextval('public.mensajes_numero_seq')::text, 6, '0');
    insert into public.mensajes (numero, nombre, correo, motivo, mensaje, cliente_id)
    values (v_numero, left(trim(p_nombre), 120), left(trim(p_correo), 120), left(coalesce(p_motivo, ''), 40),
            left(trim(p_mensaje), 3000), auth.uid());
    return v_numero;
end;
$$;
revoke execute on function public.enviar_mensaje(text, text, text, text) from public;
grant  execute on function public.enviar_mensaje(text, text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5b. SUSCRIPTORES DEL NEWSLETTER
-- ---------------------------------------------------------------------
create table if not exists public.suscriptores (
    correo     text primary key check (correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    origen     text not null default '',              -- 'pie' o 'registro'
    creado_en  timestamptz not null default now()
);
alter table public.suscriptores enable row level security;

drop policy if exists "suscriptores: admin lee"   on public.suscriptores;
drop policy if exists "suscriptores: admin borra" on public.suscriptores;
create policy "suscriptores: admin lee" on public.suscriptores for select to authenticated
    using ((select public.es_admin()));
create policy "suscriptores: admin borra" on public.suscriptores for delete to authenticated
    using ((select public.es_admin()));
grant select, delete on public.suscriptores to authenticated;

-- Suscribirse dos veces no da error (y no revela si el correo ya estaba)
create or replace function public.suscribir(p_correo text, p_origen text default 'pie')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if coalesce(p_correo, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'CORREO_INVALIDO';
    end if;
    insert into public.suscriptores (correo, origen)
    values (lower(trim(p_correo)), left(coalesce(p_origen, ''), 20))
    on conflict (correo) do nothing;
end;
$$;
revoke execute on function public.suscribir(text, text) from public;
grant  execute on function public.suscribir(text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. FOTOS (Supabase Storage)
--    Un "bucket" es una carpeta en la nube. "fotos" es público para LEER
--    (las fotos se ven en la tienda), pero para SUBIR:
--      productos/...          → solo el administrador
--      resenas/<id-cliente>/  → cada cliente, solo en su propia carpeta
--    Máximo 3 MB por foto, solo JPG, PNG o WEBP.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
    public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos: admin sube prendas"       on storage.objects;
drop policy if exists "fotos: admin borra"              on storage.objects;
drop policy if exists "fotos: cliente sube su reseña"   on storage.objects;

create policy "fotos: admin sube prendas" on storage.objects for insert to authenticated
    with check (bucket_id = 'fotos'
                and (storage.foldername(name))[1] = 'productos'
                and (select public.es_admin()));

create policy "fotos: admin borra" on storage.objects for delete to authenticated
    using (bucket_id = 'fotos' and (select public.es_admin()));

create policy "fotos: cliente sube su reseña" on storage.objects for insert to authenticated
    with check (bucket_id = 'fotos'
                and (storage.foldername(name))[1] = 'resenas'
                and (storage.foldername(name))[2] = (select auth.uid())::text);

-- Listo. Comprobación: Storage → debe aparecer el bucket "fotos" marcado como Public.
