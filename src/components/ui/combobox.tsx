
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, CheckCircle2, PlusCircle } from "lucide-react"

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

type Option = {
  value: string
  label: string
  keywords?: string;
  description?: string; 
  isSaved?: boolean;
}

interface ComboboxProps {
  options: Option[]
  value?: string
  onChange: (value: string) => void
  onBlur?: () => void;
  name?: string;
  placeholder?: string
  searchPlaceholder?: string
  notFoundMessage?: string
  className?: string;
  allowCreate?: boolean;
  disabled?: boolean;
}

const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = "Select an option",
      searchPlaceholder = "Search...",
      notFoundMessage = "No option found.",
      className,
      allowCreate = false,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const [inputValue, setInputValue] = React.useState("")

    const handleSelect = (currentValue: string) => {
      onChange(currentValue.toLowerCase() === value?.toLowerCase() ? "" : currentValue)
      setOpen(false)
      setInputValue("")
    }

    const handleCreate = () => {
        if (inputValue) {
            onChange(inputValue);
            setOpen(false);
            setInputValue("");
        }
    };
    
    const selectedOption = options.find((option) => option.value.toLowerCase() === value?.toLowerCase());

    const filteredOptions = options.filter(option =>
      option.label.toLowerCase().includes(inputValue.toLowerCase())
    );

    return (
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between h-auto", !value && "text-muted-foreground", className)}
            ref={ref}
            disabled={disabled}
            {...props}
          >
            <div className="flex flex-col items-start text-left">
              {selectedOption ? (
                <>
                  <span className="truncate font-medium">{selectedOption.label}</span>
                  {selectedOption.description && <span className="truncate text-xs text-muted-foreground">{selectedOption.description}</span>}
                </>
              ) : value ? (
                 <span className="truncate font-medium">{value}</span>
              ) : (
                <span className="font-normal">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput
              placeholder={searchPlaceholder}
              value={inputValue}
              onValueChange={setInputValue}
            />
            <CommandList>
                {(filteredOptions.length === 0 && allowCreate && inputValue) ? (
                     <CommandEmpty>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleCreate}
                          >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Añadir "{inputValue}"
                          </Button>
                     </CommandEmpty>
                ) : (
                    <CommandEmpty>{notFoundMessage}</CommandEmpty>
                )}
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                    className="flex justify-between items-start cursor-pointer"
                  >
                    <div className="flex items-start">
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 mt-0.5",
                          value?.toLowerCase() === option.value.toLowerCase() ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        {option.description && <span className="text-xs text-muted-foreground">{option.description}</span>}
                      </div>
                    </div>
                    {option.isSaved && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }
)

Combobox.displayName = "Combobox";

export { Combobox }
