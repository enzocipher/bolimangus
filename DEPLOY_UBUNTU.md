# Instalacion segura en Ubuntu y Oracle Cloud

Esta guia instala la rifa desde GitHub en una instancia Ubuntu de Oracle Cloud
con 1 GB de RAM. La arquitectura usa un solo proceso Node.js, `systemd`, Nginx
y certificados HTTPS de Let's Encrypt. No instala una base de datos.

Los comandos asumen Ubuntu 22.04 o 24.04 y un usuario con acceso por SSH y
`sudo`. Sustituye `IP_PUBLICA`, `rifa.ejemplo.com` y el correo antes de usarlos.

## 1. Preparar Oracle Cloud y el dominio

Antes de entrar a Ubuntu:

1. Asigna preferiblemente una IP publica reservada a la instancia.
2. Crea un registro DNS `A` para el dominio apuntando a esa IP.
3. En el Network Security Group (recomendado) o Security List de OCI permite:
   - TCP 80 desde `0.0.0.0/0`.
   - TCP 443 desde `0.0.0.0/0`.
   - TCP 22 solamente desde tu IP publica, por ejemplo `203.0.113.10/32`.
4. Si habilitas IPv6, agrega las reglas equivalentes y el registro `AAAA`.

No abras el puerto 3000 en OCI: Node.js escuchara solo en `127.0.0.1` y Nginx
sera el unico punto de entrada publico.

Conectate desde tu PC:

```bash
ssh ubuntu@IP_PUBLICA
```

## 2. Actualizar Ubuntu y activar el firewall local

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt install -y ca-certificates curl git gnupg nginx rsync snapd ufw unattended-upgrades xz-utils
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw limit OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status verbose
```

Mantén abierta la sesion SSH actual y confirma desde otra terminal que aun
puedes conectarte antes de cerrar la primera.

Activa las actualizaciones de seguridad automaticas:

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

Selecciona `Yes` cuando Ubuntu lo pregunte.

## 3. Instalar Node.js LTS verificando la descarga

La aplicacion requiere Node.js 22 o superior. Estos comandos instalan Node.js
24 LTS desde el sitio oficial y verifican la firma de los checksums. Funcionan
tanto en Oracle Ampere ARM como en instancias AMD/Intel.

```bash
RIFA_NODE_VERSION=v24.19.0

case "$(uname -m)" in
  x86_64) RIFA_NODE_ARCH=x64 ;;
  aarch64|arm64) RIFA_NODE_ARCH=arm64 ;;
  *) echo "Arquitectura no soportada: $(uname -m)"; exit 1 ;;
esac

RIFA_NODE_FILE="node-${RIFA_NODE_VERSION}-linux-${RIFA_NODE_ARCH}.tar.xz"
cd /tmp
curl -fsSLO "https://nodejs.org/dist/${RIFA_NODE_VERSION}/${RIFA_NODE_FILE}"
curl -fsSLO "https://nodejs.org/dist/${RIFA_NODE_VERSION}/SHASUMS256.txt.asc"
curl -fsSLo nodejs-keyring.kbx "https://github.com/nodejs/release-keys/raw/HEAD/gpg/pubring.kbx"
gpgv --keyring ./nodejs-keyring.kbx --output SHASUMS256.txt SHASUMS256.txt.asc
grep " ${RIFA_NODE_FILE}$" SHASUMS256.txt | sha256sum --check -

sudo tar -xJf "$RIFA_NODE_FILE" -C /opt
sudo ln -sfn "/opt/node-${RIFA_NODE_VERSION}-linux-${RIFA_NODE_ARCH}" /opt/node
sudo ln -sfn /opt/node/bin/node /usr/local/bin/node
sudo ln -sfn /opt/node/bin/npm /usr/local/bin/npm
sudo ln -sfn /opt/node/bin/npx /usr/local/bin/npx
sudo ln -sfn /opt/node/bin/corepack /usr/local/bin/corepack
sudo corepack enable --install-directory /usr/local/bin pnpm

node --version
```

El proyecto fija `pnpm@11.6.0` en `package.json`; Corepack respetara esa
version al entrar al repositorio.

## 4. Clonar y comprobar la aplicacion

Ejecuta esta parte como tu usuario normal, no como `root`:

```bash
cd
git clone https://github.com/enzocipher/bolimangus.git
cd bolimangus
pnpm --version
pnpm install --prod --frozen-lockfile
pnpm test
```

`pnpm test` debe terminar con 13 pruebas aprobadas antes de continuar.

## 5. Crear el usuario aislado y copiar el codigo

El proceso web no usara tu cuenta `ubuntu` y no podra modificar el codigo.
Solo tendra escritura en `/var/lib/bolimangus`.

```bash
sudo adduser --system --group --no-create-home --home /nonexistent --shell /usr/sbin/nologin bolimangus
sudo install -d -o root -g bolimangus -m 0750 /opt/bolimangus
sudo rsync -a --exclude='.git/' --exclude='.env' ./ /opt/bolimangus/
sudo chown -R root:bolimangus /opt/bolimangus
sudo find /opt/bolimangus -type d -exec chmod 0750 {} \;
sudo find /opt/bolimangus -type f -exec chmod 0640 {} \;

sudo install -d -o bolimangus -g bolimangus -m 0750 /var/lib/bolimangus/data
sudo install -d -o bolimangus -g bolimangus -m 0750 /var/lib/bolimangus/uploads
sudo install -d -o bolimangus -g bolimangus -m 0750 /var/lib/bolimangus/temp-uploads
sudo install -d -o root -g bolimangus -m 0750 /etc/bolimangus
```

## 6. Generar la contraseña y crear el archivo de secretos

Desde el clon situado en tu directorio personal:

```bash
cd ~/bolimangus
pnpm create-secrets
```

El comando muestra una contraseña aleatoria para `/admin`,
`ADMIN_PASSWORD_HASH` y `SESSION_SECRET`. Guarda la contraseña en tu gestor de
contraseñas; no se volvera a mostrar.

Abre el archivo privado:

```bash
sudoedit /etc/bolimangus/bolimangus.env
```

Copia este contenido y sustituye los dos valores indicados por los generados:

```dotenv
HOST=127.0.0.1
PORT=3000
ADMIN_PASSWORD_HASH=scrypt$PEGA_AQUI_EL_HASH_COMPLETO
SESSION_SECRET=PEGA_AQUI_EL_SECRETO
COOKIE_SECURE=false
HTTPS_ONLY=false
DATA_FILE=/var/lib/bolimangus/data/rifa.json
UPLOAD_DIR=/var/lib/bolimangus/uploads
TEMP_UPLOAD_DIR=/var/lib/bolimangus/temp-uploads
```

Protege el archivo y comprueba que el usuario del servicio puede leerlo:

```bash
sudo chown root:bolimangus /etc/bolimangus/bolimangus.env
sudo chmod 0640 /etc/bolimangus/bolimangus.env
sudo -u bolimangus test -r /etc/bolimangus/bolimangus.env
```

No copies `.env` al repositorio ni lo publiques en GitHub.

## 7. Generar una sola vez los 106 tickets

```bash
sudo -u bolimangus env \
  DATA_FILE=/var/lib/bolimangus/data/rifa.json \
  /usr/local/bin/node /opt/bolimangus/scripts/initialize-data.js

sudo -u bolimangus env \
  DATA_FILE=/var/lib/bolimangus/data/rifa.json \
  /usr/local/bin/node /opt/bolimangus/scripts/initialize-data.js
```

La segunda ejecucion solo verifica el archivo: no debe cambiar los pares. No
borres `rifa.json` despues de vender tickets.

## 8. Instalar y arrancar el servicio systemd

```bash
cd ~/bolimangus
sudo install -o root -g root -m 0644 deploy/bolimangus.service /etc/systemd/system/bolimangus.service
sudo systemctl daemon-reload
sudo systemctl enable --now bolimangus.service
sudo systemctl status bolimangus.service --no-pager
curl --fail http://127.0.0.1:3000/health
```

Para ver registros:

```bash
sudo journalctl -u bolimangus.service -n 100 --no-pager
sudo journalctl -u bolimangus.service -f
```

Puedes revisar el endurecimiento aplicado con:

```bash
sudo systemd-analyze security bolimangus.service
```

## 9. Configurar Nginx

Define tu unico dominio publico, sin `https://` ni rutas:

```bash
RIFA_DOMAIN=rifa.ejemplo.com
cd ~/bolimangus
sudo install -o root -g root -m 0644 deploy/nginx-bolimangus.conf /etc/nginx/sites-available/bolimangus
sudo sed -i "s/DOMINIO_EJEMPLO/${RIFA_DOMAIN}/g" /etc/nginx/sites-available/bolimangus
sudo ln -sfn /etc/nginx/sites-available/bolimangus /etc/nginx/sites-enabled/bolimangus
sudo unlink /etc/nginx/sites-enabled/default 2>/dev/null || true
sudo nginx -t
sudo systemctl reload nginx
curl --fail -I "http://${RIFA_DOMAIN}/health"
```

Si la ultima comprobacion falla, revisa primero DNS, las reglas 80/443 de OCI,
`sudo ufw status` y `sudo journalctl -u nginx -n 100`.

## 10. Activar HTTPS con Let's Encrypt

El dominio ya debe responder por HTTP en el puerto 80.

```bash
RIFA_DOMAIN=rifa.ejemplo.com
LETSENCRYPT_EMAIL=tu-correo@ejemplo.com

sudo snap install --classic certbot
sudo ln -sfn /snap/bin/certbot /usr/local/bin/certbot
sudo certbot --nginx \
  -d "$RIFA_DOMAIN" \
  --redirect \
  --agree-tos \
  --no-eff-email \
  -m "$LETSENCRYPT_EMAIL"

sudo certbot renew --dry-run
```

Cuando HTTPS funcione, activa cookies seguras y HSTS en la aplicacion:

```bash
sudo sed -i 's/^COOKIE_SECURE=false$/COOKIE_SECURE=true/' /etc/bolimangus/bolimangus.env
sudo sed -i 's/^HTTPS_ONLY=false$/HTTPS_ONLY=true/' /etc/bolimangus/bolimangus.env
sudo systemctl restart bolimangus.service

curl --fail -I "https://${RIFA_DOMAIN}/health"
curl --fail -I "https://${RIFA_DOMAIN}/admin"
```

Certbot instala un temporizador para renovar el certificado automaticamente.
Compruebalo con:

```bash
systemctl list-timers | grep certbot
```

## 11. Instalar respaldos diarios

Los archivos importantes estan en `/var/lib/bolimangus/data` y
`/var/lib/bolimangus/uploads`. La plantilla conserva respaldos locales durante
14 dias:

```bash
cd ~/bolimangus
sudo install -d -o root -g root -m 0700 /var/backups/bolimangus
sudo install -o root -g root -m 0750 deploy/backup-bolimangus.sh /usr/local/sbin/backup-bolimangus
sudo install -o root -g root -m 0644 deploy/bolimangus-backup.service /etc/systemd/system/bolimangus-backup.service
sudo install -o root -g root -m 0644 deploy/bolimangus-backup.timer /etc/systemd/system/bolimangus-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now bolimangus-backup.timer
sudo systemctl start bolimangus-backup.service
sudo systemctl status bolimangus-backup.service --no-pager
sudo ls -lh /var/backups/bolimangus
```

Un respaldo en la misma instancia no protege frente a la perdida completa del
servidor. Descarga periodicamente una copia a otra maquina. Desde Windows,
PowerShell o Linux puedes usar:

```bash
scp ubuntu@IP_PUBLICA:/var/backups/bolimangus/bolimangus-FECHA.tar.gz .
```

## 12. Endurecer SSH despues de comprobar tus llaves

Haz esta parte solamente si ya puedes entrar con una llave SSH desde una
segunda terminal. Crea un archivo separado para no modificar la configuracion
principal de Ubuntu:

```bash
sudoedit /etc/ssh/sshd_config.d/99-bolimangus-hardening.conf
```

Contenido:

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
```

Valida antes de recargar:

```bash
sudo sshd -t
sudo systemctl reload ssh
```

No cierres la sesion actual hasta confirmar que una nueva conexion funciona.

## 13. Actualizar desde GitHub

El directorio `~/bolimangus` es tu copia de trabajo; `/opt/bolimangus` es la
copia de produccion de solo lectura. Para publicar una actualizacion:

```bash
cd ~/bolimangus
git pull --ff-only
pnpm install --prod --frozen-lockfile
pnpm test

sudo systemctl start bolimangus-backup.service
sudo systemctl stop bolimangus.service
sudo rsync -a --delete \
  --exclude='.git/' \
  --exclude='.env' \
  ./ /opt/bolimangus/
sudo chown -R root:bolimangus /opt/bolimangus
sudo find /opt/bolimangus -type d -exec chmod 0750 {} \;
sudo find /opt/bolimangus -type f -exec chmod 0640 {} \;
sudo systemctl start bolimangus.service

sudo systemctl status bolimangus.service --no-pager
curl --fail https://TU_DOMINIO/health
```

Los datos y secretos no se sobrescriben porque viven fuera de `/opt`.

## 14. Lista de comprobacion final

- `https://TU_DOMINIO/` abre la pagina publica.
- `https://TU_DOMINIO/admin` permite iniciar sesion.
- `http://TU_DOMINIO` redirige a HTTPS.
- El puerto 3000 no esta abierto en OCI ni UFW.
- `COOKIE_SECURE` y `HTTPS_ONLY` estan en `true`.
- `systemctl status bolimangus nginx` muestra ambos servicios activos.
- `certbot renew --dry-run` termina correctamente.
- Existe un respaldo reciente fuera de la instancia.
- TCP 22 en OCI esta limitado a tu IP y el acceso por contraseña esta apagado.

## Fuentes oficiales consultadas

- Node.js LTS y verificacion de binarios: https://nodejs.org/en/download
- pnpm y Corepack: https://pnpm.io/installation
- Certbot con Nginx: https://certbot.eff.org/instructions?os=snap&ws=nginx
- Proxy HTTP de Nginx: https://nginx.org/en/docs/http/ngx_http_proxy_module.html
- Firewall UFW de Ubuntu: https://documentation.ubuntu.com/server/how-to/security/firewalls/
- Reglas de red OCI: https://docs.oracle.com/en-us/iaas/tools/oci-cli/latest/oci_cli_docs/cmdref/network/security-list.html
