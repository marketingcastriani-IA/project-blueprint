import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface AccessStatus {
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'loading';
  isAdmin: boolean;
  expiresAt: string | null;
  trialDays: number;
  daysRemaining: number | null;
}

export function useAccessControl() {
  const { user } = useAuth();
  const [access, setAccess] = useState<AccessStatus>({
    status: 'loading',
    isAdmin: false,
    expiresAt: null,
    trialDays: 0,
    daysRemaining: null,
  });

  useEffect(() => {
    if (!user) {
      setAccess(prev => ({ ...prev, status: 'loading', isAdmin: false }));
      return;
    }

    const fetchAccess = async () => {
      // Check admin role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const isAdmin = roles?.some((r: any) => r.role === 'admin') ?? false;

      if (isAdmin) {
        setAccess({ status: 'approved', isAdmin: true, expiresAt: null, trialDays: 9999, daysRemaining: null });
        return;
      }

      // Check user_access
      const { data: accessData } = await supabase
        .from('user_access')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!accessData) {
        setAccess({ status: 'pending', isAdmin: false, expiresAt: null, trialDays: 0, daysRemaining: null });
        return;
      }

      const ua = accessData as any;
      let status = ua.status as AccessStatus['status'];

      // Check expiry
      if (status === 'approved' && ua.expires_at) {
        const expiresAt = new Date(ua.expires_at);
        if (expiresAt < new Date()) {
          status = 'expired';
        }
      }

      const daysRemaining = ua.expires_at
        ? Math.max(0, Math.ceil((new Date(ua.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null;

      setAccess({
        status,
        isAdmin: false,
        expiresAt: ua.expires_at,
        trialDays: ua.trial_days ?? 0,
        daysRemaining,
      });
    };

    fetchAccess();
  }, [user]);

  return access;
}
