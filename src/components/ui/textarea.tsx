import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-cyber-border bg-cyber-dark/50 px-3 py-2 text-sm text-cyber-text ring-offset-cyber-dark placeholder:text-cyber-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyber-neon focus-visible:border-cyber-neon disabled:cursor-not-allowed disabled:opacity-50 font-cyber transition-all",
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
