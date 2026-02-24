
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { allNavLinks, type NavLink } from '@/lib/nav-links';
import { Award, CalendarDays, FileSearch } from 'lucide-react';

const STORAGE_KEY = 'recentDashboardLinks';
const MAX_RECENT_LINKS = 3;

// Default links to show when there's no history
const defaultLinks: NavLink[] = [
  { name: "Evaluar Personal", href: "/dashboard/my-evaluations", icon: Award, id: "my-evaluations" },
  { name: "Solicitudes", href: "/dashboard/vacation-requests", icon: CalendarDays, id: "vacation-requests" },
  { name: "Evaluación de Perfil", href: "/dashboard/profile-evaluation", icon: FileSearch, id: "profile-evaluation" },
];


export function useRecentLinks() {
  const [recentLinks, setRecentLinks] = useState<NavLink[]>([]);

  const { allLinksMap } = useMemo(() => {
    const flatLinks = allNavLinks.flatMap(module => 
      module.groups 
      ? module.groups.flatMap(g => g.sublinks)
      : (module.sublinks || [])
    );
    const map = new Map<string, NavLink>();
    flatLinks.forEach(link => {
        if(link) map.set(link.href, link);
    });
    return { allLinksMap: map };
  }, []);

  useEffect(() => {
    try {
      const storedHrefs = localStorage.getItem(STORAGE_KEY);
      if (storedHrefs) {
        const hrefs = JSON.parse(storedHrefs) as string[];
        const hydratedLinks = hrefs.map(href => allLinksMap.get(href)).filter((l): l is NavLink => !!l);
        if (hydratedLinks.length > 0) {
            setRecentLinks(hydratedLinks);
            return;
        }
      }
    } catch (error) {
      console.error("Failed to parse recent links from localStorage", error);
    }
    // If nothing in storage or there was an error, set the default links
    setRecentLinks(defaultLinks);
  }, [allLinksMap]);

  const addRecentLink = useCallback((pathname: string) => {
    const newLink = allLinksMap.get(pathname);
    
    if (!newLink || pathname === '/dashboard') {
      return;
    }
    
    setRecentLinks(prevLinks => {
      // Prevent adding if it's already the first one
      if(prevLinks.length > 0 && prevLinks[0].href === newLink.href) {
        return prevLinks;
      }

      const filteredLinks = prevLinks.filter(link => link.href !== newLink.href);
      const updatedLinks = [newLink, ...filteredLinks];
      const finalLinks = updatedLinks.slice(0, MAX_RECENT_LINKS);
      
      try {
        const hrefsToStore = finalLinks.map(link => link.href);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(hrefsToStore));
      } catch (error) {
        console.error("Failed to save recent links to localStorage", error);
      }
      
      return finalLinks;
    });
  }, [allLinksMap]);

  return { recentLinks, addRecentLink };
}
