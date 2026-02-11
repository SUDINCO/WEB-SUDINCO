'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import * as React from 'react';

interface ConditioningPanelProps {
  conditioning: {
    morning: number;
    afternoon: number;
    night: number;
  };
  isAutomatic: boolean;
  onDraftChange: (newConditioning: { morning: number; afternoon: number; night: number }, isAutomatic: boolean) => void;
  isLocked: boolean;
  totalCollaborators: number;
  disabled?: boolean;
}

export function ConditioningPanel({ conditioning, isAutomatic, onDraftChange, isLocked, totalCollaborators, disabled = false }: ConditioningPanelProps) {
  const handleChange = (shift: 'morning' | 'afternoon' | 'night', value: string) => {
    if (value === '') {
      const newConditioning = { ...conditioning, [shift]: 0 };
      onDraftChange(newConditioning, isAutomatic);
      return;
    }
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0) {
      const newConditioning = { ...conditioning, [shift]: numValue };
      onDraftChange(newConditioning, isAutomatic);
    }
  };
  
  const handleAutomaticChange = (checked: boolean) => {
      onDraftChange(conditioning, checked);
  };

  const assignedShifts = isAutomatic ? 0 : conditioning.morning + conditioning.afternoon + conditioning.night;
  const libCount = Math.max(0, totalCollaborators - assignedShifts);

  const isEffectivelyDisabled = disabled || isLocked;
  const isInputDisabled = isEffectivelyDisabled || isAutomatic;

  const suggestionMessage = React.useMemo(() => {
    const totalDailyShifts = conditioning.morning + conditioning.afternoon + conditioning.night;
    if (isAutomatic || disabled || totalDailyShifts === 0) {
        return null;
    }

    const recommended = Math.ceil(totalDailyShifts * 1.4);

    if (totalCollaborators < recommended) {
        return (
            <div className="text-xs text-yellow-800 flex items-start gap-2 mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-500/30">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                    Para cubrir <strong>{totalDailyShifts}</strong> turnos diarios y mantener un balance de descansos (ej. ciclo 2-2-1-2), se recomiendan al menos <strong>{recommended}</strong> cajeros. Con los <strong>{totalCollaborators}</strong> actuales, el balance se verá afectado para cumplir la demanda.
                </span>
            </div>
        );
    }
    
    return null;

  }, [conditioning, isAutomatic, totalCollaborators, disabled]);


  return (
    <Card className={cn("mb-6 p-4 shadow-sm bg-muted/30 transition-opacity", disabled && 'opacity-50 cursor-not-allowed')}>
        <fieldset disabled={isEffectivelyDisabled} className="group">
            <div className="flex flex-wrap items-center justify-start gap-x-4 gap-y-3">
                <div className="flex items-center gap-2 shrink-0 mr-auto">
                    <p className="font-semibold text-sm text-foreground">Condicionamiento (Cajeros):</p>
                    {isLocked && !disabled && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                </div>

                <div className="flex items-center space-x-2">
                    <Switch id="automatic-mode" checked={isAutomatic} onCheckedChange={handleAutomaticChange} disabled={isEffectivelyDisabled} />
                    <Label htmlFor="automatic-mode" className="text-sm font-medium">Automático</Label>
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="morning-shift" className="text-sm font-medium">M8</Label>
                    <Input
                        id="morning-shift"
                        type="number"
                        min="0"
                        value={conditioning.morning || ''}
                        onChange={(e) => handleChange('morning', e.target.value)}
                        className="h-8 w-16 bg-background"
                        disabled={isInputDisabled}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="afternoon-shift" className="text-sm font-medium">T8</Label>
                    <Input
                        id="afternoon-shift"
                        type="number"
                        min="0"
                        value={conditioning.afternoon || ''}
                        onChange={(e) => handleChange('afternoon', e.target.value)}
                        className="h-8 w-16 bg-background"
                        disabled={isInputDisabled}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="night-shift" className="text-sm font-medium">N8</Label>
                    <Input
                        id="night-shift"
                        type="number"
                        min="0"
                        value={conditioning.night || ''}
                        onChange={(e) => handleChange('night', e.target.value)}
                        className="h-8 w-16 bg-background"
                        disabled={isInputDisabled}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="lib-shift" className="text-sm font-medium">LIB</Label>
                    <Input
                        id="lib-shift"
                        type="number"
                        value={libCount}
                        disabled
                        className="h-8 w-16 bg-muted/50"
                    />
                </div>
            </div>
            
            <div className="mt-1">
                {disabled && (
                    <p className="text-xs text-muted-foreground mt-2">
                        Por favor, seleccione una ubicación específica para configurar el condicionamiento.
                    </p>
                )}
                {isLocked && !disabled && (
                     <p className="text-xs text-muted-foreground mt-2">
                        El condicionamiento y el horario están confirmados. Para hacer cambios, utilice el botón "Modificar Horario".
                     </p>
                )}
                {!isLocked && suggestionMessage}
            </div>
        </fieldset>
    </Card>
  );
}
