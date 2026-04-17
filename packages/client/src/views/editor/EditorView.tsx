import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
const randomUUID = () => crypto.randomUUID();
import type { GameConfig, Category, Question, MediaAsset } from '@jeopardy/shared';

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

interface MediaUploadProps {
  gameId: string;
  media?: MediaAsset;
  label?: string;
  accept?: string;
  onUpload: (asset: MediaAsset) => void;
  onRemove: () => void;
}

function MediaUpload({ gameId, media, label = '+ Mídia', accept = 'image/*,audio/*', onUpload, onRemove }: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (media) {
      await fetch(`/api/games/${gameId}/media/${media.filename}`, { method: 'DELETE' }).catch(() => {});
    }

    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/games/${gameId}/media`, { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json();
        setUploadError(data.error ?? 'Erro ao enviar');
      } else {
        const { filename, type } = await res.json();
        onUpload({ type: type as MediaAsset['type'], filename });
      }
    } catch {
      setUploadError('Erro ao enviar');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleRemove() {
    if (!media) return;
    await fetch(`/api/games/${gameId}/media/${media.filename}`, { method: 'DELETE' }).catch(() => {});
    onRemove();
  }

  if (media) {
    return (
      <div className="flex items-center gap-2 mt-1">
        {media.type === 'audio' ? (
          <audio src={`/media/${gameId}/${media.filename}`} controls className="h-10 max-w-[200px]" />
        ) : (
          <img src={`/media/${gameId}/${media.filename}`} alt="" className="h-12 w-auto rounded object-cover border border-slate-600" />
        )}
        <label className="cursor-pointer btn-ghost text-xs py-1 px-2">
          {uploading ? 'Enviando...' : 'Trocar'}
          <input type="file" accept={accept} className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        <button
          type="button"
          onClick={handleRemove}
          className="text-red-400 text-xs hover:text-red-300 border border-red-400 rounded px-2 py-1"
        >
          Remover
        </button>
        {uploadError && <span className="text-red-400 text-xs">{uploadError}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <label className="cursor-pointer btn-ghost text-xs py-1 px-2">
        {uploading ? 'Enviando...' : label}
        <input type="file" accept={accept} className="hidden" onChange={handleFile} disabled={uploading} />
      </label>
      {uploadError && <span className="text-red-400 text-xs">{uploadError}</span>}
    </div>
  );
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

  function addQuestion(catIdx: number) {
    setGame((g) => {
      const cat = g.categories[catIdx];
      if (cat.questions.length >= 10) return g;
      const lastValue = cat.questions[cat.questions.length - 1]?.value ?? 0;
      const newValue = lastValue + 100;
      const newQ = emptyQuestion(newValue);
      return {
        ...g,
        categories: g.categories.map((c, i) =>
          i === catIdx ? { ...c, questions: [...c.questions, newQ] } : c,
        ),
      };
    });
  }

  function removeQuestion(catIdx: number, qIdx: number) {
    setGame((g) => {
      const cat = g.categories[catIdx];
      if (cat.questions.length <= 1) return g;
      return {
        ...g,
        categories: g.categories.map((c, i) =>
          i === catIdx ? { ...c, questions: c.questions.filter((_, qi) => qi !== qIdx) } : c,
        ),
      };
    });
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
      } else if (!gameId) {
        const created: GameConfig = await res.json();
        navigate(`/editor/${created.id}`);
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
          {saving ? 'Salvando...' : gameId ? 'Salvar' : 'Criar e Continuar'}
        </button>
      </div>

      {error && <p className="text-red-400 text-center">{error}</p>}

      {/* Descrição */}
      <input
        type="text"
        placeholder="Descrição (opcional)"
        value={game.description}
        onChange={(e) => setGame((g) => ({ ...g, description: e.target.value }))}
        maxLength={500}
        className="bg-jeopardy-blue-light border border-slate-500 rounded-lg px-4 py-2 text-slate-300 text-sm focus:outline-none focus:border-jeopardy-gold"
      />

      {!gameId && (
        <p className="text-slate-400 text-xs text-center">
          Salve o jogo primeiro para poder adicionar imagens às questões.
        </p>
      )}

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
              {gameId && (
                <div className="flex-shrink-0">
                  <MediaUpload
                    gameId={gameId}
                    media={cat.media}
                    label="+ Imagem do Header"
                    onUpload={(asset) => updateCategory(selectedCat, { media: asset })}
                    onRemove={() => updateCategory(selectedCat, { media: undefined })}
                  />
                </div>
              )}
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
                  <div className="flex items-center gap-3 flex-wrap">
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
                      <option value="challenge">Desafio</option>
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
                    {cat.questions.length > 1 && (
                      <button
                        type="button"
                        className="ml-auto text-red-400 text-xs hover:text-red-300 border border-red-400 rounded px-2 py-1"
                        onClick={() => removeQuestion(selectedCat, qi)}
                      >
                        Remover
                      </button>
                    )}
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
                  {q.type === 'challenge' && (
                    <input
                      type="text"
                      placeholder="Dica do alvo (ex: jogador mais pontuado) — opcional"
                      value={q.challengeTarget ?? ''}
                      onChange={(e) => updateQuestion(selectedCat, qi, { challengeTarget: e.target.value || undefined })}
                      className="w-full bg-jeopardy-blue border border-orange-500/40 rounded px-3 py-2 text-orange-300 text-sm focus:outline-none focus:border-orange-500"
                    />
                  )}
                  {gameId && (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-1">
                      <div>
                        <span className="text-slate-500 text-xs">Imagem do clue</span>
                        <MediaUpload
                          gameId={gameId} media={q.media} label="+ Imagem" accept="image/*"
                          onUpload={(asset) => updateQuestion(selectedCat, qi, { media: asset })}
                          onRemove={() => updateQuestion(selectedCat, qi, { media: undefined })}
                        />
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Áudio do clue</span>
                        <MediaUpload
                          gameId={gameId} media={q.clueAudio} label="+ Áudio" accept="audio/*"
                          onUpload={(asset) => updateQuestion(selectedCat, qi, { clueAudio: asset })}
                          onRemove={() => updateQuestion(selectedCat, qi, { clueAudio: undefined })}
                        />
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Imagem da resposta</span>
                        <MediaUpload
                          gameId={gameId} media={q.answerMedia} label="+ Imagem" accept="image/*"
                          onUpload={(asset) => updateQuestion(selectedCat, qi, { answerMedia: asset })}
                          onRemove={() => updateQuestion(selectedCat, qi, { answerMedia: undefined })}
                        />
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Áudio da resposta</span>
                        <MediaUpload
                          gameId={gameId} media={q.answerAudio} label="+ Áudio" accept="audio/*"
                          onUpload={(asset) => updateQuestion(selectedCat, qi, { answerAudio: asset })}
                          onRemove={() => updateQuestion(selectedCat, qi, { answerAudio: undefined })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {cat.questions.length < 10 && (
                <button
                  type="button"
                  className="btn-ghost text-sm py-2 mt-1"
                  onClick={() => addQuestion(selectedCat)}
                >
                  + Questão
                </button>
              )}
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
                    className="w-full bg-jeopardy-blue border border-slate-600 rounded px-3 py-2 text-slate-400 focus:outline-none focus:border-jeopardy-gold mb-2"
                  />
                  {gameId && (
                    <MediaUpload
                      gameId={gameId}
                      media={game.finalChallengeMedia}
                      onUpload={(asset) => setGame((g) => ({ ...g, finalChallengeMedia: asset }))}
                      onRemove={() => setGame((g) => ({ ...g, finalChallengeMedia: undefined }))}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
