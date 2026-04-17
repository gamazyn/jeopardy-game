import { createApp } from './server.js';
import { startTunnel } from './tunnel.js';
import { setTunnelUrl, setLocalUrl } from './handlers/lobbyHandler.js';
import { PORT } from './config.js';
import { networkInterfaces } from 'os';

function getLocalIp(): string | null {
  const nets = networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

const { httpServer } = createApp();

httpServer.listen(PORT, async () => {
  console.log(`\n🃏 Jeopardy Server rodando na porta ${PORT}`);

  // IP local para acesso na mesma rede
  const localIp = getLocalIp();
  if (localIp) {
    const url = `http://${localIp}:${PORT}`;
    setLocalUrl(url);
    console.log(`   Local: ${url}`);
  }

  // Iniciar tunnel para acesso remoto
  const tunnelUrl = await startTunnel();
  if (tunnelUrl) {
    setTunnelUrl(tunnelUrl);
    console.log(`   Remoto: ${tunnelUrl}`);
  }

  console.log('\nAcesse http://localhost:5173 para abrir o app (modo dev)\n');
});
