// 0039 – Schwerpunkt „Saisonal“ gibt es nicht mehr: aus den gespeicherten Schwerpunkten der Familien entfernen
export default [`UPDATE profiles SET health_focus = array_remove(health_focus, 'seasonal') WHERE 'seasonal' = ANY(health_focus)`];
