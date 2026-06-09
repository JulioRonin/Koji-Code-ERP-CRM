import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-app-primary)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-app-primary)] text-white hover:bg-[var(--color-app-primary-hover)]",
        destructive:
          "bg-[var(--color-app-danger)] text-white hover:bg-[var(--color-app-danger)]/90",
        outline:
          "border border-[var(--color-app-border-strong)] bg-white text-[var(--color-app-text)] hover:bg-[var(--color-app-surface-alt)]",
        secondary:
          "bg-[var(--color-app-surface-alt)] text-[var(--color-app-text)] hover:bg-[var(--color-app-border)]",
        ghost:
          "text-[var(--color-app-text)] hover:bg-[var(--color-app-surface-alt)]",
        link:
          "text-[var(--color-app-primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "h-9 w-9",
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
