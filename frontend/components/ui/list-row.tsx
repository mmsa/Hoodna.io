import * as React from "react"

import { cn } from "@/lib/utils"

export interface ListRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  leading?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
}

const ListRow = React.forwardRef<HTMLDivElement, ListRowProps>(
  (
    {
      title,
      description,
      leading,
      meta,
      actions,
      className,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
      className={cn(
        "flex min-h-16 items-center gap-3 border-b border-border px-4 py-3 last:border-b-0",
        className
      )}
      {...props}
    >
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          {meta ? (
            <div className="shrink-0 text-xs text-muted-foreground">{meta}</div>
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex min-h-11 shrink-0 items-center gap-1">{actions}</div>
      ) : null}
    </div>
  )
)
ListRow.displayName = "ListRow"

export { ListRow }
