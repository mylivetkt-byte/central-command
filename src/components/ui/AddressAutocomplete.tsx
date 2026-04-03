import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Suggestion {
  name: string;
  city?: string;
  street?: string;
  housenumber?: string;
  lat: number;
  lng: number;
  full_address: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({ 
  value, 
  onChange, 
  placeholder = "Buscar dirección...",
  className = ""
}) => {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddresses = async (text: string) => {
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      // Usamos Photon (OSM) que es gratuito y rápido para autocomplete
      // Limitamos a Colombia y priorizamos Bucaramanga
      const response = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&lat=7.1193&lon=-73.1198&limit=5&lang=es`
      );
      const data = await response.json();

      const results = data.features.map((f: any) => {
        const p = f.properties;
        const name = p.name || p.street || '';
        const house = p.housenumber ? ` ${p.housenumber}` : '';
        const street = p.street ? `, ${p.street}` : '';
        const city = p.city ? `, ${p.city}` : '';
        
        return {
          name: name + house,
          full_address: `${name}${house}${street}${city}`,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0]
        };
      });

      setSuggestions(results);
      setShowDropdown(true);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query !== value) {
        searchAddresses(query);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (s: Suggestion) => {
    onChange(s.full_address, { lat: s.lat, lng: s.lng });
    setQuery(s.full_address);
    setShowDropdown(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
          }}
          onFocus={() => query.length >= 3 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full rounded-lg bg-muted/50 border border-border/50 pl-10 pr-10 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {query && (
          <button 
            type="button"
            onClick={() => { setQuery(''); onChange(''); setSuggestions([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl backdrop-blur-md"
          >
            <div className="max-h-[250px] overflow-y-auto py-1">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/50 last:border-0"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold leading-none">{s.name}</span>
                    <span className="mt-1 text-[11px] text-muted-foreground line-clamp-1">{s.full_address}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AddressAutocomplete;
