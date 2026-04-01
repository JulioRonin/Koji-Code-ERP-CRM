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
          "flex h-10 w-full rounded-md border border-cyber-border bg-cyber-dark/50 px-3 py-2 text-sm text-cyber-text ring-offset-cyber-dark file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-cyber-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyber-neon focus-visible:border-cyber-neon disabled:cursor-not-allowed disabled:opacity-50 font-cyber transition-all",
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
