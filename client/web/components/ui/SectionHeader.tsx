import { ReactNode } from 'react';
import { SectionTitle } from '@/components/ui/SectionTitle';

interface SectionHeaderProps {
  title: ReactNode;
  subtitle?: string;
  gradient?: string;
}

export function SectionHeader({ title, subtitle, gradient }: SectionHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <SectionTitle gradient={gradient}>{title}</SectionTitle>
      {subtitle && <p className="text-lg text-white/80 lg:text-xl">{subtitle}</p>}
    </div>
  );
}
