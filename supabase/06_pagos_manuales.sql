-- =====================================================================
--  NOVAK · 06_pagos_manuales.sql
--  Solo dos formas de pago: TRANSFERENCIA BANCARIA y CONTRA ENTREGA.
--  (Se quitó todo lo de Culqi, tarjeta y Yape.)
--
--  CÓMO USARLO: SQL Editor → New query → pega todo → Run.
--  Ejecútalo DESPUÉS de 05_admin.sql. Se puede ejecutar más de una vez.
--  Si en algún momento ejecutaste los antiguos 06_pagos.sql o
--  07_sin_culqi.sql, este archivo también los deshace.
--
--  Cómo queda:
--   - Transferencia → el pedido nace "Pendiente de pago". Cuando veas el
--     dinero en tu banco, cámbialo a "Pagado" en Panel admin → Pedidos.
--   - Contra entrega → el pedido nace "Preparando" (pagan al recibir).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Limpieza de lo que dejó Culqi (si existía)
-- ---------------------------------------------------------------------
do $$
begin
    -- Tarea automática que cancelaba reservas de 30 minutos
    if exists (select 1 from pg_extension where extname = 'pg_cron') then
        perform cron.unschedule(jobid) from cron.job where jobname = 'novak-cancelar-vencidos';
    end if;
end;
$$;

drop function if exists public.reservar_cobro(text, uuid);
drop function if exists public.registrar_pago(text, boolean, text, numeric, text, text, jsonb);
drop function if exists public.cancelar_mi_pedido(text);
drop table if exists public.pagos;
drop table if exists public.configuracion;
alter table public.pedidos drop column if exists pagar_antes;
alter table public.pedidos drop column if exists cobrando_desde;


-- ---------------------------------------------------------------------
-- 2. crear_pedido() versión final: solo transferencia y contra entrega
-- ---------------------------------------------------------------------
create or replace function public.crear_pedido(
    p_items         jsonb,
    p_entrega       jsonb,
    p_metodo        text,
    p_pago_detalle  text default '',
    p_cupon         text default '',
    p_nombre        text default '',
    p_telefono      text default '',
    p_dni           text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_uid          uuid := auth.uid();
    v_cliente      public.clientes%rowtype;
    v_linea        record;
    v_var          record;
    v_items        jsonb := '[]'::jsonb;
    v_oferta       boolean;
    v_precio       numeric(10, 2);
    v_subtotal     numeric(10, 2) := 0;
    v_cupon        public.cupones%rowtype;
    v_codigo       text := '';
    v_descuento    numeric(10, 2) := 0;
    v_envio_gratis boolean := false;
    v_envio        numeric(10, 2);
    v_zona         text;
    v_entrega      jsonb;
    v_estado       text;
    v_id           text;
begin
    if v_uid is null then
        raise exception 'NECESITA_SESION';
    end if;
    select * into v_cliente from public.clientes where id = v_uid;
    if not found then
        raise exception 'SIN_PERFIL';
    end if;

    if p_metodo not in ('transferencia', 'contraentrega') then
        raise exception 'METODO_NO_DISPONIBLE';
    end if;
    -- Transferencia: el número de operación es obligatorio (para que puedas verificarla)
    if p_metodo = 'transferencia' and coalesce(p_pago_detalle, '') !~ '\d{6,}' then
        raise exception 'FALTA_OPERACION';
    end if;
    if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'CARRITO_VACIO';
    end if;
    if jsonb_array_length(p_items) > 30 then
        raise exception 'DEMASIADOS_ITEMS';
    end if;

    if p_entrega ->> 'tipo' = 'recojo' then
        v_zona := 'recojo';
        v_entrega := jsonb_build_object('tipo', 'recojo',
            'direccion', left(coalesce(p_entrega ->> 'direccion', ''), 200), 'distrito', '');
    else
        v_zona := case when p_entrega ->> 'zona' = 'provincia' then 'provincia' else 'lima' end;
        if coalesce(trim(p_entrega ->> 'direccion'), '') = '' then
            raise exception 'FALTA_DIRECCION';
        end if;
        v_entrega := jsonb_build_object('tipo', 'domicilio',
            'direccion',    left(coalesce(p_entrega ->> 'direccion', ''), 200),
            'distrito',     left(coalesce(p_entrega ->> 'distrito', ''), 80),
            'referencia',   left(coalesce(p_entrega ->> 'referencia', ''), 200),
            'departamento', left(coalesce(p_entrega ->> 'departamento', ''), 40),
            'zona',         v_zona);
    end if;
    -- Contra entrega solo para envíos a domicilio en Lima
    if p_metodo = 'contraentrega' and v_zona <> 'lima' then
        raise exception 'METODO_NO_DISPONIBLE';
    end if;

    for v_linea in
        select x.producto_id, x.talla, x.color, sum(x.cantidad)::int as cantidad
        from jsonb_to_recordset(p_items) as x(producto_id text, talla text, color text, cantidad int)
        group by x.producto_id, x.talla, x.color
        order by x.producto_id, x.talla, x.color
    loop
        if v_linea.cantidad is null or v_linea.cantidad < 1 or v_linea.cantidad > 20 then
            raise exception 'CANTIDAD_INVALIDA';
        end if;

        select v.id as variante_id, v.stock, p.nombre, p.categoria_id, p.precio, p.descuento,
               p.campana_id, p.oferta_hasta, p.imagen, p.activo
          into v_var
        from public.variantes v
        join public.productos p on p.id = v.producto_id
        where v.producto_id = v_linea.producto_id
          and v.talla = v_linea.talla
          and v.color = v_linea.color
        for update of v;

        if not found or not v_var.activo then
            raise exception 'NO_EXISTE: %', v_linea.producto_id;
        end if;
        if v_var.stock < v_linea.cantidad then
            raise exception 'SIN_STOCK: % (talla %, %): quedan %', v_var.nombre, v_linea.talla, v_linea.color, v_var.stock;
        end if;

        update public.variantes set stock = stock - v_linea.cantidad where id = v_var.variante_id;

        v_oferta := public.oferta_vigente(v_var.descuento, v_var.campana_id, v_var.oferta_hasta);
        v_precio := case when v_oferta then round(v_var.precio * (100 - v_var.descuento) / 100, 2) else v_var.precio end;
        v_subtotal := v_subtotal + v_precio * v_linea.cantidad;

        v_items := v_items || jsonb_build_array(jsonb_build_object(
            'producto_id', v_linea.producto_id, 'variante_id', v_var.variante_id,
            'nombre', v_var.nombre, 'categoria', v_var.categoria_id,
            'talla', v_linea.talla, 'color', v_linea.color, 'cantidad', v_linea.cantidad,
            'precio', v_precio, 'precio_lista', v_var.precio, 'oferta', v_oferta, 'imagen', v_var.imagen));
    end loop;

    if coalesce(trim(p_cupon), '') <> '' then
        select * into v_cupon from public.cupones where codigo = upper(trim(p_cupon)) and activo;
        if found and v_subtotal >= v_cupon.minimo then
            v_codigo := v_cupon.codigo;
            if v_cupon.tipo = 'porcentaje' then
                v_descuento := round(v_subtotal * v_cupon.valor / 100, 2);
            elsif v_cupon.tipo = 'monto' then
                v_descuento := least(v_cupon.valor, v_subtotal);
            else
                v_envio_gratis := true;
            end if;
        end if;
    end if;

    v_envio := case
        when v_zona = 'recojo' or v_envio_gratis or (v_subtotal - v_descuento) >= 199 then 0
        when v_zona = 'provincia' then 18
        else 10
    end;

    v_estado := case when p_metodo = 'contraentrega' then 'Preparando' else 'Pendiente de pago' end;

    insert into public.pedidos (cliente_id, correo, nombre, telefono, dni, subtotal, descuento_cupon,
                                cupon_codigo, envio, total, metodo, pago_detalle, estado, entrega)
    values (v_uid, v_cliente.correo,
            left(coalesce(nullif(trim(p_nombre), ''), v_cliente.nombre), 120),
            left(coalesce(p_telefono, ''), 20), left(coalesce(p_dni, ''), 12),
            v_subtotal, v_descuento, v_codigo, v_envio, v_subtotal - v_descuento + v_envio,
            p_metodo, left(coalesce(p_pago_detalle, ''), 120), v_estado, v_entrega)
    returning id into v_id;

    insert into public.pedido_items (pedido_id, producto_id, variante_id, nombre, categoria, talla, color,
                                     cantidad, precio, precio_lista, oferta, imagen)
    select v_id, x.producto_id, x.variante_id, x.nombre, x.categoria, x.talla, x.color,
           x.cantidad, x.precio, x.precio_lista, x.oferta, x.imagen
    from jsonb_to_recordset(v_items) as x(producto_id text, variante_id bigint, nombre text, categoria text,
         talla text, color text, cantidad int, precio numeric, precio_lista numeric, oferta boolean, imagen text);

    return public.pedido_json(v_id);
end;
$$;

revoke execute on function public.crear_pedido(jsonb, jsonb, text, text, text, text, text, text) from public, anon;
grant  execute on function public.crear_pedido(jsonb, jsonb, text, text, text, text, text, text) to authenticated;
