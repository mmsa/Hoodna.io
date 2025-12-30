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
              <span className="font-medium text-sm text-gray-900">{selectedOption.label}</span>
              {selectedOption.description && (
                <span className="text-xs text-gray-600 mt-0.5">
                  {selectedOption.description}
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-500 flex-1 text-left">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-600" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-none p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                // Use the option value as the unique identifier
                const optionValue = String(option.value)
                const isSelected = value === option.value
                
                return (
                  <CommandItem
                    key={option.value}
                    value={optionValue}
                    keywords={[option.label, option.description || ''].filter(Boolean)}
                    onSelect={() => {
                      // When selected (via click or keyboard), update the value
                      onValueChange(option.value)
                      setOpen(false)
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col flex-1">
                      <span className="text-gray-900">{option.label}</span>
                      {option.description && (
                        <span className="text-xs text-gray-600">
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

