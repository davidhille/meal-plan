// 0028 – Foto-Nachholen erneut zurücksetzen: Der Cron hat die Versuche verbraucht, obwohl das Chefkoch-CDN dort jeden Abruf
// mit 403 abweist; ab jetzt holt `GET /profile` (Anfrage eines Nutzers) die Fotos nach
export default [`UPDATE recipes SET photo_attempts = 0 WHERE photo_attempts > 0`];
