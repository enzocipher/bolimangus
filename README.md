# Rifa de pares únicos

Aplicación web ligera para una sola rifa de 106 tickets. Cada ticket contiene
dos números distintos entre 1 y 53. El orden no crea otro par: `25-26` y
`26-25` se consideran el mismo ticket y no pueden coexistir.

La página pública muestra premios, contacto y disponibilidad. Una persona puede
tocar un ticket libre e inscribirse con nombre y teléfono; la reserva queda
pendiente de pago. El panel privado vive en `/admin`, conserva el teléfono y las
notas sin publicarlos, permite confirmar el pago o retirar al participante y
liberar el ticket. No existe pasarela de pagos ni base de datos.

## Modalidad del sorteo

- Primer premio: gana el par formado por la primera y quinta bolilla del
  resultado oficial de la Tinka.
- Segundo premio: gana el par formado por la segunda y sexta bolilla.
- `/1` y `/2` muestran las explicaciones de ambos premios, pero cada URL sigue
  mostrando únicamente sus 53 tickets y no enlaza la otra vista.
- Los números usados en la explicación visual son solo un ejemplo.

## Requisitos

- Node.js 22 o superior; para el servidor conviene una versión LTS.
- pnpm 11 o superior.

## Preparación local

1. Instala exactamente lo registrado en el lockfile:

   ```powershell
   pnpm install --frozen-lockfile
   ```

2. Genera la contraseña administrativa y el secreto de sesión:

   ```powershell
   pnpm create-secrets
   ```

   El comando muestra una contraseña una sola vez. Guarda esa contraseña y
   copia las líneas `ADMIN_PASSWORD_HASH` y `SESSION_SECRET` en un archivo
   `.env` basado en `.env.example`.

3. Inicia la aplicación:

   ```powershell
   pnpm start
   ```

   La página queda en `http://127.0.0.1:3000` y el panel en
   `http://127.0.0.1:3000/admin`.

   La raíz `/` redirige a `/1`. Las vistas públicas `/1` y `/2` muestran 53
   tickets cada una, sin enlaces ni textos que revelen la otra vista. Ambas
   usan el mismo archivo JSON y no regeneran pares.

## Datos y respaldos

- `data/rifa.json` se crea únicamente si no existe.
- En esa primera creación se generan 106 pares únicos de números distintos.
- Un par y su inverso representan lo mismo: si existe `25-26`, no puede existir
  `26-25`; tampoco se permiten pares como `25-25`.
- Los pares no pueden editarse desde el panel.
- Cada modificación válida crea `data/rifa.backup.json` con la versión
  inmediatamente anterior.
- Las inscripciones públicas se guardan como `pending`. Solo `/admin` puede
  marcarlas como `paid` o retirar al participante. Una comprobación atómica
  impide que dos personas ocupen el mismo ticket.
- Si `rifa.json` está corrupto o no cumple las reglas, el servidor se detiene y
  no genera tickets nuevos.
- Las imágenes se guardan en `public/uploads` con nombres aleatorios. Solo se
  aceptan PNG, JPEG y WebP de hasta 5 MB, comprobando tanto el tipo declarado
  como la firma interna del archivo.

Para crear o verificar los datos sin iniciar el servidor:

```powershell
pnpm init-data
```

Ejecutarlo nuevamente verifica el archivo existente; no vuelve a generar los
pares.

Para aplicar una sola vez la regla nueva sobre un JSON todavía sin compradores:

```powershell
pnpm regenerate-tickets -- --confirm
```

El comando conserva la configuración y los premios, crea un respaldo con fecha
y se detiene sin modificar nada si encuentra al menos un comprador.

## Pruebas

```powershell
pnpm test
```

Las pruebas cubren la generación de pares distintos, el rechazo de valores
iguales y pares inversos, la persistencia y el respaldo, la autenticación, las
reservas simultáneas, la separación entre `/1` y `/2`, el control de pago, la
liberación de tickets y la privacidad de teléfono y notas.

## Producción

La guia completa para Ubuntu en Oracle Cloud, incluyendo `git clone`, usuario
aislado, permisos, `systemd`, Nginx, HTTPS, firewall, respaldos y
actualizaciones, esta en [`DEPLOY_UBUNTU.md`](./DEPLOY_UBUNTU.md).

Antes de publicar:

- usa una contraseña y un secreto distintos a los de desarrollo;
- configura `COOKIE_SECURE=true` y `HTTPS_ONLY=true` cuando HTTPS esté activo;
- permite escritura únicamente al usuario del servicio sobre `data` y
  `public/uploads`;
- conserva copias externas periódicas de `rifa.json` y las imágenes;
- ejecuta un solo proceso de la aplicación, ya que el archivo JSON es la fuente
  única de datos.

Los archivos definitivos de servicio y proxy se prepararán cuando se confirme
el sistema operativo de la instancia Oracle y el dominio que se utilizará.
