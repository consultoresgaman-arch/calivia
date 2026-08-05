'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { MOOD_LABELS, MOOD_EMOJI, MOOD_COLOR, type CheckIn } from '@/lib/types';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function MoodCalendar({ checkins }: { checkins: CheckIn[] }) {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<{
    date: Date;
    entries: CheckIn[];
  } | null>(null);

  // Group checkins by local date key
  const byDate = useMemo(() => {
    const map = new Map<string, CheckIn[]>();
    for (const c of checkins) {
      const d = new Date(c.created_at);
      const key = dateKey(d);
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return map;
  }, [checkins]);

  // Build the grid of days for the visible month.
  // Monday-first layout.
  const days = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = (firstDay.getDay() + 6) % 7; // 0 = Monday
    const totalDays = lastDay.getDate();

    const cells: { date: Date; inMonth: boolean }[] = [];
    // Leading days from previous month
    for (let i = 0; i < startWeekday; i++) {
      const d = new Date(year, month, -startWeekday + i + 1);
      cells.push({ date: d, inMonth: false });
    }
    for (let day = 1; day <= totalDays; day++) {
      cells.push({ date: new Date(year, month, day), inMonth: true });
    }
    // Trailing days to complete the final week (total cells multiple of 7)
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      cells.push({ date: d, inMonth: false });
    }
    return cells;
  }, [viewMonth]);

  const today = new Date();

  function prevMonth() {
    setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }
  function goToday() {
    setViewMonth(startOfMonth(new Date()));
  }

  const monthCheckinCount = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    return checkins.filter((c) => {
      const d = new Date(c.created_at);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;
  }, [checkins, viewMonth]);

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 pb-3 border-b">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight">
              Historial en calendario
            </h2>
            <p className="text-xs text-muted-foreground">
              {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              {monthCheckinCount > 0 && ` · ${monthCheckinCount} ${monthCheckinCount === 1 ? 'registro' : 'registros'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={goToday} className="text-xs">
            Hoy
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth} aria-label="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth} aria-label="Mes siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 px-3 sm:px-5 pt-3">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-[11px] sm:text-xs font-medium text-muted-foreground py-1"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1 p-3 sm:p-5 pt-2">
        {days.map(({ date, inMonth }) => {
          const key = dateKey(date);
          const entries = byDate.get(key);
          const hasCheckin = !!entries && entries.length > 0;
          const isToday = isSameDay(date, today);
          // Dominant mood = the most recent entry that day (entries are sorted desc overall)
          const mood = entries?.[0]?.mood;

          return (
            <button
              key={key}
              type="button"
              disabled={!hasCheckin}
              onClick={() => hasCheckin && setSelectedDay({ date, entries: entries! })}
              className={cn(
                'relative flex aspect-square min-h-[44px] sm:min-h-[56px] flex-col items-center justify-center rounded-lg border text-sm transition-all',
                inMonth ? 'border-border/60 bg-background' : 'border-transparent text-muted-foreground/40',
                isToday && 'ring-1 ring-primary',
                hasCheckin
                  ? 'hover:shadow-md hover:scale-[1.04] hover:border-primary/40 cursor-pointer'
                  : 'cursor-default',
                !hasCheckin && inMonth && 'hover:bg-accent/30'
              )}
              aria-label={
                hasCheckin
                  ? `${date.getDate()} de ${MONTHS[date.getMonth()]}, ${entries?.length} ${entries?.length === 1 ? 'registro' : 'registros'}`
                  : `${date.getDate()} de ${MONTHS[date.getMonth()]}`
              }
            >
              <span
                className={cn(
                  'text-sm font-medium',
                  !inMonth && 'opacity-40',
                  isToday && 'text-primary font-semibold'
                )}
              >
                {date.getDate()}
              </span>
              {hasCheckin && mood !== undefined && (
                <span
                  className="absolute bottom-1.5 h-2 w-2 rounded-full"
                  style={{ backgroundColor: MOOD_COLOR[mood] }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-5 pb-5 pt-1 border-t">
        <span className="text-xs text-muted-foreground mr-1">Ánimo:</span>
        {[1, 2, 3, 4, 5].map((m) => (
          <div key={m} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: MOOD_COLOR[m] }}
            />
            <span className="text-xs text-muted-foreground">{MOOD_LABELS[m]}</span>
          </div>
        ))}
      </div>

      <DayDetailDialog
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
}

function DayDetailDialog({
  day,
  onClose,
}: {
  day: { date: Date; entries: CheckIn[] } | null;
  onClose: () => void;
}) {
  if (!day) return null;
  const dateLabel = day.date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Dialog open={!!day} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="capitalize">{dateLabel}</DialogTitle>
          <DialogDescription>
            {day.entries.length} {day.entries.length === 1 ? 'registro' : 'registros'} este día
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4 max-h-[55vh]">
          <div className="space-y-3">
            {day.entries.map((c) => (
              <div key={c.id} className="flex gap-3 rounded-lg border p-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
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
                      {new Date(c.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                  {c.message ? (
                    <p className="text-sm whitespace-pre-wrap break-words">{c.message}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Sin mensaje</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
