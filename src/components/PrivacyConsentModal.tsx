
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ShieldCheck, LoaderCircle } from 'lucide-react';
import type { PrivacyConsent } from '@/lib/types';

const CONSENT_VERSION = "1.0";

export function PrivacyConsentModal() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const consentDocRef = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'privacyConsents', user.uid);
  }, [firestore, user?.uid]);

  const { data: consentData, isLoading } = useDoc<PrivacyConsent>(consentDocRef);

  const showModal = !isLoading && user && (!consentData || consentData.version !== CONSENT_VERSION);

  const handleAccept = async () => {
    if (!consentDocRef || !user?.uid) return;

    setIsSubmitting(true);
    try {
      await setDoc(consentDocRef, {
        uid: user.uid,
        acceptedAt: Date.now(),
        version: CONSENT_VERSION,
        accepted: true,
      });
    } catch (error) {
      console.error("Error saving privacy consent:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showModal) return null;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]" hideCloseButton>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-full">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">Aviso de Privacidad y Consentimiento</DialogTitle>
          </div>
          <DialogDescription className="text-base leading-relaxed text-foreground/80">
            Para continuar utilizando el sistema **PERFORMA**, es necesario que aceptes nuestra política de tratamiento de datos personales conforme a la normativa legal vigente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6 px-4 bg-muted/50 rounded-lg border border-border/50">
          <div className="flex items-start space-x-3">
            <Checkbox 
              id="consent-check" 
              checked={accepted} 
              onCheckedChange={(checked) => setAccepted(checked as boolean)}
              className="mt-1"
            />
            <Label 
              htmlFor="consent-check" 
              className="text-sm font-normal leading-relaxed cursor-pointer select-none"
            >
              En cumplimiento de la Ley Orgánica de Protección de Datos Personales (LOPDP), otorgo mi consentimiento libre, específico, informado e inequívoco para el tratamiento de mis datos personales en el sistema PERFORMA, con fines administrativos, operativos y de gestión interna de la empresa.
            </Label>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button 
            onClick={handleAccept} 
            disabled={!accepted || isSubmitting}
            className="w-full sm:w-auto min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              "Aceptar y Continuar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
