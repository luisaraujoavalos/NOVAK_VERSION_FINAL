-- =====================================================================
--  NOVAK · 07_correos.sql   (correos automáticos con Brevo)
--
--  CÓMO USARLO: SQL Editor → New query → pega todo → Run.
--  Se puede ejecutar más de una vez.
--  AL FINAL te mostrará un "secreto": cópialo, lo necesitas en la Edge
--  Function (Secrets → NOTIFICAR_SECRETO).
--
--  IDEA CLAVE
--  Un "trigger" es código que la base ejecuta sola cuando pasa algo.
--  Aquí, cuando se crea un pedido, cambia su estado, llega un reclamo, un
--  mensaje o se registra un cliente, la base llama (por internet, con la
--  extensión pg_net) a la Edge Function "notificar", que envía el correo.
--  La llamada sale DESPUÉS de guardar, en segundo plano: si el correo
--  falla, la compra NO se ve afectada.
--
--  Qué correos se envían:
--    Cliente:  bienvenida (cupón) · pedido recibido · cambio de estado
--    Consumidor: copia de su hoja de reclamación · respuesta al reclamo
--    Tienda (tú): aviso de pedido nuevo · reclamo nuevo · mensaje de contacto
-- =====================================================================

create extension if not exists pg_net;

-- ---------------------------------------------------------------------
-- 1. Secreto compartido entre la base y la Edge Function, guardado en
--    Vault (la caja fuerte cifrada de Supabase). Se crea una sola vez.
--    Sirve para que NADIE más pueda llamar a "notificar" y mandar correos.
-- ---------------------------------------------------------------------
do $$
begin
    if not exists (select 1 from vault.secrets where name = 'novak_notificar_secreto') then
        perform vault.create_secret(
            replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
            'novak_notificar_secreto',
            'Secreto para que la base llame a la Edge Function notificar');
    end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Enviar un aviso a la Edge Function (en segundo plano)
-- ---------------------------------------------------------------------
create or replace function public.enviar_notificacion(p_tipo text, p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_secreto text;
begin
    select decrypted_secret into v_secreto
    from vault.decrypted_secrets where name = 'novak_notificar_secreto' limit 1;
    if v_secreto is null then
        return;
    end if;
    perform net.http_post(
        url := 'https://zqtyxnjrsiydrokktqod.supabase.co/functions/v1/notificar',
        body := jsonb_build_object('tipo', p_tipo, 'id', p_id),
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-novak-secreto', v_secreto),
        timeout_milliseconds := 10000
    );
exception when others then
    -- Un correo nunca debe impedir una compra, un reclamo o un registro
    raise warning 'NOVAK: no se pudo encolar el correo (% %): %', p_tipo, p_id, sqlerrm;
end;
$$;
revoke execute on function public.enviar_notificacion(text, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. Triggers: cuándo se envía cada correo
-- ---------------------------------------------------------------------

-- Pedidos: al crearse y cada vez que cambia el estado
create or replace function public.tr_correo_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.es_ejemplo then
        return new;
    end if;
    if tg_op = 'INSERT' then
        perform public.enviar_notificacion('pedido_nuevo', new.id);
    elsif new.estado is distinct from old.estado then
        perform public.enviar_notificacion('pedido_estado', new.id);
    end if;
    return new;
end;
$$;
drop trigger if exists correo_pedido on public.pedidos;
create trigger correo_pedido
    after insert or update of estado on public.pedidos
    for each row execute function public.tr_correo_pedido();

-- Libro de Reclamaciones: copia al consumidor al registrarse y su respuesta
create or replace function public.tr_correo_reclamo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        perform public.enviar_notificacion('reclamo_nuevo', new.numero);
    elsif new.estado = 'Respondido' and new.respuesta is distinct from old.respuesta then
        perform public.enviar_notificacion('reclamo_respuesta', new.numero);
    end if;
    return new;
end;
$$;
drop trigger if exists correo_reclamo on public.reclamaciones;
create trigger correo_reclamo
    after insert or update of respuesta on public.reclamaciones
    for each row execute function public.tr_correo_reclamo();

-- Mensajes de contacto: aviso a la tienda
create or replace function public.tr_correo_mensaje()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform public.enviar_notificacion('mensaje_nuevo', new.numero);
    return new;
end;
$$;
drop trigger if exists correo_mensaje on public.mensajes;
create trigger correo_mensaje
    after insert on public.mensajes
    for each row execute function public.tr_correo_mensaje();

-- Clientes nuevos: correo de bienvenida con el cupón
create or replace function public.tr_correo_bienvenida()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform public.enviar_notificacion('bienvenida', new.id::text);
    return new;
end;
$$;
drop trigger if exists correo_bienvenida on public.clientes;
create trigger correo_bienvenida
    after insert on public.clientes
    for each row execute function public.tr_correo_bienvenida();


-- ---------------------------------------------------------------------
-- 4. TU SECRETO: copia el valor que aparece abajo (columna "secreto") y
--    pégalo en Supabase → Edge Functions → Secrets como NOTIFICAR_SECRETO.
--    No lo compartas con nadie.
-- ---------------------------------------------------------------------
select decrypted_secret as secreto
from vault.decrypted_secrets
where name = 'novak_notificar_secreto';

-- Para revisar si los avisos salen bien (status_code 200 = enviado a la función):
-- select id, status_code, content, created from net._http_response order by created desc limit 10;
