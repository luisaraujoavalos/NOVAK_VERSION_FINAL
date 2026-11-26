/* =====================================================
   NOVAK - admin.js
   Herramientas del administrador (todo se guarda en Supabase):
   1. Formulario de prenda (tallas × colores, ofertas y 4 vistas)
   2. Eliminar prenda y actualizar stock
   3. Panel admin.html: Resumen, Prendas, Clientes, Pedidos, Ofertas,
      Reclamaciones y Mensajes
   Las acciones "estadisticas", "editar", "eliminar" y "perfil-cliente"
   funcionan en cualquier página si la sesión es de administrador.

   Patrón de cada acción (léelo una vez):
     1) validar el formulario
     2) await ...BD(...)          ← guarda en Supabase (puede tardar)
     3) await refrescarTrasCambio()  ← vuelve a leer los datos reales
     4) avisar con un toast
   Si el paso 2 falla, se muestra el error y no se cambia nada.
===================================================== */

function exigirAdmin() {
    if (!esAdmin()) {
        mostrarToast("Solo el administrador puede hacer esto.", "error");
        return false;
    }
    return true;
}

function generarId(nombre) {
    let base = nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "prenda";
    let id = base;
    let n = 2;
    while (buscarProducto(id) !== null) {
        id = base + "-" + n;
        n++;
    }
    return id;
}

// =====================================================
// 1. FORMULARIO DE PRENDA
// =====================================================
function campoImagen(nombre, etiqueta, valor) {
    return '<div class="campo-imagen">' +
        '<img class="vista-previa" src="' + escapar(valor || IMG_RESPALDO) + '" alt="" width="70" height="88" data-previa="' + nombre + '">' +
        '<div class="grupo-formulario"><label for="img-' + nombre + '">' + etiqueta + "</label>" +
        '<input type="text" id="img-' + nombre + '" name="img-' + nombre + '" value="' + escapar(valor) + '" placeholder="img/archivo.jpg o https://...">' +
        '<label class="subir-archivo">Subir foto<input type="file" accept="image/*" data-subir="' + nombre + '" hidden></label></div></div>';
}

// Tallas de la categoría (+ las que ya tenga la prenda, por si eran distintas)
function tallasPara(categoria, p) {
    let lista = PLANTILLAS[categoria] ? PLANTILLAS[categoria].tallas.slice() : ["Única"];
    if (p && p.categoria === categoria) {
        Object.keys(p.stockTallas).forEach(function (t) { if (!lista.includes(t)) { lista.push(t); } });
    }
    return lista;
}

// Cuadrícula de stock: un bloque por color, con una casilla por talla.
// "valores" = { "M|Negro": 4, ... }
function camposStock(tallas, colores, valores) {
    valores = valores || {};
    return colores.map(function (c) {
        return '<div class="stock-color"><p class="etiqueta-campo"><span class="muestra" style="background:' + escapar(c.hex) + '"></span>' + escapar(c.nombre) + "</p>" +
            '<div class="stock-tallas">' + tallas.map(function (t) {
                let v = valores[t + "|" + c.nombre] || 0;
                return '<label class="stock-talla"><span>' + escapar(t) + '</span><input type="number" min="0" step="1" value="' + escapar(v) + '"' +
                    ' data-talla="' + escapar(t) + '" data-color="' + escapar(c.nombre) + '" aria-label="Stock talla ' + escapar(t) + " " + escapar(c.nombre) + '"></label>';
            }).join("") + "</div></div>";
    }).join("");
}

// Lee la cuadrícula → { valores: {"M|Negro": 4}, error: true/false }
function leerStockFormulario(contenedor) {
    let valores = {};
    let error = false;
    contenedor.querySelectorAll("[data-talla][data-color]").forEach(function (input) {
        let v = parseInt(input.value, 10);
        if (input.value !== "" && (isNaN(v) || v < 0)) { error = true; }
        valores[input.dataset.talla + "|" + input.dataset.color] = Math.max(0, v || 0);
    });
    return { valores: valores, error: error };
}

// "Negro, Blanco, Lila:#b39ddb" → { colores: [{nombre, hex}], error: "texto que no entendí" }
function leerColores(texto) {
    let colores = [];
    let error = "";
    texto.split(",").map(function (c) { return c.trim(); }).filter(Boolean).forEach(function (c) {
        let partes = c.split(":");
        let nombreColor = partes[0].trim();
        nombreColor = nombreColor.charAt(0).toUpperCase() + nombreColor.slice(1).toLowerCase();
        let hex = partes[1] ? partes[1].trim() : COLORES[nombreColor];
        if (!hex || !/^#[0-9a-f]{3,6}$/i.test(hex)) {
            error = c;
        } else if (!colores.some(function (x) { return x.nombre === nombreColor; })) {
            colores.push({ nombre: nombreColor, hex: hex });
        }
    });
    return { colores: colores, error: error };
}

// Vuelve a dibujar la cuadrícula conservando lo que ya se escribió
function redibujarCuadriculaStock() {
    let f = document.getElementById("form-producto");
    if (!f) { return; }
    let p = f.dataset.id ? buscarProducto(f.dataset.id) : null;
    let caja = document.getElementById("stock-tallas");
    let actuales = leerStockFormulario(caja).valores;
    let colores = leerColores(f.colores.value).colores;
    caja.innerHTML = colores.length
        ? camposStock(tallasPara(f.categoria.value, p), colores, actuales)
        : '<p class="nota">Escribe al menos un color válido para cargar el stock.</p>';
}

function abrirFormularioProducto(id) {
    if (!exigirAdmin()) {
        return;
    }
    let p = id ? buscarProducto(id) : null;
    let d = p || {
        nombre: "", categoria: "polos", genero: "mujer", descripcion: "", detalle: "", precio: "", descuento: 0, ofertaHasta: "", campanaId: null,
        stockTallas: {}, stockVariantes: {}, colores: [{ nombre: "Negro", hex: COLORES.Negro }], imagen: "", vistas: {}, nuevo: true, especificaciones: []
    };
    let espec = function (nombre) {
        let fila = (d.especificaciones || []).find(function (e) { return e[0] === nombre; });
        return fila ? fila[1] : (PLANTILLAS[d.categoria] ? { "Material": PLANTILLAS[d.categoria].material, "Fit / ajuste": PLANTILLAS[d.categoria].fit, "Cuidado": PLANTILLAS[d.categoria].cuidado }[nombre] || "" : "");
    };
    let opcionesCat = CATEGORIAS.map(function (c) {
        return '<option value="' + c.id + '"' + (d.categoria === c.id ? " selected" : "") + ">" + c.nombre + "</option>";
    }).join("");
    let opcionesGen = ["mujer", "hombre"].concat(d.genero === "unisex" ? ["unisex"] : []).map(function (g) {
        return '<option value="' + g + '"' + (d.genero === g ? " selected" : "") + ">" + GENEROS[g] + "</option>";
    }).join("");
    let coloresTexto = d.colores.map(function (c) { return COLORES[c.nombre] === c.hex ? c.nombre : c.nombre + ":" + c.hex; }).join(", ");
    // Prenda nueva: por defecto usa la campaña. Existente: lo que tenga guardado.
    let usaCampana = p ? !!p.campanaId : !!campana.id;
    let hasta = !usaCampana && d.ofertaHasta ? d.ofertaHasta.slice(0, 10) : "";

    abrirModal(
        '<h2 id="modal-titulo">' + (p ? "Editar prenda" : "Agregar prenda") + "</h2>" +
        '<form id="form-producto" novalidate data-id="' + (p ? escapar(p.id) : "") + '">' +
        '<fieldset><legend>Datos principales</legend>' +
        '<div class="grupo-formulario"><label for="pNombre">Nombre</label><input type="text" id="pNombre" name="nombre" value="' + escapar(d.nombre) + '" maxlength="50" placeholder="Ej. Hoodie oversize lila"></div>' +
        '<div class="fila-triple">' +
        '<div class="grupo-formulario"><label for="pCategoria">Categoría</label><select id="pCategoria" name="categoria">' + opcionesCat + "</select></div>" +
        '<div class="grupo-formulario"><label for="pGenero">Línea</label><select id="pGenero" name="genero">' + opcionesGen + "</select></div>" +
        '<div class="grupo-formulario"><label for="pPrecio">Precio normal (S/)</label><input type="number" id="pPrecio" name="precio" value="' + escapar(d.precio) + '" min="0.1" step="0.10"></div></div>' +
        '<div class="grupo-formulario"><label for="pDesc">Descripción corta</label><input type="text" id="pDesc" name="descripcion" value="' + escapar(d.descripcion) + '" maxlength="60"></div>' +
        '<div class="grupo-formulario"><label for="pDetalle">Descripción larga (ficha)</label><textarea id="pDetalle" name="detalle" rows="3">' + escapar(d.detalle) + "</textarea></div>" +
        '<label class="casilla"><input type="checkbox" name="nuevo"' + (d.nuevo ? " checked" : "") + "> Marcar como <b>Nuevo</b></label></fieldset>" +

        '<fieldset><legend>Oferta</legend><div class="fila-doble">' +
        '<div class="grupo-formulario"><label for="pDescuento">Descuento (%)</label><input type="number" id="pDescuento" name="descuento" value="' + escapar(d.descuento || 0) + '" min="0" max="90" step="1"></div>' +
        '<div class="grupo-formulario"><label for="pHasta">Válida hasta (vacío = sin fecha)</label><input type="date" id="pHasta" name="hasta" value="' + escapar(hasta) + '"' + (usaCampana ? " disabled" : "") + "></div></div>" +
        (campana.id ? '<label class="casilla"><input type="checkbox" name="usarCampana" id="pUsarCampana"' + (usaCampana ? " checked" : "") + "> Usar las fechas de la campaña <b>" + escapar(campana.nombre) + "</b></label>" : "") +
        '<p class="nota" id="vista-precio-oferta"></p></fieldset>' +

        '<fieldset><legend>Colores disponibles</legend>' +
        '<div class="grupo-formulario"><label for="pColores">Separados por coma. Puedes usar: ' + Object.keys(COLORES).join(", ") + '. O un color propio así: Lila:#b39ddb</label>' +
        '<input type="text" id="pColores" name="colores" value="' + escapar(coloresTexto) + '"></div></fieldset>' +

        '<fieldset><legend>Stock por talla y color</legend><div id="stock-tallas">' +
        camposStock(tallasPara(d.categoria, p), d.colores, d.stockVariantes || {}) + "</div></fieldset>" +

        '<fieldset><legend>Fotos: las 4 vistas</legend><p class="nota">Puedes escribir la ruta (por ejemplo <code>img/polos-03-espalda.jpg</code>), pegar un enlace o subir la foto. Las fotos subidas se reducen y se guardan en Supabase Storage.</p>' +
        '<div class="grilla-imagenes">' +
        campoImagen("frente", "Frente (principal)", d.imagen) +
        campoImagen("espalda", "Espalda", (d.vistas || {}).espalda) +
        campoImagen("izquierda", "Lado izquierdo", (d.vistas || {}).izquierda) +
        campoImagen("derecha", "Lado derecho", (d.vistas || {}).derecha) +
        "</div></fieldset>" +

        '<fieldset><legend>Especificaciones</legend>' +
        '<div class="grupo-formulario"><label for="pMaterial">Material</label><input type="text" id="pMaterial" name="material" value="' + escapar(espec("Material")) + '"></div>' +
        '<div class="fila-doble"><div class="grupo-formulario"><label for="pFit">Fit / ajuste</label><input type="text" id="pFit" name="fit" value="' + escapar(espec("Fit / ajuste")) + '"></div>' +
        '<div class="grupo-formulario"><label for="pCuidado">Cuidado</label><input type="text" id="pCuidado" name="cuidado" value="' + escapar(espec("Cuidado")) + '"></div></div></fieldset>' +

        '<div class="botones-accion"><button type="submit" class="boton">' + (p ? "Guardar cambios" : "Agregar prenda") + "</button>" +
        '<button type="button" class="boton boton-claro" data-accion="cerrar-modal">Cancelar</button></div>' +
        '<p class="mensaje" role="alert" hidden></p></form>', "modal-grande");
    actualizarVistaOferta();
}

function actualizarVistaOferta() {
    let f = document.getElementById("form-producto");
    let nota = document.getElementById("vista-precio-oferta");
    if (!f || !nota) {
        return;
    }
    let precio = parseFloat(f.precio.value);
    let dcto = parseInt(f.descuento.value, 10) || 0;
    nota.textContent = (precio > 0 && dcto > 0)
        ? "Precio con oferta: " + formatoPrecio(redondear(precio * (1 - dcto / 100))) + " (antes " + formatoPrecio(precio) + ")"
        : "Sin descuento: el cliente verá el precio normal.";
}

// Reduce la foto, la sube a Supabase Storage y pone su dirección en el campo
function procesarFotoSubida(input) {
    let archivo = input.files[0];
    if (!archivo) {
        return;
    }
    let lector = new FileReader();
    lector.onload = function () {
        let img = new Image();
        img.onload = async function () {
            let escala = Math.min(1, 1000 / Math.max(img.width, img.height));
            let lienzo = document.createElement("canvas");
            lienzo.width = Math.round(img.width * escala);
            lienzo.height = Math.round(img.height * escala);
            lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
            let nombre = input.dataset.subir;
            mostrarToast("Subiendo foto...");
            try {
                let url = await subirFoto(await lienzoABlob(lienzo, 0.82), "productos");
                document.getElementById("img-" + nombre).value = url;
                document.querySelector('[data-previa="' + nombre + '"]').src = url;
                mostrarToast("Foto subida. Guarda la prenda para aplicarla.", "ok");
            } catch (error) {
                mostrarToast(error.message, "error");
            }
            input.value = "";
        };
        img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
}

function rutaValida(texto) {
    return texto === "" || /^(https?:\/\/|data:image\/|\.?\.?\/?[\w\-./ ]+\.(jpe?g|png|webp|gif|avif)$)/i.test(texto);
}

async function guardarFormularioProducto(f) {
    let nombre = f.nombre.value.trim();
    let precio = parseFloat(f.precio.value);
    let descuento = parseInt(f.descuento.value, 10) || 0;
    if (nombre.length < 3) {
        mostrarMensaje(f, "El nombre debe tener al menos 3 letras.", true);
        return;
    }
    if (isNaN(precio) || precio <= 0) {
        mostrarMensaje(f, "Ingresa un precio mayor que 0.", true);
        return;
    }
    if (descuento < 0 || descuento > 90) {
        mostrarMensaje(f, "El descuento debe estar entre 0 y 90%.", true);
        return;
    }
    let lecturaColores = leerColores(f.colores.value);
    if (lecturaColores.error) {
        mostrarMensaje(f, 'No reconozco el color "' + lecturaColores.error + '". Usa uno de la lista o escribe Nombre:#hex.', true);
        return;
    }
    let colores = lecturaColores.colores;
    if (colores.length === 0) {
        mostrarMensaje(f, "Agrega al menos un color.", true);
        return;
    }
    let lecturaStock = leerStockFormulario(document.getElementById("stock-tallas"));
    if (lecturaStock.error) {
        mostrarMensaje(f, "El stock de cada talla y color debe ser 0 o más.", true);
        return;
    }
    let rutas = {};
    let rutaMala = "";
    ["frente", "espalda", "izquierda", "derecha"].forEach(function (v) {
        rutas[v] = f["img-" + v].value.trim();
        if (!rutaValida(rutas[v])) { rutaMala = v; }
    });
    if (rutaMala) {
        mostrarMensaje(f, "La foto de " + rutaMala + " debe ser una ruta de imagen (img/archivo.jpg), un enlace https:// o una foto subida.", true);
        return;
    }

    let id = f.dataset.id;
    let p = id ? buscarProducto(id) : null;
    // Una variante por cada talla × color (las casillas vacías valen 0)
    let tallas = tallasPara(f.categoria.value, p);
    let variantes = [];
    tallas.forEach(function (talla, iTalla) {
        colores.forEach(function (c, iColor) {
            variantes.push({ talla: talla, color: c.nombre, color_hex: c.hex, stock: lecturaStock.valores[talla + "|" + c.nombre] || 0, orden_talla: iTalla, orden_color: iColor });
        });
    });

    let usarCampana = descuento > 0 && f.usarCampana && f.usarCampana.checked && campana.id;
    let especificaciones = (p ? p.especificaciones : []).filter(function (e) {
        return !["Material", "Fit / ajuste", "Cuidado"].includes(e[0]);
    });
    let datos = {
        id: p ? p.id : generarId(nombre),
        sku: p ? p.sku : "",
        nombre: nombre, categoria: f.categoria.value, genero: f.genero.value,
        descripcion: f.descripcion.value.trim(), detalle: f.detalle.value.trim(),
        precio: redondear(precio), descuento: descuento,
        campanaId: usarCampana ? campana.id : null,
        ofertaHasta: descuento > 0 && !usarCampana && f.hasta.value ? new Date(f.hasta.value + "T23:59:59").toISOString() : "",
        nuevo: f.nuevo.checked,
        imagen: rutas.frente, vistas: { espalda: rutas.espalda, izquierda: rutas.izquierda, derecha: rutas.derecha },
        especificaciones: [["Material", f.material.value.trim()], ["Fit / ajuste", f.fit.value.trim()], ["Cuidado", f.cuidado.value.trim()]]
            .filter(function (e) { return e[1] !== ""; }).concat(especificaciones)
    };

    formularioOcupadoAdmin(f, true);
    try {
        await guardarProductoBD(productoParaBD(datos, variantes));   // prenda + variantes, todo o nada
        await refrescarTrasCambio();
    } catch (error) {
        formularioOcupadoAdmin(f, false);
        mostrarMensaje(f, error.message, true);
        return;
    }
    cerrarModal();
    mostrarToast((p ? "Prenda actualizada: " : "Prenda agregada: ") + nombre, "ok");
}

// Bloquea el botón principal mientras esperamos a Supabase
function formularioOcupadoAdmin(f, ocupado) {
    let boton = f.querySelector('button[type="submit"]');
    if (!boton) { return; }
    if (ocupado) { boton.dataset.textoOriginal = boton.textContent; boton.textContent = "Guardando..."; }
    else if (boton.dataset.textoOriginal) { boton.textContent = boton.dataset.textoOriginal; }
    boton.disabled = ocupado;
}

// =====================================================
// 2. ELIMINAR Y STOCK
// =====================================================
async function eliminarProducto(id) {
    if (!exigirAdmin()) {
        return;
    }
    let p = buscarProducto(id);
    if (p === null || !confirm('¿Eliminar "' + p.nombre + '" de la tienda? Esta acción no se puede deshacer.\n\nLos pedidos antiguos que la incluyen se conservan.')) {
        return;
    }
    try {
        await eliminarProductoBD(id);
    } catch (error) {
        mostrarToast(error.message, "error");
        return;
    }
    mostrarToast("Prenda eliminada: " + p.nombre, "ok");
    if (pagina === "producto") {
        window.location.href = "catalogo.html";
        return;
    }
    await refrescarTrasCambio();
}

function abrirStockRapido(id) {
    if (!exigirAdmin()) {
        return;
    }
    let p = buscarProducto(id);
    abrirModal('<h2 id="modal-titulo">Stock de ' + escapar(p.nombre) + "</h2>" +
        '<form id="form-stock" data-id="' + escapar(id) + '" novalidate><div id="stock-rapido">' +
        camposStock(Object.keys(p.stockTallas), p.colores, p.stockVariantes) + "</div>" +
        '<div class="botones-accion"><button class="boton" type="submit">Guardar stock</button><button type="button" class="boton boton-claro" data-accion="cerrar-modal">Cancelar</button></div>' +
        '<p class="mensaje" role="alert" hidden></p></form>', "modal-mediano");
}

async function guardarStockRapido(f) {
    let p = buscarProducto(f.dataset.id);
    let lectura = leerStockFormulario(f);
    if (lectura.error) {
        mostrarMensaje(f, "Cada talla y color debe tener 0 o más unidades.", true);
        return;
    }
    let variantes = variantesDe(p).map(function (v) {
        return Object.assign({}, v, { stock: lectura.valores[v.talla + "|" + v.color] || 0 });
    });
    formularioOcupadoAdmin(f, true);
    try {
        await guardarProductoBD(productoParaBD(p, variantes));
        await refrescarTrasCambio();
    } catch (error) {
        formularioOcupadoAdmin(f, false);
        mostrarMensaje(f, error.message, true);
        return;
    }
    cerrarModal();
    let actualizado = buscarProducto(p.id);
    mostrarToast("Stock actualizado: " + stockTotal(actualizado || p) + " unidades de " + p.nombre, "ok");
}

// Eventos del administrador (sirven en todas las páginas)
document.addEventListener("click", function (evento) {
    let boton = evento.target.closest("[data-accion]");
    if (boton === null) {
        return;
    }
    let id = boton.dataset.id;
    switch (boton.dataset.accion) {
        case "nuevo": abrirFormularioProducto(null); break;
        case "editar": abrirFormularioProducto(id); break;
        case "eliminar": eliminarProducto(id); break;
        case "stock": abrirStockRapido(id); break;
        case "estadisticas": if (exigirAdmin()) { abrirEstadisticasProducto(id); } break;
        case "perfil-cliente": if (exigirAdmin()) { abrirPerfilCliente(boton.dataset.correo); } break;
    }
});

document.addEventListener("change", function (evento) {
    let t = evento.target;
    if (t.dataset && t.dataset.subir) {
        procesarFotoSubida(t);
    }
    if (t.id === "pCategoria" || t.id === "pColores") {
        redibujarCuadriculaStock();
    }
    if (t.id === "pUsarCampana") {
        let hasta = document.getElementById("pHasta");
        hasta.disabled = t.checked;
        if (t.checked) { hasta.value = ""; }
    }
});

document.addEventListener("input", function (evento) {
    let t = evento.target;
    if (t.id === "pPrecio" || t.id === "pDescuento") {
        actualizarVistaOferta();
    }
    if (t.id && t.id.indexOf("img-") === 0 && rutaValida(t.value.trim()) && t.value.trim()) {
        let previa = document.querySelector('[data-previa="' + t.id.slice(4) + '"]');
        if (previa) { previa.src = t.value.trim(); }
    }
});

document.addEventListener("submit", function (evento) {
    let f = evento.target;
    if (f.id === "form-producto") {
        evento.preventDefault();
        guardarFormularioProducto(f);
    } else if (f.id === "form-stock") {
        evento.preventDefault();
        guardarStockRapido(f);
    }
});

// =====================================================
// 3. PÁGINA admin.html
// =====================================================
let pestanaAdmin = "resumen";

function iniciarAdmin() {
    if (!esAdmin()) {
        window.location.replace("login.html?volver=admin.html");
        return;
    }
    let hash = location.hash.replace("#", "");
    if (document.getElementById("tab-" + hash)) {
        pestanaAdmin = hash;
    }
    let filtroCat = document.getElementById("filtro-cat-admin");
    filtroCat.innerHTML = '<option value="">Todas las categorías</option>' + CATEGORIAS.map(function (c) {
        return '<option value="' + c.id + '">' + c.nombre + "</option>";
    }).join("");
    let ofertaCat = document.getElementById("oferta-categoria");
    ofertaCat.innerHTML = '<option value="todas">Toda la tienda</option>' + CATEGORIAS.map(function (c) {
        return '<option value="' + c.id + '">' + c.nombre + "</option>";
    }).join("");
    document.getElementById("estado-filtro").innerHTML = '<option value="">Todos los estados</option>' + ESTADOS_PEDIDO.map(function (e) {
        return "<option>" + e + "</option>";
    }).join("");
    mostrarPestana(pestanaAdmin);

    document.addEventListener("click", async function (evento) {
        let tab = evento.target.closest("[data-tab]");
        if (tab) {
            mostrarPestana(tab.dataset.tab);
            history.replaceState(null, "", "#" + tab.dataset.tab);
        }
        let b = evento.target.closest("[data-accion]");
        if (!b) {
            return;
        }
        try {
            switch (b.dataset.accion) {
                case "quitar-oferta": {
                    let p = buscarProducto(b.dataset.id);
                    await actualizarProductoBD(p.id, { descuento: 0, campana_id: null, oferta_hasta: null });
                    await refrescarTrasCambio();
                    mostrarToast("Oferta quitada de " + p.nombre, "ok");
                    break;
                }
                case "alternar-cupon": {
                    let c = cupones.find(function (x) { return x.codigo === b.dataset.codigo; });
                    await actualizarCuponBD(c.codigo, { activo: !c.activo });
                    await recargarCupones();
                    dibujarOfertasAdmin();
                    break;
                }
                case "borrar-cupon":
                    if (confirm("¿Eliminar el cupón " + b.dataset.codigo + "?")) {
                        await borrarCuponBD(b.dataset.codigo);
                        await recargarCupones();
                        dibujarOfertasAdmin();
                    }
                    break;
                case "ver-pedido": abrirDetallePedido(b.dataset.pedido); break;
                case "responder-reclamo": abrirRespuestaReclamo(b.dataset.numero); break;
                case "ver-mensaje": abrirMensaje(b.dataset.numero); break;
                case "alternar-leido": {
                    let m = mensajes.find(function (x) { return x.numero === b.dataset.numero; });
                    await marcarMensajeLeidoBD(m.numero, !m.leido);
                    m.leido = !m.leido;
                    dibujarMensajesAdmin();
                    break;
                }
            }
        } catch (error) {
            mostrarToast(error.message, "error");
        }
    });
    document.addEventListener("input", function (evento) {
        if (["buscar-producto-admin", "buscar-cliente-admin"].includes(evento.target.id)) {
            redibujarPagina();
        }
    });
    document.addEventListener("change", async function (evento) {
        let t = evento.target;
        if (["rango-resumen", "filtro-cat-admin", "estado-filtro", "orden-productos-admin"].includes(t.id)) {
            redibujarPagina();
        }
        if (t.dataset.estadoPedido) {
            cambiarEstadoPedido(t.dataset.estadoPedido, t.value, t);
        }
        if (t.dataset.dctoProducto) {
            let p = buscarProducto(t.dataset.dctoProducto);
            let v = parseInt(t.value, 10);
            if (isNaN(v) || v < 0 || v > 90) {
                mostrarToast("El descuento debe estar entre 0 y 90%.", "error");
                t.value = p.descuento;
                return;
            }
            try {
                await actualizarProductoBD(p.id, v === 0 ? { descuento: 0, campana_id: null, oferta_hasta: null } : { descuento: v });
                await refrescarTrasCambio();
                mostrarToast("Descuento de " + p.nombre + ": " + v + "%", "ok");
            } catch (error) {
                t.value = p.descuento;
                mostrarToast(error.message, "error");
            }
        }
    });
    document.addEventListener("submit", async function (evento) {
        let f = evento.target;
        if (f.id === "form-campana") {
            evento.preventDefault();
            if (!f.fin.value) {
                mostrarMensaje(f, "Elige la fecha y hora de término.", true);
                return;
            }
            if (f.inicio.value && new Date(f.inicio.value) >= new Date(f.fin.value)) {
                mostrarMensaje(f, "La fecha de inicio debe ser anterior a la de término.", true);
                return;
            }
            let nueva = { id: campana.id, nombre: f.nombre.value.trim() || "Ofertas NOVAK", subtitulo: f.subtitulo.value.trim(),
                inicio: f.inicio.value ? new Date(f.inicio.value).toISOString() : new Date().toISOString(),
                fin: new Date(f.fin.value).toISOString(), stockMinimo: Math.max(1, parseInt(f.stockMinimo.value, 10) || 1) };
            formularioOcupadoAdmin(f, true);
            try {
                // Las ofertas ligadas a la campaña usan sus fechas automáticamente;
                // con "extender", todas las prendas con descuento se ligan a ella.
                campana = await guardarCampanaBD(nueva, f.extender.checked);
                await refrescarTrasCambio();
                mostrarMensaje(f, "Campaña guardada. La cuenta regresiva y las ofertas ya usan la nueva fecha.", false);
            } catch (error) {
                mostrarMensaje(f, error.message, true);
            }
            formularioOcupadoAdmin(f, false);
            dibujarOfertasAdmin();
        } else if (f.id === "form-respuesta-reclamo") {
            evento.preventDefault();
            let texto = f.respuesta.value.trim();
            if (texto.length < 10) {
                mostrarMensaje(f, "Escribe la respuesta que se enviará al consumidor.", true);
                return;
            }
            formularioOcupadoAdmin(f, true);
            try {
                await responderReclamoBD(f.dataset.numero, texto);
            } catch (error) {
                formularioOcupadoAdmin(f, false);
                mostrarMensaje(f, error.message, true);
                return;
            }
            let hoja = reclamos.find(function (r) { return r.numero === f.dataset.numero; });
            hoja.respuesta = texto;
            hoja.estado = "Respondido";
            hoja.fechaRespuesta = new Date().toISOString();
            cerrarModal();
            mostrarToast("Respuesta registrada para " + hoja.numero + ". Se envía sola por correo al consumidor (si configuraste los correos con 07_correos.sql).", "ok");
            dibujarReclamosAdmin();
        } else if (f.id === "form-oferta-masiva") {
            evento.preventDefault();
            let pct = parseInt(f.porcentaje.value, 10);
            if (isNaN(pct) || pct < 0 || pct > 90) {
                mostrarMensaje(f, "El porcentaje debe estar entre 0 y 90.", true);
                return;
            }
            let cat = f.categoria.value;
            let cuenta = productos.filter(function (p) { return cat === "todas" || p.categoria === cat; }).length;
            formularioOcupadoAdmin(f, true);
            try {
                await ofertaMasivaBD(cat, pct, campana.id || null);
                await refrescarTrasCambio();
                mostrarMensaje(f, pct > 0 ? pct + "% aplicado a " + cuenta + " prendas hasta el fin de la campaña." : "Se quitó la oferta a " + cuenta + " prendas.", false);
            } catch (error) {
                mostrarMensaje(f, error.message, true);
            }
            formularioOcupadoAdmin(f, false);
            dibujarOfertasAdmin();
        } else if (f.id === "form-cupon") {
            evento.preventDefault();
            let codigo = f.codigo.value.trim().toUpperCase().replace(/\s+/g, "");
            let valor = parseFloat(f.valor.value) || 0;
            let minimo = parseFloat(f.minimo.value) || 0;
            if (!/^[A-Z0-9]{4,15}$/.test(codigo)) {
                mostrarMensaje(f, "El código debe tener de 4 a 15 letras o números.", true);
                return;
            }
            if (cupones.some(function (c) { return c.codigo === codigo; })) {
                mostrarMensaje(f, "Ese código ya existe.", true);
                return;
            }
            if (f.tipo.value !== "envio" && (valor <= 0 || (f.tipo.value === "porcentaje" && valor > 90))) {
                mostrarMensaje(f, "Ingresa un valor válido (porcentaje hasta 90).", true);
                return;
            }
            let descripcion = f.tipo.value === "porcentaje" ? valor + "% de descuento" : (f.tipo.value === "monto" ? "S/ " + valor + " de descuento" : "Envío gratis");
            if (minimo > 0) { descripcion += " desde " + formatoPrecio(minimo); }
            formularioOcupadoAdmin(f, true);
            try {
                await crearCuponBD({ codigo: codigo, tipo: f.tipo.value, valor: valor, minimo: minimo, activo: true, descripcion: descripcion });
                await recargarCupones();
                f.reset();
                mostrarToast("Cupón " + codigo + " creado.", "ok");
            } catch (error) {
                mostrarMensaje(f, error.message, true);
            }
            formularioOcupadoAdmin(f, false);
            dibujarOfertasAdmin();
        }
    });
}

function mostrarPestana(nombre) {
    pestanaAdmin = nombre;
    document.querySelectorAll("[data-tab]").forEach(function (b) {
        b.classList.toggle("activa", b.dataset.tab === nombre);
        b.setAttribute("aria-selected", b.dataset.tab === nombre);
    });
    document.querySelectorAll(".pestana-panel").forEach(function (p) {
        p.hidden = p.id !== "tab-" + nombre;
    });
    redibujarPagina();
}

function redibujarAdmin() {
    if (pestanaAdmin === "resumen") { dibujarResumenAdmin(); }
    if (pestanaAdmin === "productos") { dibujarProductosAdmin(); }
    if (pestanaAdmin === "clientes") { dibujarClientesAdmin(); }
    if (pestanaAdmin === "pedidos") { dibujarPedidosAdmin(); }
    if (pestanaAdmin === "ofertas") { dibujarOfertasAdmin(); }
    if (pestanaAdmin === "reclamos") { dibujarReclamosAdmin(); }
    if (pestanaAdmin === "mensajes") { dibujarMensajesAdmin(); }
    activarImagenesDeRespaldo(document.getElementById("contenido"));
}

function dibujarResumenAdmin() {
    let dias = parseInt(document.getElementById("rango-resumen").value, 10) || 0;
    let e = estadisticasGlobales(dias);
    let bajos = productos.filter(function (p) { return stockTotal(p) <= 5; });
    document.getElementById("resumen-kpis").innerHTML = htmlIndicadores([
        [soles(e.ventas), "Ventas", e.pedidos + " pedidos"],
        [soles(e.ticket), "Ticket promedio", e.unidades + " prendas vendidas"],
        [e.totalClientes, "Clientes que compraron", listaClientes().length + " registrados"],
        [e.conversion.toFixed(1) + "%", "Conversión de la tienda", "unidades vendidas / vistas"],
        [productos.filter(ofertaVigente).length, "Prendas en oferta", "Termina: " + fechaCorta(campana.fin)],
        [bajos.length, "Con stock bajo", "5 unidades o menos"]
    ]);
    let ranking = rankingProductos(dias).slice(0, 8);
    document.getElementById("resumen-graficos").innerHTML =
        '<div class="graficos-grilla">' +
        htmlLineaMensual("Ventas por mes (S/)", e.porMes, ultimosMeses(6), soles) +
        htmlBarras("Ventas por categoría (S/)", mapaABarras(e.porCategoria, false, nombreCategoria), soles, 12) +
        htmlBarras("Segmento más vendido", mapaABarras(e.porSegmento), unidadesTexto) +
        htmlBarras("Clientes por edad", mapaABarras(e.porEdad), function (v) { return v + " clientes"; }) +
        htmlBarras("Clientes por género", mapaABarras(e.porGenero), function (v) { return v + " clientes"; }) +
        htmlBarras("Colores más vendidos", mapaABarras(e.porColor, true), unidadesTexto) +
        htmlBarras("Métodos de pago", mapaABarras(e.porMetodo), function (v) { return v + " pedidos"; }) +
        "</div>" +
        '<div class="graficos-grilla dos"><div class="grafico"><h4>Top prendas más vendidas</h4><ol class="lista-ranking">' + ranking.map(function (r) {
            let p = buscarProducto(r.id);
            return p ? '<li><button type="button" class="enlace" data-accion="estadisticas" data-id="' + escapar(p.id) + '">' + escapar(p.nombre) + "</button><span>" + r.unidades + " und. · " + soles(r.ingresos) + "</span></li>" : "";
        }).join("") + "</ol></div>" +
        '<div class="grafico"><h4>Reponer stock</h4>' + (bajos.length ? '<ul class="lista-ranking">' + bajos.slice(0, 8).map(function (p) {
            return '<li><span>' + escapar(p.nombre) + '</span><button type="button" class="boton boton-claro boton-chico" data-accion="stock" data-id="' + escapar(p.id) + '">' + stockTotal(p) + " und. · Reponer</button></li>";
        }).join("") + "</ul>" : '<p class="sin-datos">Todo el stock está en buen nivel.</p>') + "</div></div>";
}

function dibujarProductosAdmin() {
    let texto = document.getElementById("buscar-producto-admin").value.trim().toLowerCase();
    let cat = document.getElementById("filtro-cat-admin").value;
    let orden = document.getElementById("orden-productos-admin").value;
    let ventas = {};
    rankingProductos().forEach(function (r) { ventas[r.id] = r; });
    let lista = productos.filter(function (p) {
        return (!cat || p.categoria === cat) && (p.nombre + " " + p.sku).toLowerCase().includes(texto);
    });
    lista.sort(function (a, b) {
        if (orden === "vendidos") { return ((ventas[b.id] || {}).unidades || 0) - ((ventas[a.id] || {}).unidades || 0); }
        if (orden === "stock") { return stockTotal(a) - stockTotal(b); }
        if (orden === "vistas") { return (eventos.vistas[b.id] || 0) - (eventos.vistas[a.id] || 0); }
        return 0;
    });
    let cuerpo = document.getElementById("cuerpo-inventario");
    cuerpo.innerHTML = lista.map(function (p) {
        let st = stockTotal(p);
        let clase = st <= 0 ? " agotado" : (st <= 5 ? " poco" : "");
        let v = ventas[p.id] || { unidades: 0, ingresos: 0 };
        return "<tr>" +
            '<td><div class="celda-producto"><img class="miniatura" src="' + escapar(p.imagen || IMG_RESPALDO) + '" alt="" width="44" height="55"><span><a href="producto.html?id=' + encodeURIComponent(p.id) + '">' + escapar(p.nombre) + "</a><small>" + escapar(p.sku) + " · " + GENEROS[p.genero] + "</small></span></div></td>" +
            "<td>" + escapar(nombreCategoria(p.categoria)) + "</td>" +
            "<td>" + formatoPrecio(precioFinal(p)) + (ofertaVigente(p) ? ' <span class="pastilla-dcto">-' + p.descuento + "%</span>" : "") + "</td>" +
            '<td><span class="stock-pastilla' + clase + '" title="' + escapar(Object.keys(p.stockTallas).map(function (t) { return t + ": " + p.stockTallas[t]; }).join(" · ")) + '">' + st + "</span></td>" +
            "<td>" + v.unidades + "</td><td>" + (eventos.vistas[p.id] || 0) + "</td>" +
            '<td><div class="acciones-fila">' +
            '<button type="button" class="boton boton-chico" data-accion="estadisticas" data-id="' + escapar(p.id) + '">Estadísticas</button>' +
            '<button type="button" class="boton boton-claro boton-chico" data-accion="editar" data-id="' + escapar(p.id) + '">Editar</button>' +
            '<button type="button" class="boton boton-claro boton-chico" data-accion="stock" data-id="' + escapar(p.id) + '">Stock</button>' +
            '<button type="button" class="boton boton-peligro boton-chico" data-accion="eliminar" data-id="' + escapar(p.id) + '">Eliminar</button>' +
            "</div></td></tr>";
    }).join("");
    document.getElementById("sin-inventario").hidden = lista.length > 0;
    document.getElementById("conteo-productos").textContent = lista.length + " de " + productos.length + " prendas";
}

function dibujarClientesAdmin() {
    let texto = document.getElementById("buscar-cliente-admin").value.trim().toLowerCase();
    let filas = listaClientes().filter(function (c) {
        return ((c.nombre || "") + " " + c.correo).toLowerCase().includes(texto);
    }).map(function (c) {
        return { c: c, e: estadisticasCliente(c.correo) };
    }).sort(function (a, b) { return b.e.gastado - a.e.gastado; });

    document.getElementById("cuerpo-clientes").innerHTML = filas.map(function (f) {
        let edad = calcularEdad(f.c.nacimiento);
        return "<tr>" +
            '<td><div class="celda-producto"><span class="avatar chico">' + escapar((f.c.nombre || "?").charAt(0)) + "</span><span>" + escapar(f.c.nombre || f.c.correo) + "<small>" + escapar(f.c.correo) + "</small></span></div></td>" +
            "<td>" + (edad !== null ? edad + " años" : "—") + "</td>" +
            "<td>" + (f.e.categoriaFavorita ? escapar(nombreCategoria(f.e.categoriaFavorita)) + "<small>" + escapar(f.e.segmentoFavorito) + "</small>" : "—") + "</td>" +
            "<td>" + (f.e.colorFavorito ? '<span class="muestra" style="background:' + hexDeColor(f.e.colorFavorito) + '"></span>' + escapar(f.e.colorFavorito) : "—") + "</td>" +
            "<td>" + (f.e.tallaFavorita || "—") + "</td>" +
            "<td>" + f.e.pedidos + "</td><td><b>" + soles(f.e.gastado) + "</b></td>" +
            "<td>" + (f.e.ultima ? fechaCorta(f.e.ultima) : "—") + "</td>" +
            '<td><button type="button" class="boton boton-chico" data-accion="perfil-cliente" data-correo="' + escapar(f.c.correo) + '">Ver estadísticas</button></td></tr>';
    }).join("");
    document.getElementById("conteo-clientes").textContent = filas.length + " clientes";
}

function dibujarPedidosAdmin() {
    let estado = document.getElementById("estado-filtro").value;
    let lista = pedidos.filter(function (p) { return !estado || p.estado === estado; }).slice().reverse();
    document.getElementById("cuerpo-pedidos").innerHTML = lista.slice(0, 150).map(function (p) {
        let opciones = ESTADOS_PEDIDO.map(function (e) {
            return "<option" + (e === p.estado ? " selected" : "") + ">" + e + "</option>";
        }).join("");
        return "<tr>" +
            '<td><button type="button" class="enlace" data-accion="ver-pedido" data-pedido="' + escapar(p.id) + '">' + escapar(p.id) + "</button>" + (p.semilla ? "<small>ejemplo</small>" : "") + "</td>" +
            "<td>" + fechaCorta(p.fecha) + "</td>" +
            '<td><button type="button" class="enlace" data-accion="perfil-cliente" data-correo="' + escapar(p.cliente) + '">' + escapar(p.nombre) + "</button></td>" +
            "<td>" + p.items.reduce(function (s, i) { return s + i.cantidad; }, 0) + "</td>" +
            // Pendiente de pago: se ve el n.º de operación (transferencia) para verificarlo
            "<td>" + escapar(METODOS_PAGO[p.metodo] || p.metodo) + (p.estado === "Pendiente de pago" && p.pagoDetalle ? "<small>" + escapar(p.pagoDetalle) + "</small>" : "") + "</td>" +
            "<td><b>" + soles(p.total) + "</b></td>" +
            '<td><select class="selector-estado estado-' + p.estado.toLowerCase().replace(/\s+/g, "-") + '" data-estado-pedido="' + escapar(p.id) + '"' + (p.estado === "Cancelado" ? " disabled" : "") + ' aria-label="Estado del pedido ' + escapar(p.id) + '">' + opciones + "</select></td></tr>";
    }).join("");
    document.getElementById("conteo-pedidos").textContent = lista.length + " pedidos" + (lista.length > 150 ? " (se muestran los 150 más recientes)" : "");
}

// Al cancelar, la base devuelve el stock sola (trigger de 05_admin.sql)
async function cambiarEstadoPedido(idPedido, nuevo, selector) {
    let pedido = pedidos.find(function (p) { return p.id === idPedido; });
    if (!pedido) {
        return;
    }
    if (nuevo === "Cancelado" && !confirm("¿Cancelar el pedido " + idPedido + "? Las prendas vuelven al stock y el pedido ya no se podrá reactivar.")) {
        selector.value = pedido.estado;
        return;
    }
    if (pedido.semilla) {
        // Los pedidos de ejemplo no existen en la base: solo cambian en pantalla
        pedido.estado = nuevo;
        mostrarToast("Pedido de ejemplo " + idPedido + ": " + nuevo + " (no se guarda)", "ok");
        dibujarPedidosAdmin();
        return;
    }
    selector.disabled = true;
    try {
        await cambiarEstadoPedidoBD(idPedido, nuevo);
    } catch (error) {
        selector.value = pedido.estado;
        selector.disabled = false;
        mostrarToast(error.message, "error");
        return;
    }
    pedido.estado = nuevo;
    if (nuevo === "Cancelado") {
        await refrescarTrasCambio();   // muestra el stock ya devuelto
    }
    mostrarToast("Pedido " + idPedido + ": " + nuevo, "ok");
    dibujarPedidosAdmin();
}

function htmlDetallePedido(p) {
    return '<ul class="resumen-pedido">' + p.items.map(function (i) {
        return '<li><span><img src="' + escapar(i.imagen || (buscarProducto(i.id) || {}).imagen || IMG_RESPALDO) + '" alt="" width="40" height="50">' +
            i.cantidad + " × " + escapar(i.nombre) + " <small>Talla " + escapar(i.talla) + " · " + escapar(i.color) + (i.oferta ? " · en oferta" : "") + "</small></span><span>" + formatoPrecio(i.precio * i.cantidad) + "</span></li>";
    }).join("") +
        "<li><span>Subtotal</span><span>" + formatoPrecio(p.subtotal) + "</span></li>" +
        (p.descuentoCupon ? "<li><span>Cupón " + escapar(p.cupon) + "</span><span>-" + formatoPrecio(p.descuentoCupon) + "</span></li>" : "") +
        "<li><span>Envío</span><span>" + (p.envio ? formatoPrecio(p.envio) : "Gratis") + "</span></li>" +
        '<li class="total"><span>Total</span><span>' + formatoPrecio(p.total) + "</span></li></ul>";
}

function abrirDetallePedido(id) {
    let p = pedidos.find(function (x) { return x.id === id; });
    if (!p) {
        return;
    }
    abrirModal('<h2 id="modal-titulo">Pedido ' + escapar(p.id) + "</h2>" +
        "<p>" + fechaCorta(p.fecha) + " · " + escapar(p.nombre) + " (" + escapar(p.cliente) + ")" +
        (p.telefono ? "<br>Teléfono: " + escapar(p.telefono) : "") + (p.dni ? " · DNI: " + escapar(p.dni) : "") + "<br>" +
        "Pago: " + escapar(METODOS_PAGO[p.metodo] || p.metodo) + (p.pagoDetalle ? " · " + escapar(p.pagoDetalle) : "") + "<br>" +
        "Entrega: " + (p.entrega.tipo === "recojo" ? "Recojo en tienda · " + escapar(p.entrega.direccion || "") : escapar((p.entrega.direccion || "") + ", " + (p.entrega.distrito || "") + (p.entrega.referencia ? " (" + p.entrega.referencia + ")" : ""))) +
        '<br>Estado: <b>' + escapar(p.estado) + "</b></p>" + htmlDetallePedido(p), "modal-mediano");
}

function dibujarOfertasAdmin() {
    let f = document.getElementById("form-campana");
    f.nombre.value = campana.nombre;
    f.subtitulo.value = campana.subtitulo;
    let local = function (iso) { let d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
    f.fin.value = local(campana.fin);
    f.inicio.value = local(campana.inicio || new Date().toISOString());
    f.stockMinimo.value = campana.stockMinimo || 1;
    document.getElementById("estado-campana").innerHTML = tiempoRestante(campana.fin).terminado
        ? '<span class="estado-chip rojo">Terminada</span> Las ofertas con esta fecha ya no se aplican. Elige una nueva fecha para reactivarlas.'
        : new Date(campana.inicio) > new Date() ? '<span class="estado-chip ambar">Programada</span> Empieza el ' + new Date(campana.inicio).toLocaleString("es-PE")
        : '<span class="estado-chip verde">Activa</span> Termina en: <span class="cuenta-regresiva chica" data-cuenta-regresiva="' + campana.fin + '"></span>';

    let enOferta = productos.filter(function (p) { return p.descuento > 0; });
    document.getElementById("cuerpo-ofertas").innerHTML = enOferta.map(function (p) {
        let vigente = ofertaVigente(p);
        return "<tr><td><div class=\"celda-producto\"><img class=\"miniatura\" src=\"" + escapar(p.imagen) + '" alt="" width="44" height="55"><span>' + escapar(p.nombre) + "</span></div></td>" +
            "<td>" + formatoPrecio(p.precio) + "</td>" +
            '<td><input type="number" class="input-chico" min="0" max="90" value="' + p.descuento + '" data-dcto-producto="' + escapar(p.id) + '" aria-label="Descuento de ' + escapar(p.nombre) + '"> %</td>' +
            "<td><b>" + formatoPrecio(redondear(p.precio * (1 - p.descuento / 100))) + "</b></td>" +
            "<td>" + (p.campanaId && p.campanaId === campana.id ? "Campaña · " + fechaCorta(campana.fin) : (p.ofertaHasta && !p.campanaId ? fechaCorta(p.ofertaHasta) : (p.campanaId ? "Campaña anterior" : "Sin fecha"))) +
            (vigente ? "" : ' <span class="estado-chip rojo">Vencida</span>') + "</td>" +
            '<td><button type="button" class="boton boton-peligro boton-chico" data-accion="quitar-oferta" data-id="' + escapar(p.id) + '">Quitar</button></td></tr>';
    }).join("") || '<tr><td colspan="6">No hay prendas con descuento.</td></tr>';

    let usos = {};
    pedidos.forEach(function (p) { if (p.cupon) { usos[p.cupon] = (usos[p.cupon] || 0) + 1; } });
    document.getElementById("cuerpo-cupones").innerHTML = cupones.map(function (c) {
        return "<tr><td><code>" + escapar(c.codigo) + "</code></td><td>" + escapar(c.descripcion) + "</td><td>" + (usos[c.codigo] || 0) + "</td>" +
            "<td>" + (c.activo ? '<span class="estado-chip verde">Activo</span>' : '<span class="estado-chip">Pausado</span>') + "</td>" +
            '<td><div class="acciones-fila"><button type="button" class="boton boton-claro boton-chico" data-accion="alternar-cupon" data-codigo="' + escapar(c.codigo) + '">' + (c.activo ? "Pausar" : "Activar") + "</button>" +
            '<button type="button" class="boton boton-peligro boton-chico" data-accion="borrar-cupon" data-codigo="' + escapar(c.codigo) + '">Eliminar</button></div></td></tr>';
    }).join("");
}

// =====================================================
// LIBRO DE RECLAMACIONES (respuesta en 15 días hábiles)
// "reclamos" se carga desde Supabase al abrir admin.html
// =====================================================
function dibujarReclamosAdmin() {
    let lista = reclamos.slice().reverse();
    let pendientes = lista.filter(function (r) { return r.estado !== "Respondido"; }).length;
    document.getElementById("conteo-reclamos").textContent = lista.length + " hojas · " + pendientes + " pendientes";
    document.getElementById("cuerpo-reclamos").innerHTML = lista.map(function (r) {
        let vencido = r.estado !== "Respondido" && new Date(r.limite) < new Date();
        let dias = Math.ceil((new Date(r.limite) - new Date()) / 86400000);
        return "<tr><td><b>" + escapar(r.numero) + "</b><small>" + fechaCorta(r.fecha) + "</small></td>" +
            "<td>" + escapar(r.nombre) + "<small>" + escapar(r.correo) + "</small></td>" +
            "<td>" + (r.tipo === "queja" ? "Queja" : "Reclamo") + "<small>" + escapar(r.descripcionBien) + "</small></td>" +
            "<td>" + fechaCorta(r.limite) + (r.estado !== "Respondido" ? "<small>" + (vencido ? "Plazo vencido" : "Quedan " + dias + " días") + "</small>" : "") + "</td>" +
            '<td><span class="estado-chip ' + (r.estado === "Respondido" ? "verde" : vencido ? "rojo" : "ambar") + '">' + escapar(r.estado) + "</span></td>" +
            '<td><button type="button" class="boton boton-chico" data-accion="responder-reclamo" data-numero="' + escapar(r.numero) + '">' + (r.estado === "Respondido" ? "Ver" : "Responder") + "</button></td></tr>";
    }).join("") || '<tr><td colspan="6">No hay hojas de reclamación registradas.</td></tr>';
}

function abrirRespuestaReclamo(numero) {
    let r = reclamos.find(function (x) { return x.numero === numero; });
    if (!r) { return; }
    abrirModal('<h2 id="modal-titulo">Hoja ' + escapar(r.numero) + "</h2>" +
        '<table class="tabla-especificaciones">' +
        "<tr><th>Fecha</th><td>" + new Date(r.fecha).toLocaleString("es-PE") + "</td></tr>" +
        "<tr><th>Consumidor</th><td>" + escapar(r.nombre) + " · " + escapar(r.tipoDocumento) + " " + escapar(r.documento) + "<br>" + escapar(r.domicilio) + " · " + escapar(r.telefono) + " · " + escapar(r.correo) + (r.apoderado ? "<br>Apoderado: " + escapar(r.apoderado) : "") + "</td></tr>" +
        "<tr><th>Bien</th><td>" + escapar(r.tipoBien) + ": " + escapar(r.descripcionBien) + (r.monto ? " · S/ " + escapar(r.monto) : "") + (r.numeroPedido ? " · Pedido " + escapar(r.numeroPedido) : "") + "</td></tr>" +
        "<tr><th>Tipo</th><td>" + (r.tipo === "queja" ? "Queja" : "Reclamo") + "</td></tr>" +
        "<tr><th>Detalle</th><td>" + escapar(r.detalle) + "</td></tr>" +
        "<tr><th>Pedido</th><td>" + escapar(r.pedido) + "</td></tr>" +
        "<tr><th>Responder antes del</th><td>" + new Date(r.limite).toLocaleDateString("es-PE") + "</td></tr>" +
        (r.fechaRespuesta ? "<tr><th>Respondido el</th><td>" + new Date(r.fechaRespuesta).toLocaleString("es-PE") + "</td></tr>" : "") + "</table>" +
        '<form id="form-respuesta-reclamo" data-numero="' + escapar(r.numero) + '" novalidate><div class="grupo-formulario"><label for="rRespuesta">Observaciones y acciones adoptadas por el proveedor</label>' +
        '<textarea id="rRespuesta" name="respuesta" rows="4">' + escapar(r.respuesta) + "</textarea></div>" +
        '<button type="submit" class="boton">Guardar respuesta</button><p class="mensaje" role="alert" hidden></p></form>', "modal-mediano");
}

// =====================================================
// MENSAJES DE CONTACTO Y NEWSLETTER
// =====================================================
const MOTIVOS_MENSAJE = { consulta: "Consulta de prenda o talla", pedido: "Estado de mi pedido", cambio: "Cambios y devoluciones", reclamo: "Reclamo", otro: "Otro" };

function dibujarMensajesAdmin() {
    let noLeidos = mensajes.filter(function (m) { return !m.leido; }).length;
    document.getElementById("conteo-mensajes").textContent = mensajes.length + " mensajes · " + noLeidos + " sin leer";
    document.getElementById("cuerpo-mensajes").innerHTML = mensajes.map(function (m) {
        return "<tr><td><b>" + escapar(m.numero) + "</b><small>" + fechaCorta(m.fecha) + "</small></td>" +
            "<td>" + escapar(m.nombre) + "<small>" + escapar(m.correo) + "</small></td>" +
            "<td>" + escapar(MOTIVOS_MENSAJE[m.motivo] || m.motivo || "—") + "</td>" +
            "<td>" + escapar(m.mensaje.length > 70 ? m.mensaje.slice(0, 70) + "…" : m.mensaje) + "</td>" +
            '<td><span class="estado-chip ' + (m.leido ? "verde" : "ambar") + '">' + (m.leido ? "Leído" : "Nuevo") + "</span></td>" +
            '<td><div class="acciones-fila"><button type="button" class="boton boton-chico" data-accion="ver-mensaje" data-numero="' + escapar(m.numero) + '">Ver</button>' +
            '<button type="button" class="boton boton-claro boton-chico" data-accion="alternar-leido" data-numero="' + escapar(m.numero) + '">' + (m.leido ? "Marcar nuevo" : "Marcar leído") + "</button></div></td></tr>";
    }).join("") || '<tr><td colspan="6">Aún no llegan mensajes.</td></tr>';

    document.getElementById("conteo-suscriptores").textContent = suscriptores.length + " suscriptores";
    document.getElementById("cuerpo-suscriptores").innerHTML = suscriptores.map(function (s) {
        return "<tr><td>" + escapar(s.correo) + "</td><td>" + escapar(s.origen === "registro" ? "Registro" : "Pie de página") + "</td><td>" + fechaCorta(s.creado_en) + "</td></tr>";
    }).join("") || '<tr><td colspan="3">Aún no hay suscriptores.</td></tr>';
}

async function abrirMensaje(numero) {
    let m = mensajes.find(function (x) { return x.numero === numero; });
    if (!m) { return; }
    abrirModal('<h2 id="modal-titulo">Mensaje ' + escapar(m.numero) + "</h2>" +
        '<table class="tabla-especificaciones">' +
        "<tr><th>Fecha</th><td>" + new Date(m.fecha).toLocaleString("es-PE") + "</td></tr>" +
        "<tr><th>De</th><td>" + escapar(m.nombre) + " · " + escapar(m.correo) + "</td></tr>" +
        "<tr><th>Motivo</th><td>" + escapar(MOTIVOS_MENSAJE[m.motivo] || m.motivo || "—") + "</td></tr>" +
        "<tr><th>Mensaje</th><td>" + escapar(m.mensaje) + "</td></tr></table>" +
        '<div class="botones-accion"><a class="boton" href="mailto:' + encodeURIComponent(m.correo) + "?subject=" + encodeURIComponent("Respuesta a tu mensaje " + m.numero + " - NOVAK") + '">Responder por correo</a></div>', "modal-mediano");
    if (!m.leido) {
        try {
            await marcarMensajeLeidoBD(m.numero, true);
            m.leido = true;
            dibujarMensajesAdmin();
        } catch (error) {
            console.warn(error);
        }
    }
}
