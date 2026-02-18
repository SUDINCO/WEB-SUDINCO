'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel"

interface AppsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navLinks: any[];
}

export function AppsMenu({ isOpen, onClose, navLinks }: AppsMenuProps) {
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)
  const [count, setCount] = React.useState(0)

  const handleLinkClick = () => {
    onClose();
  };

  React.useEffect(() => {
    if (!api) {
      return
    }

    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap() + 1)

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1)
    })
  }, [api])

  if (!isOpen) return null;

  const allApps = navLinks.flatMap(module =>
    module.groups
      ? module.groups.flatMap((group: any) => group.sublinks)
      : module.sublinks
  );

  const appsPerPage = 12; // 3 columns x 4 rows
  const appPages = [];
  for (let i = 0; i < allApps.length; i += appsPerPage) {
    appPages.push(allApps.slice(i, i + appsPerPage));
  }

  return (
    <div className={cn('apps-menu-overlay', isOpen && 'active')} onClick={onClose}>
      <div className="apps-menu-content" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <h3 className="text-xl font-bold text-primary mb-5 text-center">Apps</h3>

        <Carousel setApi={setApi} className="w-full max-w-sm mx-auto">
          <CarouselContent>
            {appPages.map((page, index) => (
              <CarouselItem key={index}>
                <div className="p-1">
                  <div className="grid grid-cols-3 gap-y-4 gap-x-3">
                    {page.map((link: any) => (
                      <Link href={link.href} key={link.href} className="app-icon-link" onClick={handleLinkClick}>
                        <div className="app-icon-item" style={{ backgroundColor: `hsl(var(--card))` }}>
                          <link.icon className="app-icon-svg text-primary" />
                        </div>
                        <div className="h-8 flex items-start justify-center text-center">
                            <span className="app-icon-label">{link.name}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          {appPages.length > 1 && (
            <>
              <CarouselPrevious className="absolute -left-8 top-1/2 -translate-y-1/2" />
              <CarouselNext className="absolute -right-8 top-1/2 -translate-y-1/2" />
            </>
          )}
        </Carousel>

        {appPages.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: count }).map((_, index) => (
              <button
                key={index}
                onClick={() => api?.scrollTo(index)}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  current === index + 1 ? "bg-primary" : "bg-muted-foreground/30"
                )}
                aria-label={`Ir a la página ${index + 1}`}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
