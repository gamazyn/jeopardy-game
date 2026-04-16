/**
 * Script de seed: copia os jogos da pasta samples/ para data/games/
 * Uso: pnpm seed
 */
import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplesDir = resolve(__dirname, '../samples');
const gamesDir = resolve(__dirname, '../data/games');

async function seed() {
  const files = await readdir(samplesDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  if (jsonFiles.length === 0) {
    console.log('Nenhum jogo encontrado em samples/');
    return;
  }

  for (const file of jsonFiles) {
    const raw = await readFile(resolve(samplesDir, file), 'utf-8');
    const config = JSON.parse(raw);
    const gameDir = resolve(gamesDir, config.id);
    await mkdir(resolve(gameDir, 'media'), { recursive: true });
    await writeFile(resolve(gameDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');
    console.log(`✓ Importado: ${config.name} (${config.id})`);
  }

  console.log(`\n${jsonFiles.length} jogo(s) importado(s) para data/games/`);
  console.log('Inicie o servidor e acesse http://localhost:5173 para jogar.');
}

seed().catch((err) => {
  console.error('Erro no seed:', err);
  process.exit(1);
});
