import { Factory, Cog, Wrench, Megaphone, Ruler, Briefcase, GraduationCap, Hammer, Building2 } from 'lucide-react';

const MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Factory,
  Cog,
  Wrench,
  Megaphone,
  Ruler,
  Briefcase,
  GraduationCap,
  Hammer,
};

export function IndustryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? Building2;
  return <Icon className={className} />;
}
