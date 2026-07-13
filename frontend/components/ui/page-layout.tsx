import * as React from "react"

import { cn } from "@/lib/utils"

type PageWidth = "sm" | "md" | "lg" | "xl" | "full"

const pageWidths: Record<PageWidth, string> = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-none",
}

export interface AppShellProps extends React.HTMLAttributes<HTMLDivElement> {}

const AppShell = React.forwardRef<HTMLDivElement, AppShellProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("min-h-screen bg-background text-foreground", className)}
      {...props}
    />
  )
)
AppShell.displayName = "AppShell"

export interface PageLayoutProps
  extends React.HTMLAttributes<HTMLElement> {
  width?: PageWidth
}

const PageLayout = React.forwardRef<HTMLElement, PageLayoutProps>(
  ({ className, width = "lg", ...props }, ref) => (
    <main
      ref={ref}
      className={cn(
        "mx-auto w-full py-2 sm:py-4",
        pageWidths[width],
        className
      )}
      {...props}
    />
  )
)
PageLayout.displayName = "PageLayout"

export interface PageHeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  eyebrow?: React.ReactNode
  actions?: React.ReactNode
}

const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  ({ title, description, eyebrow, actions, className, ...props }, ref) => (
    <header
      ref={ref}
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
      {...props}
    >
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? (
          <p className="mb-2 text-sm font-medium text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold leading-8 tracking-tight sm:text-3xl sm:leading-9">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  )
)
PageHeader.displayName = "PageHeader"

export interface SectionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  surface?: boolean
}

const Section = React.forwardRef<HTMLElement, SectionProps>(
  (
    {
      title,
      description,
      actions,
      surface = false,
      children,
      className,
      ...props
    },
    ref
  ) => (
    <section
      ref={ref}
      className={cn(
        "space-y-4",
        surface && "rounded-lg border border-border bg-card p-4 sm:p-6",
        className
      )}
      {...props}
    >
      {title || description || actions ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 className="text-lg font-semibold leading-6 tracking-tight">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
)
Section.displayName = "Section"

export { AppShell, PageHeader, PageLayout, Section }
