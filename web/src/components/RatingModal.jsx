import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function RatingModal({ open, tripId, role, onClose, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (open) { setRating(0); setComment(""); }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!rating) return alert("Selecciona una calificación");
    const field = role === "cliente" ? "driver_rating" : "client_rating";
    const { error } = await supabase.from("trips").update({ [field]: rating }).eq("id", tripId);
    if (error) return alert(error.message);
    onSubmit?.();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Calificar {role === "cliente" ? "al conductor" : "al cliente"}</div>
        <div className="small" style={{ marginBottom: 14 }}>Tu opinión ayuda a mejorar la comunidad.</div>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={`star ${n <= rating ? "active" : ""}`} onClick={() => setRating(n)}>
              ★
            </button>
          ))}
        </div>
        <textarea
          placeholder="Comentario (opcional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="field-input"
          style={{ marginTop: 14, minHeight: 80, borderRadius: 10 }}
        />
        <div className="row mt-2">
          <button className="btn" onClick={submit}>Enviar calificación</button>
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
