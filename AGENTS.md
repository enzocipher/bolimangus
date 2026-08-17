# AGENTS.md

## Objetivo del proyecto

Construir y mantener una sola aplicacion web de rifa, pequena y apta para una
instancia Oracle con 1 GB de RAM. La pagina publica muestra la informacion de la
rifa, premios, contacto y los tickets con sus compradores. La administracion
vive en `/admin`. No existe pasarela de pagos.

## Decisiones confirmadas con el usuario

- Usar Node.js y Express.
- Usar `pnpm` como unico gestor de paquetes y conservar `pnpm-lock.yaml`.
- Usar HTML, CSS y JavaScript sin un framework de interfaz.
- Persistir toda la informacion en archivos JSON locales; no agregar una base
  de datos ni enviar los datos a servicios externos.
- Usar contenido e imagenes provisionales en la primera version.
- Mantener la solucion sencilla y de bajo consumo. Ante varias alternativas,
  elegir la mas facil de operar y explicar la eleccion antes de aplicarla.
- Preguntar al usuario antes de introducir una tecnologia, dependencia,
  servicio, despliegue o cambio de arquitectura no acordado.

## Reglas inmutables de los tickets

- Deben existir exactamente 106 tickets.
- Cada ticket contiene dos numeros distintos dentro de un par no dirigido.
- Ambos numeros estan dentro del intervalo inclusivo `1..53`.
- No se permiten numeros iguales: `(24, 24)` es invalido.
- El orden no crea otro ticket: `(23, 25)` y `(25, 23)` representan el mismo
  par y no pueden coexistir.
- No puede repetirse un par entre dos tickets, ni en el mismo orden ni
  invertido.
- Los 106 pares se generan aleatoriamente solo durante la inicializacion, si el
  archivo de datos todavia no existe.
- La migracion aprobada el 2026-08-12 permite una regeneracion explicita, con
  respaldo previo, solamente cuando ningun ticket tiene comprador.
- Si el archivo existe pero esta corrupto o no cumple las reglas, la aplicacion
  debe detenerse con un error claro. Nunca debe regenerar los tickets en
  silencio, porque eso podria cambiar tickets vendidos.
- Asignar, editar o retirar un comprador nunca debe modificar el par del ticket.

## Modalidad confirmada del sorteo

- El resultado oficial de la Tinka aporta seis bolillas ordenadas por posición.
- El primer premio usa la primera y la quinta bolilla.
- El segundo premio usa la segunda y la sexta bolilla.
- Tanto `/1` como `/2` deben mostrar completas las explicaciones de ambos
  premios, sin crear enlaces entre las dos vistas de tickets.
- Las capturas y números mostrados para explicar la modalidad son ejemplos; no
  deben presentarse como un resultado real.
- La interfaz debe decir `53 tickets`, no `53 oportunidades`, y no debe enlazar
  `/1` con `/2`.

## Persistencia y privacidad

- Las escrituras del JSON deben serializarse y realizarse de forma atomica.
- Mantener una copia de respaldo local antes de reemplazar datos existentes.
- La API publica solo puede exponer los datos publicos del comprador definidos
  por la interfaz. Telefonos, notas internas y credenciales son exclusivos de
  `/admin`.
- No guardar secretos en el repositorio. Las credenciales de administracion y
  secretos de sesion deben venir del entorno del proceso.
- Validar todos los datos en el servidor, aunque tambien se validen en el
  navegador.

## Calidad y operacion

- Priorizar HTML semantico, navegacion por teclado, contraste legible y diseno
  adaptable a telefonos.
- Evitar procesos de compilacion y dependencias innecesarias en produccion.
- Agregar pruebas para la generacion y validacion de tickets, persistencia y
  rutas criticas de administracion.
- Antes de afirmar que una tarea termino, ejecutar las pruebas y una comprobacion
  de inicio de la aplicacion.
- Actualizar `progress.md` despues de cada bloque material de trabajo, anotando
  lo terminado, lo pendiente y las decisiones nuevas.

## Skills instalados para este proyecto

- `web-coder`, desde `github/awesome-copilot`, revision `8fedf95`.
- `node`, desde `mcollina/skills`.
- `nodejs-express-server`, desde `aj-geddes/useful-ai-prompts`.

### Criterios visuales vigentes

- La interfaz publica usa una identidad moderna de alto contraste (navy,
  lima y coral), tipografia del sistema, tarjetas compactas y layouts
  responsive. El panel `/admin` usa una variante navy/azul orientada a
  operacion, con estados visibles para tickets y formularios densos.
- Los rediseños deben conservar los IDs y clases consumidos por `app.js` y
  `public/admin/admin.js`; cualquier cambio de markup debe verificarse con
  `node --check`, `pnpm test` y una comprobacion de las rutas publicas.
- No cargar fuentes, imagenes, analiticas ni hojas de estilo remotas: el
  servidor debe seguir siendo autonomo y liviano para 1 GB de RAM.

Los skills son instrucciones para Codex. No forman parte de las dependencias ni
del proceso que se ejecutara en el servidor de la rifa.

## Dependencias aprobadas

- `express`: servidor HTTP, rutas, API y archivos estaticos.
- `helmet`: encabezados de seguridad y politica de contenido.
- `multer`: recepcion limitada de imagenes en el panel administrativo.

No agregar otra dependencia de produccion sin explicarla y obtener aprobacion.

## Despliegue aprobado

- El servidor objetivo es Ubuntu en Oracle Cloud con 1 GB de RAM.
- Produccion usa un solo proceso Node.js administrado por `systemd`, enlazado a
  `127.0.0.1:3000`, con Nginx como unico proxy publico.
- HTTPS se obtiene y renueva con Certbot/Let's Encrypt. OCI y UFW solo exponen
  80/443; SSH debe limitarse a la IP administrativa.
- Codigo, secretos y datos se separan en `/opt/bolimangus`,
  `/etc/bolimangus` y `/var/lib/bolimangus`. El usuario del servicio no puede
  modificar el codigo.
- Las plantillas operativas se mantienen en `deploy/` y la guia completa en
  `DEPLOY_UBUNTU.md`.
