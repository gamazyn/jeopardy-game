let currentTunnelUrl: string | null = null;

export async function startTunnel(port: number): Promise<string | null> {
  try {
    // Importação dinâmica pois localtunnel é CommonJS
    const localtunnel = (await import('localtunnel')).default;
    const tunnel = await localtunnel({ port });

    currentTunnelUrl = tunnel.url;
    console.log(`[tunnel] URL pública: ${tunnel.url}`);

    tunnel.on('close', () => {
      console.log('[tunnel] Tunnel fechado');
      currentTunnelUrl = null;
    });

    tunnel.on('error', (err: Error) => {
      console.error('[tunnel] Erro:', err.message);
      currentTunnelUrl = null;
    });

    return tunnel.url;
  } catch (err) {
    console.warn('[tunnel] Não foi possível iniciar o tunnel:', (err as Error).message);
    console.warn('[tunnel] Players na mesma rede podem usar o IP local.');
    return null;
  }
}

export function getTunnelUrl(): string | null {
  return currentTunnelUrl;
}
