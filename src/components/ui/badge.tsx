import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--color-app-info-soft)] text-[var(--color-app-info)]",
        secondary:
          "border-transparent bg-[var(--color-app-surface-alt)] text-[var(--color-app-text-muted)]",
        destructive:
          "border-transparent bg-[var(--color-app-danger-soft)] text-[var(--color-app-danger)]",
        outline:
          "border-[var(--color-app-border-strong)] text-[var(--color-app-text-muted)] bg-white",
        success:
          "border-transparent bg-[var(--color-app-success-soft)] text-[var(--color-app-success)]",
        warning:
          "border-transparent bg-[var(--color-app-warning-soft)] text-[var(--color-app-warning)]",
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
