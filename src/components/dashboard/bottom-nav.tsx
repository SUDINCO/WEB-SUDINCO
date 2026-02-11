
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, User, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import React from 'react';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Inicio' },
  { href: '#', icon: LayoutGrid, label: 'Menú', isCentral: true },
  { href: '/dashboard/profile', icon: User, label: 'Perfil' },
];

export function BottomNav({ onCentralClick }: { onCentralClick: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-content">
        {navItems.map((item) => {
          if (item.isCentral) {
            return (
              <button
                key="central-button"
                className="central-nav-item"
                onClick={(e) => {
                  e.preventDefault();
                  onCentralClick();
                }}
              >
                <item.icon className="apps-svg-icon" />
              </button>
            );
          }

          const isActive = (item.href === '/dashboard' && pathname === item.href) || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          
          return (
            <Link href={item.href} key={item.href} className={cn('bottom-nav-item', isActive && 'active')}>
              <item.icon className="bottom-nav-icon" />
              <span className="bottom-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
