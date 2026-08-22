import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, Navigation, Crosshair, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from "@/integrations/supabase/client";

interface Suggestion {
  name: string;
  city?: string;
  street?: string;
  housenumber?: string;
  lat?: number;
  lng?: number;
  full_address: string;
  isCustom?: boolean;
  place_id?: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
}

// Normalizador y formateador inteligente de direcciones estilo Colombia/LatAm
function parseAndFormatColombianAddress(raw: string): { formatted: string; isStructured: boolean } {
  if (!raw) return { formatted: '', isStructured: false };
  let text = raw.trim();

  // 1. Reemplazar abreviaturas comunes de vías principales
  text = text.replace(/\b(dg|diag|diago)\.?\b/gi, 'Diagonal');
  text = text.replace(/\b(cll|cl|call)\.?\b/gi, 'Calle');
  text = text.replace(/\b(cra|cr|kr|carr)\.?\b/gi, 'Carrera');
  text = text.replace(/\b(tv|tr|trans|transv)\.?\b/gi, 'Transversal');
  text = text.replace(/\b(av|avd|aven)\.?\b/gi, 'Avenida');
  text = text.replace(/\b(auto|autop)\.?\b/gi, 'Autopista');
  text = text.replace(/\b(cir|circ)\.?\b/gi, 'Circular');
  text = text.replace(/\b(manz|mz)\.?\b/gi, 'Manzana');

  // 2. Formatear automáticamente 3 grupos numéricos: "Carrera 23 33 39" -> "Carrera 23 #33-39"
  const match3 = text.match(/^([a-záéíóúñ\s]+)\s+(\d+[a-z]?)\s+([#\s]*\d+[a-z]?)\s+[-#\s]*(\d+)/i);
  if (match3) {
    const via = match3[1].trim();
    const numVia = match3[2].trim();
    const numGen = match3[3].replace(/[^\d\w]/g, '').trim();
    const numPlaca = match3[4].trim();
    return {
      formatted: `${via} ${numVia} #${numGen}-${numPlaca}`,
      isStructured: true
    };
  }

  // 3. Formatear 2 grupos numéricos: "Carrera 23 33" -> "Carrera 23 #33"
  const match2 = text.match(/^([a-záéíóúñ\s]+)\s+(\d+[a-z]?)\s+([#\s]*\d+[a-z]?)$/i);
  if (match2) {
    const via = match2[1].trim();
    const numVia = match2[2].trim();
    const numGen = match2[3].replace(/[^\d\w]/g, '').trim();
    return {
      formatted: `${via} ${numVia} #${numGen}`,
      isStructured: true
    };
  }

  return { formatted: text, isStructured: false };
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
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [cityName, setCityName] = useState<string>(""); 
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Obtener geolocalización GPS real del dispositivo para sesgar dinámicamente la búsqueda a la ciudad/ubicación real
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLocation({ lat, lng });

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
            if (res.ok) {
              const data = await res.json();
              const city = data?.address?.city || data?.address?.town || data?.address?.municipality || data?.address?.county;
              if (city) setCityName(city);
            }
          } catch {}
        },
        () => console.log('[GPS] Geolocalización no otorgada'),
        { timeout: 4000 }
      );
    }
  }, []);

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

    const { formatted, isStructured } = parseAndFormatColombianAddress(cleanText);
    setIsLoading(true);

    try {
      const results: Suggestion[] = [];
      const lat = userLocation?.lat;
      const lng = userLocation?.lng;

      // 1. Consulta dinámica a Google Maps (vía Edge Function) pasando lat/lng reales solo si existen
      try {
        const { data: gData, error: gErr } = await supabase.functions.invoke('google-navigation', {
          body: {
            action: 'autocomplete',
            input: formatted,
            biasLat: lat,
            biasLng: lng
          }
        });

        if (!gErr && gData) {
          // 1a. Procesar predicciones de Google Places
          if (Array.isArray(gData.predictions)) {
            gData.predictions.forEach((p: any) => {
              const mainText = p.structured_formatting?.main_text || p.description.split(',')[0];
              const secondaryText = p.structured_formatting?.secondary_text || p.description;
              results.push({
                name: mainText,
                full_address: `${mainText}, ${secondaryText}`,
                city: secondaryText,
                place_id: p.place_id,
              });
            });
          }

          // 1b. Procesar resultados directos de Google Maps Geocoding
          if (Array.isArray(gData.results)) {
            gData.results.forEach((item: any) => {
              if (item.name && !results.some(r => r.full_address === item.full_address || r.name === item.name)) {
                results.push({
                  name: item.name,
                  full_address: item.full_address,
                  city: item.secondary_text,
                  lat: item.lat,
                  lng: item.lng,
                });
              }
            });
          }
        }
      } catch (e) {
        console.log('[Google Maps] Error o timeout');
      }

      // 2. Consulta de respaldo secundaria solo si Google dio pocos resultados
      if (results.length < 5) {
        const viewboxParam = (lat && lng) ? `&viewbox=${lng - 0.3},${lat + 0.3},${lng + 0.3},${lat - 0.3}&bounded=0` : '';
        const locationSuffix = cityName ? `, ${cityName}` : '';
        const cleanQuery = `${cleanText}${locationSuffix}`;
        const photonQuery = `${formatted}${locationSuffix}`;
        
        const nominatimPromise = fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=json&addressdetails=1&limit=5${viewboxParam}`,
          { headers: { 'Accept-Language': 'es' } }
        ).then(res => res.ok ? res.json() : []).catch(() => []);

        const photonLocationParam = (lat && lng) ? `&lat=${lat}&lon=${lng}` : '';
        const photonPromise = fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(photonQuery)}&limit=5&lang=es${photonLocationParam}`
        ).then(res => res.ok ? res.json() : { features: [] }).catch(() => ({ features: [] }));

        const [nomData, photonData] = await Promise.all([nominatimPromise, photonPromise]);

        if (Array.isArray(nomData)) {
          nomData.forEach((item: any) => {
            const addr = item.address || {};
            const road = addr.road || addr.pedestrian || addr.suburb || item.display_name.split(',')[0];
            const house = addr.house_number ? ` #${addr.house_number}` : '';
            const city = addr.city || addr.town || addr.village || addr.municipality || cityName || '';
            const name = `${road}${house}`;
            const full = `${name}${city ? `, ${city}` : ''}`;

            if (name && !results.some(r => r.full_address === full || r.name === name)) {
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

        if (photonData?.features && Array.isArray(photonData.features)) {
          photonData.features.forEach((f: any) => {
            const p = f.properties;
            const name = p.name || p.street || '';
            const house = p.housenumber ? ` #${p.housenumber}` : '';
            const city = p.city || p.county || p.state || cityName || '';
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
      }

      // 3. Formato dinámico según el texto ingresado por el usuario
      const formattedTitle = isStructured ? formatted : cleanText;
      const fullAddr = cityName ? `${formattedTitle}, ${cityName}` : formattedTitle;
      const customOption: Suggestion = {
        name: formattedTitle,
        full_address: fullAddr,
        isCustom: true,
        lat,
        lng
      };

      setSuggestions([customOption, ...results.slice(0, 6)]);
      setShowDropdown(true);
    } catch (error) {
      console.error('Error buscando direcciones:', error);
      const fallback: Suggestion = {
        name: formatted,
        full_address: cityName ? `${formatted}, ${cityName}` : formatted,
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
  }, [query, cityName, userLocation]);

  const handleSelect = async (s: Suggestion) => {
    let finalAddress = s.full_address;
    let coords = s.lat && s.lng ? { lat: s.lat, lng: s.lng } : undefined;

    // Si viene de Google Places Autocomplete, obtenemos la dirección formateada y coordenadas exactas mediante Place Details
    if (s.place_id && !coords) {
      setIsLoading(true);
      try {
        const { data: dData } = await supabase.functions.invoke('google-navigation', {
          body: { action: 'details', place_id: s.place_id }
        });
        if (dData?.result?.formatted_address) {
          finalAddress = dData.result.formatted_address;
        }
        if (dData?.result?.lat && dData?.result?.lng) {
          coords = { lat: dData.result.lat, lng: dData.result.lng };
        }
      } catch {}
      setIsLoading(false);
    }

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
                      ? "bg-emerald-50/80 hover:bg-emerald-100 text-emerald-950 font-medium"
                      : "hover:bg-slate-100 text-slate-700"
                  }`}
                >
                  {s.isCustom ? (
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                      <Crosshair className="h-4 w-4" />
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
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white shrink-0">
                          Formato Colombia
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


