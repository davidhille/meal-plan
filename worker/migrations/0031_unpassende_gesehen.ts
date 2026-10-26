// 0031 – Hinweis „Gerichte passen nicht zu euren Einstellungen“: Wer „Fertig“ tippt, entscheidet für die ganze Familie.
// Bisher lag das nur im localStorage des jeweiligen Browsers – auf einem anderen Gerät kam der Hinweis wieder.
export default [`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seen_unsuitable text[] NOT NULL DEFAULT '{}'`];
