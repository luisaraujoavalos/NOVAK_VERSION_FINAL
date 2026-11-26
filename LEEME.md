# NOVAK: tienda virtual (versión mejorada)

Abre `index.html` con Live Server en Visual Studio Code (clic derecho → "Open with Live Server").
Todo funciona en el navegador con localStorage, sin servidor ni base de datos.

## Cuentas (Supabase Auth)
Las cuentas viven en Supabase: crea las tuyas desde `registro.html` o en Supabase → Authentication → Users.
Para que una cuenta sea administrador, ejecuta en el SQL Editor:
`update public.clientes set rol = 'admin' where correo = 'tu-correo@ejemplo.com';`
Los 12 clientes de ejemplo de `datos.js` solo alimentan las estadísticas (no pueden iniciar sesión).
Archivos SQL en `supabase/` (ejecutar en este orden): `01_tablas.sql` → `02_datos_iniciales.sql` → `03_auth.sql` → `04_pedidos.sql` → `05_admin.sql` → `06_pagos_manuales.sql` → `07_correos.sql`.
**Pagos:** solo transferencia bancaria (el cliente escribe el n.º de operación y tú cambias el pedido a "Pagado" en el panel) y contra entrega en efectivo (Lima). Las cuentas se editan en `EMPRESA.cuentasBancarias` de `js/datos.js`.
**Correos:** Edge Function `supabase/functions/notificar` + Brevo (gratis). Secretos: `BREVO_API_KEY`, `CORREO_REMITENTE`, `CORREO_TIENDA`, `NOTIFICAR_SECRETO`, `TIENDA_URL`.
El panel admin guarda todo en Supabase: prendas con stock por talla y color, ofertas, campaña, cupones, estados de pedido (al cancelar, el stock vuelve solo), respuestas del Libro de Reclamaciones y mensajes de contacto. Las fotos subidas van a Supabase Storage (bucket `fotos`).
Los pedidos se crean con la función `crear_pedido` (04_pedidos.sql): valida stock por talla y color, lo descuenta y calcula precios, cupón y envío en una sola transacción.

## Páginas
- Modo claro y oscuro: con el botón de la luna o el sol en la cabecera. Recuerda la elección y, la primera vez, usa la del sistema.
- `seguimiento.html`: estado del pedido con el número NV- y el correo.
- `politicas.html`: términos, privacidad, envíos, cambios y promociones.
- `index.html`: carrusel principal, categorías, ofertas con cuenta regresiva, "Encuentra tu fit", novedades y "Seleccionados para ti" (personalizado según las compras del cliente).
- `catalogo.html`: filtros por categoría, línea, talla, color, precio, ofertas y novedades. Admite enlaces como `?oferta=1`, `?cat=hoodies` o `?genero=mujer`.
- `producto.html?id=...`: ficha con 4 vistas (frente, espalda, lado izquierdo y lado derecho), colores, tallas con stock, guía de tallas, especificaciones y reseñas. El administrador ve además las estadísticas de la prenda.
- `carrito.html`: cantidades por talla y color, cupones, barra de envío gratis.
- `checkout.html`: compra en 3 pasos (datos, entrega y pago por transferencia o contra entrega).
- `cuenta.html`: pedidos con seguimiento, "Mi estilo", favoritos y datos.
- `admin.html`: Resumen (gráficos), Prendas (estadísticas por prenda), Clientes (perfil de compra de cada cliente), Pedidos (cambiar estado) y Ofertas y cupones.

## Fotos de las 4 vistas
Cada prenda trae una sola foto. Mientras falten las otras vistas, la ficha muestra una **vista referencial** marcada como tal. Para poner las fotos reales tienes dos opciones:
1. Copia las fotos en `img/` con este nombre: `<id>-espalda.jpg`, `<id>-izquierda.jpg`, `<id>-derecha.jpg` (ejemplo: `img/hoodies-08-espalda.jpg`). La página las detecta sola.
2. Desde el panel admin → Editar prenda → "Fotos: las 4 vistas" (ruta, enlace o subir foto).

## Antes de publicar (importante)
- **Datos de la empresa** en `js/datos.js` (objeto `EMPRESA`): razón social, RUC, dirección, WhatsApp, correo e Instagram/TikTok/Facebook. Los actuales son de ejemplo. Cámbialos también en el bloque `ClothingStore` de `index.html` y en los enlaces de `contacto.html`.
- **Tiendas** en `js/datos.js` (`TIENDAS`): direcciones, horarios y teléfonos reales.
- **Nuestra historia** en `index.html` (bloque marcado con "EDITA ESTE BLOQUE"): pon tu historia real y, si puedes, una foto del equipo o del taller.
- **Datos de ejemplo:** en `js/datos.js` cambia `DATOS_DE_EJEMPLO` a `false`. Así dejan de cargarse los clientes, pedidos y reseñas de prueba y solo se verán compras y opiniones reales.
- **Campaña:** las fechas están fijas en `CAMPANA_INICIAL` (`js/datos.js`), son iguales para todos los visitantes y la cuenta regresiva no se reinicia. Se pueden cambiar en Panel admin → Ofertas y cupones.
- **Dominio:** las etiquetas para redes y buscadores (Open Graph, `sitemap.xml`, `robots.txt`) usan `https://www.novak.pe/`. Reemplázalo por tu dominio real.
- **Textos legales** (`politicas.html`): son una base. Hazlos revisar por un abogado.

## Libro de Reclamaciones
`libro-reclamaciones.html` genera la hoja numerada (RC-AAAA-000001) con los datos que pide la norma. Calcula la fecha límite de 15 días hábiles y permite imprimirla o guardarla en PDF. El administrador responde las hojas en Panel admin → Reclamaciones. En una tienda real, la hoja también debe llegar por correo al cliente y a la empresa, y eso requiere un servidor.

## Cupones incluidos
NOVAK10 · BIENVENIDA15 (desde S/ 150) · GENZ20 (S/ 20 desde S/ 120) · ENVIOGRATIS

## Archivos JS
`datos.js` (catálogo y datos de ejemplo) → `app.js` (núcleo: carrito, favoritos, cabecera) → `estadisticas.js` (cálculos y gráficos) → `admin.js` (panel) → `tienda.js` (cada página).
Para volver a los datos iniciales: en la consola del navegador ejecuta `localStorage.clear()` y recarga.
