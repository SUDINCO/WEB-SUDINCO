"use client";

import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { ControllerRenderProps, UseFormReturn } from "react-hook-form";
import { Check } from "lucide-react";

type RatingValue = "NT" | "BA" | "ED" | "TI";

const ratings: { value: RatingValue, label: string, color: string, hoverColor: string }[] = [
  { value: "NT", label: "No Tiene", color: "bg-red-500", hoverColor: "hover:bg-red-600" },
  { value: "BA", label: "Bajo", color: "bg-yellow-400", hoverColor: "hover:bg-yellow-500" },
  { value: "ED", label: "En Desarrollo", color: "bg-green-500", hoverColor: "hover:bg-green-600" },
  { value: "TI", label: "Tiene", color: "bg-teal-500", hoverColor: "hover:bg-teal-600" },
];

interface EvaluationCriteriaGroupProps {
  title: string;
  description: string;
  field: ControllerRenderProps<any, any>;
  justificationField: ControllerRenderProps<any, any>;
  formInstance: UseFormReturn<any>;
}

export function EvaluationCriteriaGroup({ title, description, field, justificationField, formInstance }: EvaluationCriteriaGroupProps) {
  const justificationError = formInstance.formState.errors[justificationField.name]?.message;

  return (
    <div className="border border-gray-300 rounded-lg flex flex-col h-full">
      <div className="p-3 text-left border-b border-gray-300 rounded-t-lg flex-grow">
        <p className="font-bold text-gray-800">{title}</p>
        <p className="font-normal text-xs mt-1 text-gray-600">{description}</p>
      </div>
      <div className="flex">
        {ratings.map(rating => {
          const isSelected = field.value === rating.value;
          return (
            <button
              key={rating.value}
              type="button"
              onClick={() => field.onChange(rating.value)}
              className={cn(
                "flex-1 text-center p-2 border-r border-gray-300 last:border-r-0 font-bold transition-all flex justify-center items-center gap-2",
                isSelected
                  ? `${rating.color} ${rating.hoverColor} text-white ring-2 ring-blue-500 ring-inset z-10`
                  : 'bg-white text-black hover:bg-gray-100'
              )}
            >
              {isSelected && <Check className="h-4 w-4" />}
              {rating.value}
            </button>
          )
        })}
      </div>
      <div className="p-3 bg-gray-50/50 flex flex-col border-t border-gray-200 rounded-b-lg">
        <Label htmlFor={`justification-${field.name}`} className="text-xs font-semibold text-gray-600 mb-1 block">
          JUSTIFIQUE SU CALIFICACIÓN:
        </Label>
        <Textarea 
          id={`justification-${field.name}`} 
          {...justificationField} 
          placeholder=""
          className={cn(
            "mt-1 flex-grow min-h-[60px] text-sm focus-visible:ring-1 focus-visible:ring-blue-500 bg-white resize-none", 
            justificationError && "border-destructive"
          )}
        />
        {justificationError && <p className="text-sm font-medium text-destructive mt-1">{String(justificationError)}</p>}
      </div>
    </div>
  );
}
