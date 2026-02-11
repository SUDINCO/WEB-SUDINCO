
'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navLinks: any[]; 
}

export function AppsMenu({ isOpen, onClose, navLinks }: AppsMenuProps) {

  const handleLinkClick = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={cn('apps-menu-overlay', isOpen && 'active')} onClick={onClose}>
      <div className="apps-menu-content" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-8 w-8" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <h3 className="text-xl font-bold text-primary mb-5 text-center">Apps</h3>
        <div className="apps-menu-grid">
          {navLinks.flatMap(module => 
            module.groups 
              ? module.groups.flatMap((group: any) => group.sublinks) 
              : module.sublinks
          ).map((link: any) => (
            <Link href={link.href} key={link.href} className="app-icon-link" onClick={handleLinkClick}>
              <div className="app-icon-item" style={{ backgroundColor: `hsl(var(--card))` }}>
                <link.icon className="app-icon-svg text-primary" />
              </div>
              <span className="app-icon-label">{link.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
