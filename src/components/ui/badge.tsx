import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-[var(--color-neon-cyan)] bg-[var(--color-neon-cyan)]/10 text-[var(--color-neon-cyan)] shadow-[0_0_5px_var(--color-neon-cyan-dim)]",
        secondary:
          "border-[var(--color-neon-purple)] bg-[var(--color-neon-purple)]/10 text-[var(--color-neon-purple)] shadow-[0_0_5px_var(--color-neon-purple)]",
        destructive:
          "border-[var(--color-neon-red)] bg-[var(--color-neon-red)]/10 text-[var(--color-neon-red)] shadow-[0_0_5px_var(--color-neon-red)]",
        outline: "border-[var(--color-neon-cyan-dim)] text-[var(--color-text-main)]",
        success: "border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-[0_0_5px_rgba(16,185,129,0.5)]",
        warning: "border-amber-500 bg-amber-500/10 text-amber-400 shadow-[0_0_5px_rgba(245,158,11,0.5)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
