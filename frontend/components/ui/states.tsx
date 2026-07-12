import * as React from "react"
import { AlertCircle, Inbox, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

interface StateFrameProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

function StateFrame({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: StateFrameProps) {
  return (
    <div
      className={cn(
        "flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card px-6 py-8 text-center",
        className
      )}
      {...props}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        {icon}
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

export interface EmptyStateProps
  extends Omit<StateFrameProps, "icon"> {
  icon?: React.ReactNode
}

function EmptyState({ icon, ...props }: EmptyStateProps) {
  return (
    <StateFrame
      icon={icon ?? <Inbox aria-hidden="true" className="h-5 w-5" />}
      {...props}
    />
  )
}

export interface LoadingStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode
  description?: React.ReactNode
}

function LoadingState({
  title = "Loading",
  description,
  className,
  ...props
}: LoadingStateProps) {
  return (
    <StateFrame
      role="status"
      aria-live="polite"
      icon={
        <Loader2
          aria-hidden="true"
          className="h-5 w-5 animate-spin motion-reduce:animate-none"
        />
      }
      title={title}
      description={description}
      className={className}
      {...props}
    />
  )
}

export interface ErrorStateProps
  extends Omit<StateFrameProps, "icon"> {
  icon?: React.ReactNode
}

function ErrorState({ icon, ...props }: ErrorStateProps) {
  return (
    <StateFrame
      role="alert"
      icon={
        icon ?? (
          <AlertCircle
            aria-hidden="true"
            className="h-5 w-5 text-destructive"
          />
        )
      }
      {...props}
    />
  )
}

export { EmptyState, ErrorState, LoadingState }
