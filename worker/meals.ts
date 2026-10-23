// Rezeptdatenbank + Auswahl-Logik (übernommen aus den Supabase Edge Functions)
import { excludedByDislikes } from "./dislikes";
import type { DayRules } from "./dayRules";
import { VEGETARISCH } from "./recipes/vegetarisch";
import { FLEISCH } from "./recipes/fleisch";
import { WOCHENENDE } from "./recipes/wochenende";
import { MEALDB } from "./recipes/mealdb";
import { focusScore } from "./nutrition";

export interface Recipe {
  name: string;
  type: "vegetarisch" | "fleisch" | "wochenende";
  ingredients: string[];
  instructions: string;
  durationMin?: number | null;
  /** Originalfoto des Gerichts (z. B. aus TheMealDB), wird statt eines KI-Bilds genommen */
  imageUrl?: string;
}

/** Ursprüngliche Rezepte (Juli-Version) */
const CLASSIC_RECIPES: Recipe[] = [
  {
    name: "Spaghetti Bolognese",
    type: "fleisch",
    ingredients: ["400g Spaghetti", "500g Rinderhackfleisch", "2 Dosen Tomaten", "1 Zwiebel", "3 Knoblauchzehen", "2 EL Olivenöl", "1 TL Zucker", "Salz, Pfeffer, Oregano", "50g Parmesan"],
    instructions: "Zwiebel und Knoblauch fein hacken und in Olivenöl glasig dünsten. Hackfleisch dazugeben und krümelig braten. Mit Salz, Pfeffer und Oregano würzen. Dosentomaten hinzufügen und 20 Minuten köcheln lassen. Mit Zucker abschmecken. Spaghetti nach Packungsanweisung kochen und mit der Sauce servieren. Mit geriebenem Parmesan bestreuen.",
  },
  {
    name: "Gemüse-Curry mit Basmati-Reis",
    type: "vegetarisch",
    ingredients: ["300g Basmati-Reis", "1 Zucchini", "1 Paprika (rot)", "200g Kichererbsen (Dose)", "1 Dose Kokosmilch (400ml)", "2 EL Currypaste (mild)", "1 Zwiebel", "Frischer Koriander", "Salz, Limette"],
    instructions: "Reis nach Packungsanweisung kochen. Zwiebel würfeln und in Öl anbraten. Currypaste hinzufügen und kurz rösten. Gemüse in Stücke schneiden und dazugeben. Kokosmilch und Kichererbsen einrühren. 15 Minuten auf mittlerer Hitze köcheln lassen. Mit Salz und Limettensaft abschmecken. Mit Koriander und Reis servieren.",
  },
  {
    name: "Hähnchenbrust mit Süßkartoffelwedges",
    type: "fleisch",
    ingredients: ["4 Hähnchenbrustfilets", "3 Süßkartoffeln", "2 EL Olivenöl", "1 TL Paprikapulver", "1 TL Knoblauchpulver", "Rosmarin, Thymian", "Salz, Pfeffer", "1 Zitrone"],
    instructions: "Ofen auf 200°C vorheizen. Süßkartoffeln in Wedges schneiden, mit Öl, Paprika und Knoblauchpulver vermischen und 30 Min backen. Hähnchen mit Zitronensaft, Olivenöl, Rosmarin und Thymian marinieren. In einer Pfanne von jeder Seite 5-6 Min braten. Mit den Wedges servieren.",
  },
  {
    name: "Linseneintopf mit Vollkornbrot",
    type: "vegetarisch",
    ingredients: ["300g rote Linsen", "2 Karotten", "2 Stangen Sellerie", "1 Dose Tomaten", "1 Zwiebel", "1 L Gemüsebrühe", "1 TL Kreuzkümmel", "1 TL Kurkuma", "Salz, Pfeffer, Petersilie", "Vollkornbrot zum Servieren"],
    instructions: "Zwiebel, Karotten und Sellerie klein schneiden und in Öl anbraten. Kreuzkümmel und Kurkuma hinzufügen. Linsen, Dosentomaten und Brühe dazugeben. Zum Kochen bringen und 20 Min köcheln lassen. Mit Salz und Pfeffer abschmecken. Mit Petersilie bestreuen und Vollkornbrot servieren.",
  },
  {
    name: "Lachsfilet mit Brokkoli & Kartoffeln",
    type: "fleisch",
    ingredients: ["4 Lachsfilets", "1 Brokkoli", "800g Kartoffeln", "2 EL Butter", "1 Zitrone", "Dill", "Salz, Pfeffer", "2 EL Crème fraîche"],
    instructions: "Kartoffeln schälen und kochen. Brokkoli in Röschen teilen und 8 Min dämpfen. Lachsfilets mit Salz und Pfeffer würzen und in Butter von jeder Seite 3-4 Min braten. Mit Zitronensaft beträufeln. Kartoffeln stampfen und mit Crème fraîche und Dill verfeinern. Alles zusammen servieren.",
  },
  {
    name: "Selbstgemachte Pizza Margherita",
    type: "wochenende",
    ingredients: ["500g Pizzamehl (Typ 00)", "7g Trockenhefe", "300ml lauwarmes Wasser", "2 EL Olivenöl", "1 TL Salz", "400g Dosentomaten (passiert)", "300g Mozzarella", "Frisches Basilikum", "Salz, Oregano"],
    instructions: "Mehl, Hefe, Salz und Olivenöl mischen. Wasser schrittweise einkneten bis ein glatter Teig entsteht. 1 Stunde abgedeckt ruhen lassen. Ofen auf 240°C vorheizen. Teig ausrollen und auf Backblech legen. Tomatensoße aufstreichen, Mozzarella reißen und verteilen. 12-15 Min backen bis der Rand goldbraun ist. Mit frischem Basilikum bestreuen.",
  },
  {
    name: "Rinderbraten mit Rotkohl & Klößen",
    type: "wochenende",
    ingredients: ["1,2 kg Rinderbraten", "1 Glas Rotkohl (720ml)", "6 Thüringer Klöße (Packung)", "2 Zwiebeln", "3 Karotten", "500ml Rinderbrühe", "200ml Rotwein", "Lorbeer, Thymian", "Salz, Pfeffer, Butterschmalz"],
    instructions: "Braten von allen Seiten in Butterschmalz scharf anbraten und würzen. Gemüse grob schneiden und dazugeben. Mit Rotwein ablöschen und mit Brühe auffüllen. Lorbeer und Thymian hinzufügen. Im Ofen bei 160°C ca. 2,5 Stunden schmoren. Rotkohl nach Packung aufwärmen. Klöße nach Anleitung kochen. Bratensaft durch Sieb gießen und als Soße servieren.",
  },
  {
    name: "Tortellini in Tomaten-Sahnesoße",
    type: "vegetarisch",
    ingredients: ["500g Tortellini (Käse)", "400ml Sahne", "1 Dose Tomaten", "2 Knoblauchzehen", "50g Parmesan", "Basilikum", "Salz, Pfeffer"],
    instructions: "Tortellini nach Packung kochen. Knoblauch in Öl anbraten, Dosentomaten hinzufügen und 5 Min einköcheln. Sahne einrühren und weitere 5 Min köcheln. Tortellini in die Soße geben. Mit Parmesan und Basilikum servieren.",
  },
  {
    name: "Hackbällchen mit Couscous & Tzatziki",
    type: "fleisch",
    ingredients: ["400g Lammhackfleisch", "300g Couscous", "1 Ei", "2 Knoblauchzehen", "Petersilie", "1 TL Kreuzkümmel", "200g griechischer Joghurt", "1 Gurke", "Dill, Salz"],
    instructions: "Hackfleisch mit Ei, Knoblauch, Petersilie und Kreuzkümmel vermengen und zu Bällchen formen. In Öl goldbraun braten. Couscous mit kochendem Wasser übergießen und quellen lassen. Tzatziki: Gurke raspeln, mit Joghurt, Knoblauch und Dill vermischen. Alles zusammen servieren.",
  },
  {
    name: "Kürbis-Ingwer-Suppe",
    type: "vegetarisch",
    ingredients: ["1 Hokkaido-Kürbis (ca. 1kg)", "1 Stück Ingwer (3cm)", "1 Zwiebel", "1 Dose Kokosmilch", "500ml Gemüsebrühe", "1 Orange (Saft)", "Kürbiskernöl", "Salz, Pfeffer, Cayenne"],
    instructions: "Kürbis würfeln (Schale lassen), Zwiebel und Ingwer klein schneiden. In Öl anbraten. Mit Brühe auffüllen und 20 Min weich kochen. Kokosmilch und Orangensaft hinzufügen. Alles pürieren. Mit Salz, Pfeffer und Cayenne abschmecken. Mit Kürbiskernöl und -kernen garnieren.",
  },
  {
    name: "Hähnchen-Wrap mit Avocado",
    type: "fleisch",
    ingredients: ["2 Hähnchenbrustfilets", "4 Weizentortillas", "2 Avocados", "1 Tomate", "100g Eisbergsalat", "Saure Sahne 100g", "Limette, Chili", "Salz, Pfeffer, Paprikapulver"],
    instructions: "Hähnchen würzen und in Streifen schneiden. In Öl goldbraun braten. Avocado mit Limettensaft, Salz und Chili zerstampfen (Guacamole). Tortillas kurz in der Pfanne erhitzen. Mit Guacamole, Hähnchen, Salat und Tomate belegen und einrollen.",
  },
  {
    name: "Ofen-Gnocchi mit Gorgonzola-Sauce",
    type: "vegetarisch",
    ingredients: ["1kg Gnocchi (frisch)", "150g Gorgonzola", "200ml Sahne", "100g Walnüsse", "2 Knoblauchzehen", "Frische Kräuter", "Salz, Pfeffer", "Olivenöl"],
    instructions: "Ofen auf 220°C vorheizen. Gnocchi mit Öl und Knoblauch auf dem Blech verteilen und 20 Min backen bis sie knusprig sind. Gorgonzola in Sahne schmelzen und zu einer cremigen Soße einköcheln. Gnocchi mit Soße vermengen und mit Walnüssen und Kräutern servieren.",
  },
  {
    name: "Selbstgemachte Burger",
    type: "wochenende",
    ingredients: ["600g Rinderhackfleisch", "4 Burger-Buns", "4 Scheiben Cheddar", "1 rote Zwiebel", "2 Tomaten", "Eisbergsalat", "Gurken eingelegt", "Ketchup, Mayonnaise, Senf", "Salz, Pfeffer"],
    instructions: "Hackfleisch mit Salz und Pfeffer vermengen und 4 Patties formen. In einer heißen Pfanne je 3-4 Min pro Seite braten. Käse auf den Patties schmelzen lassen. Buns aufschneiden und kurz rösten. Mit allen Toppings nach Belieben belegen.",
  },
  {
    name: "Coq au Vin (Hähnchen in Rotwein)",
    type: "wochenende",
    ingredients: ["1 ganzes Hähnchen (geteilt)", "300ml Rotwein", "200g Champignons", "150g Speckwürfel", "2 Karotten", "1 Zwiebel", "3 Knoblauchzehen", "500ml Hühnerbrühe", "Lorbeer, Thymian, Petersilie", "Butterschmalz, Mehl"],
    instructions: "Hähnchen in Mehl wenden und in Butterschmalz von allen Seiten anbraten. Herausnehmen. Speck, Karotten und Zwiebeln anbraten. Knoblauch und Champignons dazugeben. Mit Rotwein ablöschen und Brühe hinzufügen. Hähnchen zurücklegen. Bei niedriger Hitze 1 Stunde schmoren. Mit Baguette oder Bandnudeln servieren.",
  },
  {
    name: "Erbsen-Minze-Risotto",
    type: "vegetarisch",
    ingredients: ["300g Risotto-Reis (Arborio)", "200g TK-Erbsen", "1L Gemüsebrühe", "1 Zwiebel", "150ml Weißwein", "50g Parmesan", "2 EL Butter", "Frische Minze", "Salz, Pfeffer"],
    instructions: "Zwiebel in Butter glasig dünsten. Reis dazugeben und 2 Min rösten. Mit Weißwein ablöschen. Brühe kellenweise hinzufügen und rühren bis sie aufgesogen ist (20 Min). Erbsen in den letzten 5 Min unterrühren. Butter und Parmesan einrühren. Mit frischer Minze garnieren.",
  },
  {
    name: "Schweinefilet im Speckmantel",
    type: "fleisch",
    ingredients: ["2 Schweinefilets (je 350g)", "8 Scheiben Frühstücksspeck", "2 EL Senf", "Rosmarin, Thymian", "500g Kartoffeln", "200g grüne Bohnen", "Salz, Pfeffer, Olivenöl"],
    instructions: "Schweinefilets mit Senf einreiben und in Speck einwickeln. In einer Pfanne von allen Seiten 3-4 Min anbraten. Im vorgeheizten Ofen (180°C) 15 Min garen. Kartoffeln in Würfel schneiden und rösten. Bohnen 8 Min blanchieren. Fleisch 5 Min ruhen lassen und aufschneiden.",
  },
  {
    name: "Spinat-Feta-Quiche",
    type: "vegetarisch",
    ingredients: ["1 Quiche-Teig (rund, fertig)", "300g TK-Spinat", "200g Feta", "4 Eier", "200ml Sahne", "100ml Milch", "1 Zwiebel", "Muskatnuss, Salz, Pfeffer"],
    instructions: "Ofen auf 180°C vorheizen. Teig in die Form legen. Spinat auftauen und gut ausdrücken. Zwiebel würfeln und glasig dünsten. Eier, Sahne und Milch verquirlen und würzen. Spinat, Zwiebel und Feta auf dem Teig verteilen. Eiercreme darübergießen. 35-40 Min goldbraun backen.",
  },
  {
    name: "Asiatische Gemüse-Pfanne mit Tofu",
    type: "vegetarisch",
    ingredients: ["400g fester Tofu", "200g Brokkoli", "2 Paprika", "200g Zuckerschoten", "3 EL Sojasoße", "2 EL Sesamöl", "2 EL Austernsauce", "1 Stück Ingwer", "3 Knoblauchzehen", "200g Jasmin-Reis"],
    instructions: "Tofu würfeln, trocken tupfen und in Sesamöl knusprig braten. Herausnehmen. Ingwer und Knoblauch anbraten. Gemüse in Stücke schneiden und mit hoher Hitze pfannenrühren. Sojasoße und Austernsauce hinzufügen. Tofu wieder dazugeben. Mit Jasmin-Reis servieren.",
  },
  {
    name: "Shakshuka",
    type: "vegetarisch",
    ingredients: ["6 Eier", "2 Dosen Tomaten", "1 Paprika", "1 Zwiebel", "3 Knoblauchzehen", "1 TL Kreuzkümmel", "1 TL Paprikapulver (geräuchert)", "Feta 100g", "Petersilie", "Fladenbrot"],
    instructions: "Zwiebel, Knoblauch und Paprika in Olivenöl anbraten. Gewürze hinzufügen. Dosentomaten dazugeben und 10 Min köcheln. Mulden in die Soße drücken und Eier hineingeben. Mit Deckel 5-7 Min garen bis das Eiweiß stockt, das Eigelb aber weich ist. Mit Feta und Petersilie bestreuen. Mit Fladenbrot servieren.",
  },
  {
    name: "Teriyaki-Hähnchen mit Sesam-Nudeln",
    type: "fleisch",
    ingredients: ["4 Hähnchenoberschenkel", "200g Ramen-Nudeln", "4 EL Sojasoße", "3 EL Honig", "2 EL Mirin", "1 EL Sesamöl", "2 EL Sesam", "3 Frühlingszwiebeln", "1 Stück Ingwer"],
    instructions: "Teriyaki-Marinade: Sojasoße, Honig, Mirin und Ingwer mischen. Hähnchen marinieren (mind. 30 Min). In der Pfanne bei mittlerer Hitze 6-8 Min pro Seite garen und mit Marinade glasieren. Nudeln kochen, mit Sesamöl und Sojasoße abschmecken. Mit Sesam und Frühlingszwiebeln garnieren.",
  },
  {
    name: "BBQ-Rippchen aus dem Ofen",
    type: "wochenende",
    ingredients: ["2 kg Schweinerippen", "4 EL Ketchup", "2 EL Worcestershire", "2 EL Honig", "1 EL Apfelessig", "1 TL Paprikapulver (geräuchert)", "1 TL Knoblauchpulver", "500g Maiskolben (TK)", "Kartoffelwedges 1kg", "Salz, Pfeffer"],
    instructions: "Rippchen mit Salz, Pfeffer und Paprikapulver einreiben. In Alufolie wickeln und bei 150°C 2,5 Stunden garen. BBQ-Sauce aus Ketchup, Worcestershire, Honig, Essig und Knoblauchpulver mischen. Folie öffnen, Sauce auftragen und nochmals 30 Min bei 200°C glasieren. Mit Wedges und Maiskolben servieren.",
  },
  {
    name: "Gefüllte Paprika mit Hack & Reis",
    type: "wochenende",
    ingredients: ["4 große Paprikaschoten", "400g gemischtes Hackfleisch", "200g Reis", "1 Zwiebel", "400g Dosentomaten", "100ml Tomatensoße (Glas)", "100g Käse (gerieben)", "Salz, Pfeffer, Paprikapulver", "Petersilie"],
    instructions: "Reis kochen. Paprika entkernen und den Deckel abschneiden. Zwiebel und Hackfleisch anbraten. Reis und Dosentomaten hinzufügen und würzen. Paprika füllen, in eine Auflaufform stellen. Mit Tomatensoße begießen, Käse drüber. Bei 180°C 35 Min backen.",
  },
  // --- KI-Rezepte aus dem Supabase-Backup (Juli 2026) ---
  {
    name: "Hackfleisch-Paprika-Ofenauflauf mit Kartoffeln",
    type: "fleisch",
    ingredients: ["500 g Hackfleisch (gemischt oder Rind/Schwein)", "2 rote Paprika", "1 Zwiebel", "2 Knoblauchzehen", "800 g Kartoffeln", "1 Dose gehackte Tomaten (ca. 400 g)", "2 EL Tomatenmark", "1 TL Paprikapulver edelsüß", "1/2 TL getrockneter Oregano", "Salz", "schwarzer Pfeffer", "2 EL Olivenöl", "150 g geriebener Käse (z.B. Gouda oder Emmentaler)", "200 ml Gemüsebrühe", "optional: 1 kleine Prise Chiliflocken", "optional: 1 Handvoll frischer Petersilie zum Bestreuen"],
    instructions: "Kartoffeln schälen, in dünne Scheiben schneiden und in einer Schüssel mit 1 EL Olivenöl, etwas Salz und Pfeffer vermengen. Paprika entkernen und in Streifen schneiden, Zwiebel würfeln, Knoblauch fein hacken. Backofen auf 200 °C Ober-/Unterhitze vorheizen. In einer großen Pfanne 1 EL Olivenöl erhitzen und Zwiebel sowie Knoblauch glasig anbraten, dann das Hackfleisch dazugeben und krümelig anbraten. Paprikastreifen kurz mitrösten, Tomatenmark unterrühren und 1 Minute mitrösten. Gehackte Tomaten und Gemüsebrühe angießen, Paprikapulver, Oregano, optional Chiliflocken, Salz und Pfeffer zugeben und alles 5–8 Minuten leicht köcheln lassen. Eine Auflaufform leicht einfetten, eine Schicht Kartoffelscheiben hineinlegen, dann die Hack-Paprika-Soße darauf verteilen und mit Kartoffeln abschließen. Mit Käse bestreuen und im Ofen etwa 45–55 Minuten backen, bis die Kartoffeln weich sind und der Käse goldbraun ist. Optional mit Petersilie bestreuen und servieren.",
  },
  {
    name: "Schnelle Rahm-Champignon-Pfanne mit Hähnchen und Spätzle",
    type: "fleisch",
    ingredients: ["Hähnchenbrust (oder Hähnchengeschnetzeltes)", "Champignons", "Zwiebel", "Knoblauch", "Butter", "Öl", "Schlagsahne", "Hühnerbrühe", "Senf", "Paprikapulver (edelsüß)", "Salz", "Schwarzer Pfeffer", "Thymian (getrocknet oder frisch)", "Petersilie (optional)", "Spätzle (TK oder frisch)"],
    instructions: "Die Spätzle nach Packungsanleitung in Salzwasser garen. In der Zwischenzeit Hähnchen in mundgerechte Stücke schneiden, mit Salz, Pfeffer und Paprikapulver würzen. Champignons putzen und vierteln, Zwiebel fein würfeln. In einer großen Pfanne etwas Butter und Öl erhitzen und das Hähnchen bei mittelhoher bis hoher Hitze rundum anbraten, dann aus der Pfanne nehmen. Zwiebel in derselben Pfanne glasig anschwitzen, Knoblauch kurz mitbraten. Champignons dazugeben und so lange braten, bis möglichst viel Flüssigkeit verdampft ist und sie goldbraun sind. Hähnchen wieder zugeben, mit Hühnerbrühe ablöschen und Senf einrühren. Schlagsahne zugießen, mit Thymian abschmecken und alles 3–5 Minuten sanft köcheln lassen, bis die Soße cremig ist. Mit Salz und Pfeffer final abschmecken. Spätzle abgießen, in die Pfanne geben oder separat servieren und mit gehackter Petersilie bestreuen (optional).",
  },
  {
    name: "Klassisches Hackfleisch-Kartoffel-Lauch-Pfannenrezept",
    type: "fleisch",
    ingredients: ["500 g Rinderhackfleisch", "800 g Kartoffeln", "2 Stangen Lauch", "1 Zwiebel", "2 Knoblauchzehen", "2 EL Butterschmalz oder Öl", "1 TL Paprikapulver edelsüß", "1 TL getrockneter Oregano", "1 EL Tomatenmark", "200 ml Gemüsebrühe", "150 ml Schlagsahne oder Milch", "1–2 EL Senf", "Salz", "Pfeffer", "Muskatnuss", "2 EL geriebener Käse (z. B. Gouda oder Emmentaler)", "Petersilie (optional)"],
    instructions: "Die Kartoffeln schälen, würfeln und in Salzwasser etwa 8–10 Minuten vorkochen (sie sollen noch Biss haben), dann abgießen. Lauch putzen, in Ringe schneiden und gründlich waschen, Zwiebel fein würfeln und Knoblauch hacken. In einer großen Pfanne Butterschmalz/Öl erhitzen, Zwiebel und Knoblauch glasig anbraten, dann das Hackfleisch dazugeben und krümelig anbraten. Paprikapulver und Oregano einrühren, Tomatenmark kurz mitrösten und mit Gemüsebrühe ablöschen. Lauch zugeben und 5–7 Minuten dünsten. Sahne/Milch und Senf einrühren, mit Salz, Pfeffer und etwas Muskatnuss abschmecken. Kartoffelwürfel unterheben und weitere 5 Minuten gar ziehen lassen, bis alles cremig und durchgewärmt ist. Zum Schluss Käse unterrühren oder darüber streuen, bis er leicht schmilzt; nach Wunsch mit Petersilie bestreuen und servieren.",
  },
  {
    name: "Bunter Hackfleisch-Ofenauflauf mit Paprika & Kartoffeln",
    type: "fleisch",
    ingredients: ["500 g Kartoffeln", "350 g Hackfleisch (gemischt oder Rind)", "1 rote Paprika", "1 gelbe Paprika", "1 Zwiebel", "2 Knoblauchzehen", "1 Dose (400 g) stückige Tomaten", "2 EL Tomatenmark", "150 ml Gemüsebrühe", "1 TL Paprikapulver (edelsüß)", "1/2 TL Kreuzkümmel", "1 TL Oregano (getrocknet)", "Salz", "Pfeffer", "2 EL Olivenöl", "150 g geriebener Käse (z. B. Gouda/Emmentaler)", "2 EL gehackte Petersilie (optional)"],
    instructions: "Die Kartoffeln schälen, waschen und in dünne Scheiben schneiden. Paprika entkernen und in Streifen schneiden. Zwiebel fein würfeln, Knoblauch hacken. Ofen auf 200 °C Ober-/Unterhitze vorheizen. Olivenöl in einer Pfanne erhitzen und Zwiebel mit Knoblauch glasig anbraten. Hackfleisch dazugeben und krümelig anbraten, mit Salz, Pfeffer, Paprikapulver und Kreuzkümmel würzen. Tomatenmark einrühren, kurz mitrösten, dann stückige Tomaten und Gemüsebrühe angießen. Oregano zugeben, alles 5 Minuten köcheln lassen. Eine Auflaufform leicht einfetten und Kartoffelscheiben als erste Schicht einlegen. Paprikastreifen darüber verteilen und die Hack-Tomatensoße gleichmäßig daraufgeben. Mit etwas Käse bestreuen und im Ofen etwa 35–45 Minuten backen, bis die Kartoffeln gar sind. Danach restlichen Käse darüberstreuen und weitere 5–10 Minuten überbacken. Vor dem Servieren 2–3 Minuten ruhen lassen, nach Wunsch mit Petersilie bestreuen.",
  },
  {
    name: "Ofen-Hackfleisch-Pfannenbraten mit Paprika, Bohnen & Reis",
    type: "fleisch",
    ingredients: ["500 g gemischtes Hackfleisch", "1 Zwiebel", "2 Knoblauchzehen", "1 rote Paprika", "1 gelbe Paprika", "400 g gehackte Tomaten (Dose)", "1 EL Tomatenmark", "250 ml Gemüsebrühe", "1 TL Paprikapulver edelsüß", "1/2 TL Kreuzkümmel", "1/2 TL getrockneter Oregano", "Salz", "Pfeffer", "1 Dose Kidneybohnen (ca. 240 g Abtropfgewicht)", "200 g Langkornreis (ungekocht)", "1 Paprikaschote oder Chilischote (optional, für Schärfe)", "1 EL Olivenöl", "50 g geriebener Käse (z. B. Gouda)", "1 Handvoll Petersilie (optional, zum Bestreuen)"],
    instructions: "Den Ofen auf 200 °C Ober-/Unterhitze vorheizen. Zwiebel und Knoblauch fein würfeln. Paprika in mundgerechte Stücke schneiden. Öl in einer großen ofenfesten Pfanne oder einem Bräter erhitzen und das Hackfleisch darin kräftig anbraten, bis es krümelig ist. Zwiebel und Knoblauch zugeben und kurz mitbraten. Paprika dazugeben, kurz anrösten, dann Tomatenmark einrühren und mit Paprikapulver, Kreuzkümmel und Oregano würzen. Gehackte Tomaten und Gemüsebrühe angießen, salzen und pfeffern. Kidneybohnen abspülen und untermischen. Den ungekochten Reis gleichmäßig in der Pfanne verteilen und vorsichtig in die Flüssigkeit drücken; die Flüssigkeit sollte den Reis gerade bedecken. Bei Bedarf etwas Brühe nachgießen, damit der Reis später gar wird. Optional Chili in feinen Ringen dazugeben. Den Bräter mit Deckel oder mit Alufolie abdecken und ca. 35–40 Minuten garen, bis der Reis weich ist. Anschließend Deckel/ Foliendeckel entfernen, geriebenen Käse darüber streuen und weitere 5–8 Minuten überbacken. Vor dem Servieren kurz ruhen lassen und nach Wunsch mit Petersilie bestreuen.",
  },
  {
    name: "Cremige Hähnchen-Gemüse-Pfanne mit Reis und Zitronenkräutern",
    type: "fleisch",
    ingredients: ["Hähnchenbrust (ca. 600 g)", "Reis (ca. 250 g, z.B. Langkorn oder Basmatireis)", "Zwiebel (1)", "Knoblauch (2 Zehen)", "Paprika (1 rote oder gelbe)", "Zucchini (1)", "Champignons (250 g)", "Öl (2 EL)", "Gemüsebrühe (700 ml)", "Sahne (200 ml) oder Kochsahne", "Schmand (2 EL)", "Zitronensaft (1-2 EL)", "Getrockneter Oregano (1 TL)", "Paprikapulver (edelsüß, 1 TL)", "Salz", "Pfeffer", "Hühnergewürz oder Kräuter der Provence (optional, 1 TL)", "Frische Petersilie oder Schnittlauch (kleiner Bund)"],
    instructions: "Reis nach Packungsanweisung in Salzwasser oder mit der Gemüsebrühe garen und warm halten. In der Zwischenzeit Zwiebel würfeln, Knoblauch fein hacken. Hähnchenbrust in mundgerechte Stücke schneiden, mit Salz, Pfeffer, Paprikapulver und Oregano würzen. Öl in einer großen Pfanne erhitzen und das Hähnchen rundum 5–7 Minuten kräftig anbraten. Zwiebel und Knoblauch zugeben und kurz mitrösten. Paprika in Streifen und Zucchini in Halbmonde schneiden, Champignons vierteln und alles zur Pfanne geben; bei mittlerer Hitze weitere 8–10 Minuten braten, bis das Gemüse bissfest ist. Sahne und Schmand einrühren, mit Zitronensaft, Salz und Pfeffer abschmecken und 2–3 Minuten sanft köcheln lassen. Den gegarten Reis auf Teller verteilen und die cremige Hähnchen-Gemüse-Soße darüber geben; mit frischer Petersilie oder Schnittlauch bestreuen.",
  },
  {
    name: "Krosses Schweineschnitzel mit Senf-Dill-Soße & Ofen-Kartoffelwedges",
    type: "fleisch",
    ingredients: ["Schweineschnitzel (z. B. 4 Stück à ca. 150–180 g)", "Salz", "Pfeffer", "Paprikapulver", "Mehl", "2 Eier", "Semmelbrösel", "Butterschmalz oder neutrales Öl zum Braten", "Kartoffeln (ca. 800 g)", "Olivenöl", "Knoblauch (2 Zehen)", "Zwiebel (1 kleine)", "Streichfähiger Senf", "Dijon-Senf", "Schmand oder saure Sahne (200 g)", "Gemüsebrühe (150 ml)", "Dill (frisch oder TK)", "Zitronensaft (nach Geschmack)", "optional: Ein paar Gurken- oder Essiggurkenwürfel für die Soße"],
    instructions: "Den Ofen auf 220 °C Ober-/Unterhitze vorheizen. Kartoffeln waschen, in Spalten/Wedges schneiden, mit Olivenöl, Salz, Pfeffer und etwas Paprikapulver mischen und auf ein Blech geben. Im heißen Ofen ca. 25–30 Minuten goldbraun backen, nach der Hälfte einmal wenden. In der Zwischenzeit Schnitzel trocken tupfen, leicht flach klopfen, salzen, pfeffern und mit Paprikapulver würzen. Für die Panade jeweils Mehl, verquirlte Eier und Semmelbrösel bereitstellen; Schnitzel zuerst in Mehl wenden, dann durch die Eier ziehen und zuletzt gut mit Semmelbröseln panieren. Öl/Butterschmalz in einer Pfanne stark erhitzen und die Schnitzel von beiden Seiten ca. 3–5 Minuten knusprig braten (je nach Dicke), herausnehmen und kurz ruhen lassen. Für die Senf-Dill-Soße Zwiebel fein würfeln und in etwas Bratfett glasig anschwitzen. Knoblauch kurz mitbraten, dann Brühe angießen und 2–3 Minuten einkochen lassen. Senf (z. B. 1–2 EL Streichsenf und 1 EL Dijon) einrühren, Hitze reduzieren und Schmand/Saure Sahne unter Rühren zu einer cremigen Soße schmelzen lassen. Mit Salz, Pfeffer und Zitronensaft abschmecken und den Dill unterheben. Optional nach Wunsch Gurken- oder Essiggurkenwürfel für eine leicht pikante Note einrühren. Schnitzel mit Ofen-Kartoffelwedges anrichten und die Senf-Dill-Soße darüber oder separat servieren.",
  },
  {
    name: "Klassische Hackfleisch-Paprika-Sauce mit Penne und Kräuterjoghurt",
    type: "fleisch",
    ingredients: ["250 g Rinderhackfleisch", "1 Zwiebel", "2 Knoblauchzehen", "1 rote Paprika", "1 gelbe Paprika", "1 Dose gehackte Tomaten (ca. 400 g)", "2 EL Tomatenmark", "1 TL Paprikapulver edelsüß", "1/2 TL getrockneter Oregano", "Salz", "Pfeffer", "1 Prise Zucker", "2 EL Olivenöl", "300 g Penne (oder Rigatoni)", "2-3 EL Wasser (vom Nudelkochwasser oder zusätzlich)", "150 g Joghurt (z.B. 3,5% Fett)", "1-2 EL gehackte Petersilie (oder Schnittlauch)", "1-2 TL Zitronensaft", "optional: 30 g geriebener Käse zum Bestreuen"],
    instructions: "Penne in Salzwasser nach Packungsangabe bissfest kochen. In der Zwischenzeit Zwiebel würfeln, Knoblauch fein hacken und Paprika in kleine Stücke schneiden. Olivenöl in einer großen Pfanne erhitzen, Zwiebel darin 2-3 Minuten anbraten, dann Knoblauch zugeben und kurz mitrösten. Rinderhackfleisch in die Pfanne geben, krümelig anbraten und mit Salz, Pfeffer sowie Paprikapulver würzen. Paprikastücke hinzufügen und 4-5 Minuten mitbraten, bis sie etwas weich werden. Tomatenmark einrühren, kurz anrösten, dann gehackte Tomaten, Oregano und eine Prise Zucker zugeben. Die Sauce 10-15 Minuten köcheln lassen und bei Bedarf mit etwas Wasser (oder Nudelkochwasser) cremiger rühren. Währenddessen Joghurt mit Petersilie/Schnittlauch, Zitronensaft, Salz und Pfeffer abschmecken. Penne abgießen, mit der Hackfleisch-Paprika-Sauce mischen (bei Bedarf noch einen Schuss Nudelwasser zugeben). Auf Tellern anrichten, mit Kräuterjoghurt toppen und optional etwas Käse darüberstreuen.",
  },
  {
    name: "Ofen-Hackfleisch-Champignon-Käseauflauf mit Kartoffeln und Kräutern",
    type: "fleisch",
    ingredients: ["500 g Kartoffeln", "400 g Hackfleisch (Rind oder gemischt)", "250 g Champignons", "1 Zwiebel", "2 Knoblauchzehen", "200 g Schmand oder Crème fraîche", "150 g geriebener Käse (z. B. Gouda/Emmentaler)", "2 EL Tomatenmark", "1 TL Paprikapulver (edelsüß)", "1 TL getrockneter Oregano (oder italienische Kräuter)", "Salz", "Pfeffer", "1 EL Öl", "1 EL Butter", "1 Bund Petersilie (oder Schnittlauch)", "optional: 1 Prise Chiliflocken"],
    instructions: "Den Ofen auf 200 °C Ober-/Unterhitze vorheizen. Die Kartoffeln waschen, schälen (optional) und in dünne Scheiben schneiden. Zwiebel würfeln, Knoblauch fein hacken. Champignons putzen und vierteln. Öl und Butter in einer Pfanne erhitzen und das Hackfleisch darin krümelig anbraten, mit Salz, Pfeffer und Paprikapulver würzen. Zwiebel und Knoblauch zugeben und kurz mitbraten. Champignons dazugeben und so lange braten, bis Flüssigkeit verdampft ist. Tomatenmark unterrühren, Oregano (und optional Chiliflocken) dazugeben und kurz mitrösten. Schmand/Crème fraîche in die Pfanne geben und alles 2–3 Minuten sanft köcheln lassen. Eine Auflaufform leicht einfetten, Kartoffelscheiben hineinlegen und die Hack-Champignon-Soße darüber verteilen. Mit geriebenem Käse bestreuen. Im Ofen ca. 35–45 Minuten backen, bis die Kartoffeln weich sind und der Käse goldbraun ist. Vor dem Servieren mit gehackter Petersilie oder Schnittlauch bestreuen.",
  },
];

/** Feste Grundsammlung: Klassiker + große Basis (worker/recipes/*), dazu kommen KI-Rezepte aus der DB */
export const MEAL_DATABASE: Recipe[] = [...CLASSIC_RECIPES, ...VEGETARISCH, ...FLEISCH, ...WOCHENENDE, ...MEALDB];

export interface ScoringContext {
  familyMembers: { type: string; age: number | null; favorite_foods: string[] | null; disliked_foods: string[] | null }[];
  rejectedMeals: string[];
  mealRatings: Record<string, number>;
  healthConditions: string[];
  /** Ernährungs-Schwerpunkte (mehrere möglich), siehe nutrition.ts */
  healthFocus: string[];
  /** Fleisch höchstens so oft pro Kalenderwoche (null = keine Grenze) */
  meatMaxPerWeek?: number | null;
  /** Monat 1–12 für „saisonal“ */
  month?: number;
  /** Kommentare der Familie zu bewerteten Gerichten (für KI-Rezepte) */
  feedback?: string[];
  /** Familie (für eigene Rezepte in der Tabelle recipes) */
  profileId?: string;
  /** Regeln pro Wochentag (frei / höchstens X Minuten), siehe dayRules.ts */
  dayRules?: DayRules;
  /** So oft pro Woche Brotzeit statt Kochen (feste Brotzeit-Wochentage zählen mit) */
  brotzeitPerWeek?: number;
  /** Gerichte, die schon im Plan sind (nur beim Ersetzen: −20) */
  existingPlanMeals?: string[];
  /** Favoriten ohne Turnus bekommen einen Bonus */
  favoriteNames?: string[];
  /** In den letzten Wochen schon geplant → Abzug für mehr Abwechslung */
  recentNames?: string[];
  /** Frisch erzeugte KI-Rezepte → Bonus, damit sie auch eingeplant werden */
  newNames?: string[];
  /** „Kommt nie in den Plan“ – Hauptzutaten, die die ganze Familie nicht will (siehe dislikes.ts) */
  familyDislikes?: string[];
}

const MEAT_RE =
  /hackfleisch|hähnchen|huhn|hühner|pute|kalb|speck|schinken|wurst|würstchen|leberkäse|guanciale|kassler|fleisch|rippchen|schwein|\brind|\blamm|filet|schnitzel|(?<!ge)braten|burger|lachs|fisch|kabeljau|thunfisch|garnele|chorizo|salami|sardine|sardelle|barsch|forelle|dorade|makrele|hering|tintenfisch|muschel|scampi|krabbe|shrimp/i;

// Zutaten mit Gluten (Weizen, Dinkel, Roggen, Gerste …)
const GLUTEN_RE =
  /spaghetti|nudel|pasta|penne|tortellini|gnocchi|spätzle|mehl|brot|bun|tortilla|wrap|couscous|bulgur|teig|pizza|ramen|weizen|dinkel|roggen|gerste|paniermehl|semmel|sojasoße|sojasauce|worcester/i;

// Oberbegriffe für „mag nicht“ / „mag gern“ → konkrete Zutaten
const FOOD_GROUPS: Record<string, string[]> = {
  fisch: ["fisch", "lachs", "thunfisch", "forelle", "kabeljau", "seelachs", "dorsch", "hering", "makrele", "zander", "sardine"],
  meeresfrüchte: ["garnele", "shrimp", "muschel", "tintenfisch", "calamari", "krabbe"],
  pilze: ["pilz", "champignon", "pfifferling", "steinpilz"],
  nüsse: ["nuss", "nüsse", "walnuss", "haselnuss", "mandel", "cashew", "erdnuss", "pistazie"],
  fleisch: ["fleisch", "hack", "hähnchen", "huhn", "rind", "schwein", "lamm", "speck", "wurst"],
  käse: ["käse", "parmesan", "mozzarella", "feta", "gorgonzola", "cheddar", "gouda", "emmentaler"],
  nudeln: ["nudel", "spaghetti", "penne", "pasta", "tortellini", "spätzle"],
};

function expandTerm(term: string): string[] {
  const t = term.trim().toLowerCase();
  if (!t) return [];
  for (const [group, words] of Object.entries(FOOD_GROUPS)) {
    if (t === group || t === group.replace(/e$/, "") || t + "e" === group) return words;
  }
  return [t];
}

/** Trifft eine Abneigung (inkl. Oberbegriffe wie „Fisch“) dieses Gericht? */
export function dislikeMatches(meal: Recipe, term: string): boolean {
  const text = [meal.name, ...meal.ingredients].join(" | ").toLowerCase();
  return expandTerm(term).some((t) => text.includes(t));
}

export function containsGluten(meal: Recipe): boolean {
  return violates(meal, GLUTEN_RE, /glutenfrei/i);
}

// ---------- Gesundheitsbedingungen (Muster übernommen aus der Juli-Version, verfeinert) ----------
// Best-Effort-Heuristik auf Zutatentexten – keine zertifizierte Allergie-Absicherung.

const LACTOSE_RE =
  /(?<!kokos|hafer|soja|mandel|reis|cashew)milch|sahne|käse|butter(?!schmalz)|joghurt|quark|schmand|crème fraîche|creme fraiche|mascarpone|parmesan|mozzarella|ricotta|feta|gorgonzola|cheddar|gouda|emmentaler/i;
const NUT_RE =
  /nuss|nüsse|mandel|haselnuss|walnuss|cashew|pistazie|erdnuss|pekannuss|macadamia|pinienkern|nutella|marzipan/i;
const ANIMAL_RE = new RegExp(
  `${LACTOSE_RE.source}|butterschmalz|\\bei(er)?\\b|eigelb|eiweiß|honig|gelatine|fisch|lachs|thunfisch|garnele`,
  "i"
);
const ALCOHOL_RE = /wein(?!essig|blatt|traube)|bier|\brum\b|likör|sekt|alkohol|cognac|brandy/i;
const SUGAR_RE = /zucker|honig|sirup|weißbrot|marmelade|nutella/i;

/**
 * Trifft das Muster eine Zutat, die nicht ausdrücklich „…frei“ ist? Der Name zählt auch („Spaghetti Bolognese“),
 * außer die Zutaten nennen die freie Variante („glutenfreie Spaghetti“).
 */
function violates(meal: Recipe, pattern: RegExp, freeMarker?: RegExp): boolean {
  const isFree = (s: string) => !!freeMarker && freeMarker.test(s);
  const freeIngredient = meal.ingredients.some((i) => pattern.test(i) && isFree(i));
  if (pattern.test(meal.name) && !isFree(meal.name) && !freeIngredient) return true;
  return meal.ingredients.some((i) => pattern.test(i) && !isFree(i));
}

/** Enthält das Rezept Fleisch oder Fisch? */
export function looksMeaty(meal: Recipe): boolean {
  return MEAT_RE.test(meal.name) || meal.ingredients.some((i) => MEAT_RE.test(i));
}

/** Harte Ausschlüsse nach Profil-Einstellungen (Diabetes ist nur ein Abzug, siehe scoreMeal) */
export function violatesHealthConditions(meal: Recipe, conditions: string[]): boolean {
  const has = (c: string) => conditions.includes(c);
  const meaty = meal.type === "fleisch" || meal.ingredients.some((i) => MEAT_RE.test(i));
  if ((has("vegetarian") || has("vegan")) && meaty) return true;
  if (has("vegan") && violates(meal, ANIMAL_RE, /vegan/i)) return true;
  if (has("gluten_free") && containsGluten(meal)) return true;
  if (has("lactose_intolerant") && violates(meal, LACTOSE_RE, /laktosefrei|vegan/i)) return true;
  if (has("nut_allergy") && violates(meal, NUT_RE)) return true;
  if (has("no_alcohol") && violates(meal, ALCOHOL_RE, /alkoholfrei/i)) return true;
  return false;
}

export function scoreMeal(meal: Recipe, ctx: ScoringContext): number {
  let score = 50;
  if (ctx.rejectedMeals.includes(meal.name)) return -1;
  if (ctx.existingPlanMeals?.includes(meal.name)) score -= 20;
  if (ctx.mealRatings[meal.name]) score += ctx.mealRatings[meal.name] * 10;
  if (ctx.favoriteNames?.includes(meal.name)) score += 20;
  if (ctx.recentNames?.includes(meal.name)) score -= 25;
  if (ctx.newNames?.includes(meal.name)) score += 5;

  const text = [meal.name, ...meal.ingredients].join(" | ").toLowerCase();
  const matches = (term: string) => expandTerm(term).some((t) => text.includes(t));

  for (const member of ctx.familyMembers) {
    for (const fav of member.favorite_foods || []) if (matches(fav)) score += 15;
    for (const dis of member.disliked_foods || []) if (matches(dis)) score -= 30;
    if (member.type === "child" && member.age && member.age < 8 && meal.type === "fleisch" && meal.ingredients.length <= 8) {
      score += 5;
    }
  }

  if (violatesHealthConditions(meal, ctx.healthConditions)) return -1;
  // Familien-Nein oder Abneigung der Mehrheit: nie planen (einzelne Abneigungen geben oben nur Abzug)
  if (excludedByDislikes(meal, ctx.familyDislikes, ctx.familyMembers, (d) => dislikeMatches(meal, d))) return -1;
  if (ctx.healthConditions.includes("diabetes") && violates(meal, SUGAR_RE)) score -= 15;

  score += focusScore(meal, ctx.healthFocus ?? [], ctx.month);
  return Math.max(0, score);
}

// ---------- Ähnliche Gerichte erkennen ----------
// „Mediterrane Quinoa-Pfanne“ und „Skandinavische Quinoa-Pfanne“ sind für die Familie dasselbe.

const NAME_STOPWORDS = new Set([
  "mit", "und", "in", "im", "aus", "dem", "der", "die", "das", "den", "vom", "von", "an", "auf", "nach", "art", "à", "la",
  "zu", "zum", "zur", "oder", "ein", "eine",
]);
/** Beschreibende Wörter, die nichts über das eigentliche Gericht sagen */
const NAME_DESCRIPTOR_RE =
  /^(asiatisch|mediterran|skandinavisch|indisch|italienisch|französisch|griechisch|orientalisch|mexikanisch|thailändisch|spanisch|deutsch|klassisch|bunt|schnell|cremig|einfach|herzhaft|würzig|leicht|selbstgemacht|knusprig|krossen?|frisch|mild|gefüllt|überbacken|hausgemacht|lecker|fein|sommerlich|winterlich|herbstlich|rustikal|traditionell|original)/;

/** Kennwörter eines Gerichts (ohne Füllwörter und Herkunftsangaben), z. B. {quinoa, pfanne} */
export function dishKeywords(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .split(/[^a-zäöüß]+/)
      .filter((w) => w.length > 2 && !NAME_STOPWORDS.has(w) && !NAME_DESCRIPTOR_RE.test(w))
      .map((w) => w.replace(/(en|er|es|e|n|s)$/, ""))
  );
}

/** Hauptgericht ohne Beilagen: „Kassler mit Sauerkraut und Püree“ → „Kassler“ */
const mainDish = (name: string) => name.split(/\s(?:mit|und|&|in|an|auf)\s/i)[0];

/** Gleiches Hauptgericht in anderer Variante? (gleiche Kennwörter oder mehr als die Hälfte gemeinsam) */
export function isSimilarDish(a: string, b: string): boolean {
  const ka = dishKeywords(mainDish(a));
  const kb = dishKeywords(mainDish(b));
  if (ka.size === 0 || kb.size === 0) return false;
  let shared = 0;
  for (const w of ka) if (kb.has(w)) shared++;
  if (shared === ka.size && shared === kb.size) return true;
  return shared >= 2 && shared / (ka.size + kb.size - shared) > 0.5;
}

/** Wie viele Kennwörter teilt ein Gericht mit den zuletzt geplanten? (Grundlage für Abwechslung) */
function overlapWithRecent(name: string, recent: string[]): number {
  const k = dishKeywords(name);
  let n = 0;
  for (const r of recent) for (const w of dishKeywords(r)) if (k.has(w) && !GENERIC_DISH_WORDS.has(w)) n++;
  return n;
}
/** Wörter, die sich ruhig öfter wiederholen dürfen */
const GENERIC_DISH_WORDS = new Set(["gemüs", "kartoffel", "reis", "soß", "sauc", "salat", "ofen", "brot", "kräuter", "tomat", "zwiebel"]);

/** Sa/So → wochenende, gerade Wochentage → fleisch, ungerade → vegetarisch */
export function preferredTypeFor(dateStr: string): Recipe["type"] {
  const dow = new Date(dateStr + "T00:00:00Z").getUTCDay();
  if (dow === 0 || dow === 6) return "wochenende";
  return dow % 2 === 0 ? "fleisch" : "vegetarisch";
}

export function pickMeal(
  dateStr: string,
  ctx: ScoringContext,
  used: Set<string>,
  pool: Recipe[] = MEAL_DATABASE
): Recipe | null {
  const preferred = preferredTypeFor(dateStr);
  // Etwas Zufall, damit nicht jeder Plan dieselben Spitzenreiter bekommt; Gerichte, die den
  // letzten Tagen ähneln (z. B. die dritte Quinoa-Pfanne), rutschen nach hinten
  const recent = [...used].slice(-6);
  const all = pool.map((meal) => ({ meal, score: scoreMeal(meal, ctx) }))
    .filter((s) => s.score >= 0)
    .map((s) => ({ ...s, rank: s.score + Math.random() * 15 - 15 * overlapWithRecent(s.meal.name, recent) }))
    .sort((a, b) => b.rank - a.rank);
  const fresh = all.filter((s) => !used.has(s.meal.name));
  // Sind alle schon dran gewesen: das Gericht wiederholen, das am längsten zurückliegt
  // (`used` ist in Einfüge-Reihenfolge, wiederholte Gerichte wandern ans Ende)
  const order = [...used];
  const oldest = (list: typeof all) =>
    list.reduce<(typeof all)[number] | undefined>(
      (best, s) => (!best || order.indexOf(s.meal.name) < order.indexOf(best.meal.name) ? s : best),
      undefined
    );
  const choice =
    fresh.find((s) => s.meal.type === preferred) ??
    fresh[0] ??
    oldest(all.filter((s) => s.meal.type === preferred)) ??
    oldest(all);
  if (!choice) return null;
  used.delete(choice.meal.name);
  used.add(choice.meal.name);
  return choice.meal;
}

/** Bestes Ersatzgericht für einen Tag (schließt Gerichte aus `exclude` aus) */
export function pickReplacement(
  dateStr: string,
  ctx: ScoringContext,
  pool: Recipe[],
  exclude: Set<string>
): Recipe | null {
  const preferred = preferredTypeFor(dateStr);
  // Etwas Zufall wie bei pickMeal, sonst kommt beim Austauschen immer derselbe Spitzenreiter
  const scored = pool
    .filter((m) => !exclude.has(m.name))
    .map((meal) => ({ meal, score: scoreMeal(meal, ctx) }))
    .filter((s) => s.score >= 0)
    .map((s) => ({ ...s, rank: s.score + Math.random() * 15 }))
    .sort((a, b) => b.rank - a.rank);
  return (scored.find((s) => s.meal.type === preferred) ?? scored[0])?.meal ?? null;
}
