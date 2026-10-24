// 0027 – Foto-Nachholen neu starten: Bis zur Korrektur des Foto-Abrufs (403 vom Chefkoch-CDN wegen Browser-Kennung)
// sind Versuche verbraucht worden, die nichts mit dem Rezept zu tun hatten
export default [`UPDATE recipes SET photo_attempts = 0 WHERE photo_attempts > 0`];
