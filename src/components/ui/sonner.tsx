import { useTheme } from "@/hooks/useTheme"
import { Toaster as Sonner } from "sonner"

export function Toaster() {
  const { theme } = useTheme()
  return (
    <Sonner
      theme={theme as "light" | "dark" | "system"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-soft",
          error: "group toast group-[.toaster]:bg-destructive group-[.toaster]:text-destructive-foreground group-[.toaster]:border-destructive",
          success: "group toast group-[.toaster]:bg-success group-[.toaster]:text-success-foreground group-[.toaster]:border-success",
        },
      }}
    />
  )
}
