import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Suggestion {
  name: string;
  city?: string;
  street?: string;
  housenumber?: string;
  lat?: number;
  lng?: number;
  full_address: string;
  isCustom?: boolean;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
}

// Normalizador inteligente de nomenclaturas de direcciones en Colombia y Latinoamérica
function normalizeColombianAddress(raw: string): string {
  if (!raw) return '';
  let text = raw.trim();
  
  // Reemplazar abreviaturas comunes al inicio o en palabras aisladas
  text = text.replace(/\b(dg|diag|diago)\.?\b/gi, 'Diagonal');
  text = text.replace(/\b(cll|cl|call)\.?\b/gi, 'Calle');
  text = text.replace(/\b(cra|cr|kr|carr)\.?\b/gi, 'Carrera');
  text = text.replace(/\b(tv|tr|trans|transv)\.?\b/gi, 'Transversal');
  text = text.replace(/\b(av|avd|aven)\.?\b/gi, 'Avenida');
  text = text.replace(/\b(auto|autop)\.?\b/gi, 'Autopista');
  text = text.replace(/\b(cir|circ)\.?\b/gi, 'Circular');
  text = text.replace(/\b(manz|mz)\.?\b/gi, 'Manzana');
  
  return text;
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
    const cleanText = text.trim();
    if (cleanText.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const normalized = normalizeColombianAddress(cleanText);
    setIsLoading(true);

    try {
      const results: Suggestion[] = [];

      // 1. Consulta en paralelo: Nominatim (Excelente para direcciones de Colombia) y Photon (Komoot)
      const nominatimPromise = fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(normalized + ', Colombia')}&format=json&addressdetails=1&limit=5&countrycodes=co`,
        { headers: { 'Accept-Language': 'es' } }
      ).then(res => res.ok ? res.json() : []).catch(() => []);

      const photonPromise = fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(normalized)}&lat=7.1193&lon=-73.1198&limit=5&lang=es`
      ).then(res => res.ok ? res.json() : { features: [] }).catch(() => ({ features: [] }));

      const [nomData, photonData] = await Promise.all([nominatimPromise, photonPromise]);

      // Procesar resultados de Nominatim
      if (Array.isArray(nomData)) {
        nomData.forEach((item: any) => {
          const addr = item.address || {};
          const road = addr.road || addr.pedestrian || addr.suburb || item.display_name.split(',')[0];
          const house = addr.house_number ? ` #${addr.house_number}` : '';
          const city = addr.city || addr.town || addr.village || addr.municipality || 'Colombia';
          const name = `${road}${house}`;
          const full = `${name}, ${city}`;

          if (name && !results.some(r => r.full_address === full)) {
            results.push({
              name,
              full_address: full,
              city,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon)
            });
          }
        });
      }

      // Procesar resultados de Photon
      if (photonData?.features && Array.isArray(photonData.features)) {
        photonData.features.forEach((f: any) => {
          const p = f.properties;
          const name = p.name || p.street || '';
          const house = p.housenumber ? ` #${p.housenumber}` : '';
          const city = p.city || p.county || p.state || '';
          const full = `${name}${house}${city ? `, ${city}` : ''}`;

          if (name && !results.some(r => r.full_address === full || r.name === `${name}${house}`)) {
            results.push({
              name: `${name}${house}`,
              full_address: full,
              city,
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0]
            });
          }
        });
      }

      // 2. Opción inteligente personalizada siempre disponible para asegurar uso continuo estilo delivery
      const customOption: Suggestion = {
        name: normalized,
        full_address: `${normalized} (Usar dirección exacta ingresada)`,
        isCustom: true
      };

      // Colocamos la sugerencia personalizada al inicio si es una dirección específica
      setSuggestions([customOption, ...results.slice(0, 5)]);
      setShowDropdown(true);
    } catch (error) {
      console.error('Error buscando direcciones:', error);
      // Fallback siempre activo en caso de fallo de red
      const fallback: Suggestion = {
        name: normalized,
        full_address: `${normalized} (Usar dirección ingresada)`,
        isCustom: true
      };
      setSuggestions([fallback]);
      setShowDropdown(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        searchAddresses(query);
      } else {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (s: Suggestion) => {
    const finalAddress = s.isCustom ? s.name : s.full_address;
    const coords = s.lat && s.lng ? { lat: s.lat, lng: s.lng } : undefined;
    
    onChange(finalAddress, coords);
    setQuery(finalAddress);
    setShowDropdown(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-emerald-500" /> : <Search className="h-4 w-4" />}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            onChange(val);
            if (val.trim().length >= 2) setShowDropdown(true);
          }}
          onFocus={() => query.trim().length >= 2 && setShowDropdown(true)}
          placeholder={placeholder}
          className="w-full h-14 rounded-2xl bg-slate-50 border-transparent focus:bg-white focus:ring-4 focus:ring-emerald-100 transition-all pl-11 pr-10 text-sm font-bold text-slate-800"
        />
        {query && (
          <button 
            type="button"
            onClick={() => { setQuery(''); onChange(''); setSuggestions([]); setShowDropdown(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[9999] mt-2 w-full overflow-hidden rounded-2xl border border-slate-100 bg-white text-slate-800 shadow-2xl backdrop-blur-xl"
          >
            <div className="max-h-[280px] overflow-y-auto p-1.5 space-y-1">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left rounded-xl transition-all ${
                    s.isCustom
                      ? "bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-950 font-medium"
                      : "hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  {s.isCustom ? (
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                      <Navigation className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-slate-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                  )}

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold truncate text-slate-900">{s.name}</span>
                      {s.isCustom && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white">
                          Dirección Directa
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 truncate mt-0.5">
                      {s.full_address}
                    </span>
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

