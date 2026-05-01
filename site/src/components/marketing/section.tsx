import { cn } from "@/lib/utils";

export function Section({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("py-28 sm:py-36 lg:py-44", className)}
      {...props}
    />
  );
}
