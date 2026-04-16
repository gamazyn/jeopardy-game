# Jeopardy!

Jeopardy customizável para jogar online com seus amigos. O host controla o board numa tela grande enquanto os jogadores se conectam pelo celular ou PC para apertar o buzzer.

## Funcionalidades

- **Board customizável** — categorias, questões e valores configuráveis
- **Buzzer online** — fila ordenada por timestamp server-side (sem trapaças)
- **Questões especiais** — Todos Jogam, Desafie um Jogador, Dupla Aposta
- **Desafio Final** — apostas em segredo, revelação dramática pelo host
- **Timer** — 60s padrão, com pause, extensão e valor customizado
- **Mídia** — imagens nas questões e categorias
- **Acesso remoto** — tunnel automático via localtunnel, sem configuração

## Requisitos

- [Node.js](https://nodejs.org) v20+
- [pnpm](https://pnpm.io) v9+

## Instalação

```bash
git clone https://github.com/gamazyn/jeopardy-game
cd jeopardy-game
pnpm install
```

## Rodando em desenvolvimento

```bash
pnpm dev
```

Isso inicia o servidor (`:3000`) e o cliente (`:5173`) em paralelo.

Acesse **http://localhost:5173** no browser.

## Como jogar

### 1. Criar um jogo

1. Abra o app e clique em **Editor de Jogos**
2. Adicione categorias e preencha as questões
3. Configure o Desafio Final (opcional)
4. Clique em **Salvar**

### 2. Hospedar uma sala

1. Na tela inicial, clique em **Hospedar Jogo**
2. Selecione o jogo criado e clique em **Criar Sala**
3. Compartilhe o **código de 6 letras** ou o **link do tunnel** com seus amigos
4. Quando todos entrarem, clique em **Iniciar Jogo**

### 3. Entrar como jogador

1. Acesse o link compartilhado pelo host (ou abra o app manualmente)
2. Digite seu nome e o código da sala
3. Aguarde o host iniciar

### 4. Fluxo do jogo

- O host clica em uma questão do board para revelá-la
- Os jogadores pressionam **BUZZ** para responder
- A fila de buzzers aparece para o host em ordem de quem apertou primeiro
- O host julga a resposta: **Correto** (+pontos) ou **Errado** (−pontos)
- Quando todas as questões forem respondidas, o **Desafio Final** é habilitado automaticamente

## Estrutura do Projeto

```
jeopardy-game/
├── packages/
│   ├── shared/     # Tipos TypeScript e utilitários compartilhados
│   ├── server/     # Backend Node.js + Express + Socket.io
│   └── client/     # Frontend React + Vite + Tailwind
```

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind + Framer Motion |
| Backend | Node.js + Express + Socket.io |
| Monorepo | pnpm workspaces + Turborepo |
| Tunnel | localtunnel |

## Scripts

| Comando | Descrição |
|---|---|
| `pnpm dev` | Inicia server + client em modo dev |
| `pnpm build` | Build de produção |
| `pnpm type-check` | Checa tipos em todos os packages |

## Licença

MIT
