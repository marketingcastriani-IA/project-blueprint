import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_PRICE = 14.90;
const DEFAULT_DISCOUNT = 20; // percent

/**
 * Hook to fetch the PRO plan price and annual discount from site_settings.
 */
export function useProPrice() {
  const [proPrice, setProPrice] = useState(DEFAULT_PRICE);
  const [annualDiscountPercent, setAnnualDiscountPercent] = useState(DEFAULT_DISCOUNT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', 'pro_plan')
          .maybeSingle();

        if (data?.value && typeof data.value === 'object') {
          const val = data.value as { price?: number; annual_discount?: number };
          if (val.price) setProPrice(Number(val.price));
          if (val.annual_discount !== undefined) setAnnualDiscountPercent(Number(val.annual_discount));
        }
      } catch (e) {
        console.error("[useProPrice] Erro ao buscar preço:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPrice();
  }, []);

  const discountFactor = 1 - annualDiscountPercent / 100;
  const annualPrice = Math.round(proPrice * 12 * discountFactor * 100) / 100;
  const monthlyEquivalent = Math.round((annualPrice / 12) * 100) / 100;

  return { proPrice, annualPrice, monthlyEquivalent, annualDiscountPercent, loading };
}
