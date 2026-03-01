import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface AccessStatus {
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'loading';
  isAdmin: boolean;
  planType: 'free' | 'pro';
  simulationsCount: number;
}

export function useAccessControl() {
  const { user } = useAuth();
  const [access, setAccess] = useState<AccessStatus>({
    status: 'loading',
    isAdmin: false,
    planType: 'free',
    simulationsCount: 0,
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
        setAccess({ 
          status: 'approved', 
          isAdmin: true, 
          planType: 'pro',
          simulationsCount: 0
        });
        return;
      }

      // Check user_access
      const { data: accessData } = await supabase
        .from('user_access')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!accessData) {
        setAccess({ 
          status: 'pending', 
          isAdmin: false, 
          planType: 'free',
          simulationsCount: 0
        });
        return;
      }

      const ua = accessData as any;
      
      setAccess({
        status: ua.status as AccessStatus['status'],
        isAdmin: false,
        planType: (ua.plan_type as 'free' | 'pro') || 'free',
        simulationsCount: ua.simulations_count || 0,
      });
    };

    fetchAccess();
  }, [user]);

  return access;
}