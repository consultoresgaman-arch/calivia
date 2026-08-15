import { LANGUAGES, useLanguage } from './lib/i18n';

interface Props {
  compact?: boolean;
  dark?: boolean;
}

export default function LanguageSelector({ compact, dark }: Props) {
  const { lang, setLang } = useLanguage();

  return (
    <div className={`lang-selector ${compact ? 'compact' : ''} ${dark ? 'dark' : ''}`}>
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          className={`lang-pill ${lang === l.code ? 'active' : ''}`}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
        >
          <span aria-hidden="true">{l.flag}</span>
          <span>{l.label}</span>
        </button>
      ))}

      <style>{`
        .lang-selector { display: flex; gap: 6px; flex-wrap: wrap; }
        .lang-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 12px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-soft);
          border-radius: 999px;
          font-size: 13px; font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .lang-pill:hover { border-color: var(--primary-200); color: var(--text); }
        .lang-pill.active { border-color: var(--primary); color: var(--primary-600); background: rgba(112,130,56,0.08); }
        .lang-selector.compact .lang-pill { padding: 5px 10px; font-size: 12px; }

        .lang-selector.dark .lang-pill { border-color: var(--dark-border); background: rgba(255,255,255,0.04); color: var(--dark-text-soft); }
        .lang-selector.dark .lang-pill:hover { border-color: var(--dark-accent); color: var(--dark-text); }
        .lang-selector.dark .lang-pill.active { border-color: var(--dark-accent); color: var(--dark-accent); background: var(--dark-accent-glow); }
      `}</style>
    </div>
  );
}
