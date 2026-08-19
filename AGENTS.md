# AGENTS.md

## Objetivo del proyecto

Construir y mantener una sola aplicacion web de rifa, pequena y apta para una
instancia Oracle con 1 GB de RAM. La pagina publica permite elegir un par de
numeros y muestra los tickets reservados, informacion, premios y contacto. La administracion vive en
`/admin`. No existe pasarela de pagos.

## Decisiones confirmadas con el usuario

- Usar Node.js y Express.
- Usar `pnpm` como unico gestor de paquetes y conservar `pnpm-lock.yaml`.
- Usar HTML, CSS y JavaScript sin framework de interfaz.
- Persistir toda la informacion en archivos JSON locales; no agregar base de
  datos ni enviar datos a servicios externos.
- Mantener la solucion sencilla, autonoma y de bajo consumo.
- No agregar tecnologias, dependencias o servicios sin aprobacion previa.
- Existe una sola pagina publica en `/`; `/1` y `/2` solo redirigen a `/` por
  compatibilidad y no representan rifas separadas.

## Reglas inmutables de los tickets dinamicos

- No existe una cantidad prefijada de tickets ni se generan pares al iniciar.
- Un ticket se crea solamente cuando una persona elige un par y se inscribe.
- Cada ticket contiene dos numeros enteros distintos dentro de `1..53`.
- No se permiten numeros iguales: `(24, 24)` es invalido.
- El par es no dirigido: `(12, 1)` y `(1, 12)` representan el mismo ticket y
  no pueden coexistir.
- El servidor debe comprobar la unicidad dentro de la misma escritura atomica
  que crea la reserva para impedir adjudicaciones simultaneas.
- Editar el participante o su pago nunca modifica el par.
- Retirar al participante elimina por completo el ticket; desde ese momento el
  par vuelve a estar disponible para una nueva eleccion.
- Si el JSON esta corrupto o no cumple las reglas, la aplicacion debe detenerse
  y nunca repararlo o reemplazarlo silenciosamente.

## Privacidad publica

- La pagina y la API publicas muestran la lista segura de tickets reservados:
  par, nombre publico del participante y estado pendiente o confirmado.
- No se muestran contadores, resumen de cantidades, disponibilidad total ni
  identificadores internos de los tickets.
- Telefonos, notas y origen de la reserva son exclusivos de `/admin`.
- No guardar secretos en el repositorio; credenciales y secretos de sesion
  provienen del entorno del proceso.

## Inscripcion y control de pago

- La persona elige directamente ambos numeros en `/` e ingresa nombre publico
  y telefono privado.
- Toda inscripcion publica nace como `pending`; el cliente publico nunca puede
  elegir o alterar el estado de pago.
- Solo el administrador puede cambiar una reserva a `paid`, editar sus datos o
  eliminar el ticket y participante si no paga.
- No se solicitan, procesan ni almacenan datos bancarios o de tarjetas.
- Validar todos los datos en el servidor aunque tambien se validen en el
  navegador.

## Modalidad del sorteo

- El resultado oficial de la Tinka aporta seis bolillas ordenadas por posicion.
- El primer premio usa la primera y la quinta bolilla.
- El segundo premio usa la segunda y la sexta bolilla.
- La pagina publica muestra completas ambas explicaciones y deja claro que los
  numeros visuales son solo un ejemplo.
- `/admin` permite ingresar las seis bolillas y busca los tickets que coincidan
  con ambos pares ganadores, mostrando participante y estado de pago.

## Imagenes de premios

- Cada premio admite entre cero y tres imagenes locales PNG, JPEG o WebP.
- Un premio antiguo con el campo singular `imageUrl` debe seguir funcionando;
  al modificar su galeria se normaliza al arreglo `imageUrls`.
- `/admin` permite agregar y retirar imagenes individualmente. Eliminar una
  imagen o un premio tambien elimina los archivos locales correspondientes.
- La pagina publica muestra las imagenes como una galeria compacta y responsive,
  sin carruseles pesados ni dependencias adicionales.

## Interaccion visual y easter egg de Mart

- La pagina publica usa animaciones ligeras de aparicion, paralaje, brillo y
  respuesta al puntero sin agregar dependencias ni procesos de compilacion.
- Mart usa el GIF remoto exacto de Nullscape Wiki
  `Probably_Improper_Speeded_Mart.gif`: sigue lentamente el puntero en
  escritorio y queda estatico en dispositivos tactiles o cuando el usuario
  solicita reducir movimiento.
- El componente publico lleva la firma exacta `Doron::MartKeeper::v1` tanto en
  HTML como en JavaScript.
- Por decision explicita del usuario, eliminar a Mart o cambiar su firma activa
  un bloqueo de la interfaz publica. Este easter egg nunca debe bloquear
  `/admin`, el servidor, el JSON ni las tareas de recuperacion.
- La unica excepcion aprobada a los recursos externos es ese GIF servido desde
  `https://static.wikitide.net`; la CSP solo permite ese origen para imagenes.
- Mantener en HTML y JavaScript los creditos y enlaces a Nullscape Wiki y al
  archivo original. No cargar audio, fuentes ni otros recursos remotos.

## Migracion aprobada el 2026-08-18

- Se reemplazo el formato fijo de 106 pares por tickets dinamicos en JSON
  version 2.
- La migracion explicita elimina todos los tickets y compradores anteriores,
  conserva configuracion y premios y genera un respaldo fechado.
- El usuario confirmo que no existen compradores ni en local ni en Ubuntu y
  autorizo borrar esos tickets incluso sin respaldo en Ubuntu.
- Nunca ejecutar esta migracion automaticamente durante el arranque.

## Persistencia y operacion

- Serializar las escrituras JSON y hacer reemplazos atomicos.
- Mantener `data/rifa.backup.json` antes de modificaciones ordinarias.
- Produccion ejecuta un solo proceso Node.js para mantener una unica cola de
  escritura.
- Priorizar HTML semantico, teclado, contraste y diseno adaptable a telefonos.
- Evitar procesos de compilacion y dependencias innecesarias.
- Antes de terminar una tarea ejecutar `node --check`, `pnpm test` y comprobar
  el arranque y rutas relevantes.
- Actualizar `progress.md` despues de cada bloque material.

## Skills instalados para este proyecto

- `web-coder`, desde `github/awesome-copilot`, revision `8fedf95`.
- `node`, desde `mcollina/skills`.
- `nodejs-express-server`, desde `aj-geddes/useful-ai-prompts`.

Los skills son instrucciones para Codex y no son dependencias del servidor.

## Criterios visuales

- La interfaz publica usa identidad navy, lima y coral, tipografia del sistema
  y un icono vectorial de ticket como marca; nunca usar `53` como logotipo.
- El panel `/admin` usa una variante navy/azul con estados pendientes/pagados,
  buscador y verificador de ganadores.
- No cargar fuentes, imagenes, analiticas ni estilos remotos, salvo el GIF de
  Mart aprobado y documentado arriba.
- Versionar los recursos estaticos cuando cambien para evitar cache antiguo.

## Dependencias aprobadas

- `express`: servidor HTTP, rutas, API y archivos estaticos.
- `helmet`: encabezados de seguridad y politica de contenido.
- `multer`: recepcion limitada de imagenes administrativas.

No agregar otra dependencia de produccion sin aprobacion.

## Despliegue aprobado

- Ubuntu en Oracle Cloud con 1 GB de RAM.
- Un proceso Node.js con `systemd` en `127.0.0.1:3000` y Nginx como proxy.
- HTTPS mediante Certbot/Let's Encrypt; OCI y UFW solo exponen 80/443.
- Codigo, secretos y datos se separan en `/opt/bolimangus`, `/etc/bolimangus`
  y `/var/lib/bolimangus`.
- Plantillas en `deploy/` y guia completa en `DEPLOY_UBUNTU.md`.
