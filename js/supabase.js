/* =====================================================
   NOVAK - supabase.js
   Conexión con la base de datos (Supabase / PostgreSQL).

   Se carga DESPUÉS de la librería oficial de Supabase:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="js/supabase.js"></script>

   SOBRE LA LLAVE
   La "publishable key" (sb_publishable_...) está pensada para ir en el
   navegador: cualquiera puede verla, y no pasa nada porque las reglas RLS
   de la base deciden qué puede hacer cada visitante.
   NUNCA pongas aquí la "secret key" (sb_secret_...) ni la "service_role":
   esas se saltan todas las reglas.

   SOBRE "async / await" (léelo una vez, se usa en todo el archivo)
   localStorage responde al instante:
       let productos = leerLocal(...);        // ya tienes los datos
   Supabase está en internet y tarda unos milisegundos:
       let respuesta = sb.from("productos").select();   // ¡todavía NO hay datos!
   "await" significa "espera aquí hasta que llegue la respuesta":
       let respuesta = await sb.from("productos").select();   // ahora sí
   Solo se puede usar await dentro de una función marcada "async".
   Una función async devuelve una "promesa": quien la llame también
   tiene que usar await para recibir el resultado.
===================================================== */

// 1. Pega aquí los datos de tu proyecto (Supabase → Project Settings → API Keys)
//    Ojo: la URL va SIN "/rest/v1/" al final; la librería lo agrega sola.
const SUPABASE_URL = "https://zqtyxnjrsiydrokktqod.supabase.co";
const SUPABASE_KEY = "sb_publishable_0UZ0FlYcYVzohi6N06wVPQ_n0AAjyh0";

// 2. Crea el cliente. "sb" es el objeto que usaremos para hablar con la base.
//    (window.supabase es la librería; sb es nuestra conexión.)
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Toda respuesta de Supabase trae { data, error }. Esta ayuda lanza el
// error si lo hubo, así no hay que revisarlo a mano cada vez.
function revisar(respuesta, queHacia) {
    if (respuesta.error) {
        console.error("Supabase (" + queHacia + "):", respuesta.error);
        throw new Error("No se pudo " + queHacia + ": " + respuesta.error.message);
    }
    return respuesta.data;
}

// =====================================================
// LECTURAS DEL CATÁLOGO
// Convierten las filas de la base al MISMO formato de objetos que usa hoy
// app.js, para que el resto del código (tarjetas, filtros, ficha) no cambie.
// =====================================================

function campanaDesdeFila(fila) {
    if (!fila) {
        return Object.assign({}, CAMPANA_INICIAL);
    }
    return {
        id: fila.id,
        nombre: fila.nombre,
        subtitulo: fila.subtitulo,
        inicio: fila.inicio,
        fin: fila.fin,
        stockMinimo: fila.stock_minimo
    };
}

function productoDesdeFila(fila, campanaActual) {
    // Las variantes llegan sueltas; las ordenamos por talla y color
    let variantes = (fila.variantes || []).slice().sort(function (a, b) {
        return a.orden_talla - b.orden_talla || a.orden_color - b.orden_color;
    });

    let stockTallas = {};        // { "S": 5, "M": 8 }  ← lo que usa hoy la tienda
    let stockVariantes = {};     // { "M|Negro": 3 }    ← nuevo, para el carrito de la etapa 3
    let colores = [];
    variantes.forEach(function (v) {
        stockTallas[v.talla] = (stockTallas[v.talla] || 0) + v.stock;
        stockVariantes[v.talla + "|" + v.color] = v.stock;
        if (!colores.some(function (c) { return c.nombre === v.color; })) {
            colores.push({ nombre: v.color, hex: v.color_hex });
        }
    });
    if (colores.length === 0) {
        colores.push({ nombre: "Negro", hex: COLORES.Negro });
    }

    // Oferta de campaña → usa la fecha de fin de la campaña (igual que hoy).
    // Si es de una campaña que ya no está activa, se trata como vencida
    // (la base de datos, que cobra, piensa igual: ver oferta_vigente()).
    let ofertaHasta = "";
    if (fila.descuento > 0) {
        if (fila.campana_id) {
            ofertaHasta = campanaActual && campanaActual.id === fila.campana_id ? campanaActual.fin : "2000-01-01T00:00:00Z";
        } else {
            ofertaHasta = fila.oferta_hasta || "";
        }
    }

    return {
        id: fila.id,
        nombre: fila.nombre,
        categoria: fila.categoria_id,
        genero: fila.genero,
        descripcion: fila.descripcion,
        detalle: fila.detalle,
        precio: Number(fila.precio),            // numeric llega como texto o número: lo forzamos a número
        descuento: fila.descuento,
        ofertaHasta: ofertaHasta,
        campanaId: fila.campana_id || null,     // si la oferta usa las fechas de la campaña
        stockTallas: stockTallas,
        stockVariantes: stockVariantes,
        colores: colores,
        especificaciones: fila.especificaciones || [],
        imagen: fila.imagen,
        vistas: { espalda: fila.vista_espalda, izquierda: fila.vista_izquierda, derecha: fila.vista_derecha },
        nuevo: fila.nuevo,
        activo: fila.activo,
        sku: fila.sku,
        fecha: new Date(fila.creado_en).toLocaleDateString("es-PE")
    };
}

// Campaña activa más reciente
async function leerCampana() {
    let filas = revisar(
        await sb.from("campanas").select("*").eq("activa", true).order("inicio", { ascending: false }).limit(1),
        "leer la campaña"
    );
    return campanaDesdeFila(filas[0]);
}

// Supabase entrega como máximo 1000 filas por consulta. Esta ayuda pide
// de a 1000 hasta traerlas todas (útil cuando haya muchos pedidos).
async function leerTodo(armarConsulta, queHacia) {
    let todas = [];
    let desde = 0;
    const TAMANO = 1000;
    while (true) {
        let filas = revisar(await armarConsulta().range(desde, desde + TAMANO - 1), queHacia);
        todas = todas.concat(filas);
        if (filas.length < TAMANO) {
            return todas;
        }
        desde += TAMANO;
    }
}

// "variantes(*)" trae las filas relacionadas en la misma consulta
function leerFilasProductos() {
    return leerTodo(function () {
        return sb.from("productos").select("*, variantes(*)").order("creado_en").order("id");
    }, "leer los productos");
}

// Todos los productos con sus variantes, en el formato de app.js
async function leerProductos(campanaActual) {
    let filas = await leerFilasProductos();
    return filas.map(function (f) { return productoDesdeFila(f, campanaActual); });
}

async function leerCupones() {
    let filas = revisar(await sb.from("cupones").select("*").order("codigo"), "leer los cupones");
    return filas.map(function (c) {
        return { codigo: c.codigo, tipo: c.tipo, valor: Number(c.valor), minimo: Number(c.minimo), activo: c.activo, descripcion: c.descripcion };
    });
}

// =====================================================
// CUENTAS (etapa 2): login, registro, perfil y salir
//
// Cómo funciona la sesión con Supabase Auth:
// - Al ingresar, Supabase guarda un "token" (un pase firmado) en el
//   navegador y lo renueva solo. Ya no guardamos la sesión nosotros.
// - Cada consulta a la base viaja con ese token; así la base sabe quién
//   eres (auth.uid()) y aplica las reglas RLS.
// - El rol (cliente / admin) se lee de public.clientes. Ocultar botones con
//   esAdmin() es solo comodidad visual: la seguridad real está en RLS.
// =====================================================

// Convierte una fila de public.clientes al formato de cuenta que usa app.js
function perfilDesdeFila(fila) {
    return {
        id: fila.id,
        usuario: fila.correo,
        correo: fila.correo,
        nombre: fila.nombre,
        rol: fila.rol,
        genero: fila.genero,
        nacimiento: fila.nacimiento || "",
        telefono: fila.telefono,
        distrito: fila.distrito,
        talla: fila.talla,
        prendas: fila.prendas || [],
        estilo: fila.estilo,
        newsletter: fila.newsletter,
        registro: fila.creado_en
    };
}

// Mensajes de Supabase (en inglés) traducidos para el cliente
function traducirErrorAuth(error) {
    let m = (error && error.message || "").toLowerCase();
    if (m.includes("invalid login credentials")) { return "Correo o contraseña incorrectos."; }
    if (m.includes("email not confirmed")) { return "Aún no confirmas tu correo. Revisa tu bandeja de entrada (y la carpeta de spam)."; }
    if (m.includes("already registered") || m.includes("already been registered")) { return "Ya existe una cuenta con ese correo. Ingresa desde Login."; }
    if (m.includes("password should be") || m.includes("weak password")) { return "La contraseña es muy débil. Usa al menos 8 caracteres con letras y números."; }
    if (m.includes("rate limit") || m.includes("too many")) { return "Demasiados intentos seguidos. Espera un minuto y vuelve a probar."; }
    if (m.includes("failed to fetch") || m.includes("network")) { return "No hay conexión con el servidor. Revisa tu internet."; }
    return "Ocurrió un problema: " + (error && error.message ? error.message : "inténtalo de nuevo.");
}

// Lee quién está conectado y llena las variables globales "sesion" y "usuarios"
// (declaradas en app.js). Se llama una vez al cargar cada página.
async function cargarSesion() {
    let { data } = await sb.auth.getSession();          // lo lee del navegador: es rápido
    if (!data.session) {
        sesion = null;
        usuarios = [];
        return null;
    }
    let usuarioAuth = data.session.user;
    let fila = revisar(
        await sb.from("clientes").select("*").eq("id", usuarioAuth.id).maybeSingle(),
        "leer tu perfil"
    );
    // Si el perfil aún no existe (no se ejecutó 03_auth.sql), usamos lo básico
    let perfil = fila ? perfilDesdeFila(fila) : {
        id: usuarioAuth.id, usuario: usuarioAuth.email, correo: usuarioAuth.email,
        nombre: (usuarioAuth.user_metadata && usuarioAuth.user_metadata.nombre) || usuarioAuth.email, rol: "usuario"
    };
    sesion = { id: perfil.id, usuario: perfil.correo, correo: perfil.correo, nombre: perfil.nombre, rol: perfil.rol };
    usuarios = [perfil];

    // El admin necesita la lista de clientes para el panel (RLS solo se la da a él)
    if (perfil.rol === "admin") {
        let todos = await leerTodo(function () { return sb.from("clientes").select("*").order("creado_en"); }, "leer los clientes");
        usuarios = todos.map(perfilDesdeFila);
    }
    return sesion;
}

// Devuelve { ok: true } o { ok: false, mensaje: "..." }
async function ingresar(correo, clave) {
    let { error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
    if (error) {
        return { ok: false, mensaje: traducirErrorAuth(error) };
    }
    await cargarSesion();
    return { ok: true };
}

// "datos" trae nombre, nacimiento, talla, etc. Viajan como "metadata" y el
// trigger de 03_auth.sql los copia a public.clientes.
// Devuelve { ok, sesionIniciada, mensaje }. sesionIniciada es false cuando
// Supabase pide confirmar el correo antes de entrar.
async function registrarCuenta(correo, clave, datos) {
    let { data, error } = await sb.auth.signUp({
        email: correo,
        password: clave,
        options: {
            data: datos,
            // A dónde vuelve el cliente al hacer clic en el correo de confirmación
            emailRedirectTo: new URL("login.html", window.location.href).href
        }
    });
    if (error) {
        return { ok: false, mensaje: traducirErrorAuth(error) };
    }
    // Con "confirmar correo" activo, Supabase no avisa que el correo ya existe
    // (por privacidad): devuelve un usuario sin "identities".
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { ok: false, mensaje: "Ya existe una cuenta con ese correo. Ingresa desde Login." };
    }
    if (data.session) {
        await cargarSesion();
        return { ok: true, sesionIniciada: true };
    }
    return { ok: true, sesionIniciada: false };
}

// Guarda los cambios de "Mis datos" (solo columnas que el cliente puede tocar)
async function guardarPerfil(cambios) {
    let permitidos = {};
    ["nombre", "telefono", "nacimiento", "genero", "talla", "distrito", "prendas", "estilo", "newsletter"].forEach(function (k) {
        if (k in cambios) { permitidos[k] = cambios[k]; }
    });
    if (permitidos.nacimiento === "") { permitidos.nacimiento = null; }
    revisar(await sb.from("clientes").update(permitidos).eq("id", sesion.id), "guardar tus datos");
    await cargarSesion();
}

let saliendoAhora = false;

async function salirDeSupabase() {
    saliendoAhora = true;
    await sb.auth.signOut();
    sesion = null;
    usuarios = [];
}

// Si la sesión se cierra en otra pestaña (o vence), esta pestaña se recarga
// para no mostrar datos de alguien que ya salió.
sb.auth.onAuthStateChange(function (evento) {
    if (evento !== "SIGNED_OUT" || saliendoAhora) {
        return;
    }
    try {
        if (sesion !== null) { window.location.reload(); }
    } catch (e) {
        // app.js todavía no terminó de cargar: no hay nada que limpiar
    }
});

// =====================================================
// PEDIDOS (etapa 3)
// =====================================================

// Fila de la base → objeto pedido con el formato de siempre (app.js, cuenta, admin)
function pedidoDesdeFila(f) {
    return {
        id: f.id,
        cliente: f.correo,
        nombre: f.nombre,
        fecha: f.fecha,
        items: (f.pedido_items || []).map(function (i) {
            return {
                id: i.producto_id || "", nombre: i.nombre, categoria: i.categoria, talla: i.talla, color: i.color,
                cantidad: i.cantidad, precio: Number(i.precio), precioLista: Number(i.precio_lista), oferta: i.oferta, imagen: i.imagen
            };
        }),
        subtotal: Number(f.subtotal),
        descuentoCupon: Number(f.descuento_cupon),
        cupon: f.cupon_codigo || "",
        envio: Number(f.envio),
        total: Number(f.total),
        metodo: f.metodo,
        pagoDetalle: f.pago_detalle || "",
        estado: f.estado,
        entrega: f.entrega || {},
        telefono: f.telefono || "",
        dni: f.dni || "",
        semilla: !!f.es_ejemplo
    };
}

// El cliente recibe solo SUS pedidos y el admin, todos (lo decide RLS, no este código)
async function leerPedidos() {
    let filas = await leerTodo(function () {
        return sb.from("pedidos").select("*, pedido_items(*)").order("fecha");
    }, "leer los pedidos");
    return filas.map(pedidoDesdeFila);
}

// Convierte los códigos de error de crear_pedido() en mensajes para el cliente
function traducirErrorPedido(error) {
    let m = (error && error.message) || "";
    if (m.indexOf("SIN_STOCK") === 0) { return "Se acaba de agotar: " + m.replace("SIN_STOCK: ", "") + ". Actualizamos tu carrito."; }
    if (m.indexOf("NO_EXISTE") === 0) { return "Una prenda de tu carrito ya no está disponible. Actualizamos tu carrito."; }
    if (m.indexOf("NECESITA_SESION") === 0 || m.indexOf("SIN_PERFIL") === 0) { return "Tu sesión expiró. Vuelve a ingresar para terminar la compra."; }
    if (m.indexOf("FALTA_DIRECCION") === 0) { return "Falta la dirección de entrega."; }
    if (m.indexOf("METODO_NO_DISPONIBLE") === 0) { return "Ese método de pago no está disponible por ahora. Elige otro."; }
    if (m.indexOf("FALTA_OPERACION") === 0) { return "Escribe el número de operación de tu transferencia."; }
    if (m.indexOf("CARRITO_VACIO") === 0) { return "Tu carrito está vacío."; }
    if (m.indexOf("CANTIDAD_INVALIDA") === 0 || m.indexOf("DEMASIADOS_ITEMS") === 0) { return "Revisa las cantidades de tu carrito (máximo 20 unidades por prenda)."; }
    return traducirErrorAuth(error);
}

// Llama a la función crear_pedido() de la base (04_pedidos.sql).
// Solo enviamos QUÉ se compra; precios, cupón y envío los calcula la base.
// Devuelve { ok: true, pedido } o { ok: false, mensaje, revisarCarrito }
async function crearPedidoEnSupabase(datos) {
    let { data, error } = await sb.rpc("crear_pedido", {
        p_items: datos.items,                 // [{producto_id, talla, color, cantidad}]
        p_entrega: datos.entrega,
        p_metodo: datos.metodo,
        p_pago_detalle: datos.pagoDetalle || "",
        p_cupon: datos.cupon || "",
        p_nombre: datos.nombre || "",
        p_telefono: datos.telefono || "",
        p_dni: datos.dni || ""
    });
    if (error) {
        console.error("crear_pedido:", error);
        let m = error.message || "";
        return { ok: false, mensaje: traducirErrorPedido(error), revisarCarrito: m.indexOf("SIN_STOCK") === 0 || m.indexOf("NO_EXISTE") === 0 };
    }
    return { ok: true, pedido: pedidoDesdeFila(data) };
}

// Seguimiento con número + correo (funciona sin iniciar sesión)
async function seguirPedidoEnSupabase(numero, correo) {
    let { data, error } = await sb.rpc("seguir_pedido", { p_numero: numero, p_correo: correo });
    if (error) {
        throw new Error(traducirErrorAuth(error));
    }
    return data ? pedidoDesdeFila(data) : null;
}

// =====================================================
// FAVORITOS (etapa 3)
// =====================================================
async function leerFavoritos() {
    let filas = revisar(await sb.from("favoritos").select("producto_id").order("creado_en"), "leer tus favoritos");
    return filas.map(function (f) { return f.producto_id; });
}

async function agregarFavoritoBD(id) {
    // upsert + ignoreDuplicates: si ya estaba guardado, no da error
    revisar(await sb.from("favoritos").upsert({ cliente_id: sesion.id, producto_id: id },
        { onConflict: "cliente_id,producto_id", ignoreDuplicates: true }), "guardar el favorito");
}

async function quitarFavoritoBD(id) {
    revisar(await sb.from("favoritos").delete().eq("cliente_id", sesion.id).eq("producto_id", id), "quitar el favorito");
}

// =====================================================
// RESEÑAS (etapa 3)
// "Compra verificada", el nombre corto y la talla los pone la base
// (trigger preparar_resena de 01_tablas.sql), no el navegador.
// =====================================================
function resenaDesdeFila(r) {
    return {
        id: r.producto_id, nombre: r.nombre, estrellas: r.estrellas, texto: r.texto, fecha: r.creado_en,
        foto: r.foto_url, talla: r.talla, verificada: r.verificada,
        propia: sesion !== null && r.cliente_id === sesion.id
    };
}

// Sin productoId trae las 30 más recientes (para el inicio)
async function leerResenas(productoId) {
    let consulta = sb.from("resenas").select("*").order("creado_en", { ascending: false });
    consulta = productoId ? consulta.eq("producto_id", productoId) : consulta.limit(30);
    let filas = revisar(await consulta, "leer las reseñas");
    let mapa = {};
    filas.forEach(function (r) {
        (mapa[r.producto_id] = mapa[r.producto_id] || []).push(resenaDesdeFila(r));
    });
    return mapa;
}

// "foto" llega como data URL (la imagen reducida del formulario): se sube a
// Storage y en la base solo se guarda su dirección (mucho más liviano).
async function publicarResena(productoId, estrellasElegidas, texto, foto) {
    let fotoUrl = "";
    if (foto && foto.indexOf("data:image/") === 0) {
        fotoUrl = await subirFoto(await (await fetch(foto)).blob(), "resenas/" + sesion.id);
    }
    revisar(await sb.from("resenas").insert({
        producto_id: productoId, estrellas: estrellasElegidas, texto: texto, foto_url: fotoUrl
    }), "publicar tu reseña");
    let mapa = await leerResenas(productoId);
    resenasBD[productoId] = mapa[productoId] || [];
}

// =====================================================
// EVENTOS: vistas y "agregar al carrito" (para estadísticas)
// No usa await a propósito: se envía y la página sigue sin esperar.
// =====================================================
function registrarEvento(productoId, tipo, cantidad) {
    sb.from("eventos_producto")
        .insert({ producto_id: productoId, tipo: tipo, cantidad: Math.max(1, Math.min(50, cantidad || 1)) })
        .then(function (r) { if (r.error) { console.warn("No se registró el evento:", r.error.message); } });
}

// =====================================================
// FOTOS (etapa 4): Supabase Storage, bucket "fotos" (05_admin.sql)
// =====================================================

// Sube una imagen (Blob) y devuelve su dirección pública https://...
async function subirFoto(blob, carpeta) {
    let ruta = carpeta + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
    revisar(await sb.storage.from("fotos").upload(ruta, blob, { contentType: blob.type || "image/jpeg", cacheControl: "31536000" }), "subir la foto");
    return sb.storage.from("fotos").getPublicUrl(ruta).data.publicUrl;
}

// Convierte un <canvas> en archivo JPG (toBlob usa una "callback": la envolvemos en una promesa)
function lienzoABlob(lienzo, calidad) {
    return new Promise(function (resolver) { lienzo.toBlob(resolver, "image/jpeg", calidad || 0.82); });
}

// =====================================================
// FORMULARIOS PÚBLICOS (etapa 4): reclamaciones, contacto y newsletter
// =====================================================
async function registrarReclamoBD(hoja) {
    let { data, error } = await sb.rpc("registrar_reclamo", { p: hoja });
    if (error) {
        throw new Error(error.message.indexOf("DATOS_INCOMPLETOS") === 0 ? "Revisa los datos de la hoja: falta información obligatoria." : traducirErrorAuth(error));
    }
    return data;   // { numero, fecha, limite }
}

async function enviarMensajeBD(nombre, correo, motivo, mensaje) {
    let { data, error } = await sb.rpc("enviar_mensaje", { p_nombre: nombre, p_correo: correo, p_motivo: motivo, p_mensaje: mensaje });
    if (error) {
        throw new Error(traducirErrorAuth(error));
    }
    return data;   // número de atención: MSG-000001
}

async function suscribirBD(correo, origen) {
    let { error } = await sb.rpc("suscribir", { p_correo: correo, p_origen: origen || "pie" });
    if (error) {
        throw new Error(traducirErrorAuth(error));
    }
}

// "Más vendidos" con ventas reales de todos los clientes (solo totales)
async function leerMasVendidos() {
    let filas = revisar(await sb.rpc("mas_vendidos", { p_dias: 90, p_limite: 40 }), "leer los más vendidos");
    let mapa = {};
    filas.forEach(function (f) { mapa[f.producto_id] = Number(f.unidades); });
    return mapa;
}

// =====================================================
// RECUPERAR CONTRASEÑA (etapa 4)
// 1) El cliente pide el correo → Supabase envía un enlace.
// 2) El enlace abre login.html?recuperar=1 con una sesión temporal.
// 3) Ahí escribe su nueva contraseña → updateUser.
// =====================================================
async function pedirRecuperacion(correo) {
    let { error } = await sb.auth.resetPasswordForEmail(correo, {
        redirectTo: new URL("login.html?recuperar=1", window.location.href).href
    });
    if (error) {
        return { ok: false, mensaje: traducirErrorAuth(error) };
    }
    return { ok: true };
}

async function cambiarClave(nueva) {
    let { error } = await sb.auth.updateUser({ password: nueva });
    if (error) {
        return { ok: false, mensaje: traducirErrorAuth(error) };
    }
    return { ok: true };
}

// =====================================================
// PANEL ADMIN (etapa 4)
// Todas estas funciones las protege RLS: si quien llama no es admin,
// la base responde con error aunque alguien las ejecute desde la consola.
// =====================================================

// Producto en memoria (+ variantes) → formato que espera guardar_producto()
function productoParaBD(p, variantes) {
    return {
        id: p.id, sku: p.sku, nombre: p.nombre, categoria_id: p.categoria, genero: p.genero,
        descripcion: p.descripcion || "", detalle: p.detalle || "", precio: p.precio, descuento: p.descuento || 0,
        campana_id: p.descuento > 0 && p.campanaId ? p.campanaId : null,
        oferta_hasta: p.descuento > 0 && !p.campanaId && p.ofertaHasta ? p.ofertaHasta : null,
        imagen: p.imagen || "", vista_espalda: (p.vistas || {}).espalda || "",
        vista_izquierda: (p.vistas || {}).izquierda || "", vista_derecha: (p.vistas || {}).derecha || "",
        especificaciones: p.especificaciones || [], nuevo: !!p.nuevo,
        variantes: variantes || variantesDe(p)
    };
}

// Lista de variantes de un producto que ya está en memoria
function variantesDe(p) {
    let lista = [];
    Object.keys(p.stockTallas).forEach(function (talla, iTalla) {
        p.colores.forEach(function (c, iColor) {
            lista.push({ talla: talla, color: c.nombre, color_hex: c.hex, stock: stockDe(p, talla, c.nombre), orden_talla: iTalla, orden_color: iColor });
        });
    });
    return lista;
}

function traducirErrorAdmin(error) {
    let m = (error && error.message) || "";
    if (m.indexOf("SOLO_ADMIN") === 0 || m.indexOf("row-level security") >= 0) { return "Tu cuenta no tiene permiso de administrador."; }
    if (m.indexOf("PEDIDO_CANCELADO") === 0) { return "Un pedido cancelado no se puede reactivar (su stock ya se devolvió)."; }
    if (m.indexOf("SIN_VARIANTES") === 0) { return "La prenda necesita al menos una talla y un color."; }
    if (m.indexOf("duplicate key") >= 0) { return "Ya existe un registro con ese código."; }
    return traducirErrorAuth(error);
}

function revisarAdmin(respuesta) {
    if (respuesta.error) {
        console.error("Supabase (admin):", respuesta.error);
        throw new Error(traducirErrorAdmin(respuesta.error));
    }
    return respuesta.data;
}

async function guardarProductoBD(datos) {
    revisarAdmin(await sb.rpc("guardar_producto", { p: datos }));
}

async function eliminarProductoBD(id) {
    revisarAdmin(await sb.from("productos").delete().eq("id", id));
}

// cambios: columnas de la tabla productos, por ejemplo { descuento: 0, campana_id: null }
async function actualizarProductoBD(id, cambios) {
    revisarAdmin(await sb.from("productos").update(cambios).eq("id", id));
}

// Misma oferta para toda una categoría (o toda la tienda si categoria === "todas")
async function ofertaMasivaBD(categoria, porcentaje, campanaId) {
    let consulta = sb.from("productos").update({
        descuento: porcentaje, campana_id: porcentaje > 0 ? campanaId : null, oferta_hasta: null
    });
    consulta = categoria === "todas" ? consulta.neq("id", "") : consulta.eq("categoria_id", categoria);
    revisarAdmin(await consulta);
}

// Crea o actualiza la campaña. Con "extender", todas las prendas con
// descuento pasan a usar las fechas de esta campaña.
async function guardarCampanaBD(c, extender) {
    let fila = { nombre: c.nombre, subtitulo: c.subtitulo, inicio: c.inicio, fin: c.fin, stock_minimo: c.stockMinimo, activa: true };
    let guardada = c.id
        ? revisarAdmin(await sb.from("campanas").update(fila).eq("id", c.id).select().single())
        : revisarAdmin(await sb.from("campanas").insert(fila).select().single());
    if (extender) {
        revisarAdmin(await sb.from("productos").update({ campana_id: guardada.id, oferta_hasta: null }).gt("descuento", 0));
    }
    return campanaDesdeFila(guardada);
}

async function crearCuponBD(cupon) {
    revisarAdmin(await sb.from("cupones").insert(cupon));
}

async function actualizarCuponBD(codigo, cambios) {
    revisarAdmin(await sb.from("cupones").update(cambios).eq("codigo", codigo));
}

async function borrarCuponBD(codigo) {
    revisarAdmin(await sb.from("cupones").delete().eq("codigo", codigo));
}

// Al cancelar, el trigger de 05_admin.sql devuelve el stock solo
async function cambiarEstadoPedidoBD(id, estado) {
    revisarAdmin(await sb.from("pedidos").update({ estado: estado }).eq("id", id));
}

function reclamoDesdeFila(r) {
    return {
        numero: r.numero, fecha: r.fecha, limite: r.limite, nombre: r.nombre, tipoDocumento: r.tipo_documento,
        documento: r.documento, domicilio: r.domicilio, telefono: r.telefono, correo: r.correo, apoderado: r.apoderado,
        tipoBien: r.tipo_bien, monto: r.monto, numeroPedido: r.numero_pedido, descripcionBien: r.descripcion_bien,
        tipo: r.tipo, detalle: r.detalle, pedido: r.pedido, estado: r.estado, respuesta: r.respuesta, fechaRespuesta: r.fecha_respuesta
    };
}

async function leerReclamos() {
    let filas = await leerTodo(function () { return sb.from("reclamaciones").select("*").order("fecha"); }, "leer las reclamaciones");
    return filas.map(reclamoDesdeFila);
}

async function responderReclamoBD(numero, respuesta) {
    revisarAdmin(await sb.from("reclamaciones")
        .update({ respuesta: respuesta, estado: "Respondido", fecha_respuesta: new Date().toISOString() })
        .eq("numero", numero));
}

async function leerMensajes() {
    return leerTodo(function () { return sb.from("mensajes").select("*").order("fecha", { ascending: false }); }, "leer los mensajes");
}

async function marcarMensajeLeidoBD(numero, leido) {
    revisarAdmin(await sb.from("mensajes").update({ leido: leido }).eq("numero", numero));
}

async function leerSuscriptores() {
    return leerTodo(function () { return sb.from("suscriptores").select("*").order("creado_en", { ascending: false }); }, "leer los suscriptores");
}

// Suma dos juegos de contadores {vistas, carrito, vistasCliente}
function sumarEventos(a, b) {
    let total = { vistas: {}, carrito: {}, vistasCliente: {} };
    [a, b].forEach(function (e) {
        if (!e) { return; }
        ["vistas", "carrito"].forEach(function (tipo) {
            Object.keys(e[tipo] || {}).forEach(function (id) { total[tipo][id] = (total[tipo][id] || 0) + Number(e[tipo][id]); });
        });
        Object.keys(e.vistasCliente || {}).forEach(function (correo) {
            let destino = total.vistasCliente[correo] = total.vistasCliente[correo] || {};
            Object.keys(e.vistasCliente[correo]).forEach(function (id) { destino[id] = (destino[id] || 0) + Number(e.vistasCliente[correo][id]); });
        });
    });
    return total;
}

// =====================================================
// CARGA INICIAL (la llama el arranque de app.js en cada página)
// =====================================================
async function cargarDatosDeSupabase() {
    // 1.ª tanda: 4 consultas EN PARALELO (Promise.all espera a que terminen todas)
    let resultados = await Promise.all([cargarSesion(), leerCampana(), leerFilasProductos(), leerCupones()]);
    campana = resultados[1];
    productos = resultados[2].map(function (f) { return productoDesdeFila(f, campana); });
    cupones = resultados[3];

    // 2.ª tanda: lo que depende de la sesión o de la página
    let idFicha = pagina === "producto" ? new URLSearchParams(location.search).get("id") : null;
    let segunda = await Promise.all([
        sesion !== null ? leerPedidos() : [],
        sesion !== null ? leerFavoritos() : null,
        pagina === "index" ? leerResenas(null) : (idFicha ? leerResenas(idFicha) : {})
    ]);

    // Pedidos de ejemplo (en memoria, solo para estadísticas y "más vendidos").
    // Nunca se mezclan con los pedidos propios de un cliente real.
    let ejemplos = DATOS_DE_EJEMPLO ? pedidosIniciales(productos).filter(function (p) {
        return sesion === null || sesion.rol === "admin" || p.cliente !== sesion.correo;
    }) : [];
    pedidos = ejemplos.concat(segunda[0]).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });

    // Favoritos: con sesión vienen de la base; los guardados sin sesión se suben una vez
    let locales = leerLocal(CLAVES.favoritos, []).filter(function (id) { return buscarProducto(id) !== null; });
    if (sesion !== null) {
        favoritos = segunda[1];
        let nuevos = locales.filter(function (id) { return !favoritos.includes(id); });
        if (nuevos.length > 0) {
            revisar(await sb.from("favoritos").upsert(nuevos.map(function (id) { return { cliente_id: sesion.id, producto_id: id }; }),
                { onConflict: "cliente_id,producto_id", ignoreDuplicates: true }), "subir tus favoritos");
            favoritos = favoritos.concat(nuevos);
        }
        localStorage.removeItem(CLAVES.favoritos);
    } else {
        favoritos = locales;
    }

    resenasBD = segunda[2];

    // 3.ª tanda (etapa 4). Si falla (por ejemplo, aún no ejecutaste
    // 05_admin.sql), la tienda sigue funcionando sin estos extras.
    try {
        await cargarExtrasEtapa4();
    } catch (error) {
        console.warn("NOVAK: no se cargaron estadísticas/extras. ¿Ejecutaste 05_admin.sql?", error);
        if (esAdmin()) {
            eventos = DATOS_DE_EJEMPLO ? eventosIniciales(productos, pedidos) : eventos;
        }
    }
}

async function cargarExtrasEtapa4() {
    if (esAdmin()) {
        // Estadísticas: vistas reales de la base + (si DATOS_DE_EJEMPLO) las de ejemplo
        let tareas = [sb.rpc("resumen_eventos")];
        if (pagina === "admin") {
            tareas.push(leerReclamos(), leerMensajes(), leerSuscriptores());
        }
        let tercera = await Promise.all(tareas);
        let reales = revisarAdmin(tercera[0]);
        eventos = sumarEventos(DATOS_DE_EJEMPLO ? eventosIniciales(productos, pedidos) : null, reales);
        if (pagina === "admin") {
            reclamos = tercera[1];
            mensajes = tercera[2];
            suscriptores = tercera[3];
        }
    } else if (pagina === "index" || pagina === "carrito") {
        ventasReales = await leerMasVendidos();
    }
}

// Vuelve a leer el stock (por ejemplo, después de una compra o si se agotó algo)
async function recargarCatalogo() {
    productos = await leerProductos(campana);
}

async function recargarCupones() {
    cupones = await leerCupones();
}

// =====================================================
// PRUEBA DE CONEXIÓN (etapa 1)
// En la consola del navegador escribe:  await probarConexion()
// =====================================================
async function probarConexion() {
    let campanaActual = await leerCampana();
    let lista = await leerProductos(campanaActual);
    let cuponesActivos = await leerCupones();
    let unidades = lista.reduce(function (s, p) { return s + stockTotal(p); }, 0);
    let resumen = {
        campana: campanaActual.nombre + " (termina " + new Date(campanaActual.fin).toLocaleString("es-PE") + ")",
        productos: lista.length,
        unidades: unidades,
        enOferta: lista.filter(function (p) { return p.descuento > 0; }).length,
        cupones: cuponesActivos.map(function (c) { return c.codigo; }).join(", ")
    };
    console.table(resumen);
    return resumen;
}

// stockTotal vive en app.js; esta copia permite usar el archivo solo (página de prueba)
if (typeof stockTotal !== "function") {
    window.stockTotal = function (p) {
        return Object.values(p.stockTallas).reduce(function (s, n) { return s + (Number(n) || 0); }, 0);
    };
}
