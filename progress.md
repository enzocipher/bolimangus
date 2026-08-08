# Progreso de la rifa

Ultima actualizacion: 2026-08-08

## Terminado

- [x] Se comprobo que el espacio de trabajo no contenia un proyecto previo.
- [x] Se acordo y documento la arquitectura en `AGENTS.md`: Node.js, Express,
  HTML, CSS y JavaScript sin framework de interfaz ni base de datos.
- [x] Se cambio el gestor de paquetes a `pnpm` y se genero `pnpm-lock.yaml`.
- [x] Se instalaron y aplicaron los skills `node`, `nodejs-express-server` y
  `web-coder`.
- [x] Se limitaron las dependencias de produccion a `express`, `helmet` y
  `multer`.
- [x] Se implemento la generacion inicial de exactamente 106 pares ordenados
  unicos con valores de 1 a 53.
- [x] Se admite que ambos valores sean iguales y se mantiene la distincion entre
  pares invertidos como `23-25` y `25-23`.
- [x] Se impidio modificar o regenerar silenciosamente los pares existentes.
- [x] Se inicializo `data/rifa.json` y se comprobo mediante SHA-256 que ejecutar
  la inicializacion de nuevo no cambia ningun ticket.
- [x] Se implemento persistencia JSON con cola de escrituras, reemplazo atomico
  y `data/rifa.backup.json` antes de cada modificacion.
- [x] Se implemento la pagina publica con informacion, premios, contacto,
  estadisticas, buscador, filtros y los 106 tickets con nombre del comprador.
- [x] Se implemento el panel `/admin` para editar informacion, contacto,
  premios, imagenes y compradores.
- [x] Telefono y notas del comprador se mantienen privados y nunca aparecen en
  la API publica.
- [x] Se implemento autenticacion con contraseña derivada mediante scrypt,
  cookie firmada HttpOnly/SameSite, expiracion de sesion y limite de intentos.
- [x] Se agrego proteccion de solicitudes administrativas, politica CSP,
  encabezados de seguridad y validacion en el servidor.
- [x] Las imagenes se limitan a 5 MB y se comprueban por MIME y firma interna
  para PNG, JPEG y WebP; los nombres finales son aleatorios.
- [x] Se creo un diseño adaptable, semantico, navegable por teclado, con foco
  visible, contraste legible y respeto por movimiento reducido.
- [x] No se agregaron fuentes, scripts, telemetria ni servicios externos.
- [x] Se documento instalacion, secretos, datos, respaldos y operacion en
  `README.md` y `.env.example`.
- [x] Pasan 13 pruebas automatizadas de tickets, persistencia, autenticacion,
  privacidad, rutas, seguridad e imagenes.
- [x] `pnpm audit --prod` informa cero vulnerabilidades conocidas.
- [x] Se ejecuto el servidor real: `/health`, `/`, `/admin` y `/api/public`
  respondieron correctamente; la API devolvio 106 tickets y CSP estuvo activo.
- [x] Se reemplazo la primera propuesta visual por un rediseño moderno en la
  pagina publica y `/admin`: tipografia del sistema, superficies limpias,
  paleta navy/lima/coral en publico, panel navy/azul en administracion,
  estados de tickets mas claros y layouts responsive para movil.
- [x] El rediseño se trabajo en paralelo con una auditoria visual y dos pases
  independientes (publico y admin), preservando los IDs, APIs y comportamiento
  existentes. `node --check` pasa para ambos scripts y las 13 pruebas siguen
  pasando.
- [x] Se reforzo especificamente el inicio que ven los participantes: se agrego
  la seccion "Como participar", se simplifico la explicacion del ticket, se
  versionaron los recursos para evitar CSS antiguo en cache y se elimino el
  desplazamiento horizontal detectado durante la revision visual.

## Pendiente para publicar

- [ ] Reemplazar textos, contacto e imagenes provisionales desde `/admin`.
- [ ] Generar los secretos definitivos con `pnpm create-secrets` en el servidor.
- [x] Se confirmo Ubuntu como sistema de la instancia Oracle.
- [x] Se preparo `DEPLOY_UBUNTU.md` con `git clone`, Node.js LTS verificado,
  permisos, UFW/OCI, `systemd`, Nginx, Certbot, HTTPS, actualizaciones y
  recuperacion operativa.
- [x] Se agregaron plantillas endurecidas para el servicio, proxy y respaldo
  diario en `deploy/`.
- [x] Se corrigio la CSP para activar `upgrade-insecure-requests` solo cuando
  `HTTPS_ONLY=true`; durante la preparacion por HTTP, CSS y JavaScript ya no se
  intentan cargar prematuramente mediante HTTPS.
- [x] Se transformaron las tarjetas de tickets en boletos neón con acabado
  vectorial CSS: perforaciones laterales, borde punteado, código visual,
  números iluminados y estados disponibles/comprados diferenciados.
- [x] Se incrementó la versión de los recursos públicos a `v=5` para que los
  navegadores no conserven las tarjetas antiguas en caché.
- [x] Se agregaron las vistas públicas `/1` y `/2`: cada una muestra 53
  tickets del mismo JSON, sin regenerar ni duplicar pares. La raíz `/` conserva
  la vista completa de 106 tickets para compatibilidad.
- [ ] Confirmar el dominio definitivo y ejecutar la instalacion en la instancia.
- [ ] Guardar respaldos periodicos fuera de la instancia Oracle.
- [ ] Activar `COOKIE_SECURE=true` y `HTTPS_ONLY=true` cuando HTTPS este listo.

## Nota de operacion

Debe ejecutarse un solo proceso de la aplicacion. El JSON local es la fuente
unica de datos y esta decision mantiene el consumo adecuado para 1 GB de RAM.
