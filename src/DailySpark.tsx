import { Sparkles } from 'lucide-react';
import { useLanguage } from './lib/i18n';
import { SPARKS } from './DailySpark.i18n';

function todayIndex(length: number): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return dayOfYear % length;
}

export default function DailySpark() {
  const { lang } = useLanguage();
  const sparks = SPARKS[lang];
  const spark = sparks[todayIndex(sparks.length)];

  return (
    <div className="spark-card anim-fade">
      <div className="spark-icon"><Sparkles size={16} strokeWidth={2} /></div>
      <p className="spark-text">{spark}</p>

      <style>{`
        .spark-card {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm);
          background: var(--surface-2);
        }
        .spark-icon {
          flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
          background: rgba(112,130,56,0.12); color: var(--primary); display: grid; place-items: center;
          margin-top: 1px;
        }
        .spark-text { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--text); font-weight: 500; }
      `}</style>
    </div>
  );
}
