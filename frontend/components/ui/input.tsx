import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-[52px] w-full min-w-0 rounded-lg border border-input bg-white px-[var(--spacing-16)] py-[var(--spacing-8)] text-[length:var(--text-body)] leading-[var(--leading-body)] tracking-[var(--tracking-body)] text-carbon transition-[border-color,box-shadow,background-color] duration-150 outline-none placeholder:text-ash focus-visible:border-apple-blue focus-visible:ring-3 focus-visible:ring-apple-blue/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-pebble disabled:text-ash disabled:opacity-70 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15",
        className
      )}
      {...props}
    />
  )
}

export { Input }
