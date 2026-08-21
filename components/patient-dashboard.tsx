'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { MOOD_LABELS, MOOD_EMOJI, MOOD_COLOR, type CheckIn } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Plus, Sparkles, CalendarDays, Heart } from 'lucide-react';
import MoodCalendar from '@/components/mood-calendar';

const MOOD_OPTIONS = [1, 2, 3, 4, 5];

export default function PatientDashboard() {
  const { user } = useAuth();
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [mood, setMood] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const loadCheckins = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('checkins')
      .select('id, user_id, mood, message, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setCheckins((data ?? []) as CheckIn[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadCheckins();
  }, [loadCheckins]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || mood === null) return;
    setSubmitting(true);
    setError(null);
    const { error } = await supabase
      .from('checkins')
      .insert({ mood, message: message.trim() || null });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setMood(null);
    setMessage('');
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2500);
    loadCheckins();
  }

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const lastCheckin = checkins[0];
  const checkedInToday =
    lastCheckin &&
    new Date(lastCheckin.created_at).toDateString() === new Date().toDateString();

  const avgMood =
    checkins.length > 0
      ? checkins.reduce((s, c) => s + c.mood, 0) / checkins.length
      : null;

  return (
    <div className="space-y-8 animate-in-fade">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">
          Hola, ¿cómo te sientes hoy?
        </h1>
        <p className="text-muted-foreground mt-1.5 capitalize flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          {today}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* New check-in */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Nuevo registro
              </CardTitle>
              <CardDescription>
                Tómate un momento para registrar tu estado emocional.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {checkedInToday && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                  <Sparkles className="h-4 w-4" />
                  Ya registraste tu ánimo hoy. Puedes añadir otro cuando lo desees.
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-3 block">
                    ¿Cómo está tu ánimo ahora mismo?
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {MOOD_OPTIONS.map((m) => {
                      const selected = mood === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMood(m)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                            selected
                              ? 'border-primary bg-primary/5 scale-[1.03] shadow-sm'
                              : 'border-border hover:border-primary/40 hover:bg-accent/50'
                          }`}
                          aria-pressed={selected}
                        >
                          <span className="text-2xl leading-none">{MOOD_EMOJI[m]}</span>
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {MOOD_LABELS[m]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="text-sm font-medium mb-2 block">
                    Tu mensaje del día <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="¿Qué pasó hoy? ¿Cómo lo viviste? Escribe libremente..."
                    className="min-h-[140px] resize-none"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={mood === null || submitting}>
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Guardar registro
                  </Button>
                  {justSaved && (
                    <span className="text-sm text-success flex items-center gap-1.5 animate-in-fade">
                      <Sparkles className="h-4 w-4" /> Guardado. Gracias por compartir.
                    </span>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Ánimo promedio</CardDescription>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-semibold tracking-tight">
                  {avgMood !== null ? avgMood.toFixed(1) : '—'}
                </span>
                <span className="text-muted-foreground text-sm">/ 5</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5">
                {MOOD_OPTIONS.map((m) => {
                  const count = checkins.filter((c) => c.mood === m).length;
                  const pct = checkins.length ? (count / checkins.length) * 100 : 0;
                  return (
                    <div key={m} className="flex-1 flex flex-col items-center gap-1">
                      <div className="h-24 w-full bg-muted rounded-md overflow-hidden flex items-end">
                        <div
                          className="w-full transition-all duration-500"
                          style={{
                            height: `${pct}%`,
                            backgroundColor: MOOD_COLOR[m],
                            minHeight: count > 0 ? '6px' : '0',
                          }}
                        />
                      </div>
                      <span className="text-base leading-none">{MOOD_EMOJI[m]}</span>
                      <span className="text-[10px] text-muted-foreground">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total de registros</CardDescription>
              <CardTitle className="text-3xl mt-1">{checkins.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Calendar history */}
      <MoodCalendar checkins={checkins} />

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tu historial</CardTitle>
          <CardDescription>Tus registros recientes, del más nuevo al más antiguo.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : checkins.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Heart className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Aún no tienes registros. Empieza por el primero arriba.</p>
            </div>
          ) : (
            <ScrollArea className="h-[420px] pr-4">
              <div className="space-y-3">
                {checkins.map((c) => (
                  <div
                    key={c.id}
                    className="flex gap-4 rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow"
                  >
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                      style={{ backgroundColor: `${MOOD_COLOR[c.mood]}1a` }}
                    >
                      {MOOD_EMOJI[c.mood]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Badge
                          variant="secondary"
                          className="font-medium"
                          style={{ color: MOOD_COLOR[c.mood] }}
                        >
                          {MOOD_LABELS[c.mood]}
                        </Badge>
                        <time className="text-xs text-muted-foreground shrink-0">
                          {new Date(c.created_at).toLocaleString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>
                      {c.message ? (
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                          {c.message}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Sin mensaje</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
