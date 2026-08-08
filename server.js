import { createApp } from './src/app.js';
import { createConfig } from './src/config.js';

async function main() {
  const config = createConfig();
  const { app } = await createApp({ config });
  const server = app.listen(config.port, config.host, () => {
    console.info(`Rifa disponible en http://${config.host}:${config.port}`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    app.locals.isShuttingDown = true;
    console.info(`${signal} recibido; cerrando el servidor.`);

    const forceClose = setTimeout(() => {
      console.error('El cierre supero 10 segundos; finalizando conexiones.');
      server.closeAllConnections?.();
    }, 10_000);
    forceClose.unref();

    server.close((error) => {
      clearTimeout(forceClose);
      if (error) {
        console.error('No se pudo cerrar el servidor correctamente.', error);
        process.exitCode = 1;
      }
    });
    server.closeIdleConnections?.();
  }

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('No se pudo iniciar la rifa.', error);
  process.exitCode = 1;
});
