import { useEffect, useState, useCallback } from 'react';
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
          planType: 'pro',
          simulationsCount: 0
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
        // Se não existir, o trigger handle_new_user pode ter falhado ou o usuário é antigo
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
    } catch (err) {
      console.error("[useAccessControl] Erro ao buscar acesso:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchAccess();
    
    if (user) {
      // Inscrição em tempo real para mudanças na tabela user_access
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