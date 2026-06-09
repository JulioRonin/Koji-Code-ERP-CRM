import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-[var(--color-app-border-strong)] bg-white px-3 py-2 text-sm text-[var(--color-app-text)] placeholder:text-[var(--color-app-text-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-app-primary)]/40 focus-visible:border-[var(--color-app-primary)] disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
