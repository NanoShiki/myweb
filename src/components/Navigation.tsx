import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { Scroll, Sword, BookOpen, Coffee } from "lucide-react";

export function Navigation() {
  const location = useLocation();

  const links = [
    { name: "ORARIO", path: "/", icon: Scroll },
    { name: "Magic Notes", path: "/magic-notes", icon: BookOpen },
    { name: "Tavern Rumors", path: "/tavern-rumors", icon: Coffee },
  ];

  return (
    <nav className="flex flex-wrap gap-2 md:gap-4 text-sm font-bold uppercase tracking-wider font-sans z-20">
      {links.map((link) => {
        const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
        const Icon = link.icon;
        
        return (
          <Link
            key={link.path}
            to={link.path}
            className={cn(
              "cursor-pointer px-2 py-1 border-b-2 transition-colors flex items-center gap-1.5",
              isActive 
                ? "text-guild-primary border-guild-primary" 
                : "text-guild-ink hover:text-guild-primary border-transparent"
            )}
          >
            <Icon 
              size={16} 
              className={cn(
                "transition-colors duration-300", 
                isActive ? "text-guild-primary" : "text-guild-ink"
              )} 
            />
            <span className="hidden sm:inline">{link.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
