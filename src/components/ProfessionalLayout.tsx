import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ProfessionalLayoutProps {
  children: ReactNode;
  className?: string;
}

export const ProfessionalHeader = ({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: ReactNode }) => (
  <div className="space-y-2 mb-8">
    <div className="flex items-center gap-3">
      <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight text-foreground">
        {title}
      </h1>
      {badge}
    </div>
    {subtitle && (
      <p className="text-lg text-muted-foreground font-medium">{subtitle}</p>
    )}
  </div>
);

export const ProfessionalCard = ({ 
  children, 
  className,
  glow = false,
  highlight = false,
}: { 
  children: ReactNode; 
  className?: string;
  glow?: boolean;
  highlight?: boolean;
}) => (
  <div
    className={cn(
      'relative rounded-2xl border backdrop-blur-xl transition-all duration-300',
      'bg-gradient-to-br from-card/80 to-card/40',
      'border-primary/20 hover:border-primary/40',
      'hover:shadow-[0_20px_60px_-12px_hsl(var(--primary)/0.2)]',
      glow && 'shadow-[0_0_40px_-8px_hsl(var(--primary)/0.3)]',
      highlight && 'ring-2 ring-primary/30 shadow-[0_0_60px_-12px_hsl(var(--primary)/0.4)]',
      className
    )}
  >
    {/* Gradient overlay */}
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
    
    {/* Content */}
    <div className="relative">
      {children}
    </div>
  </div>
);

export const SectionDivider = ({ title }: { title: string }) => (
  <div className="my-12 space-y-4">
    <div className="flex items-center gap-4">
      <div className="h-1 flex-1 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent rounded-full" />
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground whitespace-nowrap">
        {title}
      </h2>
      <div className="h-1 flex-1 bg-gradient-to-l from-primary/40 via-primary/20 to-transparent rounded-full" />
    </div>
  </div>
);

export const HighlightedMetric = ({ 
  label, 
  value, 
  unit = '', 
  color = 'primary',
  size = 'md',
}: { 
  label: string; 
  value: string | number; 
  unit?: string;
  color?: 'primary' | 'success' | 'destructive' | 'warning';
  size?: 'sm' | 'md' | 'lg';
}) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const colorClasses = {
    primary: 'text-primary',
    success: 'text-success',
    destructive: 'text-destructive',
    warning: 'text-warning',
  };

  return (
    <div className="space-y-1">
      <p className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn('font-bold font-mono', sizeClasses[size], colorClasses[color])}>
        {value}
        {unit && <span className="text-sm ml-1">{unit}</span>}
      </p>
    </div>
  );
};

export const MenuButton = ({ 
  children, 
  isActive = false, 
  onClick,
  icon: Icon,
}: { 
  children: ReactNode; 
  isActive?: boolean;
  onClick?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'relative px-6 py-3 rounded-xl font-semibold text-base transition-all duration-300',
      'flex items-center gap-2 whitespace-nowrap',
      isActive
        ? 'bg-primary text-primary-foreground shadow-[0_0_30px_-8px_hsl(var(--primary)/0.5)]'
        : 'bg-muted/50 text-foreground hover:bg-muted hover:text-primary',
    )}
  >
    {Icon && <Icon className="h-5 w-5" />}
    {children}
  </button>
);

export const ProfessionalLayout = ({ children, className }: ProfessionalLayoutProps) => (
  <div className={cn('min-h-screen bg-background', className)}>
    {children}
  </div>
);

export default ProfessionalLayout;
