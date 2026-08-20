import { useState, useEffect, useRef } from "react";
import { searchPlaces } from "../lib/geo";

export default function PlaceSearch({ onSelect, placeholder, label, near }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (query.trim().length < 3) return setResults([]);
    timer.current = setTimeout(async () => {
      const places = await searchPlaces(query, near);
      setResults(places);
      setOpen(true);
    }, 350);
    return () => clearTimeout(timer.current);
  }, [query, near]);

  return (
    <div>
      {label && <label className="small">{label}</label>}
      <div style={{ position: "relative" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="field-input"
        />
        {open && results.length > 0 && (
          <div className="places-dropdown">
            {results.map((p) => (
              <div key={p.id} className="place-item" onClick={() => { onSelect(p); setOpen(false); setQuery(p.name); }}>
                <div className="spot" />
                <div>
                  <div>{p.label || p.name}</div>
                  <div className="small">{p.name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
