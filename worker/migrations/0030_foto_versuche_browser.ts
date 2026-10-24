// 0030 – Chefkoch-Fotos kommen jetzt aus dem Browser (Worker-Abrufe beim CDN scheitern immer mit 403): die bisher verbrauchten
// Versuche der Server-Abrufe zählen nicht mehr, die App darf es noch einmal von vorn versuchen
export default [`UPDATE recipes SET photo_attempts = 0 WHERE photo_attempts > 0`];
