import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-slate-950 text-white shadow-lg shadow-slate-950/10 hover:bg-slate-800",
  secondary: "border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50",
  ghost: "text-slate-700 hover:bg-slate-100",
  danger: "bg-rose-600 text-white shadow-lg shadow-rose-600/10 hover:bg-rose-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  icon: "h-9 w-9 p-0",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  icon?: ReactNode;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  icon,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  icon?: ReactNode;
};

export function LinkButton({
  className,
  variant = "secondary",
  size = "md",
  icon,
  children,
  href,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-semibold transition",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </Link>
  );
}
