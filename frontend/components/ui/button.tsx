"use client"

import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[var(--radius-pill)] border border-transparent bg-clip-padding font-sans text-[length:var(--text-body)] font-normal tracking-[var(--tracking-body)] whitespace-nowrap outline-none select-none transition-[background-color,border-color,color,transform,opacity] duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/35 active:not-aria-[haspopup]:scale-[0.985] disabled:pointer-events-none disabled:border-transparent disabled:bg-pebble disabled:text-ash disabled:opacity-100 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-apple-blue text-ice hover:bg-[#0077ed] [a]:hover:bg-[#0077ed]",
        outline:
          "border-link-blue bg-transparent text-link-blue hover:bg-link-blue/5 aria-expanded:bg-link-blue/5",
        secondary:
          "border-border bg-pebble text-carbon hover:bg-[#d8d8dc] aria-expanded:bg-pebble aria-expanded:text-carbon",
        ghost:
          "text-link-blue hover:bg-link-blue/5 aria-expanded:bg-link-blue/5",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        link: "h-auto rounded-none p-0 text-link-blue underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 gap-2 px-[15px] has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-8 gap-1.5 px-3 text-[length:var(--text-caption)] tracking-[var(--tracking-caption)] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-4 text-[length:var(--text-body-sm)] tracking-[var(--tracking-body-sm)] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-5 has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-11",
        "icon-xs":
          "size-8 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
