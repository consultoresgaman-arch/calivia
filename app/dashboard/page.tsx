'use client';

import { useAuth } from '@/lib/auth-context';
import PatientDashboard from '@/components/patient-dashboard';
import PsychologistDashboard from '@/components/psychologist-dashboard';

export default function DashboardPage() {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return profile.role === 'psychologist' ? <PsychologistDashboard /> : <PatientDashboard />;
}
