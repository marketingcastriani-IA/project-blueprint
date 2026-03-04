import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const FREE_TRIAL_DAYS = 7;

interface AccessStatus {
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'loading';
  isAdmin: boolean;
  planType: 'free' | 'pro';
  simulationsCount: number;
  maxSimulations: number;
  canSimulate: boolean;
  expiresAt: string | null;
  trialDays: number;
  daysRemaining: number | null;
  trialExpired: boolean;
}

export function useAccessControl() {
  const { user } = useAuth();
  const [access, setAccess] = useState<AccessStatus>({
    status: 'loading',
    isAdmin: false,
    planType: 'free',
    simulationsCount: 0,
    maxSimulations: Infinity,
    canSimulate: true,
    expiresAt: null,
    trialDays: 0,
    daysRemaining: null,
    trialExpired: false,
  });

  const fetchAccess = useCallback(async () => {
    if (!user) return;

    try {
      // 1. Verificar se é admin
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = roles?.some((r: any) => r.role === 'admin') ?? false;

      if (isAdmin) {
        setAccess({ 
          status: 'approved', 
          isAdmin: true, 
          expiresAt: null, 
          trialDays: 9999, 
          daysRemaining: null, 
          planType: 'pro',
          simulationsCount: 0, 
          maxSimulations: Infinity, 
          canSimulate: true,
          trialExpired: false,
        });
        return;
      }

      // 2. Buscar dados de acesso
      const { data: accessData, error } = await supabase
        .from('user_access')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!accessData) {
        setAccess({ 
          status: 'pending', 
          isAdmin: false, 
          expiresAt: null, 
          trialDays: 0, 
          daysRemaining: null, 
          planType: 'free',
          simulationsCount: 0, 
          maxSimulations: Infinity, 
          canSimulate: false,
          trialExpired: false,
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
      const trialExpired = status === 'expired';
      const canSimulate = planType === 'pro' || (!trialExpired && status === 'approved');

      setAccess({
        status, 
        isAdmin: false, 
        expiresAt: ua.expires_at,
        trialDays: ua.trial_days ?? FREE_TRIAL_DAYS, 
        daysRemaining, 
        planType,
        simulationsCount, 
        maxSimulations: Infinity, 
        canSimulate,
        trialExpired,
      });
    } catch (err) {
      console.error("[useAccessControl] Erro ao buscar acesso:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchAccess();
    
    if (user) {
      const channel = supabase
        .channel(`user_access_${user.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'user_access',
          filter: `user_id=eq.${user.id}`
        }, () => {
          fetchAccess();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, fetchAccess]);

  return access;
}