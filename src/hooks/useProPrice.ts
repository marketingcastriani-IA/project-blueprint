import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_PRICE = 14.90;

/**
 * Hook to fetch the PRO plan price from site_settings.
 * Centralizes the logic used across Index, Settings, AccessBlocked, AdminPanel.
 */
export function useProPrice() {
  const [proPrice, setProPrice] = useState(DEFAULT_PRICE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'pro_plan')
          .maybeSingle();

        if (data?.value && typeof data.value === 'object' && 'price' in data.value) {
          setProPrice(Number((data.value as { price: number }).price));
        }
      } catch (e) {
        console.error("[useProPrice] Erro ao buscar preço:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPrice();
  }, []);

  const annualPrice = Math.round(proPrice * 12 * 0.8 * 100) / 100;
  const monthlyEquivalent = Math.round((annualPrice / 12) * 100) / 100;

  return { proPrice, annualPrice, monthlyEquivalent, loading };
}
