"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  value: string | number
  label: string
  description?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string | number | null
  onValueChange: (value: string | number | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedOption = options.find((option) => option.value === value)
  
  // Create a map of search values to option values for reliable lookup
  const valueMap = React.useMemo(() => {
    const map = new Map<string, string | number>()
    options.forEach((option) => {
      const searchValue = `${option.label} ${option.description || ''}`.trim()
      map.set(searchValue.toLowerCase(), option.value)
    })
    return map
  }, [options])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-auto min-h-[2.5rem] py-2", className)}
        >
          {selectedOption ? (
            <div className="flex flex-col items-start flex-1 text-left">
              <span className="font-medium text-sm">{selectedOption.label}</span>
              {selectedOption.description && (
                <span className="text-xs text-muted-foreground mt-0.5">
                  {selectedOption.description}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground flex-1 text-left">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-none p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                // Use the label and description for search/filtering
                const searchValue = `${option.label} ${option.description || ''}`.trim()
                // Capture the option value in closure for reliable selection
                const optionValue = option.value
                return (
                  <CommandItem
                    key={option.value}
                    value={searchValue}
                    keywords={[option.label, option.description || ''].filter(Boolean)}
                    onSelect={(selectedValue) => {
                      console.log('onSelect fired:', selectedValue)
                      // cmdk passes the search value, look it up in our map
                      const actualValue = valueMap.get(selectedValue.toLowerCase())
                      if (actualValue !== undefined) {
                        onValueChange(actualValue)
                        setOpen(false)
                      } else {
                        // Fallback: use closure value
                        onValueChange(optionValue)
                        setOpen(false)
                      }
                    }}
                    className="cursor-pointer"
                    onClick={(e) => {
                      console.log('onClick fired on CommandItem')
                      e.preventDefault()
                      e.stopPropagation()
                      onValueChange(optionValue)
                      setOpen(false)
                    }}
                    onMouseDown={(e) => {
                      console.log('onMouseDown fired')
                      // Don't preventDefault - let the click event fire
                      onValueChange(optionValue)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div 
                      className="flex flex-col flex-1"
                      onClick={(e) => {
                        console.log('onClick fired on inner div')
                        e.preventDefault()
                        e.stopPropagation()
                        onValueChange(optionValue)
                        setOpen(false)
                      }}
                    >
                      <span>{option.label}</span>
                      {option.description && (
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

