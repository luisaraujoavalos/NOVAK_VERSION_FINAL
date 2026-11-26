-- =====================================================================
--  NOVAK · ETAPA 2 · 03_auth.sql
--  Une Supabase Auth (cuentas y contraseñas) con tu tabla public.clientes.
--
--  CÓMO USARLO: SQL Editor → New query → pega todo → Run.
--  Se puede ejecutar más de una vez.
--
--  IDEA CLAVE
--  Supabase guarda las cuentas en una tabla interna "auth.users" (correo +
--  contraseña cifrada). Tú no la tocas. Cuando alguien se registra, el
--  trigger de abajo crea automáticamente su fila en public.clientes con
--  los datos del formulario (nombre, talla, distrito...).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Crear el perfil del cliente al registrarse
-- ---------------------------------------------------------------------
create or replace function public.crear_perfil_cliente()
returns trigger
language plpgsql
security definer          -- necesita permiso para escribir en public.clientes
set search_path = ''
as $$
declare
    m      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);   -- datos del formulario
    v_nac  date;
begin
    -- Si la fecha viene mal escrita no rompemos el registro: queda vacía
    begin
        v_nac := nullif(m ->> 'nacimiento', '')::date;
    exception when others then
        v_nac := null;
    end;

    insert into public.clientes (id, correo, nombre, genero, nacimiento, telefono,
                                 distrito, talla, prendas, estilo, newsletter)
    values (
        new.id,
        lower(new.email),
        left(coalesce(nullif(m ->> 'nombre', ''), split_part(new.email, '@', 1)), 120),
        left(coalesce(m ->> 'genero', ''), 20),
        v_nac,
        left(coalesce(m ->> 'telefono', ''), 20),
        left(coalesce(m ->> 'distrito', ''), 80),
        left(coalesce(m ->> 'talla', ''), 10),
        case when jsonb_typeof(m -> 'prendas') = 'array'
             then array(select jsonb_array_elements_text(m -> 'prendas'))
             else '{}'::text[] end,
        left(coalesce(m ->> 'estilo', ''), 40),
        coalesce(m ->> 'newsletter', '') = 'true'
    )
    on conflict (id) do nothing;
    -- OJO: el rol SIEMPRE nace como 'usuario'. Nunca lo leemos del formulario,
    -- porque cualquiera podría enviar {"rol":"admin"} desde la consola.
    return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
    after insert on auth.users
    for each row execute function public.crear_perfil_cliente();


-- ---------------------------------------------------------------------
-- 2. Si el cliente cambia su correo en Auth, se copia a public.clientes
-- ---------------------------------------------------------------------
create or replace function public.sincronizar_correo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.clientes set correo = lower(new.email) where id = new.id;
    return new;
end;
$$;

drop trigger if exists al_cambiar_correo on auth.users;
create trigger al_cambiar_correo
    after update of email on auth.users
    for each row
    when (old.email is distinct from new.email)
    execute function public.sincronizar_correo();


-- ---------------------------------------------------------------------
-- 3. Protección del perfil (reemplaza la versión de la etapa 1)
--    Desde el navegador, el cliente puede cambiar nombre, teléfono, talla...
--    pero NO su rol, ni su correo (eso lo maneja Auth), ni su fecha de alta.
-- ---------------------------------------------------------------------
create or replace function public.proteger_rol()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if current_user in ('anon', 'authenticated') then
        if new.rol is distinct from old.rol and not public.es_admin() then
            raise exception 'Solo un administrador puede cambiar el rol de una cuenta.';
        end if;
        new.correo    := old.correo;
        new.creado_en := old.creado_en;
    end if;
    new.id := old.id;
    return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Por si ya habías creado usuarios antes de este script:
--    les crea el perfil que les falta.
-- ---------------------------------------------------------------------
insert into public.clientes (id, correo, nombre)
select u.id, lower(u.email), coalesce(nullif(u.raw_user_meta_data ->> 'nombre', ''), split_part(u.email, '@', 1))
from auth.users u
where u.email is not null
on conflict do nothing;


-- =====================================================================
-- 5. CREAR TU ADMINISTRADOR  (hazlo DESPUÉS de registrar la cuenta)
--    a) Regístrate en tu tienda (registro.html) con el correo del admin,
--       o créalo en Supabase → Authentication → Users → Add user
--       (marca "Auto Confirm User").
--    b) Quita los dos guiones "--" de la línea de abajo, pon tu correo y
--       ejecuta SOLO esa línea (selecciónala y pulsa Run).
-- =====================================================================
-- update public.clientes set rol = 'admin' where correo = 'admin@novak.pe';

-- Para comprobar quién es admin:
-- select correo, nombre, rol, creado_en from public.clientes order by creado_en;
