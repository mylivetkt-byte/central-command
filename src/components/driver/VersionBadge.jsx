import { useState } from "react";
import { APP_VERSION, CHANGELOG } from "../../constants/appVersion";

export default function VersionBadge() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "8px 12px",
          color: "var(--muted)",
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
          marginTop: "12px",
          transition: "all 0.2s",
        }}
      >
        <span>ℹ️</span>
        <span>Versión {APP_VERSION} — Ver cambios</span>
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal"
            style={{ maxWidth: "380px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-header">
              <div className="sheet-title">Historial de versiones</div>
              <button
                className="btn btn-secondary btn-sm"
                style={{ width: "auto", padding: "4px 10px" }}
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="small" style={{ color: "var(--muted)", marginBottom: 14 }}>
              Versión instalada: <strong style={{ color: "var(--accent)" }}>v{APP_VERSION}</strong>
            </div>

            <div style={{ maxHeight: "260px", overflowY: "auto", display: "grid", gap: "14px", paddingRight: "4px" }}>
              {CHANGELOG.map((entry) => (
                <div key={entry.version} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: "13px", color: "var(--text)", marginBottom: 4 }}>
                    v{entry.version}
                  </div>
                  <ul style={{ paddingLeft: "16px", margin: 0 }}>
                    {entry.changes.map((c, i) => (
                      <li key={i} className="small" style={{ color: "var(--muted)", marginBottom: 3 }}>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <button
              className="btn btn-sm mt-3"
              onClick={() => setOpen(false)}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
