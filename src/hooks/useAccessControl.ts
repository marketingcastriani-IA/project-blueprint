import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const FREE_MAX_SIMULATIONS = 3;

interface AccessStatus {
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'loading';
  isAdmin: boolean;
  expiresAt: string | null;
  trialDays: number;
  daysRemaining: number | null;
  planType: 'free' | 'pro';
  simulationsCount: number;
  maxSimulations: number;
  canSimulate: boolean;
}

export function useAccessControl() {
  const { user } = useAuth();
  const [access, setAccess] = useState<AccessStatus>({
    status: 'loading',
    isAdmin: false,
    expiresAt: null,
    trialDays: 0,
    daysRemaining: null,
    planType: 'free',
    simulationsCount: 0,
    maxSimulations: FREE_MAX_SIMULATIONS,
    canSimulate: true,
  });

  useEffect(() => {
    if (!user) {
      setAccess(prev => ({ ...prev, status: 'loading', isAdmin: false }));
      return;
    }

    const fetchAccess = async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = roles?.some((r: any) => r.role === 'admin') ?? false;

      if (isAdmin) {
        setAccess({ 
          status: 'approved', isAdmin: true, expiresAt: null, 
          trialDays: 9999, daysRemaining: null, planType: 'pro',
          simulationsCount: 0, maxSimulations: Infinity, canSimulate: true,
        });
        return;
      }

      const { data: accessData } = await supabase
        .from('user_access')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!accessData) {
        setAccess({ 
          status: 'pending', isAdmin: false, expiresAt: null, 
          trialDays: 0, daysRemaining: null, planType: 'free',
          simulationsCount: 0, maxSimulations: FREE_MAX_SIMULATIONS, canSimulate: true,
        });
        return;
      }

      const ua = accessData as any;
      let status = ua.status as AccessStatus['status'];

      if (status === 'approved' && ua.expires_at) {
        const expiresAt = new Date(ua.expires_at);
        if (expiresAt < new Date()) {
          status = 'expired';
        }
      }

      const daysRemaining = ua.expires_at
        ? Math.max(0, Math.ceil((new Date(ua.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

      const planType = (ua.plan_type as 'free' | 'pro') || 'free';
      const simulationsCount = ua.simulations_count || 0;
      const maxSimulations = planType === 'pro' ? Infinity : FREE_MAX_SIMULATIONS;
      const canSimulate = planType === 'pro' || simulationsCount < FREE_MAX_SIMULATIONS;

      setAccess({
        status, isAdmin: false, expiresAt: ua.expires_at,
        trialDays: ua.trial_days ?? 0, daysRemaining, planType,
        simulationsCount, maxSimulations, canSimulate,
      });
    };

    fetchAccess();
  }, [user]);

  return access;
}
