export interface Leg {
  id?: string;
  side: 'buy' | 'sell';
  option_type: 'call' | 'put' | 'stock';
  asset: string;
  strike: number;
  price: number;
  quantity: number;
  expiry_date?: string; // ISO date string YYYY-MM-DD
}

export interface Analysis {
  id?: string;
  user_id?: string;
  name: string;
  underlying_asset?: string;
  cdi_rate?: number;
  days_to_expiry?: number;
  ai_suggestion?: string;
  status?: 'active' | 'closed';
  legs: Leg[];
  created_at?: string;
  updated_at?: string;
}

export interface PayoffPoint {
  price: number;
  profitAtExpiry: number;
  profitToday: number;
}

export interface AIAnalysisResult {
  summary: string;
  risk_level: string;
  pros: string[];
  cons: string[];
  verdict: string;
  score: number;
  strategy_explanation: string;
  probability_success: string;
  scenarios: {
    up: string;
    flat: string;
    down: string;
  };
  cdi_comparison?: string;
  strategy_name?: string;
}

export interface AnalysisMetrics {
  maxGain: number | 'Ilimitado';
  maxLoss: number | 'Ilimitado';
  breakevens: number[];
  netCost: number;
  strategyType?: string;
  strategyLabel?: string;
  montageTotal?: number;
  realBreakeven?: number | number[]; // Updated to allow array
  isRiskFree?: boolean;
  cdiReturn?: number;
  cdiEfficiency?: number;
}
