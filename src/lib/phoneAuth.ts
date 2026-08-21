// Utilidad para permitir el registro/inicio de sesión de mensajeros usando
// únicamente el número de móvil.  Como el backend de autenticación solo
// acepta email, generamos un "email sintético" determinístico a partir del
// número normalizado.  El número real siempre se guarda en profiles.phone.

const DRIVER_PHONE_DOMAIN = "driver.gomoto.local";

export const normalizePhone = (raw: string): string => {
  const digits = (raw || "").replace(/\D+/g, "");
  return digits;
};

export const isValidPhone = (raw: string): boolean => {
  const d = normalizePhone(raw);
  return d.length >= 7 && d.length <= 15;
};

export const phoneToSyntheticEmail = (raw: string): string => {
  const d = normalizePhone(raw);
  return `${d}@${DRIVER_PHONE_DOMAIN}`;
};

export const isSyntheticPhoneEmail = (email: string): boolean =>
  !!email && email.endsWith(`@${DRIVER_PHONE_DOMAIN}`);