import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"
import { useAppeared } from "@/components/kanri/motion"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => {
  // Se llena desde 0 al aparecer (movimiento sutil del rediseño).
  const ready = useAppeared()
  const v = ready ? value || 0 : 0
  return (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-[var(--color-app-surface-alt)]",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 rounded-full bg-[var(--color-app-primary)] transition-transform duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)]"
      style={{ transform: `translateX(-${100 - v}%)` }}
    />
  </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
