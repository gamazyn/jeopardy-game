import { createApp } from './server.js';
import { startTunnel } from './tunnel.js';
import { setTunnelUrl, setLocalUrl } from './handlers/lobbyHandler.js';
import { PORT, CLIENT_URL, NODE_ENV } from './config.js';
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

// Em dev o cliente roda no Vite (CLIENT_URL), em prod o servidor serve o cliente
function getClientPort(): number {
  if (NODE_ENV === 'production') return PORT;
  try {
    return Number(new URL(CLIENT_URL).port) || 5173;
  } catch {
    return 5173;
  }
}

const { httpServer } = createApp();

httpServer.listen(PORT, async () => {
  console.log(`\n🃏 Jeopardy Server rodando na porta ${PORT}`);

  // Em dev expõe Vite (5173), em prod expõe Express (PORT)
  const clientPort = getClientPort();

  // IP local para acesso na mesma rede
  const localIp = getLocalIp();
  if (localIp) {
    setLocalUrl(`http://${localIp}:${clientPort}`);
    console.log(`   Local: http://${localIp}:${clientPort}`);
  }

  // Tunnel para acesso remoto — mesma porta do cliente
  const tunnelUrl = await startTunnel(clientPort);
  if (tunnelUrl) {
    setTunnelUrl(tunnelUrl);
    console.log(`   Remoto: ${tunnelUrl}`);
  }

  console.log('\nAcesse http://localhost:5173 para abrir o app (modo dev)\n');
});
