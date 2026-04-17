import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingView } from './views/LandingView.js';
import { HostSetupView } from './views/HostSetupView.js';
import { LobbyView } from './views/LobbyView.js';
import { HostBoardView } from './views/host/HostBoardView.js';
import { PlayerGameView } from './views/player/PlayerGameView.js';
import { EditorView } from './views/editor/EditorView.js';
import { JoinView } from './views/JoinView.js';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingView />} />
        <Route path="/host" element={<HostSetupView />} />
        <Route path="/host/:sessionId" element={<LobbyView />} />
        <Route path="/host/:sessionId/board" element={<HostBoardView />} />
        <Route path="/game/:sessionId/player" element={<PlayerGameView />} />
        <Route path="/join/:sessionId" element={<JoinView />} />
        <Route path="/editor" element={<EditorView />} />
        <Route path="/editor/:gameId" element={<EditorView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
