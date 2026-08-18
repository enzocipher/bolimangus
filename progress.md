# Progreso de la rifa

Ultima actualizacion: 2026-08-18

## Estado vigente

- [x] Aplicacion Node.js + Express, HTML/CSS/JS sin framework, `pnpm` y JSON
  local; dependencias limitadas a Express, Helmet y Multer.
- [x] Una sola pagina publica en `/`; `/1` y `/2` redirigen a `/`.
- [x] No existe cantidad prefijada ni generacion inicial de tickets. Cada
  reserva crea un ticket dinamico con dos numeros elegidos entre 1 y 53.
- [x] Se rechazan numeros iguales, valores fuera de rango, pares repetidos y
  pares inversos: `12-1` bloquea `1-12`.
- [x] La comprobacion de unicidad y la escritura se ejecutan dentro de la misma
  cola atomica para evitar dobles reservas simultaneas.
- [x] La pagina y API publicas listan cada ticket reservado con su par, nombre
  publico y estado, sin contadores, totales, disponibilidad ni ID interno.
- [x] El formulario publico solicita dos numeros, nombre y telefono; toda
  reserva nace pendiente de pago y el cliente no puede marcarla pagada.
- [x] El logotipo `53` fue reemplazado por un icono vectorial de ticket.
- [x] `/admin` muestra el total privado de reservas, pendientes y pagadas;
  permite buscar por par, identificador, nombre o telefono, confirmar pago,
  editar y eliminar ticket/participante.
- [x] Al eliminar un ticket, su par puede ser elegido nuevamente.
- [x] `/admin` incluye un verificador de seis bolillas Tinka: busca primer
  premio con 1.ª + 5.ª y segundo premio con 2.ª + 6.ª, mostrando participante,
  telefono y estado de pago.
- [x] La pagina publica conserva las explicaciones completas de ambos premios y
  marca los numeros mostrados como ejemplo.
- [x] El JSON usa version 2, escrituras serializadas, reemplazo atomico y
  respaldo antes de modificaciones ordinarias.
- [x] Se creo una migracion explicita que conserva configuracion/premios y
  elimina todos los tickets y compradores del formato anterior.
- [x] Se ejecuto la migracion local: 106 tickets y 0 compradores eliminados;
  el respaldo fechado quedo fuera de Git.
- [x] Autenticacion administrativa con scrypt, cookie HttpOnly/SameSite,
  expiracion, limite de intentos y proteccion de mutaciones.
- [x] Imagenes PNG/JPEG/WebP limitadas y verificadas por firma interna.
- [x] Diseno responsive navy/lima/coral, panel navy/azul, teclado, foco visible,
  contraste y movimiento reducido; sin recursos externos.
- [x] Se agregaron apariciones al hacer scroll, paralaje del hero, brillo y
  perspectiva interactiva de tickets, transiciones de premios y microanimacion
  al elegir el par, usando solo CSS y JavaScript nativo.
- [x] Se reemplazo la adaptacion SVG por el GIF exacto de Mart solicitado,
  reducido a 32-40 px y persiguiendo el puntero sin brillo, particulas, giro ni
  reaccion adicional al clic; conserva su orientacion y queda estatico en
  tactil o movimiento reducido.
- [x] Se agrego un favicon SVG local con el icono de ticket para evitar la
  solicitud 404 que realizaba el navegador.
- [x] Mart y su comprobacion llevan la firma `Doron::MartKeeper::v1`; eliminar
  el componente bloquea solamente la pagina publica y no afecta `/admin`.
- [x] Pasan 18 pruebas automatizadas de privacidad, concurrencia, pares,
  persistencia, pago, eliminacion, reutilizacion, autenticacion e imagenes.
- [x] Se repitieron las 18 pruebas y la comprobacion de arranque tras restaurar
  la lista publica segura; `/api/public` no expone campos de conteo y el HTML
  no muestra contadores.
- [x] Se repitieron las 18 pruebas y el arranque tras sustituir el SVG de Mart:
  el GIF original respondio 200 como `image/gif`, el HTML contiene la fuente y
  los creditos exactos, y la CSP solo agrego `static.wikitide.net` a `img-src`.

## Pendiente para publicar

- [ ] Subir los cambios a GitHub.
- [ ] En Ubuntu: detener el servicio, hacer `git pull`, ejecutar una sola vez
  `migrate-dynamic-tickets` contra
  `/var/lib/bolimangus/data/rifa.json` y reiniciar el servicio.
- [ ] Confirmar visualmente el formulario publico y el verificador Tinka con
  los datos reales del sorteo.
- [ ] Reemplazar textos, contacto e imagenes provisionales desde `/admin`.
- [ ] Activar `COOKIE_SECURE=true` y `HTTPS_ONLY=true` cuando HTTPS este listo.
- [ ] Mantener respaldos externos periodicos del JSON y las imagenes.

## Nota de operacion

Debe ejecutarse un solo proceso de la aplicacion. El JSON local es la fuente
unica de datos y la cola en memoria garantiza que dos inscripciones simultaneas
no adjudiquen el mismo par.
