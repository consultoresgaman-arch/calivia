'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Loader2, AlertCircle } from 'lucide-react';
import type { Role } from '@/lib/types';
import { EmergencyModal } from '@/components/EmergencyModal';
export default function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sign in state
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Sign up state
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpRole, setSignUpRole] = useState<Role>('patient');
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');

  function switchTab(value: string) {
    setError(null);
    setTab(value as 'signin' | 'signup');
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: signInEmail.trim(),
      password: signInPassword,
    });
    setLoading(false);
    if (error) {
      setError(error.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : error.message);
      return;
    }
    router.push('/dashboard');
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: signUpEmail.trim(),
      password: signUpPassword,
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    const uid = data.user?.id;
    if (uid) {
      await supabase.from('profiles').upsert({
        id: uid,
        email: signUpEmail.trim(),
        full_name: signUpName.trim() || null,
        role: signUpRole,
      });
    }
    setLoading(false);
    router.push('/dashboard');
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-grid">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/60 to-background pointer-events-none" />
      <div className="relative w-full max-w-md animate-in-fade">
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 mb-4">
            <Brain className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-center text-balance">
            Café con RS | Bitácora
          </h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Un espacio privado para tu bienestar
          </p>
        </div>

        <Card className="shadow-xl border-border/60">
          <Tabs value={tab} onValueChange={switchTab} className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
                <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin">
                <CardTitle className="text-xl">Bienvenido de nuevo</CardTitle>
                <CardDescription className="mt-1">
                  Ingresa para continuar tu bitácora.
                </CardDescription>
              </TabsContent>
              <TabsContent value="signup">
                <CardTitle className="text-xl">Crea tu cuenta</CardTitle>
                <CardDescription className="mt-1">
                  Elige tu rol para comenzar.
                </CardDescription>
              </TabsContent>
            </CardHeader>

            <CardContent>
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Correo electrónico</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={signInEmail}
                      onChange={(e) => setSignInEmail(e.target.value)}
                      placeholder="tu@correo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Contraseña</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                  {error && <ErrorBanner message={error} />}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nombre (opcional)</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Correo electrónico</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      placeholder="tu@correo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Contraseña</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-role">Soy</Label>
                    <Select value={signUpRole} onValueChange={(v) => setSignUpRole(v as Role)}>
                      <SelectTrigger id="signup-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="patient">Paciente</SelectItem>
                        <SelectItem value="psychologist">Psicólogo/a</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {error && <ErrorBanner message={error} />}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Crear cuenta
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>

          <CardFooter className="flex justify-center">
            <p className="text-xs text-muted-foreground text-center">
              Tus datos están protegidos y solo visibles para ti y tu psicólogo.
            </p>
          </CardFooter>
        </Card>
        <EmergencyModal/>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
