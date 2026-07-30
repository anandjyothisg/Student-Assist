import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  Check,
  RotateCw,
  Copy
} from 'lucide-react';

import { useToast } from '../ui/Toast';

export function Notebook() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('answers');
  const [answers, setAnswers] = useState([]);
  const [flashcards, setFlashcards] = useState([]);
  const [flippedCards, setFlippedCards] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    const storedAnswers = localStorage.getItem('nb_answers');
    if (storedAnswers) {
      setAnswers(JSON.parse(storedAnswers));
    } else {
      setAnswers([]);
    }

    const storedFc = localStorage.getItem('nb_flashcards');
    if (storedFc) {
      setFlashcards(JSON.parse(storedFc));
    } else {
      setFlashcards([]);
    }
  }, []);

  const handleToggleFlip = (id) => {
    setFlippedCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteAnswer = (id) => {
    const updated = answers.filter(a => a.id !== id);
    setAnswers(updated);
    localStorage.setItem('nb_answers', JSON.stringify(updated));
    toast.info('Saved note removed.');
  };

  const handleDeleteFlashcard = (id) => {
    const updated = flashcards.filter(f => f.id !== id);
    setFlashcards(updated);
    localStorage.setItem('nb_flashcards', JSON.stringify(updated));
    toast.info('Flashcard deleted.');
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="hero-title text-3xl font-normal" style={{ color: 'var(--fg)' }}>
            Study Notebook
          </h1>
          <p className="text-xs font-normal mt-1" style={{ color: 'var(--fg-3)' }}>
            Centralized repository of saved AI responses, revision flashcards, and annotations.
          </p>
        </div>

        {/* Tab Selector Pill */}
        <div className="flex items-center gap-1 p-1 rounded-md self-start sm:self-auto" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => setActiveTab('answers')}
            className="px-3.5 py-1.5 rounded-sm text-xs font-medium transition-all cursor-pointer"
            style={{
              background: activeTab === 'answers' ? 'var(--bg-subtle)' : 'transparent',
              color: activeTab === 'answers' ? 'var(--fg)' : 'var(--fg-3)',
              boxShadow: activeTab === 'answers' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            Saved Answers ({answers.length})
          </button>
          <button
            onClick={() => setActiveTab('flashcards')}
            className="px-3.5 py-1.5 rounded-sm text-xs font-medium transition-all cursor-pointer"
            style={{
              background: activeTab === 'flashcards' ? 'var(--bg-subtle)' : 'transparent',
              color: activeTab === 'flashcards' ? 'var(--fg)' : 'var(--fg-3)',
              boxShadow: activeTab === 'flashcards' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            Flashcards ({flashcards.length})
          </button>
        </div>
      </div>

      {/* Content Canvas */}
      {activeTab === 'answers' ? (
        <div className="grid grid-cols-1 gap-4">
          {answers.length === 0 ? (
            <div className="p-12 text-center border border-dashed rounded-md text-xs" style={{ borderColor: 'var(--border)', color: 'var(--fg-3)' }}>
              No answers saved yet. Click 'Save to Notebook' on any AI Assistant response to bookmark it here.
            </div>
          ) : (
            answers.map((ans) => (
              <div key={ans.id} className="p-6 rounded-md shadow-premium-sm flex flex-col gap-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="keycap">{ans.course_code || 'STUDY NOTE'}</span>
                    <h3 className="text-sm font-semibold font-sans" style={{ color: 'var(--fg)' }}>{ans.query}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--fg-3)' }}>
                    <button onClick={() => handleCopy(ans.id, ans.content)} className="p-1.5 cursor-pointer hover:opacity-80">
                      {copiedId === ans.id ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleDeleteAnswer(ans.id)} className="p-1.5 cursor-pointer hover:opacity-80" style={{ color: 'var(--error)' }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-xs leading-relaxed font-sans max-w-none whitespace-pre-wrap" style={{ color: 'var(--fg-2)' }}>
                  {ans.content}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Flashcards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {flashcards.length === 0 ? (
            <div className="col-span-full p-12 text-center border border-dashed rounded-md text-xs" style={{ borderColor: 'var(--border)', color: 'var(--fg-3)' }}>
              No flashcards created yet.
            </div>
          ) : (
            flashcards.map((fc) => {
              const isFlipped = flippedCards.has(fc.id);
              return (
                <div
                  key={fc.id}
                  onClick={() => handleToggleFlip(fc.id)}
                  className="min-h-[180px] p-6 rounded-md shadow-premium-sm cursor-pointer flex flex-col justify-between transition-all duration-200 group relative"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--fg-3)' }}>
                    <span className="keycap">{fc.category || 'CARD'}</span>
                    <div className="flex items-center gap-1">
                      <RotateCw className="w-3 h-3 transition-colors" />
                      <span>{isFlipped ? 'Answer' : 'Question'}</span>
                    </div>
                  </div>

                  <div className="my-auto text-center py-4">
                    {isFlipped ? (
                      <p className="text-sm font-semibold font-mono leading-relaxed" style={{ color: 'var(--accent)' }}>{fc.answer}</p>
                    ) : (
                      <p className="text-sm font-medium leading-relaxed font-sans" style={{ color: 'var(--fg)' }}>{fc.question}</p>
                    )}
                  </div>

                  <div className="flex justify-end pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFlashcard(fc.id);
                      }}
                      className="text-[11px] cursor-pointer hover:underline"
                      style={{ color: 'var(--error)' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
