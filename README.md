# Responde Aí!

Quiz show customizável para jogar online com seus amigos. O host controla o board numa tela grande enquanto os jogadores se conectam pelo celular ou PC para apertar o buzzer.

## Funcionalidades

- **Board customizável** — categorias, questões e valores configuráveis
- **Buzzer online** — fila ordenada por timestamp server-side (sem trapaças)
- **Questões especiais** — Todos Jogam, Desafie um Jogador, Dupla Aposta
- **Desafio Final** — apostas em segredo, revelação dramática pelo host
- **Timer** — 60s padrão, com pause, extensão e valor customizado
- **Mídia** — imagens e áudio nas questões e categorias
- **QR Code** — jogadores escaneiam e entram direto na sala, sem digitar código
- **Acesso remoto** — tunnel automático via localtunnel, sem configuração
- **App desktop** — versão Electron para Windows, Mac e Linux

## Download

Baixe o instalador mais recente na página de [Releases](https://github.com/gamazyn/responde-ai/releases):

| Plataforma | Arquivo |
|---|---|
| Windows | `responde-ai-*-x64.exe` (instalador) |
| macOS (Apple Silicon) | `responde-ai-*-arm64.zip` |
| macOS (Intel) | `responde-ai-*-x64.zip` |
| Linux | `responde-ai-*-x86_64.AppImage` |

> **Nota sobre segurança:** os binários não são assinados com certificado digital pago. Veja as instruções abaixo para cada plataforma.

### Windows

O SmartScreen pode exibir um aviso ao abrir o instalador. Para prosseguir:

1. Clique em **Mais informações**
2. Clique em **Executar assim mesmo**

### macOS

O Gatekeeper bloqueará a abertura na primeira vez. Para liberar o app:

```sh
xattr -dr com.apple.quarantine /Applications/Responde\ Aí\!.app
```

Ou, alternativamente: clique com o botão direito no app → **Abrir** → **Abrir** na janela de confirmação.

### Linux

Torne o AppImage executável e execute diretamente:

```sh
chmod +x responde-ai-*.AppImage
./responde-ai-*.AppImage
```

## Requisitos (modo dev)

- [Node.js](https://nodejs.org) v20+
- [pnpm](https://pnpm.io) v9+

## Instalação

```bash
git clone https://github.com/gamazyn/responde-ai
cd responde-ai
pnpm install
```

### Carregar jogo de teste

Para testar rapidamente sem criar um jogo do zero:

```bash
pnpm seed
```

Isso importa o **Jogo de Teste** da pasta `samples/` para `data/games/`. O jogo contém 5 categorias (Geografia, Ciência, Cultura Pop, História, Esportes) com 5 questões cada, incluindo questões especiais como *Todos Jogam* e *Desafie um Jogador*.

## Rodando em desenvolvimento

```bash
pnpm dev
```

Isso inicia o servidor (`:3000`) e o cliente (`:5173`) em paralelo.

Acesse **http://localhost:5173** no browser.

### App Electron em desenvolvimento

Com o `pnpm dev` rodando, abra outro terminal:

```bash
pnpm electron:dev
```

## Como jogar

### 1. Criar um jogo

1. Abra o app e clique em **Editor de Jogos**
2. Adicione categorias e preencha as questões
3. Configure o Desafio Final (opcional)
4. Clique em **Salvar**

### 2. Hospedar uma sala

1. Na tela inicial, clique em **Hospedar Jogo**
2. Selecione o jogo criado e clique em **Criar Sala**
3. Compartilhe o **QR Code** (mesma rede) ou o **link remoto** com seus amigos
4. Quando todos entrarem, clique em **Iniciar Jogo**

### 3. Entrar como jogador

- **QR Code** — escaneie com a câmera, digite o nome e entre direto
- **Link remoto** — acesse o link compartilhado pelo host
- **Manualmente** — abra o app, digite seu nome e o código de 6 letras

### 4. Fluxo do jogo

- O host clica em uma questão do board para revelá-la
- Os jogadores pressionam **BUZZ** para responder
- A fila de buzzers aparece para o host em ordem de quem apertou primeiro
- O host julga a resposta: **Correto** (+pontos) ou **Errado** (−pontos)
- Quando todas as questões forem respondidas, o **Desafio Final** é habilitado automaticamente

## Estrutura do Projeto

```
responde-ai/
├── packages/
│   ├── shared/     # Tipos TypeScript e utilitários compartilhados
│   ├── server/     # Backend Node.js + Express + Socket.io
│   ├── client/     # Frontend React + Vite + Tailwind
│   └── electron/   # App desktop (Electron + auto-updater)
```

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind + Framer Motion |
| Backend | Node.js + Express + Socket.io |
| Desktop | Electron + electron-builder + electron-updater |
| Monorepo | pnpm workspaces + Turborepo |
| Tunnel | localtunnel |

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | Inicia server + client em modo dev |
| `pnpm electron:dev` | Abre janela Electron (requer `pnpm dev` rodando) |
| `pnpm build` | Build de produção |
| `pnpm type-check` | Checa tipos em todos os packages |
| `pnpm test` | Roda todos os testes |
| `pnpm seed` | Importa os jogos de exemplo de `samples/` para `data/` |

## Licença

[GPL-3.0](LICENSE)
