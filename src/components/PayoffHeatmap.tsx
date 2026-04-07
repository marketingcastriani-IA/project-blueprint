import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { PayoffPoint, Leg } from '@/lib/types';
import { calculatePayoffAtExpiry, calculateOptionPrice } from '@/lib/payoff';

interface PayoffHeatmapProps {
  data: PayoffPoint[];
  breakevens: number[];
  currentSpotPrice?: number | null;
  legs?: Leg[];
  daysToExpiry?: number;
}

const TIME_STEPS = 30;
const LEGEND_W = 60;
const AXIS_BOTTOM = 40;
const AXIS_LEFT = 56;
const HEADER_H = 24;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function profitToColor(val: number, maxAbs: number): string {
  const t = Math.max(-1, Math.min(1, val / (maxAbs || 1)));
  if (t >= 0) {
    // green gradient
    const r = Math.round(lerp(30, 16, t));
    const g = Math.round(lerp(40, 185, t));
    const b = Math.round(lerp(50, 80, t));
    return `rgb(${r},${g},${b})`;
  } else {
    // red gradient
    const abs = Math.abs(t);
    const r = Math.round(lerp(50, 220, abs));
    const g = Math.round(lerp(30, 38, abs));
    const b = Math.round(lerp(40, 50, abs));
    return `rgb(${r},${g},${b})`;
  }
}

export default function PayoffHeatmap({
  data,
  breakevens,
  currentSpotPrice,
  legs,
  daysToExpiry = 30,
}: PayoffHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    price: number;
    days: number;
    profit: number;
  } | null>(null);

  const prices = useMemo(() => data.map((p) => p.price), [data]);
  const minPrice = prices.length > 0 ? prices[0] : 0;
  const maxPrice = prices.length > 0 ? prices[prices.length - 1] : 100;

  // Build heatmap matrix: rows = time steps (top=today, bottom=expiry), cols = price
  const { matrix, maxAbs } = useMemo(() => {
    if (!legs || legs.length === 0 || prices.length === 0) {
      return { matrix: [] as number[][], maxAbs: 1 };
    }

    const mat: number[][] = [];
    let mAbs = 0;
    const dte = Math.max(daysToExpiry, 1);

    for (let t = 0; t < TIME_STEPS; t++) {
      const row: number[] = [];
      const remainingDays = dte * (1 - t / (TIME_STEPS - 1)); // top = full DTE, bottom = 0
      const T = remainingDays / 365;

      for (let p = 0; p < prices.length; p++) {
        const spot = prices[p];
        let profit: number;

        if (remainingDays <= 0.5) {
          profit = calculatePayoffAtExpiry(legs, spot);
        } else {
          // Use BS to get theoretical value at this time
          profit = 0;
          for (const leg of legs) {
            const mult = leg.side === 'buy' ? 1 : -1;
            if (leg.option_type === 'stock') {
              profit += mult * (spot - leg.price) * leg.quantity;
            } else {
              const theo = calculateOptionPrice(
                leg.option_type,
                spot,
                leg.strike,
                T,
                0.12,
                0.25
              );
              profit += mult * (theo - leg.price) * leg.quantity;
            }
          }
        }

        row.push(profit);
        mAbs = Math.max(mAbs, Math.abs(profit));
      }
      mat.push(row);
    }

    return { matrix: mat, maxAbs: mAbs };
  }, [legs, prices, daysToExpiry]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || matrix.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const plotW = W - AXIS_LEFT - LEGEND_W - 8;
    const plotH = H - AXIS_BOTTOM - HEADER_H;
    const cellW = plotW / prices.length;
    const cellH = plotH / TIME_STEPS;

    // Background
    ctx.fillStyle = 'rgb(12, 14, 20)';
    ctx.fillRect(0, 0, W, H);

    // Draw heatmap cells
    for (let t = 0; t < TIME_STEPS; t++) {
      for (let p = 0; p < prices.length; p++) {
        const val = matrix[t][p];
        ctx.fillStyle = profitToColor(val, maxAbs);
        ctx.fillRect(
          AXIS_LEFT + p * cellW,
          HEADER_H + t * cellH,
          Math.ceil(cellW) + 1,
          Math.ceil(cellH) + 1
        );
      }
    }

    // Breakeven lines (vertical)
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    for (const be of breakevens) {
      const px = AXIS_LEFT + ((be - minPrice) / (maxPrice - minPrice)) * plotW;
      ctx.beginPath();
      ctx.moveTo(px, HEADER_H);
      ctx.lineTo(px, HEADER_H + plotH);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Current spot price line (vertical)
    if (currentSpotPrice) {
      const px = AXIS_LEFT + ((currentSpotPrice - minPrice) / (maxPrice - minPrice)) * plotW;
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(px, HEADER_H);
      ctx.lineTo(px, HEADER_H + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = 'rgba(96, 165, 250, 1)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`SPOT ${currentSpotPrice.toFixed(2)}`, px, HEADER_H - 4);
    }

    // Zero profit contour (horizontal scan for sign change)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    for (let t = 0; t < TIME_STEPS; t++) {
      for (let p = 0; p < prices.length - 1; p++) {
        const v1 = matrix[t][p];
        const v2 = matrix[t][p + 1];
        if ((v1 >= 0 && v2 < 0) || (v1 < 0 && v2 >= 0)) {
          const frac = Math.abs(v1) / (Math.abs(v1) + Math.abs(v2));
          const cx = AXIS_LEFT + (p + frac) * cellW;
          const cy = HEADER_H + (t + 0.5) * cellH;
          ctx.beginPath();
          ctx.arc(cx, cy, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // X-axis labels (prices)
    ctx.fillStyle = 'rgba(160, 175, 200, 0.9)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const xTicks = 8;
    for (let i = 0; i <= xTicks; i++) {
      const price = lerp(minPrice, maxPrice, i / xTicks);
      const x = AXIS_LEFT + (i / xTicks) * plotW;
      ctx.fillText(price.toFixed(0), x, HEADER_H + plotH + 14);
    }
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('Preço do Ativo (R$)', AXIS_LEFT + plotW / 2, HEADER_H + plotH + 32);

    // Y-axis labels (days to expiry)
    ctx.textAlign = 'right';
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(160, 175, 200, 0.9)';
    const dte = Math.max(daysToExpiry, 1);
    const yTicks = 6;
    for (let i = 0; i <= yTicks; i++) {
      const days = Math.round(dte * (1 - i / yTicks));
      const y = HEADER_H + (i / yTicks) * plotH + 4;
      ctx.fillText(`D-${days}`, AXIS_LEFT - 6, y);
    }
    ctx.save();
    ctx.translate(12, HEADER_H + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('Dias até Vencimento', 0, 0);
    ctx.restore();

    // Color legend
    const legendX = W - LEGEND_W + 6;
    const legendH = plotH * 0.7;
    const legendY = HEADER_H + (plotH - legendH) / 2;
    const legendBarW = 14;

    for (let i = 0; i < legendH; i++) {
      const t = 1 - (i / legendH) * 2; // +1 top to -1 bottom
      ctx.fillStyle = profitToColor(t * maxAbs, maxAbs);
      ctx.fillRect(legendX, legendY + i, legendBarW, 2);
    }

    // Legend border
    ctx.strokeStyle = 'rgba(100, 120, 150, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, legendBarW, legendH);

    // Legend labels
    ctx.fillStyle = 'rgba(160, 175, 200, 0.9)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    const legendLabelX = legendX + legendBarW + 4;
    ctx.fillText(`+${maxAbs.toFixed(0)}`, legendLabelX, legendY + 4);
    ctx.fillText('0', legendLabelX, legendY + legendH / 2 + 3);
    ctx.fillText(`-${maxAbs.toFixed(0)}`, legendLabelX, legendY + legendH);

    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('R$', legendLabelX, legendY - 8);

    // Title
    ctx.fillStyle = 'rgba(200, 215, 235, 0.95)';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Mapa de Calor — Lucro/Prejuízo por Preço × Tempo', AXIS_LEFT, 16);
  }, [matrix, maxAbs, prices, breakevens, currentSpotPrice, minPrice, maxPrice, daysToExpiry]);

  useEffect(() => {
    draw();
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas || matrix.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const plotW = rect.width - AXIS_LEFT - LEGEND_W - 8;
      const plotH = rect.height - AXIS_BOTTOM - HEADER_H;

      const px = (mx - AXIS_LEFT) / plotW;
      const py = (my - HEADER_H) / plotH;

      if (px < 0 || px > 1 || py < 0 || py > 1) {
        setTooltip(null);
        return;
      }

      const priceIdx = Math.min(Math.floor(px * prices.length), prices.length - 1);
      const timeIdx = Math.min(Math.floor(py * TIME_STEPS), TIME_STEPS - 1);
      const dte = Math.max(daysToExpiry, 1);
      const days = Math.round(dte * (1 - timeIdx / (TIME_STEPS - 1)));

      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        price: prices[priceIdx],
        days,
        profit: matrix[timeIdx][priceIdx],
      });
    },
    [matrix, prices, daysToExpiry]
  );

  if (!legs || legs.length === 0) {
    return (
      <div className="h-[450px] flex items-center justify-center bg-muted/10 rounded-xl border border-border/50">
        <p className="text-sm text-muted-foreground">Adicione pernas para visualizar o heatmap</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-[450px] w-full rounded-xl overflow-hidden border border-border/30">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-50 rounded-lg border border-border/60 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-sm text-xs"
          style={{
            left: Math.min(tooltip.x + 12, (containerRef.current?.offsetWidth ?? 300) - 180),
            top: tooltip.y - 60,
          }}
        >
          <div className="mb-1 font-bold text-foreground/90">
            Preço: R$ {tooltip.price.toFixed(2)}
          </div>
          <div className="text-muted-foreground">D-{tooltip.days} até vencimento</div>
          <div
            className={`mt-1 font-mono font-bold ${
              tooltip.profit >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {tooltip.profit >= 0 ? '+' : ''}R$ {tooltip.profit.toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}
