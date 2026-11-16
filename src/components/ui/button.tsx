import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-app-ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-app-primary)] text-white hover:bg-[var(--color-app-primary-hover)]",
        destructive:
          "bg-[var(--color-app-danger)] text-white hover:bg-[var(--color-app-danger)]/90",
        outline:
          "bg-[var(--color-app-surface-alt)] text-[var(--color-app-text)] hover:bg-[var(--color-app-border-strong)]/60",
        secondary:
          "bg-white text-[var(--color-app-text)] hover:bg-[var(--color-app-surface-muted)]",
        ghost:
          "text-[var(--color-app-text)] hover:bg-[var(--color-app-surface-alt)]",
        accent:
          "bg-[var(--color-app-accent)] text-[var(--color-app-accent-ink)] hover:brightness-95",
        link:
          "text-[var(--color-app-text)] underline underline-offset-2 hover:text-[var(--color-app-text-muted)]",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
