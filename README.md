# Rifa de pares elegidos

Aplicacion ligera en Node.js y Express para una sola rifa. Cada participante
elige dos numeros distintos entre 1 y 53. El par no tiene orden: `12-1` y
`1-12` representan el mismo ticket y solo uno puede reservarse.

No existe una cantidad prefijada de tickets. La pagina publica lista cada par
reservado con el nombre del participante y su estado, pero no muestra
contadores, totales, disponibilidad global ni identificadores internos. Los
telefonos, notas y herramientas de gestion viven exclusivamente en `/admin`.

No hay pasarela de pagos ni base de datos. Los datos se guardan localmente en
JSON mediante escrituras serializadas, atomicas y con respaldo ordinario.

## Funcionamiento

- `/` es la unica pagina publica; `/1` y `/2` redirigen a `/`.
- La persona elige ambos numeros, nombre y telefono.
- Los tickets reservados aparecen publicamente sin mostrar una cantidad total.
- La reserva nace como `pending`; solo `/admin` puede marcarla `paid`.
- Dos solicitudes simultaneas no pueden obtener el mismo par ni su inverso.
- Al eliminar un participante desde `/admin`, se elimina su ticket y ese par
  puede volver a elegirse.
- Primer premio: primera + quinta bolilla de la Tinka.
- Segundo premio: segunda + sexta bolilla.
- El panel permite ingresar las seis bolillas y localizar ambos tickets
  ganadores con su participante y estado de pago.
- Cada premio admite hasta tres imagenes PNG, JPEG o WebP. `/admin` permite
  agregarlas y quitarlas individualmente; la pagina publica las organiza en
  una galeria responsive.
- La interfaz incluye animaciones ligeras y el GIF original de Mart de
  Nullscape Wiki siguiendo el puntero. `static.wikitide.net` es el unico origen
  externo de imagenes permitido por la CSP.
- El easter egg de integridad `Doron::MartKeeper::v1` bloquea solamente la
  pagina publica si Mart es eliminado; el panel administrativo sigue aislado.

## Requisitos

- Node.js 22 o superior.
- pnpm 11 o superior.

## Preparacion local

```powershell
pnpm install --frozen-lockfile
pnpm create-secrets
pnpm start
```

Copia `ADMIN_PASSWORD_HASH` y `SESSION_SECRET` generados a un `.env` basado en
`.env.example`. La pagina queda en `http://127.0.0.1:3000` y el panel en
`http://127.0.0.1:3000/admin`.

## Datos version 2

- `data/rifa.json` se crea con `tickets: []` si no existe.
- Cada inscripcion agrega un ticket con un par unico y participante.
- El JSON no admite tickets sin participante, numeros iguales, valores fuera
  de `1..53`, identificadores duplicados ni pares inversos repetidos.
- Cada modificacion ordinaria conserva la version anterior en
  `data/rifa.backup.json`.
- Un archivo corrupto o de una version antigua detiene el arranque; nunca se
  cambia silenciosamente.

Para crear o verificar un archivo version 2:

```powershell
pnpm init-data
```

## Migracion destructiva desde los 106 tickets antiguos

Este comando conserva configuracion y premios, crea un respaldo fechado y
elimina deliberadamente todos los tickets y compradores anteriores:

```powershell
pnpm migrate-dynamic-tickets -- --confirm-delete-all-tickets
```

La migracion nunca se ejecuta automaticamente. Debe realizarse una sola vez
antes de iniciar esta version con un JSON version 1.

En Ubuntu, despues de actualizar el codigo:

```bash
sudo systemctl stop bolimangus.service
sudo -u bolimangus env DATA_FILE=/var/lib/bolimangus/data/rifa.json \
  /usr/local/bin/node /opt/bolimangus/scripts/migrate-dynamic-tickets.js \
  --confirm-delete-all-tickets
sudo systemctl start bolimangus.service
sudo systemctl status bolimangus.service --no-pager
curl --fail http://127.0.0.1:3000/health
```

El usuario confirmo que no existen compradores en Ubuntu. Si se elimina todo
`/var/lib/bolimangus/data/rifa.json` en vez de migrarlo, la aplicacion tambien crea
un archivo nuevo vacio, pero se perderan ademas configuracion, contacto y
referencias de premios. Por eso se recomienda el comando de migracion.

## Pruebas

```powershell
pnpm test
```

Las pruebas cubren privacidad publica, reservas simultaneas, bloqueo del par
inverso, rangos, persistencia, pago administrativo, eliminacion y reutilizacion
del par, autenticacion, rutas y galerias de hasta tres imagenes.

## Produccion

La guia completa para Oracle Cloud esta en
[`DEPLOY_UBUNTU.md`](./DEPLOY_UBUNTU.md). Produccion usa un proceso Node.js con
`systemd`, Nginx, HTTPS y datos en `/var/lib/bolimangus`.
