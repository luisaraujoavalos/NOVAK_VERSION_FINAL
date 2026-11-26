// =====================================================================
//  NOVAK · Edge Function "notificar"  (correos automáticos con Brevo)
//
//  La llama la BASE DE DATOS (triggers de 07_correos.sql), nunca el
//  navegador. Recibe { tipo, id } y envía el correo que corresponde.
//
//  Secretos necesarios (Supabase → Edge Functions → Secrets):
//    BREVO_API_KEY       → Brevo → SMTP & API → API Keys → "Generate a new API key"
//    CORREO_REMITENTE    → el correo que verificaste en Brevo (Senders), p. ej. tutienda@gmail.com
//    CORREO_TIENDA       → donde quieres recibir los avisos (puede ser el mismo)
//    NOTIFICAR_SECRETO   → el "secreto" que mostró 07_correos.sql al final
//    TIENDA_URL          → (opcional) dirección de tu web, p. ej. https://novak.netlify.app
//  SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya vienen incluidos.
//
//  Al crearla en el panel, DESACTIVA "Verify JWT": la protege el secreto.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

// ---- Datos de la tienda que salen en los correos (edítalos) ----
const TIENDA = {
    marca: "NOVAK",
    lema: "STAY DIFFERENT",
    whatsapp: "51999999999",
    colorPrincipal: "#1f2038",
    colorAcento: "#c8f560",
};

const env = (k: string) => Deno.env.get(k) ?? "";
const URL_TIENDA = env("TIENDA_URL").replace(/\/$/, "");

const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
});

// ---------------------------------------------------------------------
// Ayudas
// ---------------------------------------------------------------------
function esc(texto: unknown) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function soles(n: unknown) {
    return "S/ " + Number(n ?? 0).toFixed(2);
}

function fecha(iso: string) {
    return new Date(iso).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "long", timeStyle: "short" });
}

function enlace(ruta: string, texto: string) {
    if (!URL_TIENDA) {
        return "";
    }
    return `<p style="margin:24px 0"><a href="${esc(URL_TIENDA + "/" + ruta)}" style="background:${TIENDA.colorPrincipal};color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">${esc(texto)}</a></p>`;
}

// Marco común de todos los correos
function plantilla(titulo: string, cuerpo: string) {
    return `<!DOCTYPE html><html lang="es"><body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1b1b1f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:${TIENDA.colorPrincipal};padding:22px 28px;color:#fff;font-size:26px;font-weight:800;letter-spacing:3px">${esc(TIENDA.marca)}<span style="color:${TIENDA.colorAcento}">.</span></td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:22px;margin:0 0 16px">${esc(titulo)}</h1>
${cuerpo}
</td></tr>
<tr><td style="padding:18px 28px;background:#f4f4f2;font-size:12px;color:#666">
${esc(TIENDA.marca)} · ${esc(TIENDA.lema)}<br>
¿Dudas? Escríbenos por WhatsApp: <a href="https://wa.me/${esc(TIENDA.whatsapp)}" style="color:#1b1b1f">wa.me/${esc(TIENDA.whatsapp)}</a>
</td></tr></table></td></tr></table></body></html>`;
}

function tablaFilas(filas: [string, string][]) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:12px 0">${
        filas.map(([k, v]) => `<tr><th align="left" style="padding:8px;border-bottom:1px solid #eee;width:38%;color:#555;vertical-align:top">${esc(k)}</th><td style="padding:8px;border-bottom:1px solid #eee">${v}</td></tr>`).join("")
    }</table>`;
}

function detallePedido(p: any) {
    const items = (p.pedido_items ?? []).map((i: any) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.cantidad} × ${esc(i.nombre)}<br><small style="color:#666">Talla ${esc(i.talla)} · ${esc(i.color)}${i.oferta ? " · en oferta" : ""}</small></td>` +
        `<td align="right" style="padding:8px;border-bottom:1px solid #eee">${soles(Number(i.precio) * i.cantidad)}</td></tr>`
    ).join("");
    const linea = (k: string, v: string, fuerte = false) =>
        `<tr><td style="padding:6px 8px">${fuerte ? "<b>" + esc(k) + "</b>" : esc(k)}</td><td align="right" style="padding:6px 8px">${fuerte ? "<b>" + v + "</b>" : v}</td></tr>`;
    const entrega = p.entrega?.tipo === "recojo"
        ? "Recojo en tienda: " + esc(p.entrega.direccion)
        : esc([p.entrega?.direccion, p.entrega?.distrito, p.entrega?.departamento].filter(Boolean).join(", "));
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:12px 0">${items}
${linea("Subtotal", soles(p.subtotal))}
${Number(p.descuento_cupon) > 0 ? linea("Cupón " + p.cupon_codigo, "-" + soles(p.descuento_cupon)) : ""}
${linea("Envío", Number(p.envio) > 0 ? soles(p.envio) : "Gratis")}
${linea("Total", soles(p.total), true)}</table>
<p style="font-size:14px;color:#444"><b>Entrega:</b> ${entrega}</p>`;
}

const METODOS: Record<string, string> = {
    transferencia: "Transferencia bancaria", contraentrega: "Pago contra entrega",
};

// ---------------------------------------------------------------------
// Envío con Brevo (API HTTP: https://api.brevo.com/v3/smtp/email)
// ---------------------------------------------------------------------
async function enviar(para: string, nombre: string, asunto: string, html: string, responderA?: string) {
    const cuerpo: Record<string, unknown> = {
        sender: { name: TIENDA.marca, email: env("CORREO_REMITENTE") },
        to: [{ email: para, name: nombre || para }],
        subject: asunto,
        htmlContent: html,
    };
    if (responderA) {
        cuerpo.replyTo = { email: responderA };
    }
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": env("BREVO_API_KEY"), "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(cuerpo),
    });
    if (!r.ok) {
        console.error("Brevo rechazó el correo:", r.status, await r.text());
        return false;
    }
    return true;
}

// ---------------------------------------------------------------------
// Cada tipo de correo
// ---------------------------------------------------------------------
async function correoPedidoNuevo(id: string) {
    const { data: p } = await admin.from("pedidos").select("*, pedido_items(*)").eq("id", id).maybeSingle();
    if (!p) {
        return;
    }
    const instrucciones: Record<string, string> = {
        transferencia: "Estamos verificando tu transferencia (máximo 2 horas hábiles). Te avisaremos al confirmarla.",
        contraentrega: "Ya lo estamos preparando. Pagarás en efectivo al recibirlo.",
    };
    await enviar(p.correo, p.nombre, `Recibimos tu pedido ${p.id}`, plantilla(`¡Gracias, ${p.nombre.split(" ")[0]}!`,
        `<p>Recibimos tu pedido <b>${esc(p.id)}</b> del ${esc(fecha(p.fecha))}.</p>
<p><b>Estado:</b> ${esc(p.estado)} · <b>Pago:</b> ${esc(METODOS[p.metodo] ?? p.metodo)}</p>
<p>${esc(instrucciones[p.metodo] ?? "")}</p>
${detallePedido(p)}
${enlace("seguimiento.html?pedido=" + encodeURIComponent(p.id), "Seguir mi pedido")}`));
    await avisoTiendaPedido(p);
}

async function avisoTiendaPedido(p: any) {
    await enviar(env("CORREO_TIENDA"), TIENDA.marca, `Nuevo pedido ${p.id} · ${soles(p.total)} · ${METODOS[p.metodo] ?? p.metodo}`,
        plantilla(`Nuevo pedido ${p.id}`,
            tablaFilas([
                ["Cliente", esc(p.nombre) + "<br>" + esc(p.correo) + (p.telefono ? " · " + esc(p.telefono) : "")],
                ["Pago", esc(METODOS[p.metodo] ?? p.metodo) + (p.pago_detalle ? "<br>" + esc(p.pago_detalle) : "")],
                ["Estado", esc(p.estado)],
            ]) +
            (p.estado === "Pendiente de pago" && p.metodo === "transferencia" ? "<p><b>Revisa tu banco</b> y, si la transferencia llegó, cámbialo a <b>Pagado</b> en Panel admin → Pedidos.</p>" : "") +
            detallePedido(p)), p.correo);
}

async function correoEstadoPedido(id: string) {
    const { data: p } = await admin.from("pedidos").select("*, pedido_items(*)").eq("id", id).maybeSingle();
    if (!p) {
        return;
    }
    const mensajes: Record<string, string> = {
        "Pagado": "¡Confirmamos tu pago! Ya estamos preparando tu pedido.",
        "Preparando": "Estamos preparando tu pedido con mucho cuidado.",
        "En camino": p.entrega?.tipo === "recojo" ? "Tu pedido ya está listo para recoger en tienda." : "¡Tu pedido va en camino!",
        "Entregado": "Tu pedido fue entregado. ¡Esperamos que lo disfrutes! Cuéntanos qué te pareció dejando una reseña.",
        "Cancelado": "Tu pedido fue cancelado. Si ya habías pagado, te contactaremos para la devolución. Si no reconoces esta cancelación, escríbenos.",
        "Pendiente de pago": "Tu pedido está pendiente de pago.",
    };
    await enviar(p.correo, p.nombre, `Tu pedido ${p.id}: ${p.estado}`, plantilla(`Pedido ${p.id}: ${p.estado}`,
        `<p>${esc(mensajes[p.estado] ?? "El estado de tu pedido cambió.")}</p>
${detallePedido(p)}
${enlace(p.estado === "Entregado" ? "cuenta.html#pedidos" : "seguimiento.html?pedido=" + encodeURIComponent(p.id), p.estado === "Entregado" ? "Dejar una reseña" : "Seguir mi pedido")}`));
}

async function correoReclamoNuevo(numero: string) {
    const { data: r } = await admin.from("reclamaciones").select("*").eq("numero", numero).maybeSingle();
    if (!r) {
        return;
    }
    const tipo = r.tipo === "queja" ? "queja" : "reclamo";
    const hoja = tablaFilas([
        ["N.º de hoja", "<b>" + esc(r.numero) + "</b>"],
        ["Fecha", esc(fecha(r.fecha))],
        ["Consumidor", esc(r.nombre) + "<br>" + esc(r.tipo_documento) + " " + esc(r.documento) + "<br>" + esc(r.domicilio) + (r.telefono ? "<br>" + esc(r.telefono) : "") + "<br>" + esc(r.correo)],
        ...(r.apoderado ? [["Padre, madre o apoderado", esc(r.apoderado)] as [string, string]] : []),
        ["Bien contratado", esc(r.tipo_bien) + ": " + esc(r.descripcion_bien) + (r.monto ? " · S/ " + esc(r.monto) : "") + (r.numero_pedido ? " · Pedido " + esc(r.numero_pedido) : "")],
        ["Tipo", tipo === "queja" ? "Queja" : "Reclamo"],
        ["Detalle", esc(r.detalle)],
        ["Pedido del consumidor", esc(r.pedido)],
        ["Plazo de respuesta", "Hasta el " + esc(new Date(r.limite).toLocaleDateString("es-PE", { timeZone: "America/Lima" })) + " (15 días hábiles)"],
    ]);
    // Copia para el consumidor (la norma exige entregársela)
    await enviar(r.correo, r.nombre, `Copia de tu hoja de reclamación ${r.numero}`, plantilla(`Hoja de reclamación ${r.numero}`,
        `<p>Registramos tu ${tipo}. Esta es la copia de tu hoja del Libro de Reclamaciones Virtual. Te responderemos a este correo en un plazo máximo de 15 días hábiles.</p>${hoja}
<p style="font-size:12px;color:#666">La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el Indecopi.</p>`));
    // Aviso para la tienda
    await enviar(env("CORREO_TIENDA"), TIENDA.marca, `⚠️ Nuevo ${tipo} ${r.numero} · responder antes del ${new Date(r.limite).toLocaleDateString("es-PE", { timeZone: "America/Lima" })}`,
        plantilla(`Nuevo ${tipo} ${r.numero}`, `<p>Respóndelo desde Panel admin → Reclamaciones antes del plazo legal.</p>${hoja}`), r.correo);
}

async function correoReclamoRespuesta(numero: string) {
    const { data: r } = await admin.from("reclamaciones").select("*").eq("numero", numero).maybeSingle();
    if (!r || !r.respuesta) {
        return;
    }
    await enviar(r.correo, r.nombre, `Respuesta a tu hoja de reclamación ${r.numero}`, plantilla(`Respuesta a tu hoja ${r.numero}`,
        `<p>Hola, ${esc(r.nombre.split(" ")[0])}. Esta es nuestra respuesta a tu ${r.tipo === "queja" ? "queja" : "reclamo"} registrado el ${esc(fecha(r.fecha))}:</p>
<blockquote style="margin:16px 0;padding:14px 18px;background:#f4f4f2;border-left:4px solid ${TIENDA.colorPrincipal};white-space:pre-wrap">${esc(r.respuesta)}</blockquote>
<p>Si tienes alguna consulta sobre esta respuesta, responde a este correo.</p>`), env("CORREO_TIENDA"));
}

async function correoMensajeNuevo(numero: string) {
    const { data: m } = await admin.from("mensajes").select("*").eq("numero", numero).maybeSingle();
    if (!m) {
        return;
    }
    await enviar(env("CORREO_TIENDA"), TIENDA.marca, `Nuevo mensaje ${m.numero} de ${m.nombre}`, plantilla(`Mensaje ${m.numero}`,
        tablaFilas([
            ["De", esc(m.nombre) + " · " + esc(m.correo)],
            ["Motivo", esc(m.motivo)],
            ["Mensaje", `<span style="white-space:pre-wrap">${esc(m.mensaje)}</span>`],
        ]) + "<p>Responde a este correo y le llegará directamente al cliente.</p>"), m.correo);
}

async function correoBienvenida(id: string) {
    const { data: c } = await admin.from("clientes").select("correo, nombre").eq("id", id).maybeSingle();
    if (!c) {
        return;
    }
    await enviar(c.correo, c.nombre, `Bienvenido a ${TIENDA.marca} 🎉`, plantilla(`¡Hola, ${(c.nombre || "").split(" ")[0] || "bienvenido"}!`,
        `<p>Gracias por unirte a ${esc(TIENDA.marca)}. Aquí tienes tu cupón de bienvenida:</p>
<p style="font-size:26px;font-weight:800;letter-spacing:2px;background:${TIENDA.colorAcento};display:inline-block;padding:10px 18px;border-radius:10px">BIENVENIDA15</p>
<p>15% de descuento en compras desde S/ 150. Escríbelo en tu carrito.</p>
${enlace("catalogo.html", "Ver el catálogo")}`));
}

// ---------------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------------
Deno.serve(async (req) => {
    if (req.method !== "POST") {
        return new Response("Método no permitido", { status: 405 });
    }
    // Solo la base de datos conoce este secreto
    if (!env("NOTIFICAR_SECRETO") || req.headers.get("x-novak-secreto") !== env("NOTIFICAR_SECRETO")) {
        return new Response("No autorizado", { status: 401 });
    }
    if (!env("BREVO_API_KEY") || !env("CORREO_REMITENTE")) {
        console.error("Faltan los secretos BREVO_API_KEY o CORREO_REMITENTE");
        return new Response("Correo no configurado", { status: 500 });
    }
    let tipo = "", id = "";
    try {
        ({ tipo, id } = await req.json());
    } catch {
        return new Response("JSON inválido", { status: 400 });
    }
    try {
        switch (tipo) {
            case "pedido_nuevo": await correoPedidoNuevo(id); break;
            case "pedido_estado": await correoEstadoPedido(id); break;
            case "reclamo_nuevo": await correoReclamoNuevo(id); break;
            case "reclamo_respuesta": await correoReclamoRespuesta(id); break;
            case "mensaje_nuevo": await correoMensajeNuevo(id); break;
            case "bienvenida": await correoBienvenida(id); break;
            default: return new Response("Tipo desconocido", { status: 400 });
        }
    } catch (e) {
        console.error("Error al preparar el correo", tipo, id, e);
        return new Response("Error", { status: 500 });
    }
    return new Response("ok");
});
