'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { MOOD_LABELS, MOOD_EMOJI, MOOD_COLOR, type Profile, type CheckIn } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Users, CalendarClock, ChevronRight, Inbox } from 'lucide-react';

interface Patient extends Profile {
  last_checkin_at: string | null;
  checkin_count: number;
}

export default function PsychologistDashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Patient | null>(null);

  const loadPatients = useCallback(async () => {
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .eq('role', 'patient')
      .order('created_at', { ascending: false });
    if (pErr) {
      setLoading(false);
      return;
    }
    const { data: checkins, error: cErr } = await supabase
      .from('checkins')
      .select('user_id, created_at');
    if (cErr) {
      setLoading(false);
      return;
    }

    const byUser = new Map<string, { last: string | null; count: number }>();
    for (const c of checkins ?? []) {
      const cur = byUser.get(c.user_id);
      if (!cur) {
        byUser.set(c.user_id, { last: c.created_at, count: 1 });
      } else {
        cur.count += 1;
        if (!cur.last || c.created_at > cur.last) cur.last = c.created_at;
      }
    }

    const enriched: Patient[] = (profiles ?? []).map((p) => {
      const agg = byUser.get(p.id);
      return {
        ...(p as Profile),
        last_checkin_at: agg?.last ?? null,
        checkin_count: agg?.count ?? 0,
      };
    });

    setPatients(enriched);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.email.toLowerCase().includes(q) ||
        (p.full_name?.toLowerCase().includes(q) ?? false)
    );
  }, [patients, search]);

  const totalCheckins = patients.reduce((s, p) => s + p.checkin_count, 0);
  const activeToday = patients.filter(
    (p) =>
      p.last_checkin_at &&
      new Date(p.last_checkin_at).toDateString() === new Date().toDateString()
  ).length;
  const inactive = patients.filter(
    (p) =>
      !p.last_checkin_at ||
      Date.now() - new Date(p.last_checkin_at).getTime() > 24 * 60 * 60 * 1000
  ).length;

  return (
    <div className="space-y-8 animate-in-fade">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Panel del psicólogo
        </h1>
        <p className="text-muted-foreground mt-1.5">
          Revisa el estado de tus pacientes y sus registros recientes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Users} label="Pacientes" value={patients.length} />
        <StatCard icon={CalendarClock} label="Registros hoy" value={activeToday} accent="success" />
        <StatCard icon={Inbox} label="Sin registro 24h" value={inactive} accent="warning" />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Pacientes</CardTitle>
              <CardDescription>{totalCheckins} registros en total</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o correo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {patients.length === 0
                  ? 'Aún no hay pacientes registrados.'
                  : 'Ningún paciente coincide con la búsqueda.'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((p) => {
                const initials = (p.full_name || p.email)
                  .split(/[\s@.]/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((s) => s[0]?.toUpperCase())
                  .join('');
                const stale =
                  !p.last_checkin_at ||
                  Date.now() - new Date(p.last_checkin_at).getTime() > 24 * 60 * 60 * 1000;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className="flex w-full items-center gap-4 py-3.5 px-2 -mx-2 rounded-lg hover:bg-accent/50 transition-colors text-left"
                  >
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {p.full_name || 'Sin nombre'}
                        </span>
                        {stale ? (
                          <Badge variant="outline" className="text-warning border-warning/40">
                            Inactivo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-success border-success/40">
                            Activo
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{p.email}</p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end shrink-0">
                      <span className="text-sm font-medium">{p.checkin_count}</span>
                      <span className="text-xs text-muted-foreground">registros</span>
                    </div>
                    <div className="hidden md:block text-xs text-muted-foreground shrink-0 w-32 text-right">
                      {p.last_checkin_at
                        ? new Date(p.last_checkin_at).toLocaleDateString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Sin registros'}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <PatientDetailDialog patient={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent?: 'success' | 'warning';
}) {
  const accentClass =
    accent === 'success'
      ? 'text-success bg-success/10'
      : accent === 'warning'
      ? 'text-warning bg-warning/10'
      : 'text-primary bg-primary/10';
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PatientDetailDialog({
  patient,
  onClose,
}: {
  patient: Patient | null;
  onClose: () => void;
}) {
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patient) {
      setCheckins([]);
      return;
    }
    setLoading(true);
    supabase
      .from('checkins')
      .select('id, user_id, mood, message, created_at')
      .eq('user_id', patient.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error) setCheckins((data ?? []) as CheckIn[]);
        setLoading(false);
      });
  }, [patient]);

  const avg =
    checkins.length > 0
      ? checkins.reduce((s, c) => s + c.mood, 0) / checkins.length
      : null;

  return (
    <Dialog open={!!patient} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary text-sm">
                {patient
                  ? (patient.full_name || patient.email)
                      .split(/[\s@.]/)
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((s) => s[0]?.toUpperCase())
                      .join('')
                  : ''}
              </AvatarFallback>
            </Avatar>
            <span>{patient?.full_name || 'Sin nombre'}</span>
          </DialogTitle>
          <DialogDescription>
            {patient?.email} · {patient?.checkin_count ?? 0} registros
            {avg !== null && ` · Ánimo promedio ${avg.toFixed(1)}/5`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : checkins.length === 0 ? (
            <p className="text-center py-10 text-sm text-muted-foreground">
              Este paciente aún no tiene registros.
            </p>
          ) : (
            <div className="space-y-3">
              {checkins.map((c) => (
                <div key={c.id} className="flex gap-3 rounded-lg border p-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
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
                      <p className="text-sm whitespace-pre-wrap break-words">{c.message}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Sin mensaje</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
