
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, PlusCircle, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type Option = {
  value: string
  label: string
}

interface MultiSelectComboboxProps {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  notFoundMessage?: string
  className?: string
}

export function MultiSelectCombobox({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  notFoundMessage = "No option found.",
  className,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const safeSelected = selected || [];

  const handleSelect = (value: string) => {
    const newSelected = safeSelected.includes(value)
      ? safeSelected.filter((item) => item !== value)
      : [...safeSelected, value]
    onChange(newSelected)
  }

  const handleCreate = () => {
    if (inputValue && !options.some(opt => opt.value.toLowerCase() === inputValue.toLowerCase()) && !safeSelected.includes(inputValue)) {
      onChange([...safeSelected, inputValue])
    }
    setInputValue("")
  }

  const handleRemove = (value: string) => {
    onChange(safeSelected.filter((item) => item !== value))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("group border border-input rounded-md p-1 flex items-center flex-wrap gap-1 hover:cursor-text", className)} onClick={() => setOpen(true)}>
          {safeSelected.length > 0 ? (
            safeSelected.map((value) => (
              <Badge key={value} variant="secondary" className="flex items-center gap-1">
                {options.find(opt => opt.value === value)?.label || value}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(value)
                  }}
                  className="rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  aria-label={`Remove ${value}`}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground px-2">{placeholder}</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              <div className="p-2">
                <p className="text-center text-sm text-muted-foreground mb-2">{notFoundMessage}</p>
                 {inputValue && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCreate}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Añadir "{inputValue}"
                  </Button>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      safeSelected.includes(option.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
