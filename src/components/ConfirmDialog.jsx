import { useState } from "react";

export default function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{title}</h3>
        <p className="small" style={{ marginBottom: 18, lineHeight: 1.5 }}>{message}</p>
        <div className="row">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn" style={{ flex: 1, background: "var(--danger)", color: "#fff" }} onClick={onConfirm}>
            {confirmLabel || "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
