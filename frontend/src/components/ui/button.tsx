import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-sm)] text-sm font-medium ring-offset-background transition-all duration-[var(--duration-normal)] ease-[var(--ease-default)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation cursor-pointer transform active:scale-95 hover:-translate-y-0.5",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-lg)]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-lg)]",
        outline:
          "border-2 border-primary/30 text-primary bg-background hover:bg-primary/10 hover:border-primary hover:shadow-[var(--shadow-md)] active:border-primary/70",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-lg)]",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:bg-accent/80",
        link: "text-primary underline-offset-4 hover:underline active:text-primary/80",
        success:
          "bg-[hsl(var(--status-success-600))] text-white hover:bg-[hsl(var(--status-success-500))] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-lg)]",
        warning:
          "bg-[hsl(var(--status-warning-500))] text-white hover:bg-[hsl(var(--status-warning-400))] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-lg)]",
        info:
          "bg-[hsl(var(--status-info-500))] text-white hover:bg-[hsl(var(--status-info-400))] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-lg)]",
      },
      size: {
        default: "h-11 px-4 py-2 min-h-[44px]",
        sm: "h-10 rounded-[var(--radius-sm)] px-3 min-h-[44px]",
        lg: "h-12 rounded-[var(--radius-md)] px-8 min-h-[48px]",
        icon: "h-11 w-11 min-h-[44px] min-w-[44px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
