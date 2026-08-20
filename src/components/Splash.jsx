import { useState, useEffect } from "react";

export default function Splash({ onFinish }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onFinish, 400);
    }, 1800);
    return () => clearTimeout(t);
  }, [onFinish]);

  return (
    <div className={`splash ${visible ? "" : "hide"}`}>
      <div className="splash-logo">🚗</div>
      <div className="splash-title">inDrive Clone</div>
      <div className="splash-sub">Movilidad segura, precios justos</div>
      <div className="splash-loader" />
    </div>
  );
}
