import { createApp } from './server.js';
import { startTunnel, getTunnelUrl } from './tunnel.js';
import { setTunnelUrl } from './handlers/lobbyHandler.js';
import { PORT } from './config.js';
import { networkInterfaces } from 'os';

const { httpServer } = createApp();

httpServer.listen(PORT, async () => {
  console.log(`\n🃏 Jeopardy Server rodando na porta ${PORT}`);

  // Exibir IP local para acesso na rede
  const nets = networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`   Local: http://${iface.address}:${PORT}`);
      }
    }
  }

  // Iniciar tunnel para acesso remoto
  const url = await startTunnel();
  if (url) {
    setTunnelUrl(url);
    console.log(`   Remoto: ${url}`);
  }

  console.log('\nAcesse http://localhost:5173 para abrir o app (modo dev)\n');
});
