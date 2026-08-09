# Rifa de pares ordenados

Aplicación web ligera para una sola rifa de 106 tickets. Cada ticket contiene
dos números entre 1 y 53. El orden importa, se permiten pares como `24-24` y
ningún ticket completo se repite.

La página pública muestra premios, contacto, disponibilidad y el nombre del
comprador. El panel privado vive en `/admin` y conserva teléfono y notas sin
publicarlos. No existe pasarela de pagos ni base de datos.

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
- En esa primera creación se generan los 106 pares ordenados únicos.
- Los pares no pueden editarse desde el panel.
- Cada modificación válida crea `data/rifa.backup.json` con la versión
  inmediatamente anterior.
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

## Pruebas

```powershell
pnpm test
```

Las pruebas cubren la generación de pares, los valores iguales, el orden de los
números, la prevención de duplicados, la persistencia y el respaldo, la
autenticación, la protección de rutas y la privacidad de teléfono y notas.

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
