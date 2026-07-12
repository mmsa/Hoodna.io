import * as React from "react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface IconButtonProps extends Omit<ButtonProps, "size"> {
  "aria-label": string
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, type = "button", variant = "ghost", ...props }, ref) => (
    <Button
      ref={ref}
      type={type}
      size="icon"
      variant={variant}
      className={cn("shrink-0", className)}
      {...props}
    />
  )
)
IconButton.displayName = "IconButton"

export { IconButton }
