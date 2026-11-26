/* =====================================================
   NOVAK - tienda.js
   Lo que ve el cliente, página por página:
   1. Inicio (carrusel principal, categorías, ofertas, fits, para ti)
   2. Catálogo (filtros, orden y búsqueda)
   3. Ficha de producto (4 vistas, tallas, colores, especificaciones, reseñas)
   4. Carrito (cupones y envío gratis)
   5. Checkout (datos, entrega y pasarela de pago)
   6. Mi cuenta (pedidos, favoritos, datos y estilo)
   7. Login, registro y contacto
   8. Arranque de cada página
===================================================== */

// =====================================================
// 1. INICIO
// =====================================================
function diapositivasHero() {
    let fotos = "?auto=format&fit=crop&w=1900&q=80";
    return [
        { img: UNSPLASH + "1483985988355-763728e1935b" + fotos, soloCampana: true, alterna: "img/vestidos-02.jpg", tono: "rosa",
          etiqueta: campana.nombre, titulo: "Hasta<br>50% off", texto: campana.subtitulo + ". Solo por tiempo limitado.",
          cta: ["Ver ofertas", "catalogo.html?oferta=1"], cta2: ["Usa el cupón GENZ20", "carrito.html"], cuenta: true },
        { img: UNSPLASH + "1490481651871-ab68de25d43d" + fotos, alterna: "img/hoodies-07.jpg", tono: "lila",
          etiqueta: "Nueva colección", titulo: "Drop de<br>verano 2027", texto: "Linos, tonos arena y cortes relajados para el calor de la ciudad.",
          cta: ["Descubrir lo nuevo", "catalogo.html?nuevo=1"], cta2: ["Shop mujer", "catalogo.html?genero=mujer"] },
        { img: UNSPLASH + "1503342217505-b0a15ec3261c" + fotos, alterna: "img/hoodies-08.jpg", tono: "tinta",
          etiqueta: "Ready for the street", titulo: "Hoodies &amp;<br>casacas", texto: "Oversize, afelpados y con la actitud que buscas. Desde S/ 89.90.",
          cta: ["Ver hoodies", "catalogo.html?cat=hoodies"], cta2: ["Ver casacas", "catalogo.html?cat=casacas"] },
        { img: UNSPLASH + "1441986300917-64674bd600d8" + fotos, alterna: "img/calzado-03.jpg", tono: "arena",
          etiqueta: "Compra online, recoge gratis", titulo: "Visítanos<br>en tienda", texto: "Pide desde la web y retira gratis en NOVAK Miraflores o Jockey Plaza en 24 horas.",
          cta: ["Ver zapatillas", "catalogo.html?cat=calzado"], cta2: ["Guía de tallas", "#guia"] },
        { img: UNSPLASH + "1529139574466-a303027c1d8b" + fotos, alterna: "img/gafas-05.jpg", tono: "lima", posicion: "center 22%",
          etiqueta: "El detalle hace el look", titulo: "Accesorios<br>desde S/ 39.90", texto: "Gafas, relojes, collares y gorras para cerrar tu outfit.",
          cta: ["Ver accesorios", "catalogo.html?seg=accesorios"] }
    ];
}

let heroIndice = 0;
let heroTemporizador = null;

function dibujarHero() {
    let hero = document.getElementById("hero-carrusel");
    if (hero === null) {
        return;
    }
    // La diapositiva de la campaña solo aparece mientras la campaña está vigente
    let activa = !tiempoRestante(campana.fin).terminado && new Date(campana.inicio || 0) <= new Date();
    let slides = diapositivasHero().filter(function (d) { return activa || !d.soloCampana; });
    hero.innerHTML =
        '<div class="hero-pista">' + slides.map(function (s, i) {
            return '<div class="hero-slide tono-' + s.tono + (i === 0 ? " activa" : "") + '" role="group" aria-roledescription="diapositiva" aria-label="' + (i + 1) + " de " + slides.length + '"' + (i === 0 ? "" : ' aria-hidden="true"') + ">" +
                '<img src="' + s.img + '" data-alterna="' + s.alterna + '" alt="" ' + (s.posicion ? 'style="object-position:' + s.posicion + '" ' : '') + (i === 0 ? 'fetchpriority="high"' : 'loading="lazy"') + ">" +
                '<div class="hero-texto">' +
                '<span class="hero-etiqueta">' + s.etiqueta + "</span>" +
                '<h2 class="hero-titulo">' + s.titulo + "</h2>" +
                "<p>" + escapar(s.texto) + "</p>" +
                (s.cuenta ? '<div class="cuenta-regresiva" data-cuenta-regresiva="' + campana.fin + '"></div>' : "") +
                '<div class="hero-acciones"><a class="boton" href="' + s.cta[1] + '">' + s.cta[0] + "</a>" +
                (s.cta2 ? (s.cta2[1] === "#guia" ? '<button type="button" class="boton boton-vidrio" data-accion="guia-tallas" data-categoria="calzado">' + s.cta2[0] + "</button>" : '<a class="boton boton-vidrio" href="' + s.cta2[1] + '">' + s.cta2[0] + "</a>") : "") +
                "</div></div></div>";
        }).join("") + "</div>" +
        '<button type="button" class="hero-flecha anterior" aria-label="Diapositiva anterior">‹</button>' +
        '<button type="button" class="hero-flecha siguiente" aria-label="Diapositiva siguiente">›</button>' +
        '<div class="hero-puntos">' + slides.map(function (s, i) {
            return '<button type="button" data-slide="' + i + '" aria-label="Ir a la diapositiva ' + (i + 1) + '"' + (i === 0 ? ' class="activo"' : "") + '><span></span></button>';
        }).join("") + "</div>";

    hero.querySelector(".anterior").addEventListener("click", function () { irHero(heroIndice - 1, true); });
    hero.querySelector(".siguiente").addEventListener("click", function () { irHero(heroIndice + 1, true); });
    hero.querySelectorAll("[data-slide]").forEach(function (b) {
        b.addEventListener("click", function () { irHero(Number(b.dataset.slide), true); });
    });
    hero.addEventListener("mouseenter", function () { clearInterval(heroTemporizador); });
    hero.addEventListener("mouseleave", iniciarAutoplayHero);
    hero.addEventListener("focusin", function () { clearInterval(heroTemporizador); });

    // Deslizar con el dedo en celulares
    let inicioX = null;
    hero.addEventListener("pointerdown", function (e) { inicioX = e.clientX; });
    hero.addEventListener("pointerup", function (e) {
        if (inicioX !== null && Math.abs(e.clientX - inicioX) > 50) {
            irHero(heroIndice + (e.clientX < inicioX ? 1 : -1), true);
        }
        inicioX = null;
    });
    iniciarAutoplayHero();
}

function irHero(n, manual) {
    let slides = document.querySelectorAll(".hero-slide");
    let puntos = document.querySelectorAll(".hero-puntos button");
    heroIndice = (n + slides.length) % slides.length;
    slides.forEach(function (s, i) {
        s.classList.toggle("activa", i === heroIndice);
        s.setAttribute("aria-hidden", i !== heroIndice);
    });
    puntos.forEach(function (p, i) { p.classList.toggle("activo", i === heroIndice); });
    if (manual) {
        iniciarAutoplayHero();
    }
}

function iniciarAutoplayHero() {
    clearInterval(heroTemporizador);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }
    heroTemporizador = setInterval(function () { irHero(heroIndice + 1); }, 6500);
}

function dibujarCategoriasInicio() {
    let caja = document.getElementById("riel-categorias");
    if (caja === null) {
        return;
    }
    caja.innerHTML = htmlRiel(CATEGORIAS.map(function (c) {
        let cantidad = productos.filter(function (p) { return p.categoria === c.id; }).length;
        return '<a class="tarjeta-categoria" href="catalogo.html?cat=' + c.id + '">' +
            '<img src="' + c.portada + '" alt="" loading="lazy">' +
            "<span><b>" + c.nombre.toUpperCase() + '<i>.</i></b><small>' + cantidad + " productos</small></span></a>";
    }).join(""), "riel-categorias");
}

function rielProductos(lista) {
    return htmlRiel(lista.map(function (p) { return '<div class="riel-item">' + crearTarjeta(p) + "</div>"; }).join(""));
}

// Ventas de los últimos 90 días: las reales de TODOS los clientes (vienen
// de la base como totales, "ventasReales") + los pedidos de ejemplo.
// El admin ya tiene todos los pedidos cargados, así que usa el ranking directo.
function masVendidos(cantidad) {
    let unidades = {};
    rankingProductos(90).forEach(function (r) {
        unidades[r.id] = r.unidades;
    });
    if (ventasReales !== null) {
        // Los pedidos reales propios ya vienen dentro de ventasReales: no se cuentan dos veces
        unidades = {};
        pedidosActivos(90).forEach(function (pedido) {
            if (!pedido.semilla) { return; }
            pedido.items.forEach(function (i) { unidades[i.id] = (unidades[i.id] || 0) + i.cantidad; });
        });
        Object.keys(ventasReales).forEach(function (id) { unidades[id] = (unidades[id] || 0) + ventasReales[id]; });
    }
    return Object.keys(unidades).sort(function (a, b) { return unidades[b] - unidades[a]; })
        .map(buscarProducto).filter(function (p) { return p && stockTotal(p) > 0; }).slice(0, cantidad);
}

function dibujarSeccionesInicio() {
    let ofertas = document.getElementById("riel-ofertas");
    if (ofertas !== null) {
        let lista = productos.filter(function (p) { return ofertaVigente(p) && stockTotal(p) >= (campana.stockMinimo || 1); })
            .sort(function (a, b) { return b.descuento - a.descuento; }).slice(0, 14);
        let seccion = document.getElementById("seccion-ofertas");
        seccion.hidden = lista.length === 0;
        document.getElementById("titulo-campana").textContent = campana.nombre;
        document.getElementById("legal-ofertas").innerHTML = textoVigenciaCampana() + ' <a href="politicas.html#promociones">Términos de la promoción</a>';
        document.getElementById("subtitulo-campana").textContent = campana.subtitulo;
        ofertas.innerHTML = rielProductos(lista);
    }
    let nuevos = document.getElementById("riel-nuevos");
    if (nuevos !== null) {
        nuevos.innerHTML = rielProductos(productos.filter(function (p) { return p.nuevo && stockTotal(p) > 0; }).slice(0, 14));
    }
    let paraTi = document.getElementById("riel-para-ti");
    if (paraTi !== null) {
        let lista;
        let titulo = document.getElementById("titulo-para-ti");
        if (sesion !== null && !esAdmin() && estadisticasCliente(sesion.correo).pedidos > 0) {
            lista = recomendacionesPara(sesion.correo, 12);
            titulo.textContent = "Seleccionados para ti, " + sesion.nombre.split(" ")[0];
        } else {
            lista = masVendidos(12);
            titulo.textContent = "Lo más vendido de la semana";
        }
        paraTi.innerHTML = rielProductos(lista);
    }
    let recientes = document.getElementById("riel-recientes");
    if (recientes !== null) {
        let lista = leerLocal(CLAVES.recientes, []).map(buscarProducto).filter(Boolean);
        document.getElementById("seccion-recientes").hidden = lista.length === 0;
        recientes.innerHTML = rielProductos(lista);
    }
    let fits = document.getElementById("grilla-fits");
    if (fits !== null) {
        fits.innerHTML = Object.keys(FITS_PANTALON).map(function (id) {
            let p = buscarProducto(id);
            // Solo prendas con foto propia en la carpeta img/
            if (!p || p.imagen.indexOf("img/") !== 0) { return ""; }
            return '<a class="tarjeta-fit" href="producto.html?id=' + encodeURIComponent(id) + '">' +
                '<span class="fit-foto"><img src="' + escapar(p.imagen) + '" alt="' + escapar(p.nombre) + '" loading="lazy"></span>' +
                '<b class="fit-nombre">' + FITS_PANTALON[id].fit + "</b>" +
                '<small>Apertura de bota <strong>' + FITS_PANTALON[id].bota + " cm</strong></small></a>";
        }).join("");
    }
    activarRieles();
}

// =====================================================
// 2. CATÁLOGO
// =====================================================
let filtros = null;
let limiteCatalogo = 24;

function leerFiltrosURL() {
    let q = new URLSearchParams(location.search);
    let f = {
        q: q.get("q") || "",
        cats: [], generos: [], tallas: [], colores: [],
        precioMax: Number(q.get("max")) || 0,
        oferta: q.get("oferta") === "1",
        nuevo: q.get("nuevo") === "1",
        orden: q.get("orden") || "relevancia"
    };
    if (q.get("cat")) { f.cats = q.get("cat").split(","); }
    if (q.get("seg")) {
        f.cats = CATEGORIAS.filter(function (c) { return c.segmento === q.get("seg"); }).map(function (c) { return c.id; });
    }
    if (q.get("genero")) { f.generos = q.get("genero").split(","); }
    if (q.get("talla")) { f.tallas = q.get("talla").split(","); }
    if (q.get("color")) { f.colores = q.get("color").split(","); }
    return f;
}

function escribirFiltrosURL() {
    let q = new URLSearchParams();
    if (filtros.q) { q.set("q", filtros.q); }
    if (filtros.cats.length) { q.set("cat", filtros.cats.join(",")); }
    if (filtros.generos.length) { q.set("genero", filtros.generos.join(",")); }
    if (filtros.tallas.length) { q.set("talla", filtros.tallas.join(",")); }
    if (filtros.colores.length) { q.set("color", filtros.colores.join(",")); }
    if (filtros.precioMax) { q.set("max", filtros.precioMax); }
    if (filtros.oferta) { q.set("oferta", "1"); }
    if (filtros.nuevo) { q.set("nuevo", "1"); }
    if (filtros.orden !== "relevancia") { q.set("orden", filtros.orden); }
    let texto = q.toString();
    history.replaceState(null, "", "catalogo.html" + (texto ? "?" + texto : ""));
}

function cumpleFiltros(p, ignorar) {
    let f = filtros;
    if (f.q && !(p.nombre + " " + p.descripcion + " " + nombreCategoria(p.categoria) + " " + p.colores.map(function (c) { return c.nombre; }).join(" ")).toLowerCase().includes(f.q.toLowerCase())) { return false; }
    if (ignorar !== "cats" && f.cats.length && !f.cats.includes(p.categoria)) { return false; }
    // Hombre y Mujer están separados: cada prenda pertenece a una sola línea
    if (f.generos.length && !f.generos.includes(p.genero)) { return false; }
    if (f.tallas.length && !f.tallas.some(function (t) { return (Number(p.stockTallas[t]) || 0) > 0; })) { return false; }
    if (f.colores.length && !p.colores.some(function (c) { return f.colores.includes(c.nombre); })) { return false; }
    if (f.precioMax && precioFinal(p) > f.precioMax) { return false; }
    if (f.oferta && !ofertaVigente(p)) { return false; }
    if (f.nuevo && !p.nuevo) { return false; }
    return true;
}

function listaCatalogo() {
    let lista = productos.filter(function (p) { return cumpleFiltros(p); });
    let ventas = {};
    rankingProductos(90).forEach(function (r) { ventas[r.id] = r.unidades; });
    let o = filtros.orden;
    lista.sort(function (a, b) {
        if (o === "precio-asc") { return precioFinal(a) - precioFinal(b); }
        if (o === "precio-desc") { return precioFinal(b) - precioFinal(a); }
        if (o === "descuento") { return (ofertaVigente(b) ? b.descuento : 0) - (ofertaVigente(a) ? a.descuento : 0); }
        if (o === "vendidos") { return (ventas[b.id] || 0) - (ventas[a.id] || 0); }
        if (o === "nombre") { return a.nombre.localeCompare(b.nombre, "es"); }
        // Relevancia: primero lo que tiene stock, luego novedades y ofertas
        let puntos = function (p) { return (stockTotal(p) > 0 ? 4 : 0) + (p.nuevo ? 1 : 0) + (ofertaVigente(p) ? 1 : 0); };
        return puntos(b) - puntos(a);
    });
    return lista;
}

function dibujarFiltros() {
    let caja = document.getElementById("filtros");
    if (caja === null) {
        return;
    }
    let conteo = {};
    productos.forEach(function (p) { if (cumpleFiltros(p, "cats")) { conteo[p.categoria] = (conteo[p.categoria] || 0) + 1; } });
    let tallas = ["XS", "S", "M", "L", "XL", "28", "30", "32", "34", "36", "37", "38", "39", "40", "41", "42", "43", "Única"];
    let coloresUsados = {};
    productos.forEach(function (p) { p.colores.forEach(function (c) { coloresUsados[c.nombre] = c.hex; }); });
    let maximo = Math.ceil(Math.max.apply(null, productos.map(precioFinal)) / 10) * 10;

    let grupo = function (titulo, contenido, abierto) {
        return '<details class="filtro-grupo"' + (abierto ? " open" : "") + "><summary>" + titulo + "</summary><div>" + contenido + "</div></details>";
    };
    caja.innerHTML =
        '<div class="filtros-cabecera"><h2>Filtrar</h2><button type="button" class="enlace" data-filtro-limpiar>Limpiar todo</button>' +
        '<button type="button" class="cerrar-filtros" data-cerrar-filtros aria-label="Cerrar filtros">&times;</button></div>' +
        '<label class="interruptor"><input type="checkbox" data-filtro="oferta"' + (filtros.oferta ? " checked" : "") + '><span></span>Solo ofertas</label>' +
        '<label class="interruptor"><input type="checkbox" data-filtro="nuevo"' + (filtros.nuevo ? " checked" : "") + '><span></span>Solo novedades</label>' +
        grupo("Categoría", CATEGORIAS.map(function (c) {
            return '<label class="casilla-filtro"><input type="checkbox" data-filtro="cats" value="' + c.id + '"' + (filtros.cats.includes(c.id) ? " checked" : "") + ">" +
                c.nombre + "<small>" + (conteo[c.id] || 0) + "</small></label>";
        }).join(""), true) +
        grupo("Línea", Object.keys(GENEROS).filter(function (g) {
            return g !== "unisex" || productos.some(function (p) { return p.genero === "unisex"; });
        }).map(function (g) {
            return '<label class="casilla-filtro"><input type="checkbox" data-filtro="generos" value="' + g + '"' + (filtros.generos.includes(g) ? " checked" : "") + ">" + GENEROS[g] + "</label>";
        }).join(""), true) +
        grupo("Talla", '<div class="tallas-filtro">' + tallas.map(function (t) {
            return '<label class="chip-talla"><input type="checkbox" data-filtro="tallas" value="' + t + '"' + (filtros.tallas.includes(t) ? " checked" : "") + "><span>" + t + "</span></label>";
        }).join("") + "</div>", filtros.tallas.length > 0) +
        grupo("Color", '<div class="colores-filtro">' + Object.keys(coloresUsados).map(function (c) {
            return '<label class="chip-color" title="' + c + '"><input type="checkbox" data-filtro="colores" value="' + c + '"' + (filtros.colores.includes(c) ? " checked" : "") + '><span style="background:' + coloresUsados[c] + '"></span><small>' + c + "</small></label>";
        }).join("") + "</div>", filtros.colores.length > 0) +
        grupo("Precio", '<label class="rango-precio">Hasta <b id="precio-max-texto">' + formatoPrecio(filtros.precioMax || maximo) + "</b>" +
            '<input type="range" min="30" max="' + maximo + '" step="10" value="' + (filtros.precioMax || maximo) + '" data-filtro="precio" aria-label="Precio máximo"></label>', true) +
        '<button type="button" class="boton boton-bloque ver-resultados" data-cerrar-filtros>Ver resultados</button>';
}

function tituloCatalogo() {
    let f = filtros;
    if (f.oferta) { return [campana.nombre, campana.subtitulo]; }
    if (f.q) { return ['Resultados para "' + f.q + '"', "Encontramos lo que buscas en NOVAK"]; }
    if (f.nuevo) { return ["Novedades", "Lo último que llegó a la tienda"]; }
    if (f.cats.length === 1 && f.generos.length !== 1) { return [nombreCategoria(f.cats[0]), "Explora toda la línea de " + nombreCategoria(f.cats[0]).toLowerCase()]; }
    if (f.cats.length > 1 && f.cats.every(function (c) { return infoCategoria(c).segmento === "accesorios"; })) { return ["Accesorios", "Gafas, relojes, collares y gorras"]; }
    if (f.generos.length === 1 && f.generos[0] !== "unisex") {
        return [GENEROS[f.generos[0]] + (f.cats.length === 1 ? " · " + nombreCategoria(f.cats[0]) : ""), f.generos[0] === "mujer" ? "Ropa, zapatillas y accesorios para ella" : "Ropa, zapatillas y accesorios para él"];
    }
    return ["Catálogo", "Toda la moda NOVAK en un solo lugar"];
}

function dibujarCatalogo() {
    let contenedor = document.getElementById("catalogo");
    if (contenedor === null) {
        return;
    }
    document.getElementById("aviso-admin").hidden = !esAdmin();
    let titulo = tituloCatalogo();
    document.getElementById("titulo-catalogo").textContent = titulo[0];
    document.getElementById("subtitulo-catalogo").textContent = titulo[1];
    let banner = document.getElementById("banner-catalogo");
    banner.classList.toggle("banner-oferta", filtros.oferta);
    document.getElementById("cuenta-catalogo").hidden = !filtros.oferta || tiempoRestante(campana.fin).terminado;
    let legal = document.getElementById("legal-catalogo");
    legal.hidden = !filtros.oferta;
    legal.innerHTML = textoVigenciaCampana() + ' <a href="politicas.html#promociones">Ver términos</a>';

    let lista = listaCatalogo();
    contenedor.innerHTML = lista.slice(0, limiteCatalogo).map(function (p) { return crearTarjeta(p, { admin: true }); }).join("");
    activarImagenesDeRespaldo(contenedor);
    document.getElementById("sin-resultados").hidden = lista.length > 0;
    document.getElementById("ver-mas").hidden = lista.length <= limiteCatalogo;
    document.getElementById("contador-resultados").textContent = lista.length + (lista.length === 1 ? " producto" : " productos");
    document.getElementById("orden").value = filtros.orden;

    // Chips con los filtros activos
    let chips = [];
    if (filtros.q) { chips.push(["q", "", '"' + filtros.q + '"']); }
    filtros.cats.forEach(function (c) { chips.push(["cats", c, nombreCategoria(c)]); });
    filtros.generos.forEach(function (g) { chips.push(["generos", g, GENEROS[g]]); });
    filtros.tallas.forEach(function (t) { chips.push(["tallas", t, "Talla " + t]); });
    filtros.colores.forEach(function (c) { chips.push(["colores", c, c]); });
    if (filtros.precioMax) { chips.push(["precio", "", "Hasta " + formatoPrecio(filtros.precioMax)]); }
    if (filtros.oferta) { chips.push(["oferta", "", "En oferta"]); }
    if (filtros.nuevo) { chips.push(["nuevo", "", "Novedades"]); }
    document.getElementById("filtros-activos").innerHTML = chips.map(function (c) {
        return '<button type="button" class="chip-activo" data-quitar-filtro="' + c[0] + '" data-valor="' + escapar(c[1]) + '">' + escapar(c[2]) + " ✕</button>";
    }).join("");
    let cantidadFiltros = chips.length;
    document.getElementById("boton-filtros").textContent = "Filtros" + (cantidadFiltros ? " (" + cantidadFiltros + ")" : "");
}

function actualizarCatalogo() {
    limiteCatalogo = 24;
    escribirFiltrosURL();
    dibujarFiltros();
    dibujarCatalogo();
}

function iniciarCatalogo() {
    filtros = leerFiltrosURL();
    dibujarFiltros();
    dibujarCatalogo();
    document.addEventListener("change", function (evento) {
        let t = evento.target;
        if (t.id === "orden") {
            filtros.orden = t.value;
            escribirFiltrosURL();
            dibujarCatalogo();
            return;
        }
        let tipo = t.dataset.filtro;
        if (!tipo) {
            return;
        }
        if (tipo === "oferta" || tipo === "nuevo") {
            filtros[tipo] = t.checked;
        } else if (tipo === "precio") {
            filtros.precioMax = Number(t.value);
            if (filtros.precioMax >= Number(t.max)) { filtros.precioMax = 0; }
        } else {
            filtros[tipo] = filtros[tipo].filter(function (v) { return v !== t.value; });
            if (t.checked) { filtros[tipo].push(t.value); }
        }
        actualizarCatalogo();
    });
    document.addEventListener("input", function (evento) {
        if (evento.target.dataset.filtro === "precio") {
            document.getElementById("precio-max-texto").textContent = formatoPrecio(evento.target.value);
        }
    });
    document.addEventListener("click", function (evento) {
        let t = evento.target;
        let quitar = t.closest("[data-quitar-filtro]");
        if (quitar) {
            let tipo = quitar.dataset.quitarFiltro;
            if (tipo === "q") { filtros.q = ""; document.getElementById("busqueda-global").value = ""; }
            else if (tipo === "precio") { filtros.precioMax = 0; }
            else if (tipo === "oferta" || tipo === "nuevo") { filtros[tipo] = false; }
            else { filtros[tipo] = filtros[tipo].filter(function (v) { return v !== quitar.dataset.valor; }); }
            actualizarCatalogo();
        }
        if (t.closest("[data-filtro-limpiar]")) {
            filtros = { q: "", cats: [], generos: [], tallas: [], colores: [], precioMax: 0, oferta: false, nuevo: false, orden: filtros.orden };
            document.getElementById("busqueda-global").value = "";
            actualizarCatalogo();
        }
        if (t.closest("#boton-filtros")) {
            document.body.classList.add("filtros-abiertos");
        }
        if (t.closest("[data-cerrar-filtros]") || t.classList.contains("fondo-filtros")) {
            document.body.classList.remove("filtros-abiertos");
        }
        if (t.closest("#ver-mas")) {
            limiteCatalogo += 24;
            dibujarCatalogo();
        }
    });
}

// =====================================================
// 3. FICHA DE PRODUCTO
// =====================================================
let productoActual = null;
let tallaElegida = "";
let colorElegido = "";
let vistaActiva = 0;

// Reseñas: las que escriben los clientes (con foto opcional) y, si hay datos
// de ejemplo, opiniones que salen de pedidos reales de esa prenda. Cada reseña
// guarda talla, fecha y si es compra verificada (el cliente sí la compró).
const TEXTOS_RESENA = {
    ropa: [[5, "La tela es gruesa y no se deformó después de lavarla."], [5, "Me quedó tal cual la talla de siempre."], [4, "Bonito color, igual a la foto. El calce es un poco amplio."],
        [4, "Buena calidad por el precio. Pediría una talla menos si te gusta ajustado."], [3, "Me gusta el diseño pero el color es un tono más claro que en la foto."], [5, "Llegó al día siguiente y bien empacado."]],
    calzado: [[5, "Cómodas desde el primer día, las uso para todo."], [4, "La horma es normal, pedí mi talla y quedaron bien."], [3, "Lindas, pero la plantilla es algo dura al inicio."], [5, "Combinan con todo."]],
    accesorios: [[5, "Se ve mejor en persona."], [4, "Buen acabado, llegó con su estuche."], [4, "Lo compré para regalo y gustó mucho."], [3, "Está bien, aunque es más pequeño de lo que esperaba."]]
};

function nombreCorto(nombre) {
    let partes = String(nombre).split(" ");
    return partes[0] + (partes[1] ? " " + partes[1].charAt(0) + "." : "");
}

function compraVerificada(correo, idProducto) {
    return pedidos.some(function (p) {
        return p.cliente === correo && p.estado !== "Cancelado" && p.items.some(function (i) { return i.id === idProducto; });
    });
}

function resenasDe(p) {
    // Reseñas reales: vienen de Supabase (resenasBD se carga al abrir la página)
    let propias = (resenasBD[p.id] || []).map(function (r) {
        return Object.assign({ id: p.id }, r);
    });
    if (!DATOS_DE_EJEMPLO) {
        return propias;
    }
    let azar = crearAzar(p.id.split("").reduce(function (s, c) { return s + c.charCodeAt(0); }, 0));
    let pool = TEXTOS_RESENA[infoCategoria(p.categoria).segmento] || TEXTOS_RESENA.ropa;
    let lista = [];
    pedidos.forEach(function (pedido) {
        if (!pedido.semilla || lista.length >= 6) { return; }
        let item = pedido.items.find(function (i) { return i.id === p.id; });
        if (!item || azar() < 0.35) { return; }
        let fecha = new Date(pedido.fecha);
        fecha.setDate(fecha.getDate() + 4 + Math.floor(azar() * 8));
        if (fecha > new Date()) { return; }
        let texto = pool[Math.floor(azar() * pool.length)];
        lista.push({ id: p.id, nombre: nombreCorto(pedido.nombre), estrellas: texto[0], texto: texto[1], fecha: fecha.toISOString(),
            talla: item.talla, color: item.color, verificada: true });
    });
    lista.sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    return propias.concat(lista);
}

function htmlResena(r, conProducto) {
    let p = conProducto ? buscarProducto(r.id) : null;
    return '<article class="resena">' +
        (p ? '<a class="resena-producto" href="producto.html?id=' + encodeURIComponent(p.id) + '#resenas"><img src="' + escapar(p.imagen) + '" alt="" width="44" height="55"><span>' + escapar(p.nombre) + "</span></a>" : "") +
        '<div class="resena-cabecera">' + estrellas(r.estrellas) + (r.verificada ? '<span class="verificada">Compra verificada</span>' : "") + "</div>" +
        "<p>" + escapar(r.texto) + "</p>" +
        (r.foto ? '<img class="resena-foto" src="' + escapar(r.foto) + '" alt="Foto del cliente" loading="lazy">' : "") +
        "<small>" + escapar(r.nombre) + " · " + fechaCorta(r.fecha) + (r.talla && r.talla !== "Única" ? " · Talla " + escapar(r.talla) : "") + "</small></article>";
}

// Inicio: últimas opiniones (primero las de clientes con foto)
function dibujarResenasInicio() {
    let caja = document.getElementById("resenas-inicio");
    if (caja === null) {
        return;
    }
    let todas = [];
    let propias = resenasBD;   // las 30 reseñas más recientes, desde Supabase
    Object.keys(propias).forEach(function (id) {
        propias[id].forEach(function (r) { todas.push(Object.assign({ id: id }, r)); });
    });
    if (DATOS_DE_EJEMPLO) {
        ["hoodies-02", "calzado-03", "vestidos-03", "pantalones-08", "collares-05", "polos-04", "casacas-07", "gafas-02"].forEach(function (id) {
            let p = buscarProducto(id);
            if (p) { todas = todas.concat(resenasDe(p).filter(function (r) { return !r.foto && r.verificada && !propias[id]; }).slice(0, 1)); }
        });
    }
    todas.sort(function (a, b) { return (b.foto ? 1 : 0) - (a.foto ? 1 : 0) || (a.fecha < b.fecha ? 1 : -1); });
    let total = todas.length;
    let promedio = total ? todas.reduce(function (s, r) { return s + r.estrellas; }, 0) / total : 0;
    document.getElementById("resumen-resenas").innerHTML = total
        ? estrellas(promedio) + " <b>" + promedio.toFixed(1) + "</b> de 5 en las últimas " + total + " opiniones"
        : "Aún no hay opiniones. ¡Sé el primero en contarnos qué tal tu compra!";
    caja.innerHTML = todas.slice(0, 6).map(function (r) { return htmlResena(r, true); }).join("");
    activarImagenesDeRespaldo(caja);
}

function estrellas(valor) {
    let llenas = Math.round(valor);
    return '<span class="estrellas" aria-label="' + valor.toFixed(1) + ' de 5 estrellas">' + "★★★★★".slice(0, llenas) + '<span class="vacias">' + "★★★★★".slice(llenas) + "</span></span>";
}

function dibujarFicha() {
    let caja = document.getElementById("ficha");
    let id = new URLSearchParams(location.search).get("id");
    let p = buscarProducto(id);
    if (p === null) {
        caja.innerHTML = '<div class="contenedor vacio-grande"><h1>No encontramos esta prenda</h1><p>Puede que ya no esté disponible.</p><a class="boton" href="catalogo.html">Ir al catálogo</a></div>';
        return;
    }
    productoActual = p;
    document.title = p.nombre + " - NOVAK";
    if (!colorElegido) { colorElegido = p.colores[0].nombre; }

    let resenas = resenasDe(p);
    let promedio = resenas.length ? resenas.reduce(function (s, r) { return s + r.estrellas; }, 0) / resenas.length : 0;
    let galeria = VISTAS.map(function (v, i) {
        let vista = vistaProducto(p, v.id);
        return '<figure class="vista' + (vista.real ? "" : " vista-ref vista-ref-" + v.id) + (i === vistaActiva ? " activa" : "") + '" data-vista="' + i + '">' +
            '<button type="button" class="vista-boton" data-ampliar="' + i + '" aria-label="Ampliar vista ' + v.nombre + '">' +
            '<img src="' + escapar(vista.src) + '" alt="' + escapar(p.nombre) + " - " + v.nombre + '" data-id-vista="' + v.id + '"' + (i > 1 ? ' loading="lazy"' : "") + "></button>" +
            '<figcaption>' + v.nombre + (vista.real ? "" : " · referencial") + "</figcaption></figure>";
    }).join("");

    let st = stockTotal(p);
    let oferta = ofertaVigente(p);
    let specs = p.especificaciones.map(function (e) { return "<tr><th>" + escapar(e[0]) + "</th><td>" + escapar(e[1]) + "</td></tr>"; }).join("") +
        "<tr><th>Línea</th><td>" + GENEROS[p.genero] + "</td></tr>" +
        "<tr><th>Tallas</th><td>" + Object.keys(p.stockTallas).join(" · ") + "</td></tr>" +
        "<tr><th>Colores</th><td>" + p.colores.map(function (c) { return escapar(c.nombre); }).join(", ") + "</td></tr>" +
        "<tr><th>SKU</th><td>" + escapar(p.sku) + "</td></tr>";

    caja.innerHTML =
        '<div class="contenedor">' +
        '<nav class="migas" aria-label="Ruta"><a href="index.html">Inicio</a> / <a href="catalogo.html?cat=' + p.categoria + '">' + nombreCategoria(p.categoria) + "</a> / <span>" + escapar(p.nombre) + "</span></nav>" +
        '<div class="ficha-grilla">' +
        '<div class="galeria-columna"><div class="galeria" id="galeria">' + galeria + "</div>" +
        '<div class="galeria-puntos">' + VISTAS.map(function (v, i) { return '<button type="button" data-ir-vista="' + i + '" aria-label="' + v.nombre + '"' + (i === 0 ? ' class="activo"' : "") + "></button>"; }).join("") + "</div>" +
        '<p class="nota-color" id="nota-color" hidden></p></div>' +

        '<div class="ficha-info">' +
        '<p class="producto-marca">NOVAK · ' + nombreCategoria(p.categoria) + " · " + GENEROS[p.genero] + (p.nuevo ? ' <span class="sello sello-nuevo">Nuevo</span>' : "") + "</p>" +
        '<h1 class="ficha-titulo">' + escapar(p.nombre) + "</h1>" +
        '<a class="ficha-rating" href="#resenas">' + (resenas.length ? estrellas(promedio) + " " + promedio.toFixed(1) + " (" + resenas.length + (resenas.length === 1 ? " reseña" : " reseñas") + ")" : "Sin reseñas todavía") + "</a>" +
        '<p class="ficha-corta">' + escapar(p.descripcion) + "</p>" +
        htmlPrecio(p, true) +
        (oferta ? '<div class="oferta-ficha"><span>La oferta termina en</span><div class="cuenta-regresiva chica" data-cuenta-regresiva="' + (p.ofertaHasta || campana.fin) + '"></div><small>Ahorras ' + formatoPrecio(p.precio - precioFinal(p)) + '</small><p class="legal-oferta">' + (p.ofertaHasta === campana.fin ? textoVigenciaCampana() : "Válido hasta el " + fechaCorta(p.ofertaHasta) + " o hasta agotar stock.") + "</p></div>" : "") +

        '<div class="ficha-bloque"><p class="etiqueta-campo">Color: <b class="color-elegido">' + escapar(colorElegido) + "</b></p>" + htmlColores(p, colorElegido) + "</div>" +
        '<div class="ficha-bloque"><p class="etiqueta-campo">Talla <button type="button" class="enlace" data-accion="guia-tallas" data-categoria="' + p.categoria + '">' + ICONOS.regla + " Guía de tallas</button></p>" +
        htmlTallas(p, tallaElegida) + '<p class="nota-stock" id="nota-stock">' + (st <= 0 ? "Agotado en todas las tallas." : "Elige tu talla para ver el stock.") + "</p></div>" +

        '<div class="ficha-compra">' +
        '<div class="cantidad"><button type="button" data-cantidad="-1" aria-label="Quitar uno">−</button><span id="cantidad-ficha">1</span><button type="button" data-cantidad="1" aria-label="Agregar uno">+</button></div>' +
        '<button type="button" class="boton boton-grande" id="agregar-ficha"' + (st <= 0 ? " disabled" : "") + ">" + ICONOS.bolsa + (st <= 0 ? "Agotado" : "Añadir al carrito") + "</button>" +
        '<button type="button" class="boton-favorito grande' + (esFavorito(p.id) ? " activo" : "") + '" data-accion="favorito" data-id="' + escapar(p.id) + '" aria-pressed="' + esFavorito(p.id) + '" aria-label="Guardar en favoritos">' + ICONOS.corazon + "</button></div>" +
        (st > 0 ? '<button type="button" class="boton boton-claro boton-bloque" id="comprar-ahora">Comprar ahora</button>' : "") +

        '<div class="envio-ficha" id="envio-ficha"></div>' +
        '<ul class="beneficios-ficha">' +
        "<li>" + ICONOS.camion + "<span><b>Despacho a domicilio</b> Lima en 24 - 48 h · Provincias 3 - 5 días. Gratis desde S/ " + ENVIO_GRATIS_DESDE + "</span></li>" +
        "<li>" + ICONOS.tienda + "<span><b>Retira gratis en tienda</b> NOVAK Miraflores y Jockey Plaza</span></li>" +
        "<li>" + ICONOS.cambio + "<span><b>Cambios y devoluciones gratis</b> hasta 30 días después de tu compra</span></li>" +
        "<li>" + ICONOS.escudo + "<span><b>Formas de pago</b> Transferencia bancaria o contra entrega en Lima</span></li></ul>" +

        '<div class="acordeon">' +
        "<details open><summary>Descripción</summary><p>" + escapar(p.detalle || p.descripcion) + "</p></details>" +
        '<details><summary>Especificaciones</summary><table class="tabla-especificaciones">' + specs + "</table></details>" +
        "<details><summary>Envíos y devoluciones</summary><p>Envío a todo el Perú. Lima Metropolitana y Callao: " + formatoPrecio(COSTO_ENVIO.lima) + ", provincias: " + formatoPrecio(COSTO_ENVIO.provincia) + ". Gratis por compras desde " + formatoPrecio(ENVIO_GRATIS_DESDE) + ". Puedes cambiar talla o color sin costo dentro de los 30 días, con la etiqueta puesta.</p></details>" +
        "</div></div></div>" +

        (esAdmin() ? '<section class="panel-admin-ficha" aria-labelledby="titulo-admin-ficha"><div class="panel-admin-cabecera"><h2 id="titulo-admin-ficha">' + ICONOS.grafico + " Estadísticas de esta prenda <small>Solo lo ve el administrador</small></h2>" +
            '<div class="acciones-fila"><button type="button" class="boton boton-chico" data-accion="editar" data-id="' + escapar(p.id) + '">Editar prenda y fotos</button>' +
            '<button type="button" class="boton boton-claro boton-chico" data-accion="stock" data-id="' + escapar(p.id) + '">Actualizar stock</button></div></div>' +
            panelEstadisticasProducto(p.id) + "</section>" : "") +

        '<section class="resenas" id="resenas" aria-labelledby="titulo-resenas"><div class="resenas-cabecera"><div><h2 id="titulo-resenas">Valoraciones</h2>' +
        (resenas.length ? '<p class="promedio-grande">' + promedio.toFixed(1) + " " + estrellas(promedio) + "<small>" + resenas.length + " opiniones · Solo publicamos opiniones de clientes con cuenta</small></p>" : "") + "</div>" +
        (sesion !== null && !esAdmin() ? '<form class="form-resena" id="form-resena" novalidate><h3>Deja tu opinión</h3>' +
            '<div class="elegir-estrellas" role="radiogroup" aria-label="Calificación">' + [5, 4, 3, 2, 1].map(function (n) {
                return '<input type="radio" name="estrellas" id="est-' + n + '" value="' + n + '"' + (n === 5 ? " checked" : "") + '><label for="est-' + n + '" title="' + n + ' estrellas">★</label>';
            }).join("") + "</div>" +
            '<label class="sr-only" for="texto-resena">Tu comentario</label><textarea id="texto-resena" name="texto" rows="2" placeholder="¿Qué tal la talla, la tela, el color?" maxlength="300"></textarea>' +
            '<label class="subir-archivo">Agregar foto (opcional)<input type="file" accept="image/*" name="foto" hidden></label><img class="previa-resena" id="previa-resena" alt="" hidden>' +
            '<button type="submit" class="boton boton-chico">Publicar</button><p class="mensaje" role="status" hidden></p></form>'
            : (esAdmin() ? "" : '<p><a href="login.html?volver=producto.html">Ingresa</a> para dejar tu opinión.</p>')) +
        "</div>" +
        '<div class="lista-resenas">' + (resenas.length ? resenas.slice(0, 8).map(function (r) { return htmlResena(r, false); }).join("") : '<p class="sin-datos">Esta prenda aún no tiene opiniones.</p>') + "</div></section>" +

        '<section class="seccion-riel"><h2>También te puede gustar</h2><div id="riel-relacionados"></div></section>' +
        '<section class="seccion-riel" id="seccion-recientes-ficha"><h2>Vistos recientemente</h2><div id="riel-recientes-ficha"></div></section>' +
        "</div>";

    let relacionados = productos.filter(function (x) { return x.categoria === p.categoria && x.id !== p.id; })
        .concat(productos.filter(function (x) { return x.genero === p.genero && x.categoria !== p.categoria; }).slice(0, 4)).slice(0, 12);
    document.getElementById("riel-relacionados").innerHTML = rielProductos(relacionados);
    let recientes = leerLocal(CLAVES.recientes, []).filter(function (r) { return r !== p.id; }).map(buscarProducto).filter(Boolean);
    document.getElementById("seccion-recientes-ficha").hidden = recientes.length === 0;
    document.getElementById("riel-recientes-ficha").innerHTML = rielProductos(recientes);
    activarImagenesDeRespaldo(caja);
    activarRieles(caja);
    buscarFotosDeVistas(p);
    actualizarEnvioFicha();
    datosEstructuradosProducto(p, resenas, promedio);
    alElegirColor(colorElegido);
    if (tallaElegida) { alElegirTalla(tallaElegida); }
}

// Si existe img/<id>-espalda.jpg (o -izquierda / -derecha) se usa automáticamente
function buscarFotosDeVistas(p) {
    ["espalda", "izquierda", "derecha"].forEach(function (v) {
        if (p.vistas && p.vistas[v]) {
            return;
        }
        let prueba = new Image();
        prueba.onload = function () {
            let img = document.querySelector('[data-id-vista="' + v + '"]');
            if (img) {
                img.src = prueba.src;
                let figura = img.closest(".vista");
                figura.classList.remove("vista-ref", "vista-ref-" + v);
                figura.querySelector("figcaption").textContent = VISTAS.find(function (x) { return x.id === v; }).nombre;
            }
        };
        prueba.src = "img/" + p.id + "-" + v + ".jpg";
    });
}

function actualizarEnvioFicha() {
    let caja = document.getElementById("envio-ficha");
    if (caja) { caja.innerHTML = htmlBarraEnvio(calcularTotales()); }
}

// Etiquetas para buscadores y redes: título, descripción, Open Graph y datos estructurados
function ponerMeta(atributo, nombre, contenido) {
    let meta = document.head.querySelector("meta[" + atributo + '="' + nombre + '"]');
    if (meta === null) {
        meta = document.createElement("meta");
        meta.setAttribute(atributo, nombre);
        document.head.appendChild(meta);
    }
    meta.setAttribute("content", contenido);
}

function datosEstructuradosProducto(p, resenas, promedio) {
    let url = EMPRESA.sitio + "producto.html?id=" + encodeURIComponent(p.id);
    let imagen = new URL(p.imagen, EMPRESA.sitio).href;
    let descripcion = p.nombre + " - " + p.descripcion + ". " + formatoPrecio(precioFinal(p)) + " en NOVAK. Envío a todo el Perú.";
    ponerMeta("name", "description", descripcion);
    ponerMeta("property", "og:title", p.nombre + " | NOVAK");
    ponerMeta("property", "og:description", descripcion);
    ponerMeta("property", "og:image", imagen);
    ponerMeta("property", "og:url", url);
    ponerMeta("property", "og:type", "product");
    ponerMeta("property", "product:price:amount", precioFinal(p).toFixed(2));
    ponerMeta("property", "product:price:currency", "PEN");
    let datos = {
        "@context": "https://schema.org",
        "@type": "Product",
        name: p.nombre,
        image: [imagen],
        description: p.detalle || p.descripcion,
        sku: p.sku,
        brand: { "@type": "Brand", name: "NOVAK" },
        color: p.colores.map(function (c) { return c.nombre; }).join(", "),
        size: Object.keys(p.stockTallas).join(", "),
        offers: {
            "@type": "Offer",
            url: url,
            priceCurrency: "PEN",
            price: precioFinal(p).toFixed(2),
            availability: stockTotal(p) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition"
        }
    };
    if (ofertaVigente(p) && p.ofertaHasta) {
        datos.offers.priceValidUntil = p.ofertaHasta.slice(0, 10);
    }
    if (resenas.length) {
        datos.aggregateRating = { "@type": "AggregateRating", ratingValue: promedio.toFixed(1), reviewCount: resenas.length };
    }
    let script = document.getElementById("datos-producto");
    if (script === null) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.id = "datos-producto";
        document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(datos);
}

function alElegirTalla(talla) {
    if (pagina !== "producto" || !productoActual) {
        return;
    }
    tallaElegida = talla;
    // El stock ahora es por talla Y color (tabla variantes)
    let disponible = stockDe(productoActual, talla, colorElegido);
    let nota = document.getElementById("nota-stock");
    let enColor = colorElegido ? " en " + escapar(colorElegido.toLowerCase()) : "";
    nota.innerHTML = disponible === 0 ? "Talla " + escapar(talla) + " agotada" + enColor + ". Prueba otro color."
        : disponible <= 5 ? "Quedan solo <b>" + disponible + "</b> en talla " + escapar(talla) + enColor + "."
        : "Talla " + escapar(talla) + " disponible" + enColor + " (" + disponible + " unidades).";
    nota.classList.toggle("urgente", disponible <= 5);
    let cantidad = document.getElementById("cantidad-ficha");
    if (Number(cantidad.textContent) > disponible) { cantidad.textContent = Math.max(1, disponible); }
}

function alElegirColor(color) {
    if (pagina !== "producto" || !productoActual) {
        return;
    }
    colorElegido = color;
    let nota = document.getElementById("nota-color");
    let esFoto = productoActual.colores[0].nombre === color;
    nota.hidden = esFoto;
    nota.textContent = "Las fotos muestran el color " + productoActual.colores[0].nombre.toLowerCase() + ". Recibirás la prenda en " + color.toLowerCase() + ".";
    document.getElementById("galeria").style.setProperty("--tinte", esFoto ? "transparent" : hexDeColor(color));
    document.getElementById("galeria").classList.toggle("con-tinte", !esFoto);
    // Al cambiar de color, el stock de la talla elegida puede ser otro
    if (tallaElegida) { alElegirTalla(tallaElegida); }
}

function abrirVisor(indice) {
    let p = productoActual;
    vistaActiva = (indice + 4) % 4;
    let v = VISTAS[vistaActiva];
    let figura = document.querySelectorAll("#galeria .vista")[vistaActiva];
    let img = figura.querySelector("img");
    abrirModal('<div class="visor">' +
        '<h2 id="modal-titulo" class="sr-only">' + escapar(p.nombre) + " - " + v.nombre + "</h2>" +
        '<div class="visor-imagen ' + (figura.classList.contains("vista-ref") ? "vista-ref vista-ref-" + v.id : "") + '"><img src="' + escapar(img.src) + '" alt="' + escapar(p.nombre + " - " + v.nombre) + '"></div>' +
        '<div class="visor-barra"><button type="button" class="boton boton-claro boton-chico" data-visor="-1">‹ Anterior</button>' +
        "<span>" + v.nombre + (figura.classList.contains("vista-ref") ? " (vista referencial)" : "") + " · " + (vistaActiva + 1) + "/4</span>" +
        '<button type="button" class="boton boton-claro boton-chico" data-visor="1">Siguiente ›</button></div>' +
        '<div class="visor-miniaturas">' + Array.prototype.map.call(document.querySelectorAll("#galeria .vista"), function (f, i) {
            return '<button type="button" data-visor-ir="' + i + '" class="' + (i === vistaActiva ? "activo " : "") + f.className.replace(/vista|activa/g, "") + '"><img src="' + escapar(f.querySelector("img").src) + '" alt="' + VISTAS[i].nombre + '"></button>';
        }).join("") + "</div></div>", "modal-visor");
}

function iniciarFicha() {
    dibujarFicha();
    if (productoActual && !esAdmin()) {
        registrarVista(productoActual.id);
    }
    document.addEventListener("click", function (evento) {
        let t = evento.target;
        let ampliar = t.closest("[data-ampliar]");
        if (ampliar) { abrirVisor(Number(ampliar.dataset.ampliar)); return; }
        let visor = t.closest("[data-visor]");
        if (visor) { abrirVisor(vistaActiva + Number(visor.dataset.visor)); return; }
        let visorIr = t.closest("[data-visor-ir]");
        if (visorIr) { abrirVisor(Number(visorIr.dataset.visorIr)); return; }
        let ir = t.closest("[data-ir-vista]");
        if (ir) {
            let galeria = document.getElementById("galeria");
            galeria.scrollTo({ left: galeria.clientWidth * Number(ir.dataset.irVista), behavior: "smooth" });
        }
        let cambio = t.closest("[data-cantidad]");
        if (cambio) {
            let span = document.getElementById("cantidad-ficha");
            let maximo = tallaElegida ? stockDe(productoActual, tallaElegida, colorElegido) || 1 : 10;
            span.textContent = Math.min(maximo, Math.max(1, Number(span.textContent) + Number(cambio.dataset.cantidad)));
        }
        if (t.closest("#agregar-ficha") || t.closest("#comprar-ahora")) {
            if (!tallaElegida) {
                mostrarToast("Elige una talla primero.", "error");
                let grupo = document.querySelector(".ficha-info .tallas");
                grupo.classList.add("sacudir");
                grupo.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(function () { grupo.classList.remove("sacudir"); }, 500);
                return;
            }
            let ok = agregarAlCarrito(productoActual.id, tallaElegida, colorElegido, Number(document.getElementById("cantidad-ficha").textContent));
            if (ok && t.closest("#comprar-ahora")) {
                window.location.href = "checkout.html";
            }
        }
    });
    // En celulares la galería se desliza: se actualizan los puntos
    let galeria = document.getElementById("galeria");
    if (galeria) {
        galeria.addEventListener("scroll", function () {
            let i = Math.round(galeria.scrollLeft / galeria.clientWidth);
            document.querySelectorAll("[data-ir-vista]").forEach(function (b, k) { b.classList.toggle("activo", k === i); });
        }, { passive: true });
    }
    // Si solo hay una talla (accesorios) se elige sola
    if (productoActual) {
        let tallas = Object.keys(productoActual.stockTallas);
        if (tallas.length === 1 && productoActual.stockTallas[tallas[0]] > 0) {
            let b = document.querySelector('.ficha-info .talla[data-talla="' + tallas[0] + '"]');
            if (b) { b.click(); }
        }
    }
}

// =====================================================
// 4. CARRITO
// =====================================================
function dibujarCarritoPagina() {
    let lista = document.getElementById("lista-carrito");
    if (lista === null) {
        return;
    }
    let vacio = carrito.length === 0;
    document.getElementById("carrito-vacio").hidden = !vacio;
    document.getElementById("carrito-lleno").hidden = vacio;
    if (vacio) {
        document.getElementById("riel-sugeridos").innerHTML = rielProductos(masVendidos(10));
        activarRieles();
        return;
    }
    lista.innerHTML = carrito.map(function (item) {
        let p = buscarProducto(item.id);
        if (!p) { return ""; }
        let clave = claveItem(item);
        let hex = (p.colores.find(function (c) { return c.nombre === item.color; }) || {}).hex || hexDeColor(item.color);
        return '<article class="item-carrito">' +
            '<a href="producto.html?id=' + encodeURIComponent(p.id) + '"><img src="' + escapar(p.imagen) + '" alt="" width="96" height="120"></a>' +
            '<div class="item-info"><h3><a href="producto.html?id=' + encodeURIComponent(p.id) + '">' + escapar(p.nombre) + "</a></h3>" +
            '<p class="item-variante">Talla <b>' + escapar(item.talla) + '</b> · <span class="muestra" style="background:' + escapar(hex) + '"></span>' + escapar(item.color) + "</p>" +
            htmlPrecio(p) +
            '<div class="item-acciones"><div class="cantidad"><button type="button" data-cambiar="' + escapar(clave) + '" data-delta="-1" aria-label="Quitar una unidad">−</button><span>' + item.cantidad + "</span>" +
            '<button type="button" data-cambiar="' + escapar(clave) + '" data-delta="1" aria-label="Agregar una unidad">+</button></div>' +
            '<button type="button" class="enlace" data-mover-favorito="' + escapar(clave) + '">Mover a favoritos</button>' +
            '<button type="button" class="enlace peligro" data-quitar-item="' + escapar(clave) + '">Eliminar</button></div></div>' +
            '<p class="item-total">' + formatoPrecio(precioFinal(p) * item.cantidad) + "</p></article>";
    }).join("");
    activarImagenesDeRespaldo(lista);

    let t = calcularTotales();
    document.getElementById("progreso-envio").innerHTML = ICONOS.camion + htmlBarraEnvio(t);
    document.getElementById("resumen-carrito").innerHTML = htmlResumenTotales(t, "lima", true);
    let cupon = document.getElementById("cupon-actual");
    cupon.innerHTML = t.cupon ? '<span class="chip-cupon">Cupón ' + escapar(t.cupon.codigo) + " · " + escapar(t.cupon.descripcion) + ' <button type="button" data-quitar-cupon aria-label="Quitar cupón">✕</button></span>' +
        (t.mensajeCupon ? '<p class="mensaje error">' + escapar(t.mensajeCupon) + "</p>" : "") : "";
}

function htmlResumenTotales(t, zona, estimado) {
    return '<dl class="totales">' +
        "<div><dt>Subtotal (" + t.unidades + (t.unidades === 1 ? " producto" : " productos") + ")</dt><dd>" + formatoPrecio(t.lista) + "</dd></div>" +
        (t.ahorro > 0 ? '<div class="ahorro"><dt>Descuentos por ofertas</dt><dd>-' + formatoPrecio(t.ahorro) + "</dd></div>" : "") +
        (t.descuentoCupon > 0 ? '<div class="ahorro"><dt>Cupón ' + escapar(t.cupon.codigo) + "</dt><dd>-" + formatoPrecio(t.descuentoCupon) + "</dd></div>" : "") +
        "<div><dt>Envío" + (estimado ? " (estimado Lima)" : "") + "</dt><dd>" + (t.envio === 0 ? '<b class="gratis">Gratis</b>' : formatoPrecio(t.envio)) + "</dd></div>" +
        '<div class="total"><dt>Total</dt><dd>' + formatoPrecio(t.total) + "</dd></div>" +
        (t.ahorro + t.descuentoCupon > 0 ? '<p class="ahorro-total">Estás ahorrando ' + formatoPrecio(t.ahorro + t.descuentoCupon) + "</p>" : "") + "</dl>";
}

function iniciarCarrito() {
    dibujarCarritoPagina();
    document.addEventListener("click", function (evento) {
        let t = evento.target;
        let cambiar = t.closest("[data-cambiar]");
        if (cambiar) { cambiarCantidad(cambiar.dataset.cambiar, Number(cambiar.dataset.delta)); }
        let quitar = t.closest("[data-quitar-item]");
        if (quitar) {
            let item = carrito.find(function (i) { return claveItem(i) === quitar.dataset.quitarItem; });
            cambiarCantidad(quitar.dataset.quitarItem, -item.cantidad);
            mostrarToast("Producto eliminado del carrito.");
        }
        let mover = t.closest("[data-mover-favorito]");
        if (mover) {
            let item = carrito.find(function (i) { return claveItem(i) === mover.dataset.moverFavorito; });
            if (!esFavorito(item.id)) { alternarFavorito(item.id); }
            cambiarCantidad(mover.dataset.moverFavorito, -item.cantidad);
        }
        if (t.closest("[data-quitar-cupon]")) {
            quitarCupon();
            dibujarCarritoPagina();
        }
        if (t.closest("[data-vaciar]") && confirm("¿Quieres vaciar tu carrito?")) {
            carrito = [];
            guardarCarrito();
        }
        let sugerido = t.closest("[data-usar-cupon]");
        if (sugerido) {
            aplicarCupon(sugerido.dataset.usarCupon);
            dibujarCarritoPagina();
        }
    });
    document.addEventListener("submit", function (evento) {
        if (evento.target.id === "form-cupon-carrito") {
            evento.preventDefault();
            let campo = evento.target.codigo;
            if (campo.value.trim() === "") {
                mostrarToast("Escribe un código de cupón.", "error");
                return;
            }
            if (aplicarCupon(campo.value)) { campo.value = ""; }
            dibujarCarritoPagina();
        }
    });
    let sugeridos = document.getElementById("cupones-sugeridos");
    if (sugeridos) {
        sugeridos.innerHTML = cupones.filter(function (c) { return c.activo; }).slice(0, 4).map(function (c) {
            return '<button type="button" class="cupon-sugerido" data-usar-cupon="' + escapar(c.codigo) + '"><b>' + escapar(c.codigo) + "</b><small>" + escapar(c.descripcion) + "</small></button>";
        }).join("");
    }
}

// =====================================================
// 5. CHECKOUT Y PASARELA DE PAGO
// =====================================================
let pasoCheckout = 1;
let datosCheckout = {};

const DEPARTAMENTOS = ["Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca", "Cusco", "Huancavelica", "Huánuco", "Ica", "Junín", "La Libertad", "Lambayeque", "Loreto", "Madre de Dios", "Moquegua", "Pasco", "Piura", "Puno", "San Martín", "Tacna", "Tumbes", "Ucayali"];

function zonaCheckout() {
    if (datosCheckout.entrega === "recojo") { return "recojo"; }
    return datosCheckout.zona === "provincia" ? "provincia" : "lima";
}

function dibujarResumenCheckout() {
    let caja = document.getElementById("resumen-checkout");
    if (!caja) {
        return;
    }
    let t = calcularTotales(zonaCheckout());
    caja.innerHTML = "<h2>Tu pedido</h2>" +
        '<ul class="items-checkout">' + carrito.map(function (item) {
            let p = buscarProducto(item.id);
            return '<li><span class="foto-cantidad"><img src="' + escapar(p.imagen) + '" alt="" width="52" height="64"><b>' + item.cantidad + "</b></span>" +
                "<span>" + escapar(p.nombre) + "<small>Talla " + escapar(item.talla) + " · " + escapar(item.color) + "</small></span>" +
                "<span>" + formatoPrecio(precioFinal(p) * item.cantidad) + "</span></li>";
        }).join("") + "</ul>" +
        '<form class="form-cupon-mini" id="form-cupon-checkout" novalidate><label class="sr-only" for="cupon-checkout">Cupón</label><input id="cupon-checkout" name="codigo" placeholder="Código de cupón"' + (t.cupon ? ' value="' + escapar(t.cupon.codigo) + '"' : "") + '><button class="boton boton-claro boton-chico" type="submit">Aplicar</button></form>' +
        (t.mensajeCupon ? '<p class="mensaje error">' + escapar(t.mensajeCupon) + "</p>" : "") +
        htmlResumenTotales(t, zonaCheckout(), false) +
        '<p class="sello-seguro">' + ICONOS.escudo + " Pago protegido con cifrado SSL de 256 bits</p>";
    activarImagenesDeRespaldo(caja);
    let boton = document.getElementById("boton-pagar");
    if (boton) { boton.textContent = "Confirmar pedido · " + formatoPrecio(t.total); }
}

function irPaso(n) {
    pasoCheckout = n;
    document.querySelectorAll(".paso-checkout").forEach(function (s) {
        let num = Number(s.dataset.paso);
        s.classList.toggle("activo", num === n);
        s.classList.toggle("hecho", num < n);
    });
    document.querySelectorAll(".indicador-pasos li").forEach(function (li, i) {
        li.classList.toggle("activo", i + 1 === n);
        li.classList.toggle("hecho", i + 1 < n);
    });
    let activo = document.querySelector('.paso-checkout[data-paso="' + n + '"]');
    if (activo) { activo.scrollIntoView({ behavior: "smooth", block: "start" }); }
    actualizarMetodosDisponibles();
    dibujarResumenCheckout();
}

function resumenPaso(n) {
    let r = document.querySelector('.paso-checkout[data-paso="' + n + '"] .paso-resumen');
    if (!r) { return; }
    if (n === 1) { r.textContent = datosCheckout.nombre + " · " + datosCheckout.correo + " · " + datosCheckout.telefono; }
    if (n === 2) { r.textContent = datosCheckout.entrega === "recojo" ? "Recojo en " + datosCheckout.tienda : datosCheckout.direccion + ", " + datosCheckout.distrito + (datosCheckout.zona === "provincia" ? " (" + datosCheckout.departamento + ")" : ""); }
}

function actualizarMetodosDisponibles() {
    let contra = document.querySelector('input[name="metodo"][value="contraentrega"]');
    if (!contra) { return; }
    let permitido = datosCheckout.entrega === "domicilio" && datosCheckout.zona !== "provincia";
    contra.disabled = !permitido;
    contra.closest(".metodo").classList.toggle("deshabilitado", !permitido);
    contra.closest(".metodo").querySelector("small").textContent = permitido ? "Paga en efectivo al recibir (solo Lima)" : "Solo para envíos a domicilio en Lima";
    if (!permitido && contra.checked) {
        document.querySelector('input[name="metodo"][value="transferencia"]').checked = true;
        mostrarPanelPago();
    }
}

// Cuentas para transferencias: se editan en EMPRESA.cuentasBancarias (js/datos.js)
function dibujarCuentasBancarias() {
    let lista = document.getElementById("cuentas-banco");
    if (!lista) { return; }
    document.getElementById("titular-cuentas").textContent = EMPRESA.titularCuentas || EMPRESA.marca;
    lista.innerHTML = (EMPRESA.cuentasBancarias || []).map(function (c) {
        return "<li><b>" + escapar(c.banco) + "</b> " + escapar(c.cuenta) + (c.cci ? " · CCI " + escapar(c.cci) : "") + "</li>";
    }).join("");
}

function mostrarPanelPago() {
    let metodo = document.querySelector('input[name="metodo"]:checked').value;
    document.querySelectorAll(".panel-pago").forEach(function (p) { p.hidden = p.dataset.panel !== metodo; });
    document.querySelectorAll(".metodo").forEach(function (m) { m.classList.toggle("activo", m.querySelector("input").checked); });
    let t = calcularTotales(zonaCheckout());
    document.querySelectorAll("[data-monto]").forEach(function (el) { el.textContent = formatoPrecio(t.total); });
}

function validarPaso1(f) {
    let nombre = f.nombre.value.trim();
    let correo = f.correo.value.trim();
    let telefono = f.telefono.value.replace(/\D/g, "");
    let dni = f.dni.value.replace(/\D/g, "");
    if (nombre.length < 3) { return "Escribe tu nombre completo."; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { return "Escribe un correo válido."; }
    if (!/^9\d{8}$/.test(telefono)) { return "El celular debe tener 9 dígitos y empezar con 9."; }
    if (!/^\d{8}$/.test(dni)) { return "El DNI debe tener 8 dígitos."; }
    datosCheckout.nombre = nombre; datosCheckout.correo = correo; datosCheckout.telefono = telefono; datosCheckout.dni = dni;
    return "";
}

function validarPaso2(f) {
    datosCheckout.entrega = f.entrega.value;
    if (datosCheckout.entrega === "recojo") {
        datosCheckout.tienda = f.tienda.value;
        return "";
    }
    datosCheckout.zona = f.zona.value;
    datosCheckout.departamento = f.departamento.value;
    datosCheckout.distrito = f.distrito.value.trim();
    datosCheckout.direccion = f.direccion.value.trim();
    datosCheckout.referencia = f.referencia.value.trim();
    if (datosCheckout.zona === "provincia" && !datosCheckout.departamento) { return "Elige el departamento."; }
    if (datosCheckout.distrito.length < 3) { return "Escribe el distrito o la ciudad."; }
    if (datosCheckout.direccion.length < 6) { return "Escribe la dirección completa (calle y número)."; }
    return "";
}

// Solo dos formas de pago: transferencia (la verificas tú en el panel) y
// contra entrega en efectivo. No hay pagos con tarjeta en la web.
function validarPago(f) {
    let metodo = f.metodo.value;
    if (metodo === "transferencia") {
        if (!/^\d{6,12}$/.test(f.operacionBanco.value.trim())) { return "Escribe el número de operación de la transferencia (6 a 12 dígitos)."; }
        datosCheckout.pagoDetalle = f.banco.value + " · operación " + f.operacionBanco.value.trim();
    } else if (metodo === "contraentrega") {
        datosCheckout.pagoDetalle = "Efectivo al recibir";
    } else {
        return "Elige transferencia bancaria o pago contra entrega.";
    }
    if (!f.terminos.checked) { return "Acepta los términos y condiciones y la política de privacidad para continuar."; }
    datosCheckout.metodo = metodo;
    return "";
}

function mostrarCapa(texto) {
    let capa = document.getElementById("procesando");
    capa.querySelector("p").textContent = texto;
    capa.hidden = false;
}

function ocultarCapa() {
    document.getElementById("procesando").hidden = true;
}

async function procesarPago(f) {
    let error = validarPago(f);
    if (error) {
        mostrarMensaje(f, error, true);
        return;
    }
    f.querySelector(".mensaje").hidden = true;
    let boton = document.getElementById("boton-pagar");
    boton.disabled = true;
    mostrarCapa("Registrando tu pedido...");
    try {
        let pedido = await reservarPedido();
        if (pedido) { mostrarConfirmacion(pedido); }
    } catch (excepcion) {
        console.error(excepcion);
        mostrarMensaje(f, "No pudimos registrar tu pedido. Revisa tu conexión e inténtalo otra vez.", true);
    } finally {
        ocultarCapa();
        boton.disabled = false;
    }
}
// Crea (reserva) el pedido en Supabase. TODO pasa dentro de la base, en una
// sola transacción (ver 09_solo_pagos_manuales.sql): revisa el stock de
// cada talla y color, lo descuenta, calcula precios, cupón y envío, y guarda
// el pedido. Si algo falla, no se guarda nada y no se descuenta nada.
// Devuelve el pedido, o null si no se pudo (ya muestra el motivo).
async function reservarPedido() {
    let t = calcularTotales(zonaCheckout());
    let resultado = await crearPedidoEnSupabase({
        // Solo enviamos QUÉ se compra; los precios los pone la base
        items: carrito.map(function (item) {
            return { producto_id: item.id, talla: item.talla, color: item.color, cantidad: item.cantidad };
        }),
        entrega: datosCheckout.entrega === "recojo" ? { tipo: "recojo", direccion: datosCheckout.tienda }
            : { tipo: "domicilio", direccion: datosCheckout.direccion, distrito: datosCheckout.distrito, referencia: datosCheckout.referencia, zona: datosCheckout.zona, departamento: datosCheckout.departamento },
        metodo: datosCheckout.metodo,
        pagoDetalle: datosCheckout.pagoDetalle,
        cupon: t.cupon && !t.mensajeCupon ? t.cupon.codigo : "",
        nombre: datosCheckout.nombre,
        telefono: datosCheckout.telefono,
        dni: datosCheckout.dni
    });

    if (!resultado.ok) {
        let formPago = document.getElementById("form-pago");
        if (resultado.revisarCarrito) {
            // Alguien compró antes la última unidad: leemos el stock real y ajustamos el carrito
            mostrarToast(resultado.mensaje, "error");
            try { await recargarCatalogo(); } catch (e) { console.error(e); }
            limpiarCarrito();
            guardarCarrito();
            setTimeout(function () { window.location.href = "carrito.html"; }, 2500);
        } else if (formPago) {
            mostrarMensaje(formPago, resultado.mensaje, true);
        } else {
            mostrarToast(resultado.mensaje, "error");
        }
        return null;
    }
    return resultado.pedido;      // el pedido tal como quedó en la base (con su número NV-...)
}

// Pantalla de "¡Gracias por tu compra!" (vacía el carrito)
function mostrarConfirmacion(pedido) {
    let pendiente = pedido.estado === "Pendiente de pago";
    pedidos.push(pedido);
    carrito = [];
    guardarCarrito();
    quitarCupon();
    recargarCatalogo().catch(function (e) { console.error(e); });   // stock actualizado, sin esperar

    let llegada = new Date();
    llegada.setDate(llegada.getDate() + (pedido.entrega.tipo === "recojo" ? 1 : (datosCheckout.zona === "provincia" ? 5 : 2)));
    let extra = "";
    if (pedido.metodo === "transferencia") {
        extra = '<div class="caja-cip"><p>Estamos verificando tu transferencia. Apenas la confirmemos, tu pedido pasará a <b>Pagado</b> y lo empezaremos a preparar. Puedes seguir el estado en "Mis pedidos".</p></div>';
    }
    document.getElementById("checkout-contenido").hidden = true;
    let conf = document.getElementById("confirmacion");
    conf.hidden = false;
    conf.innerHTML = '<div class="confirmacion-caja"><div class="check-grande" aria-hidden="true">✓</div>' +
        "<h1>¡Gracias por tu compra, " + escapar(pedido.nombre.split(" ")[0]) + "!</h1>" +
        '<p>Tu pedido <b>' + escapar(pedido.id) + "</b> fue registrado con tu cuenta <b>" + escapar(sesion.correo) + "</b>. Guarda este número para seguirlo.</p>" +
        '<div class="estado-confirmacion"><span class="estado-chip ' + (pendiente ? "ambar" : "verde") + '">' + escapar(pedido.estado) + "</span>" +
        "<span>" + escapar(METODOS_PAGO[pedido.metodo]) + " · " + escapar(pedido.pagoDetalle) + "</span></div>" + extra +
        "<p>" + (pedido.entrega.tipo === "recojo" ? "Podrás recogerlo desde el " : "Llegada estimada: ") + "<b>" + llegada.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" }) + "</b></p>" +
        htmlDetallePedido(pedido) +
        '<div class="botones-accion centrado"><a class="boton" href="cuenta.html#pedidos">Ver mis pedidos</a><a class="boton boton-claro" href="catalogo.html">Seguir comprando</a></div></div>';
    activarImagenesDeRespaldo(conf);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function iniciarCheckout() {
    let contenido = document.getElementById("checkout-contenido");
    if (carrito.length === 0) {
        contenido.innerHTML = '<div class="vacio-grande"><h1>Tu carrito está vacío</h1><p>Agrega prendas para poder pagar.</p><a class="boton" href="catalogo.html">Ir al catálogo</a></div>';
        return;
    }
    if (sesion === null) {
        contenido.innerHTML = '<div class="vacio-grande"><h1>Ingresa para finalizar tu compra</h1><p>Así guardamos tu pedido y puedes seguirlo desde "Mi cuenta".</p>' +
            '<div class="botones-accion centrado"><a class="boton" href="login.html?volver=checkout.html">Ingresar</a><a class="boton boton-claro" href="registro.html?volver=checkout.html">Crear cuenta</a></div></div>';
        return;
    }
    if (esAdmin()) {
        contenido.innerHTML = '<div class="vacio-grande"><h1>Estás como administrador</h1><p>Para probar una compra, ingresa con una cuenta de cliente.</p><button type="button" class="boton" data-accion="salir">Cerrar sesión</button></div>';
        return;
    }
    let cuenta = cuentaPorCorreo(sesion.correo) || {};
    let f1 = document.getElementById("form-datos");
    f1.nombre.value = cuenta.nombre || sesion.nombre;
    f1.correo.value = cuenta.correo || sesion.correo;
    f1.telefono.value = (cuenta.telefono || "").replace(/\D/g, "");
    let f2 = document.getElementById("form-entrega");
    f2.distrito.value = cuenta.distrito || "";
    f2.departamento.innerHTML = '<option value="">Elige el departamento</option>' + DEPARTAMENTOS.map(function (d) { return "<option>" + d + "</option>"; }).join("");
    f2.tienda.innerHTML = TIENDAS.map(function (t) { return "<option>" + t.nombre + " · " + t.direccion + "</option>"; }).join("");
    datosCheckout = { entrega: "domicilio", zona: "lima" };
    dibujarCuentasBancarias();
    irPaso(1);
    mostrarPanelPago();

    document.addEventListener("submit", function (evento) {
        let f = evento.target;
        if (f.id === "form-datos" || f.id === "form-entrega") {
            evento.preventDefault();
            let error = f.id === "form-datos" ? validarPaso1(f) : validarPaso2(f);
            if (error) {
                mostrarMensaje(f, error, true);
                return;
            }
            f.querySelector(".mensaje").hidden = true;
            resumenPaso(f.id === "form-datos" ? 1 : 2);
            irPaso(f.id === "form-datos" ? 2 : 3);
        } else if (f.id === "form-pago") {
            evento.preventDefault();
            procesarPago(f);
        } else if (f.id === "form-cupon-checkout") {
            evento.preventDefault();
            if (f.codigo.value.trim()) { aplicarCupon(f.codigo.value); } else { quitarCupon(); }
            dibujarResumenCheckout();
        }
    });
    document.addEventListener("click", function (evento) {
        let editar = evento.target.closest("[data-editar-paso]");
        if (editar) { irPaso(Number(editar.dataset.editarPaso)); }
    });
    document.addEventListener("change", function (evento) {
        let t = evento.target;
        if (t.name === "entrega" || t.name === "zona") {
            let f = document.getElementById("form-entrega");
            datosCheckout.entrega = f.entrega.value;
            datosCheckout.zona = f.zona.value;
            document.getElementById("campos-domicilio").hidden = f.entrega.value !== "domicilio";
            document.getElementById("campos-recojo").hidden = f.entrega.value !== "recojo";
            document.getElementById("campo-departamento").hidden = f.zona.value !== "provincia";
            document.querySelectorAll(".opcion-entrega").forEach(function (o) { o.classList.toggle("activo", o.querySelector("input").checked); });
            actualizarMetodosDisponibles();
            dibujarResumenCheckout();
        }
        if (t.name === "metodo") { mostrarPanelPago(); }
    });
    document.addEventListener("input", function (evento) {
        let t = evento.target;
        if (t.name === "dni" || t.name === "telefono" || t.name === "operacionBanco") {
            t.value = t.value.replace(/\D/g, "");
        }
    });
}

// =====================================================
// 6. MI CUENTA
// =====================================================
function dibujarCuenta() {
    let caja = document.getElementById("cuenta-contenido");
    if (caja === null) {
        return;
    }
    let favs = favoritos.map(buscarProducto).filter(Boolean);
    let htmlFavoritos = '<section id="favoritos" class="bloque-cuenta"><h2>Mis favoritos <small>' + favs.length + "</small></h2>" +
        (favs.length ? '<div class="catalogo">' + favs.map(function (p) { return crearTarjeta(p); }).join("") + "</div>"
            : '<p class="sin-datos">Aún no guardas favoritos. Toca el corazón de cualquier prenda para guardarla aquí.</p><a class="boton" href="catalogo.html">Explorar catálogo</a>') + "</section>";

    if (sesion === null) {
        caja.innerHTML = '<div class="aviso-cuenta"><h2>Ingresa a tu cuenta</h2><p>Para ver tus pedidos y tu estilo NOVAK necesitas iniciar sesión.</p>' +
            '<div class="botones-accion"><a class="boton" href="login.html?volver=cuenta.html">Ingresar</a><a class="boton boton-claro" href="registro.html">Crear cuenta</a></div></div>' + htmlFavoritos;
        activarImagenesDeRespaldo(caja);
        return;
    }
    if (esAdmin()) {
        caja.innerHTML = '<div class="aviso-cuenta"><h2>Hola, administrador</h2><p>Tu panel con estadísticas de prendas y clientes está aquí:</p><a class="boton" href="admin.html">Ir al panel admin</a></div>' + htmlFavoritos;
        activarImagenesDeRespaldo(caja);
        return;
    }
    let cuenta = cuentaPorCorreo(sesion.correo) || { correo: sesion.correo, nombre: sesion.nombre };
    let misPedidos = pedidos.filter(function (p) { return p.cliente === sesion.correo; }).slice().reverse();
    let e = estadisticasCliente(sesion.correo);
    let ahorro = 0;
    misPedidos.forEach(function (p) {
        if (p.estado === "Cancelado") { return; }
        ahorro += p.descuentoCupon || 0;
        p.items.forEach(function (i) { ahorro += (i.precioLista - i.precio) * i.cantidad; });
    });
    let etapas = ["Pagado", "Preparando", "En camino", "Entregado"];

    caja.innerHTML =
        '<div class="cuenta-cabecera"><div class="avatar">' + escapar(cuenta.nombre.charAt(0)) + "</div><div><h1>Hola, " + escapar(cuenta.nombre.split(" ")[0]) + "</h1><p>" + escapar(cuenta.correo) + "</p></div>" +
        '<button type="button" class="boton boton-claro boton-chico" data-accion="salir">Cerrar sesión</button></div>' +
        '<nav class="pestanas" aria-label="Secciones de mi cuenta"><a href="#pedidos">Pedidos</a><a href="#estilo">Mi estilo</a><a href="#favoritos">Favoritos</a><a href="#datos">Mis datos</a></nav>' +

        '<section id="pedidos" class="bloque-cuenta"><h2>Mis pedidos <small>' + misPedidos.length + "</small></h2>" +
        (misPedidos.length === 0 ? '<p class="sin-datos">Todavía no tienes pedidos.</p><a class="boton" href="catalogo.html">Empezar a comprar</a>' :
            misPedidos.map(function (p) {
                let paso = etapas.indexOf(p.estado);
                return '<article class="pedido-tarjeta"><div class="pedido-cabecera"><div><b>' + escapar(p.id) + "</b><small>" + fechaCorta(p.fecha) + " · " + escapar(METODOS_PAGO[p.metodo] || p.metodo) + "</small></div>" +
                    '<span class="estado-chip ' + (p.estado === "Entregado" ? "verde" : p.estado === "Cancelado" ? "rojo" : "ambar") + '">' + escapar(p.estado) + "</span><b>" + formatoPrecio(p.total) + "</b></div>" +
                    (p.estado !== "Cancelado" && p.estado !== "Pendiente de pago" ? '<ol class="linea-tiempo">' + etapas.map(function (et, i) { return '<li class="' + (i <= paso ? "hecho" : "") + '">' + et + "</li>"; }).join("") + "</ol>" : "") +
                    '<div class="pedido-fotos">' + p.items.map(function (i) {
                        return '<a href="producto.html?id=' + encodeURIComponent(i.id) + '#resenas" title="Opinar sobre ' + escapar(i.nombre) + '"><img src="' + escapar(i.imagen || (buscarProducto(i.id) || {}).imagen || IMG_RESPALDO) + '" alt="' + escapar(i.nombre) + '" width="48" height="60"></a>';
                    }).join("") + (p.estado === "Entregado" ? '<span class="nota">Toca una prenda para dejar tu opinión con foto.</span>' : "") + "</div>" +
                    '<details><summary>Ver detalle</summary>' + htmlDetallePedido(p) + "</details>" +
                    '<button type="button" class="boton boton-claro boton-chico" data-recomprar="' + escapar(p.id) + '">Volver a comprar</button></article>';
            }).join("")) + "</section>" +

        '<section id="estilo" class="bloque-cuenta"><h2>Mi estilo NOVAK</h2>' +
        (e.pedidos ? htmlIndicadores([
            [e.categoriaFavorita ? nombreCategoria(e.categoriaFavorita) : "—", "Lo que más te gusta", e.segmentoFavorito || ""],
            [e.colorFavorito ? '<span class="muestra grande" style="background:' + hexDeColor(e.colorFavorito) + '"></span>' + escapar(e.colorFavorito) : "—", "Tu color", ""],
            [e.tallaFavorita || "—", "Tu talla más pedida", ""],
            [formatoPrecio(ahorro), "Has ahorrado", "con ofertas y cupones"]
        ]) : '<p class="sin-datos">Cuando hagas tu primera compra te mostraremos tu estilo.</p>') +
        "<h3>Elegidos para ti</h3>" + rielProductos(recomendacionesPara(sesion.correo, 10)) + "</section>" +
        htmlFavoritos +

        '<section id="datos" class="bloque-cuenta"><h2>Mis datos</h2><form id="form-mis-datos" class="caja-formulario ancho" novalidate>' +
        '<div class="fila-doble"><div class="grupo-formulario"><label for="dNombre">Nombre completo</label><input id="dNombre" name="nombre" value="' + escapar(cuenta.nombre) + '" required minlength="3"></div>' +
        '<div class="grupo-formulario"><label for="dTelefono">Celular</label><input id="dTelefono" name="telefono" value="' + escapar(cuenta.telefono || "") + '" inputmode="numeric"></div></div>' +
        '<div class="fila-triple"><div class="grupo-formulario"><label for="dNacimiento">Fecha de nacimiento</label><input type="date" id="dNacimiento" name="nacimiento" value="' + escapar(cuenta.nacimiento || "") + '"></div>' +
        '<div class="grupo-formulario"><label for="dGenero">Género</label><select id="dGenero" name="genero">' +
        [["", "Prefiero no decir"], ["femenino", "Femenino"], ["masculino", "Masculino"], ["otro", "Otro"]].map(function (g) {
            return '<option value="' + g[0] + '"' + ((cuenta.genero || "") === g[0] ? " selected" : "") + ">" + g[1] + "</option>";
        }).join("") + "</select></div>" +
        '<div class="grupo-formulario"><label for="dTalla">Talla habitual</label><select id="dTalla" name="talla">' + ["XS", "S", "M", "L", "XL"].map(function (t) {
            return "<option" + (cuenta.talla === t ? " selected" : "") + ">" + t + "</option>";
        }).join("") + "</select></div></div>" +
        '<div class="grupo-formulario"><label for="dDistrito">Distrito</label><input id="dDistrito" name="distrito" value="' + escapar(cuenta.distrito || "") + '"></div>' +
        '<button type="submit" class="boton">Guardar cambios</button><p class="mensaje" role="status" hidden></p></form></section>';
    activarImagenesDeRespaldo(caja);
    activarRieles(caja);
}

function alCambiarFavoritos() {
    if (pagina === "cuenta") {
        dibujarCuenta();
    }
}

function iniciarCuenta() {
    dibujarCuenta();
    if (location.hash) {
        let destino = document.querySelector(location.hash);
        if (destino) { setTimeout(function () { destino.scrollIntoView(); }, 50); }
    }
    document.addEventListener("click", function (evento) {
        let b = evento.target.closest("[data-recomprar]");
        if (!b) { return; }
        let pedido = pedidos.find(function (p) { return p.id === b.dataset.recomprar; });
        let agregados = 0;
        pedido.items.forEach(function (i) {
            let p = buscarProducto(i.id);
            if (p && stockDe(p, i.talla, i.color) > cantidadEnCarrito(i.id, i.talla, i.color)) {
                let item = carrito.find(function (x) { return x.id === i.id && x.talla === i.talla && x.color === i.color; });
                if (item) { item.cantidad++; } else { carrito.push({ id: i.id, talla: i.talla, color: i.color, cantidad: 1 }); }
                agregados++;
            }
        });
        guardarCarrito();
        mostrarToast(agregados ? agregados + " prendas agregadas al carrito." : "Esas prendas ya no tienen stock en tu talla.", agregados ? "ok" : "error");
        if (agregados) { setTimeout(function () { window.location.href = "carrito.html"; }, 800); }
    });
    document.addEventListener("submit", async function (evento) {
        let f = evento.target;
        if (f.id !== "form-mis-datos") { return; }
        evento.preventDefault();
        if (f.nombre.value.trim().length < 3) {
            mostrarMensaje(f, "El nombre debe tener al menos 3 letras.", true);
            return;
        }
        formularioOcupado(f, true, "Guardando...");
        try {
            await guardarPerfil({
                nombre: f.nombre.value.trim(), telefono: f.telefono.value.trim(), nacimiento: f.nacimiento.value,
                genero: f.genero.value, talla: f.talla.value, distrito: f.distrito.value.trim()
            });
            dibujarCabecera();
            mostrarContadores();
            mostrarMensaje(f, "Datos guardados.", false);
        } catch (error) {
            mostrarMensaje(f, error.message, true);
        }
        formularioOcupado(f, false);
    });
}

// =====================================================
// 7. LOGIN, REGISTRO Y CONTACTO
// =====================================================
const PAGINAS_PERMITIDAS = ["index.html", "catalogo.html", "carrito.html", "checkout.html", "admin.html", "cuenta.html", "producto.html"];

function destinoDespuesDeLogin(cuenta) {
    let destino = new URLSearchParams(window.location.search).get("volver");
    if (destino !== null && PAGINAS_PERMITIDAS.includes(destino)) {
        if (destino === "producto.html" && document.referrer.includes("producto.html")) {
            return document.referrer;
        }
        return destino;
    }
    return cuenta.rol === "admin" ? "admin.html" : "index.html";
}

// Bloquea el botón mientras esperamos a Supabase (evita el doble clic)
function formularioOcupado(f, ocupado, texto) {
    let boton = f.querySelector('button[type="submit"]');
    if (boton === null) {
        return;
    }
    if (ocupado) {
        boton.dataset.textoOriginal = boton.textContent;
        boton.textContent = texto || "Un momento...";
    } else if (boton.dataset.textoOriginal) {
        boton.textContent = boton.dataset.textoOriginal;
    }
    boton.disabled = ocupado;
}

// "async": dentro usamos await para esperar la respuesta de Supabase
async function procesarLogin(f) {
    let correo = f.usuario.value.trim().toLowerCase();
    let clave = f.clave.value;
    let rol = (f.querySelector('input[name="rol"]:checked') || {}).value || "usuario";
    if (!correo || !clave) {
        mostrarMensaje(f, "Escribe tu correo y tu contraseña.", true);
        return;
    }
    formularioOcupado(f, true, "Ingresando...");
    let resultado = await ingresar(correo, clave);   // ← aquí espera a Supabase
    if (!resultado.ok) {
        formularioOcupado(f, false);
        mostrarMensaje(f, resultado.mensaje, true);
        return;
    }
    // La contraseña era correcta, pero ¿eligió el tipo de acceso correcto?
    if (sesion.rol !== rol) {
        let mensaje = sesion.rol === "admin" ? "Esta cuenta es de administrador. Elige la opción Administrador." : "Esta cuenta es de cliente. Elige la opción Cliente.";
        await salirDeSupabase();
        formularioOcupado(f, false);
        mostrarMensaje(f, mensaje, true);
        return;
    }
    mostrarMensaje(f, "Bienvenido, " + sesion.nombre + ". Entrando...", false);
    window.location.href = destinoDespuesDeLogin(sesion);
}

async function procesarRegistro(f) {
    let correo = f.correo.value.trim().toLowerCase();
    let nombre = f.nombre.value.trim();
    if (nombre.length < 3) { mostrarMensaje(f, "Escribe tu nombre completo.", true); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { mostrarMensaje(f, "Escribe un correo válido.", true); return; }
    if (f.clave.value.length < 8) { mostrarMensaje(f, "La contraseña debe tener al menos 8 caracteres.", true); return; }
    if (f.clave.value !== f.clave2.value) { mostrarMensaje(f, "Las contraseñas no coinciden.", true); return; }
    let edad = calcularEdad(f.nacimiento.value);
    if (edad === null || isNaN(edad)) { mostrarMensaje(f, "Indica tu fecha de nacimiento.", true); return; }
    if (edad < 14) { mostrarMensaje(f, "Debes tener al menos 14 años para registrarte.", true); return; }
    if (!f.terminos.checked) { mostrarMensaje(f, "Acepta los términos y condiciones.", true); return; }
    // (Ya no buscamos el correo aquí: Supabase avisa si la cuenta ya existe)
    let prendas = Array.prototype.map.call(f.querySelectorAll('input[name="prendas"]:checked'), function (c) { return c.value; });
    let talla = f.querySelector('input[name="talla"]:checked');
    // La contraseña NO va en estos datos: la recibe y la cifra Supabase Auth
    let datos = {
        nombre: nombre, nacimiento: f.nacimiento.value, genero: f.genero.value,
        telefono: f.telefono.value.trim(), distrito: f.distrito.value.trim(),
        talla: talla ? talla.value : "", prendas: prendas, estilo: f.estilo.value,
        newsletter: f.novedades.checked
    };
    formularioOcupado(f, true, "Creando tu cuenta...");
    let resultado = await registrarCuenta(correo, f.clave.value, datos);
    if (!resultado.ok) {
        formularioOcupado(f, false);
        mostrarMensaje(f, resultado.mensaje, true);
        return;
    }
    if (f.novedades.checked) {
        // Si falla, no frenamos el registro: la cuenta ya se creó
        suscribirBD(correo, "registro").catch(function (e) { console.warn(e); });
    }
    if (!resultado.sesionIniciada) {
        // Supabase pidió confirmar el correo: el cliente entra después de hacer clic en el enlace
        mostrarMensaje(f, "¡Cuenta creada! Te enviamos un correo a " + correo + ". Abre el enlace para activarla y luego ingresa. Tu cupón de bienvenida es BIENVENIDA15.", false);
        return;
    }
    mostrarMensaje(f, "¡Registro exitoso! Tu cupón de bienvenida es BIENVENIDA15. Entrando...", false);
    let volver = new URLSearchParams(location.search).get("volver");
    setTimeout(function () {
        window.location.href = PAGINAS_PERMITIDAS.includes(volver) ? volver : "catalogo.html";
    }, 1400);
}

// "¿Olvidaste tu contraseña?" (login.html)
document.addEventListener("click", function (evento) {
    let enlace = evento.target.closest('[data-accion="olvide-clave"]');
    if (!enlace) {
        return;
    }
    evento.preventDefault();
    let escrito = document.getElementById("loginUsuario");
    abrirModal('<h2 id="modal-titulo">Recuperar contraseña</h2>' +
        "<p>Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.</p>" +
        '<form id="form-recuperar" novalidate><div class="grupo-formulario"><label for="correoRecuperar">Correo</label>' +
        '<input type="email" id="correoRecuperar" name="correo" autocomplete="email" value="' + escapar(escrito ? escrito.value.trim() : "") + '"></div>' +
        '<button type="submit" class="boton boton-bloque">Enviar enlace</button><p class="mensaje" role="status" hidden></p></form>', "modal-mediano");
});

function prepararLogin() {
    let contenido = document.getElementById("login-contenido");
    if (contenido === null || sesion === null) {
        return;
    }
    // Llegó desde el enlace "recuperar contraseña" del correo: Supabase ya le
    // dio una sesión temporal, ahora elige su nueva contraseña.
    if (new URLSearchParams(location.search).get("recuperar") === "1") {
        contenido.innerHTML = '<h2 id="titulo-login">Crea tu nueva contraseña</h2>' +
            "<p>Cuenta: <strong>" + escapar(sesion.correo) + "</strong></p>" +
            '<form id="form-nueva-clave" novalidate>' +
            '<div class="grupo-formulario"><label for="nuevaClave">Nueva contraseña (mínimo 8 caracteres)</label><input type="password" id="nuevaClave" name="clave" autocomplete="new-password"></div>' +
            '<div class="grupo-formulario"><label for="nuevaClave2">Repite la contraseña</label><input type="password" id="nuevaClave2" name="clave2" autocomplete="new-password"></div>' +
            '<button type="submit" class="boton boton-bloque">Guardar contraseña</button><p class="mensaje" role="alert" hidden></p></form>';
        return;
    }
    contenido.innerHTML = "<h2>Ya iniciaste sesión</h2>" +
        "<p>Ingresaste como <strong>" + escapar(sesion.nombre) + "</strong> (" + (esAdmin() ? "administrador" : "cliente") + ").</p>" +
        '<div class="botones-accion"><a class="boton" href="' + (esAdmin() ? "admin.html" : "cuenta.html") + '">' + (esAdmin() ? "Ir al panel" : "Mi cuenta") + "</a>" +
        '<button type="button" class="boton boton-claro" data-accion="salir">Cerrar sesión</button></div>';
}

document.addEventListener("submit", async function (evento) {
    let f = evento.target;
    if (f.id === "form-login") {
        evento.preventDefault();
        procesarLogin(f);
    } else if (f.id === "form-registro") {
        evento.preventDefault();
        procesarRegistro(f);
    } else if (f.id === "form-recuperar") {
        evento.preventDefault();
        let correo = f.correo.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            mostrarMensaje(f, "Escribe el correo de tu cuenta.", true);
            return;
        }
        formularioOcupado(f, true, "Enviando...");
        let r = await pedirRecuperacion(correo);
        formularioOcupado(f, false);
        // Por seguridad, el mensaje es el mismo exista o no la cuenta
        mostrarMensaje(f, r.ok ? "Si existe una cuenta con " + correo + ", te llegará un correo con un enlace para crear una nueva contraseña. Revisa también la carpeta de spam." : r.mensaje, !r.ok);
    } else if (f.id === "form-nueva-clave") {
        evento.preventDefault();
        if (f.clave.value.length < 8) { mostrarMensaje(f, "La contraseña debe tener al menos 8 caracteres.", true); return; }
        if (f.clave.value !== f.clave2.value) { mostrarMensaje(f, "Las contraseñas no coinciden.", true); return; }
        formularioOcupado(f, true, "Guardando...");
        let r = await cambiarClave(f.clave.value);
        if (!r.ok) {
            formularioOcupado(f, false);
            mostrarMensaje(f, r.mensaje, true);
            return;
        }
        mostrarMensaje(f, "¡Listo! Tu contraseña se actualizó. Entrando...", false);
        setTimeout(function () { window.location.href = esAdmin() ? "admin.html" : "cuenta.html"; }, 1200);
    } else if (f.id === "form-resena") {
        evento.preventDefault();
        let texto = f.texto.value.trim();
        if (texto.length < 5) {
            mostrarMensaje(f, "Escribe un comentario un poco más largo.", true);
            return;
        }
        let previa = document.getElementById("previa-resena");
        let elegida = f.querySelector('input[name="estrellas"]:checked');
        // El nombre, la talla y "Compra verificada" los decide la base al guardar
        formularioOcupado(f, true, "Publicando...");
        try {
            await publicarResena(productoActual.id, Number(elegida ? elegida.value : 5), texto,
                previa && !previa.hidden ? previa.src : "");
        } catch (error) {
            formularioOcupado(f, false);
            mostrarMensaje(f, error.message, true);
            return;
        }
        mostrarToast("Gracias por tu opinión.", "ok");
        dibujarFicha();
        document.getElementById("resenas").scrollIntoView();
    } else if (f.id === "form-contacto") {
        evento.preventDefault();
        if (f.nombre.value.trim().length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo.value.trim()) || f.mensaje.value.trim().length < 10) {
            mostrarMensaje(f, "Completa tu nombre, un correo válido y un mensaje de al menos 10 caracteres.", true);
            return;
        }
        // Se guarda en Supabase: el admin lo ve en Panel admin → Mensajes
        let numero;
        formularioOcupado(f, true, "Enviando...");
        try {
            numero = await enviarMensajeBD(f.nombre.value.trim(), f.correo.value.trim(), f.motivo.value, f.mensaje.value.trim());
        } catch (error) {
            formularioOcupado(f, false);
            mostrarMensaje(f, error.message, true);
            return;
        }
        formularioOcupado(f, false);
        mostrarMensaje(f, (f.motivo.value === "reclamo" ? "Reclamo registrado con el número " : "¡Mensaje enviado! Tu número de atención es ") + numero + ". Te responderemos en un máximo de 24 horas.", false);
        mostrarToast("Mensaje enviado.", "ok");
        f.reset();
    }
});

// =====================================================
// 8. ARRANQUE DE CADA PÁGINA
// =====================================================
function iniciarPagina() {
    switch (pagina) {
        case "index": dibujarHero(); dibujarCategoriasInicio(); dibujarSeccionesInicio(); dibujarResenasInicio(); dibujarTiendas("tiendas-inicio"); break;
        case "seguimiento": iniciarSeguimiento(); break;
        case "reclamos": iniciarReclamos(); break;
        case "catalogo": iniciarCatalogo(); break;
        case "producto": iniciarFicha(); break;
        case "carrito": iniciarCarrito(); break;
        case "checkout": iniciarCheckout(); break;
        case "cuenta": iniciarCuenta(); break;
        case "admin": iniciarAdmin(); break;
        case "login": prepararLogin(); break;
        case "politicas": {
            let promo = document.getElementById("promo-vigente");
            let activa = !tiempoRestante(campana.fin).terminado;
            promo.innerHTML = activa ? "<b>Promoción vigente: " + escapar(campana.nombre) + ".</b> " + escapar(campana.subtitulo) + ". " + textoVigenciaCampana()
                : "En este momento no hay campañas de descuento vigentes.";
            break;
        }
        case "contacto": {
            dibujarTiendas("lista-tiendas");
            let motivo = new URLSearchParams(location.search).get("motivo");
            let select = document.getElementById("cMotivo");
            if (motivo && select) { select.value = motivo; }
            break;
        }
    }
}

// Se llama cuando cambian los datos (otra pestaña, el admin editó, etc.)
function redibujarPagina() {
    switch (pagina) {
        case "index": dibujarSeccionesInicio(); dibujarResenasInicio(); break;
        case "catalogo": dibujarFiltros(); dibujarCatalogo(); break;
        case "producto": dibujarFicha(); break;
        case "carrito": dibujarCarritoPagina(); break;
        case "checkout": dibujarResumenCheckout(); break;
        case "cuenta": dibujarCuenta(); break;
        case "admin": redibujarAdmin(); break;
    }
}

function alCambiarCarrito() {
    if (pagina === "carrito") { dibujarCarritoPagina(); }
    if (pagina === "producto") { actualizarEnvioFicha(); }
    if (pagina === "checkout") { dibujarResumenCheckout(); }
}

// Foto de la reseña: se reduce antes de guardarla
document.addEventListener("change", function (evento) {
    let t = evento.target;
    if (t.name !== "foto" || !t.closest("#form-resena") || !t.files[0]) {
        return;
    }
    let lector = new FileReader();
    lector.onload = function () {
        let img = new Image();
        img.onload = function () {
            let escala = Math.min(1, 600 / Math.max(img.width, img.height));
            let lienzo = document.createElement("canvas");
            lienzo.width = Math.round(img.width * escala);
            lienzo.height = Math.round(img.height * escala);
            lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
            let previa = document.getElementById("previa-resena");
            previa.src = lienzo.toDataURL("image/jpeg", 0.75);
            previa.hidden = false;
        };
        img.src = lector.result;
    };
    lector.readAsDataURL(t.files[0]);
});

// =====================================================
// 9. SEGUIMIENTO DE PEDIDO
// =====================================================
async function mostrarSeguimiento(numero, correo) {
    let caja = document.getElementById("resultado-seguimiento");
    numero = numero.trim().toUpperCase();
    if (numero && numero.indexOf("NV-") !== 0) { numero = "NV-" + numero; }
    // 1) ¿Es uno de mis pedidos ya cargados? (los de ejemplo no cuentan)
    let pedido = pedidos.find(function (p) { return !p.semilla && p.id === numero && p.cliente.toLowerCase() === correo.trim().toLowerCase(); });
    // 2) Si no, se lo preguntamos a la base (funciona sin iniciar sesión)
    if (!pedido) {
        caja.innerHTML = '<p class="mensaje">Buscando tu pedido...</p>';
        try {
            pedido = await seguirPedidoEnSupabase(numero, correo);
        } catch (error) {
            caja.innerHTML = '<p class="mensaje error">' + escapar(error.message) + "</p>";
            return;
        }
    }
    if (!pedido) {
        caja.innerHTML = '<p class="mensaje error">No encontramos un pedido con ese número y correo. Revisa el correo de confirmación o escríbenos por <a href="' + enlaceWhatsApp("Hola, quiero saber el estado de mi pedido " + numero) + '" target="_blank" rel="noopener">WhatsApp</a>.</p>';
        return;
    }
    let etapas = ["Pagado", "Preparando", "En camino", "Entregado"];
    let paso = etapas.indexOf(pedido.estado);
    let llegada = new Date(pedido.fecha);
    llegada.setDate(llegada.getDate() + (pedido.entrega.tipo === "recojo" ? 1 : (pedido.entrega.zona === "provincia" ? 5 : 2)));
    caja.innerHTML = '<div class="pedido-tarjeta"><div class="pedido-cabecera"><div><b>Pedido ' + escapar(pedido.id) + "</b><small>Comprado el " + fechaCorta(pedido.fecha) + " · " + escapar(METODOS_PAGO[pedido.metodo] || pedido.metodo) + "</small></div>" +
        '<span class="estado-chip ' + (pedido.estado === "Entregado" ? "verde" : pedido.estado === "Cancelado" ? "rojo" : "ambar") + '">' + escapar(pedido.estado) + "</span></div>" +
        (paso >= 0 ? '<ol class="linea-tiempo">' + etapas.map(function (e, i) { return '<li class="' + (i <= paso ? "hecho" : "") + '">' + e + "</li>"; }).join("") + "</ol>" : "") +
        "<p>" + (pedido.estado === "Entregado" ? "Tu pedido ya fue entregado." :
            pedido.estado === "Cancelado" ? "Este pedido fue cancelado." :
            pedido.estado === "Pendiente de pago" ? "Estamos esperando la confirmación de tu pago." :
            (pedido.entrega.tipo === "recojo" ? "Podrás recogerlo en " + escapar(pedido.entrega.direccion) + " desde el " : "Llegada estimada: ") + "<b>" + llegada.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" }) + "</b>.") + "</p>" +
        htmlDetallePedido(pedido) + "</div>";
    activarImagenesDeRespaldo(caja);
}

function iniciarSeguimiento() {
    let f = document.getElementById("form-seguimiento");
    let q = new URLSearchParams(location.search);
    if (sesion !== null && !esAdmin()) { f.correo.value = sesion.correo; }
    if (q.get("pedido")) { f.numero.value = q.get("pedido"); }
    f.addEventListener("submit", function (evento) {
        evento.preventDefault();
        if (!f.numero.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo.value.trim())) {
            mostrarMensaje(f, "Escribe el número de pedido (NV-...) y el correo con el que compraste.", true);
            return;
        }
        f.querySelector(".mensaje").hidden = true;
        mostrarSeguimiento(f.numero.value, f.correo.value);
    });
    if (f.numero.value && f.correo.value) { mostrarSeguimiento(f.numero.value, f.correo.value); }
    let lista = document.getElementById("mis-pedidos-rapido");
    if (sesion !== null && !esAdmin()) {
        let mios = pedidos.filter(function (p) { return !p.semilla && p.cliente === sesion.correo; }).slice(-5).reverse();
        lista.innerHTML = mios.length ? "<p>Tus últimos pedidos:</p>" + mios.map(function (p) {
            return '<button type="button" class="chip-activo" data-ver-pedido="' + escapar(p.id) + '">' + escapar(p.id) + " · " + escapar(p.estado) + "</button>";
        }).join(" ") : "";
        lista.addEventListener("click", function (e) {
            let b = e.target.closest("[data-ver-pedido]");
            if (b) { f.numero.value = b.dataset.verPedido; mostrarSeguimiento(b.dataset.verPedido, sesion.correo); }
        });
    }
}

// =====================================================
// 10. LIBRO DE RECLAMACIONES
// Formato basado en el D.S. 011-2011-PCM y sus modificatorias.
// =====================================================
function sumarDiasHabiles(fecha, dias) {
    let d = new Date(fecha);
    while (dias > 0) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() !== 0 && d.getDay() !== 6) { dias--; }
    }
    return d;
}

function iniciarReclamos() {
    let f = document.getElementById("form-reclamo");
    // El número oficial (RC-AAAA-000001) lo asigna la base al registrar la hoja,
    // así dos personas nunca reciben el mismo número.
    document.getElementById("numero-hoja").textContent = "RC-" + new Date().getFullYear() + "-······ (se asigna al registrar)";
    document.getElementById("fecha-hoja").textContent = new Date().toLocaleDateString("es-PE");
    document.querySelectorAll("[data-empresa]").forEach(function (el) { el.textContent = EMPRESA[el.dataset.empresa]; });
    let lineaRuc = document.getElementById("linea-ruc");
    if (lineaRuc) { lineaRuc.hidden = !EMPRESA.ruc; }   // sin RUC no se muestra
    if (sesion !== null && !esAdmin()) {
        let cuenta = cuentaPorCorreo(sesion.correo) || {};
        f.nombre.value = cuenta.nombre || "";
        f.correo.value = cuenta.correo || "";
        f.telefono.value = cuenta.telefono || "";
    }
    f.menor.addEventListener("change", function () {
        document.getElementById("campos-apoderado").hidden = !f.menor.checked;
    });
    f.addEventListener("submit", async function (evento) {
        evento.preventDefault();
        let error = "";
        if (f.nombre.value.trim().length < 3) { error = "Escribe tu nombre completo."; }
        else if (!/^\d{8,12}$/.test(f.documento.value.trim())) { error = "Escribe tu número de DNI o carné de extranjería."; }
        else if (f.domicilio.value.trim().length < 5) { error = "Escribe tu domicilio."; }
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo.value.trim())) { error = "Escribe un correo válido: ahí te enviaremos la respuesta."; }
        else if (f.menor.checked && f.apoderado.value.trim().length < 3) { error = "Escribe el nombre del padre, madre o apoderado."; }
        else if (f.descripcionBien.value.trim().length < 3) { error = "Describe el producto o servicio."; }
        else if (f.detalle.value.trim().length < 15) { error = "Cuéntanos el detalle (mínimo 15 caracteres)."; }
        else if (f.pedido.value.trim().length < 5) { error = "Indica qué solicitas (cambio, devolución, reembolso, etc.)."; }
        else if (!f.conformidad.checked) { error = "Marca la declaración de conformidad."; }
        if (error) {
            mostrarMensaje(f, error, true);
            return;
        }
        let hoja = {
            nombre: f.nombre.value.trim(), tipoDocumento: f.tipoDocumento.value, documento: f.documento.value.trim(),
            domicilio: f.domicilio.value.trim(), telefono: f.telefono.value.trim(), correo: f.correo.value.trim(),
            apoderado: f.menor.checked ? f.apoderado.value.trim() : "",
            tipoBien: f.tipoBien.value, monto: f.monto.value, numeroPedido: f.numeroPedido.value.trim(), descripcionBien: f.descripcionBien.value.trim(),
            tipo: f.tipo.value, detalle: f.detalle.value.trim(), pedido: f.pedido.value.trim()
        };
        // Se guarda en Supabase; la base devuelve el número y la fecha límite legal
        formularioOcupado(f, true, "Registrando...");
        try {
            let registro = await registrarReclamoBD(hoja);
            hoja.numero = registro.numero;
            hoja.fecha = registro.fecha;
            hoja.limite = registro.limite;
        } catch (errorBD) {
            formularioOcupado(f, false);
            mostrarMensaje(f, errorBD.message, true);
            return;
        }
        let ahora = new Date(hoja.fecha);
        document.getElementById("numero-hoja").textContent = hoja.numero;
        document.getElementById("hoja-formulario").hidden = true;
        let constancia = document.getElementById("constancia");
        constancia.hidden = false;
        constancia.innerHTML = "<h2>Hoja de reclamación " + escapar(hoja.numero) + " registrada</h2>" +
            "<p>Fecha: " + ahora.toLocaleString("es-PE") + ". Guarda esta constancia (puedes imprimirla o guardarla en PDF). Te responderemos a <b>" + escapar(hoja.correo) + "</b>.</p>" +
            '<p class="caja-cip">Responderemos tu ' + (hoja.tipo === "queja" ? "queja" : "reclamo") + " en un plazo máximo de <b>15 días hábiles</b> improrrogables (a más tardar el <b>" + new Date(hoja.limite).toLocaleDateString("es-PE") + "</b>).</p>" +
            '<table class="tabla-especificaciones">' +
            "<tr><th>Proveedor</th><td>" + escapar(EMPRESA.razonSocial) + (EMPRESA.ruc ? " · RUC " + escapar(EMPRESA.ruc) : "") + "</td></tr>" +
            "<tr><th>Consumidor</th><td>" + escapar(hoja.nombre) + " · " + escapar(hoja.tipoDocumento) + " " + escapar(hoja.documento) + "</td></tr>" +
            "<tr><th>Bien contratado</th><td>" + escapar(hoja.tipoBien) + ": " + escapar(hoja.descripcionBien) + (hoja.monto ? " · S/ " + escapar(hoja.monto) : "") + (hoja.numeroPedido ? " · Pedido " + escapar(hoja.numeroPedido) : "") + "</td></tr>" +
            "<tr><th>Tipo</th><td>" + (hoja.tipo === "queja" ? "Queja" : "Reclamo") + "</td></tr>" +
            "<tr><th>Detalle</th><td>" + escapar(hoja.detalle) + "</td></tr>" +
            "<tr><th>Pedido del consumidor</th><td>" + escapar(hoja.pedido) + "</td></tr></table>" +
            '<p class="nota">La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el Indecopi.</p>' +
            '<div class="botones-accion"><button type="button" class="boton" onclick="window.print()">Imprimir o guardar en PDF</button><a class="boton boton-claro" href="index.html">Volver a la tienda</a></div>';
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

// =====================================================
// 11. TIENDAS FÍSICAS (dirección, horarios y mapa)
// =====================================================
function dibujarTiendas(idCaja) {
    let caja = document.getElementById(idCaja);
    if (caja === null) {
        return;
    }
    caja.innerHTML = TIENDAS.map(function (t) {
        return '<article class="tienda"><h3>' + escapar(t.nombre) + "</h3>" +
            '<p class="tienda-direccion">' + escapar(t.direccion) + "<small>" + escapar(t.referencia) + "</small></p>" +
            '<dl class="tienda-horario">' + t.horario.map(function (h) { return "<div><dt>" + escapar(h[0]) + "</dt><dd>" + escapar(h[1]) + "</dd></div>"; }).join("") + "</dl>" +
            '<p class="tienda-telefono">Teléfono: ' + escapar(t.telefono) + "</p>" +
            '<div class="botones-accion"><a class="boton boton-chico" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(t.direccion) + '" target="_blank" rel="noopener">Cómo llegar</a>' +
            '<a class="boton boton-claro boton-chico" href="' + enlaceWhatsApp("Hola, quiero consultar stock en " + t.nombre) + '" target="_blank" rel="noopener">Consultar stock</a></div></article>';
    }).join("");
}
