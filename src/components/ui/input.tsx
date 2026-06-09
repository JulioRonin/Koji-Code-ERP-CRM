import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-[var(--color-app-border-strong)] bg-white px-3 py-2 text-sm text-[var(--color-app-text)] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--color-app-text-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-app-primary)]/40 focus-visible:border-[var(--color-app-primary)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
