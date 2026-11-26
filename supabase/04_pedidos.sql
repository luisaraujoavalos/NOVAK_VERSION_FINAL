-- =====================================================================
--  NOVAK · ETAPA 3 · 04_pedidos.sql
--  Crear pedidos y descontar stock EN UNA SOLA TRANSACCIÓN.
--
--  CÓMO USARLO: SQL Editor → New query → pega todo → Run.
--  Se puede ejecutar más de una vez.
--
--  IDEA CLAVE: ¿qué es una transacción?
--  Es un grupo de cambios que se guardan TODOS o NINGUNO. Una función de
--  Postgres se ejecuta completa dentro de una transacción: si en la 3.ª
--  prenda falta stock, se lanza un error ("raise exception") y Postgres
--  deshace también lo que ya había descontado de la 1.ª y la 2.ª.
--  Nunca queda un pedido a medias ni stock descontado sin pedido.
--
--  ¿Y si dos personas compran la última unidad al mismo tiempo?
--  "for update" bloquea la fila de esa variante: el segundo comprador
--  espera a que termine el primero, y entonces ve stock 0 y recibe el error.
--
--  ¿Por qué el precio se calcula aquí y no en el navegador?
--  Porque el navegador se puede manipular desde la consola. El navegador
--  solo envía QUÉ quiere (prenda, talla, color, cantidad); el PRECIO, las
--  ofertas, el cupón y el envío los decide la base.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. ¿La oferta de una prenda está vigente ahora mismo?
--    (Misma regla que ofertaVigente() de app.js.)
-- ---------------------------------------------------------------------
create or replace function public.oferta_vigente(p_descuento int, p_campana_id bigint, p_oferta_hasta timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
    select case
        when coalesce(p_descuento, 0) <= 0 then false
        when p_campana_id is not null then exists (
            select 1 from public.campanas c
            where c.id = p_campana_id and c.activa and c.inicio <= now() and c.fin > now())
        else p_oferta_hasta is null or p_oferta_hasta > now()
    end;
$$;


-- ---------------------------------------------------------------------
-- 2. Un pedido completo (con sus items) como JSON, para devolverlo al navegador
-- ---------------------------------------------------------------------
create or replace function public.pedido_json(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select to_jsonb(p) || jsonb_build_object(
        'pedido_items',
        coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.pedido_items i where i.pedido_id = p.id), '[]'::jsonb))
    from public.pedidos p
    where p.id = p_id;
$$;
-- Solo la usan las funciones de abajo; nadie la llama directamente
revoke execute on function public.pedido_json(text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. CREAR PEDIDO
--    p_items: [{"producto_id":"hoodies-08","talla":"M","color":"Negro","cantidad":1}, ...]
--    p_entrega: {"tipo":"domicilio","direccion":"...","distrito":"...","zona":"lima"}
--               o {"tipo":"recojo","direccion":"NOVAK Miraflores · ..."}
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
security definer          -- puede descontar stock aunque el cliente no tenga permiso directo
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
    -- a) ¿Quién compra?
    if v_uid is null then
        raise exception 'NECESITA_SESION';
    end if;
    select * into v_cliente from public.clientes where id = v_uid;
    if not found then
        raise exception 'SIN_PERFIL';
    end if;

    -- b) Validaciones básicas
    if p_metodo not in ('tarjeta', 'yape', 'pagoefectivo', 'transferencia', 'contraentrega') then
        raise exception 'METODO_INVALIDO';
    end if;
    if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'CARRITO_VACIO';
    end if;
    if jsonb_array_length(p_items) > 30 then
        raise exception 'DEMASIADOS_ITEMS';
    end if;

    -- c) Entrega: solo guardamos los campos que conocemos, con largo máximo
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

    -- d) Cada línea del carrito. Se agrupan las repetidas y se recorren
    --    siempre en el mismo orden (así dos compras simultáneas no se trancan).
    for v_linea in
        select x.producto_id, x.talla, x.color, sum(x.cantidad)::int as cantidad
        from jsonb_to_recordset(p_items) as x(producto_id text, talla text, color text, cantidad int)
        group by x.producto_id, x.talla, x.color
        order by x.producto_id, x.talla, x.color
    loop
        if v_linea.cantidad is null or v_linea.cantidad < 1 or v_linea.cantidad > 20 then
            raise exception 'CANTIDAD_INVALIDA';
        end if;

        -- Lee la variante y la BLOQUEA hasta que termine este pedido
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

        -- Descuenta el stock (si algo falla después, esto también se deshace)
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

    -- e) Cupón (misma regla que calcularTotales() de app.js)
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

    -- f) Envío: gratis desde S/ 199, con cupón ENVIOGRATIS o recojo en tienda
    v_envio := case
        when v_zona = 'recojo' or v_envio_gratis or (v_subtotal - v_descuento) >= 199 then 0
        when v_zona = 'provincia' then 18
        else 10
    end;

    -- g) Estado inicial según el método de pago
    v_estado := case
        when p_metodo in ('pagoefectivo', 'transferencia') then 'Pendiente de pago'
        when p_metodo = 'contraentrega' then 'Preparando'
        else 'Pagado'
    end;

    -- h) Guarda el pedido y sus líneas
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

    -- i) Devuelve el pedido tal como quedó guardado
    return public.pedido_json(v_id);
end;
$$;

revoke execute on function public.crear_pedido(jsonb, jsonb, text, text, text, text, text, text) from public, anon;
grant  execute on function public.crear_pedido(jsonb, jsonb, text, text, text, text, text, text) to authenticated;


-- ---------------------------------------------------------------------
-- 4. SEGUIMIENTO sin iniciar sesión (seguimiento.html)
--    Pide número Y correo: con uno solo no se puede ver un pedido ajeno.
--    No devuelve DNI ni teléfono.
-- ---------------------------------------------------------------------
create or replace function public.seguir_pedido(p_numero text, p_correo text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select public.pedido_json(p.id) - 'dni' - 'telefono' - 'cliente_id'
    from public.pedidos p
    where p.id = upper(trim(p_numero))
      and lower(p.correo) = lower(trim(p_correo));
$$;

revoke execute on function public.seguir_pedido(text, text) from public;
grant  execute on function public.seguir_pedido(text, text) to anon, authenticated;

-- Comprobación rápida (debe decir "true" en las dos columnas):
-- select has_function_privilege('authenticated', 'public.crear_pedido(jsonb,jsonb,text,text,text,text,text,text)', 'execute') as puede_comprar,
--        has_function_privilege('anon', 'public.seguir_pedido(text,text)', 'execute') as puede_seguir;
