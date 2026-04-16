import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
const randomUUID = () => crypto.randomUUID();
import type { GameConfig, Category, Question } from '@jeopardy/shared';

const DEFAULT_VALUES = [100, 200, 300, 400, 500];

function emptyQuestion(value: number): Question {
  return {
    id: randomUUID(),
    value,
    clue: '',
    answer: '',
    type: 'standard',
    used: false,
  };
}

function emptyCategory(): Category {
  return {
    id: randomUUID(),
    name: '',
    questions: DEFAULT_VALUES.map(emptyQuestion),
  };
}

function emptyGame(): Omit<GameConfig, 'id' | 'version' | 'createdAt' | 'updatedAt'> {
  return {
    name: '',
    description: '',
    categories: [emptyCategory(), emptyCategory(), emptyCategory(), emptyCategory(), emptyCategory()],
    defaultTimer: 60,
    finalChallengeEnabled: true,
    finalChallengeClue: '',
    finalChallengeAnswer: '',
  };
}

export function EditorView() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId?: string }>();
  const [game, setGame] = useState<ReturnType<typeof emptyGame>>(emptyGame());
  const [selectedCat, setSelectedCat] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (gameId) {
      fetch(`/api/games/${gameId}`)
        .then((r) => r.json())
        .then((data: GameConfig) => {
          setGame({
            name: data.name,
            description: data.description ?? '',
            categories: data.categories,
            defaultTimer: data.defaultTimer,
            finalChallengeEnabled: data.finalChallengeEnabled,
            finalChallengeClue: data.finalChallengeClue,
            finalChallengeAnswer: data.finalChallengeAnswer,
            finalChallengeMedia: data.finalChallengeMedia,
          });
        })
        .catch(() => setError('Erro ao carregar jogo'));
    }
  }, [gameId]);

  function updateCategory(idx: number, update: Partial<Category>) {
    setGame((g) => ({
      ...g,
      categories: g.categories.map((c, i) => (i === idx ? { ...c, ...update } : c)),
    }));
  }

  function updateQuestion(catIdx: number, qIdx: number, update: Partial<Question>) {
    setGame((g) => ({
      ...g,
      categories: g.categories.map((c, ci) =>
        ci !== catIdx
          ? c
          : { ...c, questions: c.questions.map((q, qi) => (qi !== qIdx ? q : { ...q, ...update })) },
      ),
    }));
  }

  function addCategory() {
    setGame((g) => ({ ...g, categories: [...g.categories, emptyCategory()] }));
    setSelectedCat(game.categories.length);
  }

  function removeCategory(idx: number) {
    if (game.categories.length <= 1) return;
    setGame((g) => ({ ...g, categories: g.categories.filter((_, i) => i !== idx) }));
    setSelectedCat((c) => Math.min(c, game.categories.length - 2));
  }

  async function save() {
    setSaving(true);
    setError('');
    try {
      const url = gameId ? `/api/games/${gameId}` : '/api/games';
      const method = gameId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(game),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Erro ao salvar');
      } else {
        navigate('/host');
      }
    } catch {
      setError('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const cat = game.categories[selectedCat];

  return (
    <div className="min-h-screen flex flex-col p-4 gap-4">
      <div className="flex items-center gap-4">
        <button className="btn-ghost py-2 px-4 text-sm" onClick={() => navigate('/')}>← Voltar</button>
        <input
          type="text"
          placeholder="Nome do jogo"
          value={game.name}
          onChange={(e) => setGame((g) => ({ ...g, name: e.target.value }))}
          className="flex-1 bg-jeopardy-blue-light border-2 border-jeopardy-gold rounded-lg px-4 py-2 text-white text-xl font-bold focus:outline-none"
        />
        <button className="btn-primary" onClick={save} disabled={saving || !game.name.trim()}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {error && <p className="text-red-400 text-center">{error}</p>}

      <div className="flex gap-4 flex-1">
        {/* Sidebar de categorias */}
        <div className="w-48 flex flex-col gap-2">
          <h3 className="text-jeopardy-gold text-sm font-bold uppercase tracking-wider">Categorias</h3>
          {game.categories.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(i)}
              className={`text-left py-2 px-3 rounded-lg text-sm truncate ${
                selectedCat === i
                  ? 'bg-jeopardy-gold text-jeopardy-blue font-bold'
                  : 'bg-slate-800/40 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {c.name || `Categoria ${i + 1}`}
            </button>
          ))}
          <button className="btn-ghost text-sm py-2 mt-2" onClick={addCategory}>+ Adicionar</button>
        </div>

        {/* Editor da categoria */}
        {cat && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Nome da categoria"
                value={cat.name}
                onChange={(e) => updateCategory(selectedCat, { name: e.target.value })}
                className="flex-1 bg-jeopardy-blue-light border-2 border-slate-500 rounded-lg px-4 py-2 text-white text-lg font-bold focus:outline-none focus:border-jeopardy-gold"
              />
              {game.categories.length > 1 && (
                <button
                  className="text-red-400 hover:text-red-300 text-sm px-3 py-2 border border-red-400 rounded-lg"
                  onClick={() => removeCategory(selectedCat)}
                >
                  Remover
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {cat.questions.map((q, qi) => (
                <div key={q.id} className="card flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-jeopardy-gold font-bold">$</span>
                    <input
                      type="number"
                      value={q.value}
                      onChange={(e) => updateQuestion(selectedCat, qi, { value: Number(e.target.value) })}
                      className="w-24 bg-jeopardy-blue border border-slate-600 rounded px-2 py-1 text-jeopardy-gold font-bold text-center"
                    />
                    <select
                      value={q.type}
                      onChange={(e) => updateQuestion(selectedCat, qi, { type: e.target.value as Question['type'] })}
                      className="bg-jeopardy-blue border border-slate-600 rounded px-2 py-1 text-slate-300 text-sm"
                    >
                      <option value="standard">Normal</option>
                      <option value="all_play">Todos Jogam</option>
                      <option value="challenge">Desafie um Jogador</option>
                      <option value="double">Dupla Aposta</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Timer (s)"
                      value={q.timeOverride ?? ''}
                      onChange={(e) =>
                        updateQuestion(selectedCat, qi, {
                          timeOverride: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      className="w-24 bg-jeopardy-blue border border-slate-600 rounded px-2 py-1 text-slate-300 text-sm text-center"
                    />
                  </div>
                  <textarea
                    placeholder="Clue (o que aparece na tela)"
                    value={q.clue}
                    onChange={(e) => updateQuestion(selectedCat, qi, { clue: e.target.value })}
                    rows={2}
                    className="w-full bg-jeopardy-blue border border-slate-600 rounded px-3 py-2 text-white resize-none focus:outline-none focus:border-jeopardy-gold"
                  />
                  <input
                    type="text"
                    placeholder="Resposta (visível apenas ao host)"
                    value={q.answer}
                    onChange={(e) => updateQuestion(selectedCat, qi, { answer: e.target.value })}
                    className="w-full bg-jeopardy-blue border border-slate-600 rounded px-3 py-2 text-slate-400 focus:outline-none focus:border-jeopardy-gold"
                  />
                </div>
              ))}
            </div>

            {/* Configurações do Desafio Final */}
            <div className="card mt-4">
              <h3 className="text-jeopardy-gold font-bold mb-4">Desafio Final</h3>
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={game.finalChallengeEnabled}
                  onChange={(e) => setGame((g) => ({ ...g, finalChallengeEnabled: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-slate-300">Habilitar Desafio Final</span>
              </label>
              {game.finalChallengeEnabled && (
                <>
                  <textarea
                    placeholder="Clue do Desafio Final"
                    value={game.finalChallengeClue}
                    onChange={(e) => setGame((g) => ({ ...g, finalChallengeClue: e.target.value }))}
                    rows={2}
                    className="w-full bg-jeopardy-blue border border-slate-600 rounded px-3 py-2 text-white resize-none mb-2 focus:outline-none focus:border-jeopardy-gold"
                  />
                  <input
                    type="text"
                    placeholder="Resposta do Desafio Final"
                    value={game.finalChallengeAnswer}
                    onChange={(e) => setGame((g) => ({ ...g, finalChallengeAnswer: e.target.value }))}
                    className="w-full bg-jeopardy-blue border border-slate-600 rounded px-3 py-2 text-slate-400 focus:outline-none focus:border-jeopardy-gold"
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
