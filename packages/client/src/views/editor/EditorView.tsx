import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
const randomUUID = () => crypto.randomUUID();
import type { GameConfig, Category, Question, MediaAsset } from '@responde-ai/shared';

const DEFAULT_VALUES = [100, 200, 300, 400, 500];
const FINAL_IDX = -1;

const TYPE_META: Record<Question['type'], { label: string; color: string; bg: string }> = {
  standard:    { label: 'Normal',          color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  all_play:    { label: 'Todos Jogam',     color: '#facc15', bg: 'rgba(250,204,21,0.12)'  },
  challenge:   { label: 'Desafio',         color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  double:      { label: 'Dupla Aposta',    color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
  speed_round: { label: 'Rodada Rápida',   color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
};

function emptyQuestion(value: number): Question {
  return { id: randomUUID(), value, clue: '', answer: '', type: 'standard', used: false };
}

function emptyCategory(): Category {
  return { id: randomUUID(), name: '', questions: DEFAULT_VALUES.map(emptyQuestion) };
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
      <div className="flex items-center gap-2 flex-wrap">
        {media.type === 'audio' ? (
          <audio src={`/media/${gameId}/${media.filename}`} controls className="h-8 max-w-[180px]" />
        ) : (
          <img src={`/media/${gameId}/${media.filename}`} alt="" className="h-10 w-auto rounded-md object-cover border border-slate-700" />
        )}
        <label className="cursor-pointer text-xs font-ui text-jeopardy-gold border border-jeopardy-gold/40 rounded-lg px-2.5 py-1 hover:bg-jeopardy-gold/10 transition-colors">
          {uploading ? '...' : 'Trocar'}
          <input type="file" accept={accept} className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        <button type="button" onClick={handleRemove} className="text-red-400 text-xs hover:text-red-300 border border-red-500/40 rounded-lg px-2.5 py-1 hover:bg-red-500/10 transition-colors">
          ✕
        </button>
        {uploadError && <span className="text-red-400 text-xs">{uploadError}</span>}
      </div>
    );
  }

  return (
    <div>
      <label className="cursor-pointer text-sm font-ui text-slate-300 rounded-lg px-3 py-2 hover:border-jeopardy-gold/60 hover:text-jeopardy-gold transition-colors flex items-center gap-1.5" style={{ border: '1px dashed #3a5272', background: 'rgba(10,18,35,0.8)' }}>
        <span className="text-base leading-none">+</span>
        {uploading ? 'Enviando...' : label}
        <input type="file" accept={accept} className="hidden" onChange={handleFile} disabled={uploading} />
      </label>
      {uploadError && <span className="text-red-400 text-xs mt-1 block">{uploadError}</span>}
    </div>
  );
}

export function EditorView() {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId?: string }>();
  const [game, setGame] = useState<ReturnType<typeof emptyGame>>(emptyGame());
  const [selectedCat, setSelectedCat] = useState(0);
  const [selectedQ, setSelectedQ] = useState(0);
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
    setGame((g) => ({ ...g, categories: g.categories.map((c, i) => (i === idx ? { ...c, ...update } : c)) }));
  }

  function updateQuestion(catIdx: number, qIdx: number, update: Partial<Question>) {
    setGame((g) => ({
      ...g,
      categories: g.categories.map((c, ci) =>
        ci !== catIdx ? c : { ...c, questions: c.questions.map((q, qi) => (qi !== qIdx ? q : { ...q, ...update })) },
      ),
    }));
  }

  function addCategory() {
    setGame((g) => ({ ...g, categories: [...g.categories, emptyCategory()] }));
    setSelectedCat(game.categories.length);
    setSelectedQ(0);
  }

  function removeCategory(idx: number) {
    if (game.categories.length <= 1) return;
    setGame((g) => ({ ...g, categories: g.categories.filter((_, i) => i !== idx) }));
    setSelectedCat((c) => Math.min(c, game.categories.length - 2));
    setSelectedQ(0);
  }

  function addQuestion(catIdx: number) {
    setGame((g) => {
      const cat = g.categories[catIdx];
      if (cat.questions.length >= 10) return g;
      const lastValue = cat.questions[cat.questions.length - 1]?.value ?? 0;
      return {
        ...g,
        categories: g.categories.map((c, i) =>
          i === catIdx ? { ...c, questions: [...c.questions, emptyQuestion(lastValue + 100)] } : c,
        ),
      };
    });
    setSelectedQ(game.categories[catIdx].questions.length);
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
    setSelectedQ((q) => Math.min(q, game.categories[catIdx].questions.length - 2));
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

  const isFinal = selectedCat === FINAL_IDX;
  const cat = isFinal ? null : game.categories[selectedCat];
  const q = cat?.questions[selectedQ];
  const qMeta = q ? TYPE_META[q.type] : null;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background: '#0F172A',
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, #1a2e45 0%, #0F172A 65%)',
      }}
    >
      {/* grid background sutil */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(232,184,75,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(232,184,75,0.03) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          zIndex: 0,
        }}
      />
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 h-14 border-b relative z-10"
        style={{ background: 'rgba(10,18,35,0.85)', backdropFilter: 'blur(8px)', borderColor: '#1a2535' }}
      >
        <button
          className="btn-ghost text-sm py-1.5 px-3 flex-shrink-0"
          onClick={() => navigate('/')}
        >
          ← Voltar
        </button>
        <div className="w-px h-5 bg-slate-800 flex-shrink-0" />
        <input
          type="text"
          placeholder="Nome do quiz..."
          value={game.name}
          onChange={(e) => setGame((g) => ({ ...g, name: e.target.value }))}
          className="flex-1 bg-transparent border-none text-white font-arcade text-base focus:outline-none min-w-0"
          style={{ caretColor: '#E8B84B', letterSpacing: '0.05em' }}
        />
        {error && <p className="text-red-400 text-xs font-ui flex-shrink-0">{error}</p>}
        {!gameId && (
          <span className="text-amber-600/70 font-ui text-xs flex-shrink-0 hidden sm:block">
            💡 Salve para adicionar mídia
          </span>
        )}
        <button
          className="btn-primary flex-shrink-0 py-2 px-5 text-sm"
          onClick={save}
          disabled={saving || !game.name.trim()}
        >
          {saving ? 'Salvando...' : gameId ? '✓ Salvar' : 'Criar →'}
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative z-10">

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────── */}
        <div
          className="w-52 flex-shrink-0 flex flex-col border-r overflow-hidden"
          style={{ background: '#070e1a', borderColor: '#1a2535' }}
        >
          {/* Category list */}
          <div className="flex-shrink-0 p-3 border-b" style={{ borderColor: '#1a2535' }}>
            <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mb-2 px-1">Categorias</p>
            <div className="flex flex-col gap-1">
              {game.categories.map((c, i) => (
                <div key={c.id} className="group relative">
                  <button
                    onClick={() => { setSelectedCat(i); setSelectedQ(0); }}
                    className={`category-tab w-full pr-7 ${selectedCat === i ? 'active' : ''}`}
                  >
                    {c.name || `Categoria ${i + 1}`}
                  </button>
                  {game.categories.length > 1 && (
                    <button
                      onClick={() => removeCategory(i)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs w-5 h-5 flex items-center justify-center rounded"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                className="w-full mt-1 py-2 px-3 rounded-lg text-slate-400 hover:text-jeopardy-gold font-ui text-xs border border-dashed border-slate-800 hover:border-jeopardy-gold/30 transition-all"
                onClick={addCategory}
              >
                + Categoria
              </button>
            </div>
          </div>

          {/* Question miniatures */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mb-1 px-1 flex-shrink-0">Questões</p>
            {cat?.questions.map((qItem, qi) => {
              const isActive = !isFinal && selectedQ === qi;
              const meta = TYPE_META[qItem.type];
              return (
                <button
                  key={qItem.id}
                  onClick={() => setSelectedQ(qi)}
                  className="w-full text-left rounded-xl p-2.5 transition-all duration-150 flex items-center gap-2.5"
                  style={{
                    background: isActive ? 'linear-gradient(160deg, #1e3a5f 0%, #0d1f33 100%)' : 'rgba(255,255,255,0.03)',
                    border: isActive ? '1px solid rgba(232,184,75,0.5)' : '1px solid rgba(255,255,255,0.07)',
                    borderLeft: isActive ? '2px solid #E8B84B' : '2px solid transparent',
                  }}
                >
                  <span
                    className="font-mono font-bold text-sm leading-none flex-shrink-0 w-10 text-right"
                    style={{
                      color: isActive ? '#E8B84B' : '#94a3b8',
                      textShadow: isActive ? '0 0 10px rgba(232,184,75,0.4)' : 'none',
                    }}
                  >
                    ${qItem.value}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-ui truncate" style={{ color: isActive ? '#e2e8f0' : '#64748b' }}>
                      {qItem.clue || <span className="italic" style={{ color: '#334155' }}>sem clue</span>}
                    </p>
                    {qItem.type !== 'standard' && (
                      <span className="text-[10px] font-mono font-bold" style={{ color: meta.color }}>
                        {meta.label}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {cat && cat.questions.length < 10 && (
              <button
                type="button"
                className="w-full mt-1 py-2 px-3 rounded-xl font-ui text-xs text-slate-400 hover:text-jeopardy-gold border border-dashed border-slate-800 hover:border-jeopardy-gold/30 transition-all"
                onClick={() => addQuestion(selectedCat)}
              >
                + Questão
              </button>
            )}
          </div>

          {/* Desafio Final entry */}
          <div className="flex-shrink-0 p-2 border-t" style={{ borderColor: '#1a2535' }}>
            <button
              onClick={() => setSelectedCat(FINAL_IDX)}
              className="w-full text-left rounded-xl p-3 transition-all duration-150 flex items-center gap-2.5"
              style={{
                background: isFinal
                  ? 'linear-gradient(160deg, #1e3a20 0%, #0d1f10 100%)'
                  : 'rgba(255,255,255,0.02)',
                border: isFinal ? '1px solid rgba(232,184,75,0.4)' : '1px solid rgba(255,255,255,0.04)',
                borderLeft: isFinal ? '2px solid #E8B84B' : '2px solid rgba(255,255,255,0.04)',
              }}
            >
              <span className="text-base leading-none flex-shrink-0">🏆</span>
              <div className="min-w-0">
                <p
                  className="font-arcade text-xs uppercase tracking-wider leading-none"
                  style={{ color: isFinal ? '#E8B84B' : '#475569' }}
                >
                  Desafio Final
                </p>
                <p className="text-[10px] font-ui mt-0.5" style={{ color: game.finalChallengeEnabled ? '#4ade80' : '#475569' }}>
                  {game.finalChallengeEnabled ? 'habilitado' : 'desabilitado'}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">

          {/* ── Normal category editor ── */}
          {cat && !isFinal && (
            <>
              {/* Category header — visually separated */}
              <div
                className="flex-shrink-0 px-8 pt-8 pb-6 border-b"
                style={{ borderColor: '#1a2535' }}
              >
                <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mb-2">Categoria</p>
                <div className="flex items-center gap-4 mb-3">
                  <input
                    type="text"
                    placeholder="NOME DA CATEGORIA"
                    value={cat.name}
                    onChange={(e) => updateCategory(selectedCat, { name: e.target.value })}
                    className="editor-input flex-1 font-arcade text-2xl uppercase"
                    style={{ caretColor: '#E8B84B', letterSpacing: '0.1em' }}
                  />
                  <span className="text-slate-400 font-mono text-sm flex-shrink-0">
                    {selectedQ + 1} / {cat.questions.length}
                  </span>
                  {gameId && (
                    <MediaUpload
                      gameId={gameId}
                      media={cat.media}
                      label="+ Header"
                      onUpload={(asset) => updateCategory(selectedCat, { media: asset })}
                      onRemove={() => updateCategory(selectedCat, { media: undefined })}
                    />
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Descrição do quiz (opcional)"
                  value={game.description}
                  onChange={(e) => setGame((g) => ({ ...g, description: e.target.value }))}
                  maxLength={500}
                  className="editor-input font-ui text-sm"
                  style={{ caretColor: '#E8B84B' }}
                />
              </div>

              {/* Question fields */}
              {q && (
                <div className="flex-1 px-8 py-6 flex flex-col gap-6">
                  {/* Clue */}
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2">
                      <span className="font-mono text-xs uppercase tracking-widest font-bold" style={{ color: '#E8B84B' }}>
                        Clue
                      </span>
                      <span className="text-slate-400 font-ui text-xs">— aparece na tela para os jogadores</span>
                    </label>
                    <textarea
                      placeholder="Digite a pista aqui..."
                      value={q.clue}
                      onChange={(e) => updateQuestion(selectedCat, selectedQ, { clue: e.target.value })}
                      rows={4}
                      className="editor-textarea font-ui text-base leading-relaxed"
                    />
                    {gameId && (
                      <div className="flex gap-4 mt-1">
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-400 font-mono text-xs uppercase tracking-wider">Imagem</span>
                          <MediaUpload gameId={gameId} media={q.media} label="Adicionar imagem" accept="image/*"
                            onUpload={(asset) => updateQuestion(selectedCat, selectedQ, { media: asset })}
                            onRemove={() => updateQuestion(selectedCat, selectedQ, { media: undefined })} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-400 font-mono text-xs uppercase tracking-wider">Áudio</span>
                          <MediaUpload gameId={gameId} media={q.clueAudio} label="Adicionar áudio" accept="audio/*"
                            onUpload={(asset) => updateQuestion(selectedCat, selectedQ, { clueAudio: asset })}
                            onRemove={() => updateQuestion(selectedCat, selectedQ, { clueAudio: undefined })} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Answer */}
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2">
                      <span className="font-mono text-xs uppercase tracking-widest font-bold text-slate-400">
                        Resposta
                      </span>
                      <span className="text-slate-400 font-ui text-xs">— visível apenas ao host</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Resposta correta..."
                      value={q.answer}
                      onChange={(e) => updateQuestion(selectedCat, selectedQ, { answer: e.target.value })}
                      className="editor-input font-ui text-sm"
                      style={{ color: '#cbd5e1' }}
                    />
                    {gameId && (
                      <div className="flex gap-4 mt-1">
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-400 font-mono text-xs uppercase tracking-wider">Imagem</span>
                          <MediaUpload gameId={gameId} media={q.answerMedia} label="Adicionar imagem" accept="image/*"
                            onUpload={(asset) => updateQuestion(selectedCat, selectedQ, { answerMedia: asset })}
                            onRemove={() => updateQuestion(selectedCat, selectedQ, { answerMedia: undefined })} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-400 font-mono text-xs uppercase tracking-wider">Áudio</span>
                          <MediaUpload gameId={gameId} media={q.answerAudio} label="Adicionar áudio" accept="audio/*"
                            onUpload={(asset) => updateQuestion(selectedCat, selectedQ, { answerAudio: asset })}
                            onRemove={() => updateQuestion(selectedCat, selectedQ, { answerAudio: undefined })} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Challenge target — dica visível ao host durante o duelo */}
                  {q.type === 'challenge' && (
                    <div className="flex flex-col gap-2">
                      <label className="font-mono text-xs uppercase tracking-widest font-bold" style={{ color: '#fb923c' }}>
                        Dica de Alvo <span className="font-ui normal-case text-slate-500 ml-1">(visível só ao host, opcional)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: quem tem mais pontos, o mais novo, etc."
                        value={q.challengeTarget ?? ''}
                        onChange={(e) => updateQuestion(selectedCat, selectedQ, { challengeTarget: e.target.value || undefined })}
                        className="editor-input font-ui text-sm"
                        style={{ borderColor: 'rgba(251,146,60,0.3)', color: '#fb923c' }}
                      />
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex items-center justify-between pt-4 mt-auto border-t border-slate-800/60">
                    <button
                      disabled={selectedQ === 0}
                      onClick={() => setSelectedQ((q) => q - 1)}
                      className="font-ui text-sm px-4 py-2 rounded-lg transition-all disabled:opacity-20"
                      style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      ← anterior
                    </button>
                    <div className="flex gap-1.5 items-center">
                      {cat.questions.map((_, qi) => (
                        <button
                          key={qi}
                          onClick={() => setSelectedQ(qi)}
                          className="rounded-full transition-all"
                          style={{
                            width: qi === selectedQ ? '20px' : '8px',
                            height: '8px',
                            background: qi === selectedQ ? '#E8B84B' : '#1e3050',
                          }}
                        />
                      ))}
                    </div>
                    <button
                      disabled={selectedQ === cat.questions.length - 1}
                      onClick={() => setSelectedQ((q) => q + 1)}
                      className="font-ui text-sm px-4 py-2 rounded-lg transition-all disabled:opacity-20"
                      style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      próxima →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Desafio Final editor ── */}
          {isFinal && (
            <>
              <div
                className="flex-shrink-0 px-8 pt-8 pb-6 border-b"
                style={{ borderColor: '#1a2535' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mb-2">Questão Especial</p>
                    <h2
                      className="font-arcade text-2xl"
                      style={{ color: '#E8B84B', textShadow: '0 0 20px rgba(232,184,75,0.4), 0 2px 0 #8a6a1a', letterSpacing: '0.1em' }}
                    >
                      🏆 DESAFIO FINAL
                    </h2>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <span className="text-slate-400 font-ui text-sm">
                      {game.finalChallengeEnabled ? 'Habilitado' : 'Desabilitado'}
                    </span>
                    <div
                      className="relative w-11 h-6 rounded-full transition-colors"
                      style={{ background: game.finalChallengeEnabled ? '#E8B84B' : '#1e3050' }}
                    >
                      <div
                        className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
                        style={{ transform: game.finalChallengeEnabled ? 'translateX(23px)' : 'translateX(4px)' }}
                      />
                      <input
                        type="checkbox"
                        checked={game.finalChallengeEnabled}
                        onChange={(e) => setGame((g) => ({ ...g, finalChallengeEnabled: e.target.checked }))}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </div>
                  </label>
                </div>
              </div>

              {game.finalChallengeEnabled && (
                <div className="flex-1 px-8 py-6 flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2">
                      <span className="font-mono text-xs uppercase tracking-widest font-bold" style={{ color: '#E8B84B' }}>
                        Clue
                      </span>
                      <span className="text-slate-400 font-ui text-xs">— aparece na tela para os jogadores</span>
                    </label>
                    <textarea
                      placeholder="Digite a pista do Desafio Final..."
                      value={game.finalChallengeClue}
                      onChange={(e) => setGame((g) => ({ ...g, finalChallengeClue: e.target.value }))}
                      rows={4}
                      className="editor-textarea font-ui text-base leading-relaxed"
                    />
                    {gameId && (
                      <div className="mt-1">
                        <span className="text-slate-400 font-mono text-xs uppercase tracking-wider block mb-1">Mídia</span>
                        <MediaUpload
                          gameId={gameId}
                          media={game.finalChallengeMedia}
                          onUpload={(asset) => setGame((g) => ({ ...g, finalChallengeMedia: asset }))}
                          onRemove={() => setGame((g) => ({ ...g, finalChallengeMedia: undefined }))}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2">
                      <span className="font-mono text-xs uppercase tracking-widest font-bold text-slate-400">
                        Resposta
                      </span>
                      <span className="text-slate-400 font-ui text-xs">— visível apenas ao host</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Resposta correta..."
                      value={game.finalChallengeAnswer}
                      onChange={(e) => setGame((g) => ({ ...g, finalChallengeAnswer: e.target.value }))}
                      className="editor-input font-ui text-sm"
                      style={{ color: '#cbd5e1' }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="font-mono text-xs uppercase tracking-widest font-bold text-slate-400">
                        Tempo de Aposta <span className="font-ui normal-case text-slate-500">(s)</span>
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={300}
                        placeholder="60"
                        value={game.finalChallengeWagerSeconds ?? ''}
                        onChange={(e) => setGame((g) => ({ ...g, finalChallengeWagerSeconds: parseInt(e.target.value) || undefined }))}
                        className="editor-input font-mono text-sm"
                        style={{ color: '#cbd5e1' }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="font-mono text-xs uppercase tracking-widest font-bold text-slate-400">
                        Tempo de Resposta <span className="font-ui normal-case text-slate-500">(s)</span>
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={300}
                        placeholder="60"
                        value={game.finalChallengeAnswerSeconds ?? ''}
                        onChange={(e) => setGame((g) => ({ ...g, finalChallengeAnswerSeconds: parseInt(e.target.value) || undefined }))}
                        className="editor-input font-mono text-sm"
                        style={{ color: '#cbd5e1' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {!game.finalChallengeEnabled && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-slate-400 font-ui text-sm">Habilite o Desafio Final para editar</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── RIGHT PANEL ──────────────────────────────────────────── */}
        <div
          className="w-60 flex-shrink-0 flex flex-col border-l overflow-y-auto"
          style={{ background: '#070e1a', borderColor: '#1a2535' }}
        >
          {/* Normal question properties */}
          {q && qMeta && !isFinal && (
            <>
              {/* Value */}
              <div className="p-4 border-b" style={{ borderColor: '#1a2535' }}>
                <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mb-3">Valor</p>
                <div className="flex items-center gap-1">
                  <span
                    className="font-mono font-bold text-3xl"
                    style={{ color: '#E8B84B', textShadow: '0 0 16px rgba(232,184,75,0.4)' }}
                  >
                    $
                  </span>
                  <input
                    type="number"
                    value={q.value}
                    onChange={(e) => updateQuestion(selectedCat, selectedQ, { value: Number(e.target.value) })}
                    className="bg-transparent border-none font-mono font-bold text-3xl focus:outline-none w-24"
                    style={{ color: '#E8B84B', caretColor: '#E8B84B' }}
                  />
                </div>
              </div>

              {/* Type */}
              <div className="p-4 border-b" style={{ borderColor: '#1a2535' }}>
                <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mb-3">Tipo</p>
                <div className="flex flex-col gap-1.5">
                  {(Object.entries(TYPE_META) as [Question['type'], typeof TYPE_META[keyof typeof TYPE_META]][]).map(([type, meta]) => (
                    <button
                      key={type}
                      onClick={() => updateQuestion(selectedCat, selectedQ, { type })}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all duration-150"
                      style={{
                        background: q.type === type ? meta.bg : 'rgba(255,255,255,0.02)',
                        border: q.type === type ? `1px solid ${meta.color}40` : '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: meta.color, boxShadow: q.type === type ? `0 0 6px ${meta.color}` : 'none' }}
                      />
                      <span className="font-ui text-xs font-bold" style={{ color: q.type === type ? meta.color : '#475569' }}>
                        {meta.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timer */}
              <div className="p-4 border-b" style={{ borderColor: '#1a2535' }}>
                <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mb-3">Timer</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder={String(game.defaultTimer)}
                    value={q.timeOverride ?? ''}
                    onChange={(e) => updateQuestion(selectedCat, selectedQ, { timeOverride: e.target.value ? Number(e.target.value) : undefined })}
                    className="editor-input font-mono text-center text-sm w-20"
                  />
                  <span className="text-slate-500 text-xs font-ui">seg</span>
                  {q.timeOverride && (
                    <button
                      onClick={() => updateQuestion(selectedCat, selectedQ, { timeOverride: undefined })}
                      className="text-slate-400 hover:text-slate-400 text-xs transition-colors"
                    >
                      reset
                    </button>
                  )}
                </div>
                <p className="text-slate-400 font-ui text-xs mt-1">Padrão: {game.defaultTimer}s</p>
              </div>
            </>
          )}

          {/* Global settings — always visible */}
          <div className="p-4 border-b" style={{ borderColor: '#1a2535' }}>
            <p className="text-slate-400 font-mono text-xs uppercase tracking-widest mb-3">Timer Padrão</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={game.defaultTimer}
                onChange={(e) => setGame((g) => ({ ...g, defaultTimer: Number(e.target.value) }))}
                className="editor-input font-mono text-center text-sm w-20"
              />
              <span className="text-slate-500 text-xs font-ui">seg</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
