import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex min-h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[var(--radius-pill)] border border-transparent px-3 py-1 text-[length:var(--text-caption)] font-normal leading-[var(--leading-caption)] tracking-[var(--tracking-caption)] whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-apple-blue text-ice [a]:hover:bg-[#0077ed]",
        secondary:
          "border-border bg-white text-carbon [a]:hover:bg-frost",
        queued:
          "border-[#f4c26b] bg-[#fff7e6] text-[#7a4d00]",
        processing:
          "border-signal-blue/40 bg-ice text-link-blue",
        ready:
          "border-[#8fd8b3] bg-[#eefaf4] text-[#12643d]",
        failed:
          "border-[#f2b8b5] bg-[#fff1f0] text-[#b42318]",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 [a]:hover:bg-destructive/20",
        outline:
          "border-link-blue text-link-blue [a]:hover:bg-link-blue/5",
        ghost:
          "text-ash hover:bg-frost hover:text-carbon",
        link: "text-link-blue underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
