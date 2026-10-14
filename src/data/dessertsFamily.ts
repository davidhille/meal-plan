// Alltags-Nachtische für die Familie (eigene Rezepte, ohne Foto – Bilder entstehen nach und nach im Hintergrund
// oder per „Bild generieren“). Schwerpunkt: schnell, Cremes, Obst, warme Süßspeisen und Eis.
import type { Dessert } from '../types';

export const FAMILY_DESSERTS: Dessert[] = [
  // ---------- Cremes & Pudding ----------
  {
    name: 'Vanillepudding selbst gekocht',
    category: 'creme',
    yield: '4 Portionen',
    durationMin: 15,
    ingredients: ['500 ml Milch', '1 Vanilleschote (oder 1 Pck. Vanillezucker)', '40 g Speisestärke', '50 g Zucker', '1 Eigelb', '1 Prise Salz'],
    instructions:
      'Vanilleschote auskratzen. 400 ml Milch mit Mark, Schote, Zucker und Salz aufkochen.\nRestliche Milch mit Stärke und Eigelb glatt rühren.\nSchote herausnehmen, Topf vom Herd ziehen und die Stärkemilch unter Rühren einrühren.\nNoch einmal unter Rühren 1 Min. aufkochen, bis der Pudding andickt.\nIn Schälchen füllen, mit Frischhaltefolie direkt auf der Oberfläche abdecken (keine Haut) und warm oder kalt essen.',
  },
  {
    name: 'Schokoladenpudding mit echter Schokolade',
    category: 'creme',
    yield: '4 Portionen',
    durationMin: 15,
    ingredients: ['500 ml Milch', '40 g Speisestärke', '2 EL Kakaopulver', '50 g Zucker', '60 g Zartbitterschokolade', '1 Prise Salz'],
    instructions:
      'Schokolade hacken. 100 ml Milch mit Stärke, Kakao und Zucker glatt rühren.\nRestliche Milch mit Salz aufkochen, Topf vom Herd nehmen.\nKakaomischung einrühren, unter Rühren 1 Min. kochen lassen.\nSchokolade unterrühren, bis sie geschmolzen ist.\nIn Schälchen füllen und abkühlen lassen. Dazu passt etwas geschlagene Sahne.',
  },
  {
    name: 'Grießbrei mit Zimt und Zucker',
    category: 'creme',
    yield: '4 Portionen',
    durationMin: 15,
    ingredients: ['750 ml Milch', '80 g Weichweizengrieß', '2 EL Zucker', '1 Pck. Vanillezucker', '1 Prise Salz', '1 EL Butter', '2 EL Zimtzucker zum Bestreuen'],
    instructions:
      'Milch mit Zucker, Vanillezucker und Salz aufkochen.\nGrieß unter Rühren einrieseln lassen und bei kleiner Hitze 5 Min. quellen lassen, dabei öfter rühren.\nButter unterrühren.\nIn Teller füllen und mit Zimtzucker bestreuen. Dazu passt Apfelmus oder Kompott.',
  },
  {
    name: 'Milchreis mit warmen Kirschen',
    category: 'creme',
    yield: '4 Portionen',
    durationMin: 40,
    ingredients: ['1 l Milch', '200 g Milchreis', '2 EL Zucker', '1 Pck. Vanillezucker', '1 Prise Salz', '1 Glas Sauerkirschen (720 ml)', '1 EL Speisestärke', 'Zimtzucker'],
    instructions:
      'Milch mit Zucker, Vanillezucker und Salz aufkochen, Reis einrühren.\nBei kleinster Hitze zugedeckt ca. 30 Min. quellen lassen, gelegentlich umrühren.\nKirschen abtropfen lassen, Saft auffangen. 4 EL Saft mit der Stärke verrühren.\nRestlichen Saft aufkochen, Stärke einrühren, kurz köcheln lassen und die Kirschen unterheben.\nMilchreis mit den warmen Kirschen und etwas Zimtzucker servieren.',
  },
  {
    name: 'Quarkspeise mit Beeren',
    category: 'creme',
    yield: '4 Portionen',
    durationMin: 10,
    ingredients: ['500 g Magerquark', '150 g Naturjoghurt', '100 ml Sahne', '3 EL Zucker oder Honig', '1 Pck. Vanillezucker', '1 Bio-Zitrone (Saft und Schale)', '300 g gemischte Beeren (auch TK)'],
    instructions:
      'Quark, Joghurt, Zucker, Vanillezucker, Zitronensaft und etwas Schale glatt rühren.\nSahne steif schlagen und unterheben.\nTK-Beeren kurz antauen lassen.\nQuarkcreme und Beeren abwechselnd in Gläser schichten. Gut gekühlt servieren.',
  },
  {
    name: 'Panna Cotta mit Erdbeersoße',
    category: 'creme',
    yield: '4 Portionen',
    durationMin: 20,
    ingredients: ['400 ml Sahne', '100 ml Milch', '50 g Zucker', '1 Vanilleschote', '3 Blatt Gelatine', '300 g Erdbeeren (auch TK)', '1 EL Puderzucker', '1 TL Zitronensaft'],
    instructions:
      'Gelatine in kaltem Wasser einweichen. Vanilleschote auskratzen.\nSahne, Milch, Zucker, Vanillemark und Schote aufkochen, 5 Min. leise köcheln lassen.\nSchote entfernen, Topf vom Herd nehmen, Gelatine ausdrücken und darin auflösen.\nIn Gläser füllen und mindestens 4 Std. kalt stellen.\nErdbeeren mit Puderzucker und Zitronensaft pürieren und vor dem Servieren auf die Panna Cotta geben.',
  },
  {
    name: 'Mousse au Chocolat',
    category: 'creme',
    yield: '4 Portionen',
    durationMin: 25,
    ingredients: ['150 g Zartbitterschokolade', '2 sehr frische Eier', '1 EL Zucker', '200 ml Sahne', '1 Prise Salz'],
    instructions:
      'Schokolade über dem Wasserbad schmelzen und etwas abkühlen lassen.\nEier trennen. Eigelb mit Zucker schaumig schlagen, Schokolade unterrühren.\nSahne steif schlagen. Eiweiß mit Salz steif schlagen.\nErst die Sahne, dann den Eischnee vorsichtig unter die Schokomasse heben.\nIn Schälchen füllen und mindestens 3 Std. kalt stellen. (Enthält rohe Eier – nicht für Schwangere und Kleinkinder.)',
  },
  {
    name: 'Tiramisu ohne rohe Eier',
    category: 'creme',
    yield: '6 Portionen',
    durationMin: 25,
    ingredients: ['500 g Mascarpone', '250 g Magerquark', '80 g Zucker', '1 Pck. Vanillezucker', '200 ml Sahne', '200 g Löffelbiskuits', '250 ml starker Kaffee (für Kinder Kakao)', '2 EL Kakaopulver zum Bestäuben'],
    instructions:
      'Kaffee kochen und abkühlen lassen.\nMascarpone, Quark, Zucker und Vanillezucker glatt rühren. Sahne steif schlagen und unterheben.\nDie Hälfte der Löffelbiskuits kurz in Kaffee tauchen und eine Form damit auslegen.\nHälfte der Creme darauf streichen, zweite Schicht Biskuits und restliche Creme darauf.\nMindestens 4 Std., besser über Nacht kühlen. Vor dem Servieren mit Kakao bestäuben.',
  },
  {
    name: 'Kokos-Chia-Pudding mit Mango',
    category: 'creme',
    yield: '4 Portionen',
    durationMin: 10,
    ingredients: ['400 ml Kokosmilch', '200 ml Milch oder Haferdrink', '60 g Chiasamen', '2 EL Ahornsirup', '1 reife Mango', '1 Limette'],
    instructions:
      'Kokosmilch, Milch, Chiasamen und Ahornsirup verrühren.\nNach 10 Min. noch einmal umrühren, damit nichts klumpt, dann mindestens 3 Std. oder über Nacht kühlen.\nMango schälen, würfeln und mit etwas Limettensaft mischen.\nPudding in Gläser füllen und die Mango darauf verteilen.',
  },
  {
    name: 'Joghurt-Schichtdessert mit Knuspermüsli',
    category: 'creme',
    yield: '4 Portionen',
    durationMin: 10,
    ingredients: ['500 g griechischer Joghurt', '2 EL Honig', '1 Pck. Vanillezucker', '120 g Knuspermüsli', '300 g Beeren oder Obstwürfel'],
    instructions:
      'Joghurt mit Honig und Vanillezucker verrühren.\nIn Gläser abwechselnd Joghurt, Müsli und Obst schichten.\nMit Müsli und Obst abschließen und gleich servieren, damit das Müsli knusprig bleibt.',
  },
  {
    name: 'Zitronencreme mit Butterkeksen',
    category: 'creme',
    yield: '4 Portionen',
    durationMin: 15,
    ingredients: ['250 g Mascarpone', '250 g Magerquark', '2 Bio-Zitronen (Saft und Schale)', '70 g Puderzucker', '8 Butterkekse'],
    instructions:
      'Mascarpone, Quark, Zitronensaft, abgeriebene Schale und Puderzucker cremig rühren.\nButterkekse grob zerbröseln.\nKekskrümel und Zitronencreme abwechselnd in Gläser schichten.\nMindestens 1 Std. kalt stellen.',
  },
  {
    name: 'Apfel-Spekulatius-Dessert',
    category: 'creme',
    yield: '4 Portionen',
    durationMin: 15,
    ingredients: ['400 g Apfelmus', '1 TL Zimt', '250 g Magerquark', '200 ml Sahne', '2 EL Zucker', '1 Pck. Vanillezucker', '120 g Spekulatius'],
    instructions:
      'Apfelmus mit Zimt verrühren.\nSahne steif schlagen. Quark mit Zucker und Vanillezucker glatt rühren, Sahne unterheben.\nSpekulatius grob zerbröseln.\nIn Gläser Spekulatius, Apfelmus und Quarkcreme schichten, mit Bröseln abschließen.',
  },

  // ---------- Mit Obst ----------
  {
    name: 'Obstsalat mit Joghurt-Honig-Dip',
    category: 'obst',
    yield: '4 Portionen',
    durationMin: 15,
    ingredients: ['2 Äpfel', '2 Bananen', '2 Orangen', '250 g Weintrauben', '1 Kiwi', '1 EL Zitronensaft', '250 g Naturjoghurt', '2 EL Honig'],
    instructions:
      'Obst waschen bzw. schälen und in mundgerechte Stücke schneiden.\nMit Zitronensaft mischen, damit Äpfel und Bananen nicht braun werden.\nJoghurt mit Honig verrühren.\nObstsalat in Schälchen verteilen und den Dip dazu reichen.',
  },
  {
    name: 'Bratäpfel mit Nuss-Rosinen-Füllung',
    category: 'obst',
    yield: '4 Stück',
    durationMin: 40,
    ingredients: ['4 säuerliche Äpfel (z. B. Boskop)', '40 g gehackte Walnüsse oder Mandeln', '30 g Rosinen', '2 EL Honig', '1 TL Zimt', '20 g Butter', 'Vanillesoße zum Servieren'],
    instructions:
      'Ofen auf 180 °C (Umluft 160 °C) vorheizen.\nÄpfel waschen und das Kerngehäuse großzügig ausstechen.\nNüsse, Rosinen, Honig und Zimt mischen und in die Äpfel füllen.\nÄpfel in eine Auflaufform setzen, Butterflöckchen darauf verteilen, etwas Wasser angießen.\nCa. 25–30 Min. backen, bis die Äpfel weich sind. Mit Vanillesoße servieren.',
  },
  {
    name: 'Rote Grütze mit Vanillesoße',
    category: 'obst',
    yield: '4 Portionen',
    durationMin: 20,
    ingredients: ['500 g gemischte rote Beeren (auch TK)', '250 ml Kirschsaft', '60 g Zucker', '30 g Speisestärke', '500 ml Vanillesoße (fertig oder selbst gekocht)'],
    instructions:
      '200 ml Saft mit dem Zucker aufkochen.\nRestlichen Saft mit der Stärke glatt rühren, einrühren und 1 Min. kochen lassen.\nBeeren zugeben und nur noch kurz erhitzen, damit sie ganz bleiben.\nAbkühlen lassen und mit kalter Vanillesoße servieren.',
  },
  {
    name: 'Apfelmus selbst gemacht',
    category: 'obst',
    yield: '4 Portionen',
    durationMin: 25,
    ingredients: ['1 kg Äpfel', '100 ml Wasser oder Apfelsaft', '1–2 EL Zucker (nach Geschmack)', '1 TL Zitronensaft', '1 Prise Zimt'],
    instructions:
      'Äpfel schälen, vierteln, entkernen und in Stücke schneiden.\nMit Wasser, Zitronensaft und Zucker zugedeckt 10–15 Min. weich köcheln.\nMit dem Kartoffelstampfer oder Pürierstab zerdrücken, mit Zimt abschmecken.\nWarm oder kalt essen – passt auch zu Grießbrei, Pfannkuchen und Kaiserschmarrn.',
  },
  {
    name: 'Schoko-Obst-Spieße',
    category: 'obst',
    yield: '8 Spieße',
    durationMin: 20,
    ingredients: ['250 g Erdbeeren', '2 Bananen', '1 Kiwi', '150 g Weintrauben', '100 g Vollmilch- oder Zartbitterschokolade', '2 EL bunte Streusel (nach Wunsch)', '8 Holzspieße'],
    instructions:
      'Obst waschen und in mundgerechte Stücke schneiden.\nAbwechselnd auf die Spieße stecken.\nSchokolade über dem Wasserbad schmelzen und mit einem Löffel über die Spieße träufeln.\nNach Wunsch mit Streuseln bestreuen und kurz kalt stellen, bis die Schokolade fest ist.',
  },
  {
    name: 'Beerengratin mit Mascarponehaube',
    category: 'obst',
    yield: '4 Portionen',
    durationMin: 20,
    ingredients: ['500 g gemischte Beeren (auch TK, aufgetaut)', '250 g Mascarpone', '2 Eigelb', '50 g Zucker', '1 Pck. Vanillezucker', '2 EL gehobelte Mandeln'],
    instructions:
      'Backofengrill vorheizen. Beeren in eine flache Auflaufform oder Portionsförmchen geben.\nMascarpone, Eigelb, Zucker und Vanillezucker glatt rühren und über die Beeren streichen.\nMit Mandeln bestreuen.\nUnter dem Grill 5–8 Min. goldbraun überbacken – dabeibleiben, es geht schnell. Warm servieren.',
  },
  {
    name: 'Birne Helene',
    category: 'obst',
    yield: '4 Portionen',
    durationMin: 30,
    ingredients: ['4 Birnen', '500 ml Wasser', '100 g Zucker', '1 Vanilleschote', '100 g Zartbitterschokolade', '100 ml Sahne', '4 Kugeln Vanilleeis'],
    instructions:
      'Wasser mit Zucker und ausgekratzter Vanilleschote aufkochen.\nBirnen schälen, halbieren, entkernen und im Sirup 10–15 Min. ziehen lassen, bis sie weich sind.\nSchokolade hacken, Sahne erhitzen und die Schokolade darin schmelzen.\nBirnen mit je einer Kugel Vanilleeis anrichten und mit der warmen Schokosoße übergießen.',
  },
  {
    name: 'Melonen-Minz-Salat',
    category: 'obst',
    yield: '4 Portionen',
    durationMin: 10,
    ingredients: ['1/2 Wassermelone', '1/2 Honigmelone', '1 Limette', '1 EL Honig', 'einige Blätter frische Minze'],
    instructions:
      'Melonen schälen, entkernen und in Würfel schneiden.\nLimettensaft mit Honig verrühren.\nMinze in feine Streifen schneiden.\nMelone mit dem Dressing und der Minze mischen und gut gekühlt servieren.',
  },
  {
    name: 'Zwetschgenröster mit Vanilleeis',
    category: 'obst',
    yield: '4 Portionen',
    durationMin: 25,
    ingredients: ['600 g Zwetschgen', '60 g Zucker', '100 ml Rotwein oder Traubensaft', '1 Zimtstange', '2 Gewürznelken', '4 Kugeln Vanilleeis'],
    instructions:
      'Zwetschgen waschen, entsteinen und halbieren.\nZucker in einem Topf leicht karamellisieren, mit Wein oder Saft ablöschen.\nZimtstange und Nelken zugeben, Zwetschgen darin 10–15 Min. weich dünsten.\nGewürze entfernen. Warm oder lauwarm mit Vanilleeis servieren – passt auch zu Kaiserschmarrn.',
  },

  // ---------- Pfannkuchen & warme Süßspeisen ----------
  {
    name: 'Kaiserschmarrn mit Apfelmus',
    category: 'pfanne',
    yield: '4 Portionen',
    durationMin: 25,
    ingredients: ['4 Eier', '250 ml Milch', '150 g Mehl', '1 EL Zucker', '1 Prise Salz', '40 g Rosinen (nach Wunsch)', '3 EL Butter', 'Puderzucker zum Bestäuben', '400 g Apfelmus'],
    instructions:
      'Eier trennen. Eigelb, Milch, Mehl, Zucker und Salz zu einem glatten Teig rühren.\nEiweiß steif schlagen und unterheben, Rosinen unterrühren.\nButter in einer großen Pfanne schmelzen, Teig hineingießen und bei mittlerer Hitze stocken lassen, bis die Unterseite goldbraun ist.\nIn Viertel teilen, wenden und mit zwei Gabeln in Stücke reißen.\nNoch etwas Butter und 1 EL Zucker zugeben und kurz karamellisieren. Mit Puderzucker bestäuben und mit Apfelmus servieren.',
  },
  {
    name: 'Arme Ritter mit Zimtzucker',
    category: 'pfanne',
    yield: '4 Portionen',
    durationMin: 20,
    ingredients: ['8 Scheiben altbackenes Brot oder Toast', '2 Eier', '250 ml Milch', '1 Pck. Vanillezucker', '2 EL Butter', '3 EL Zimtzucker', 'Beeren oder Apfelmus zum Servieren'],
    instructions:
      'Eier, Milch und Vanillezucker in einem tiefen Teller verquirlen.\nBrotscheiben kurz darin einweichen.\nButter in einer Pfanne erhitzen und die Scheiben von beiden Seiten goldbraun braten.\nNoch warm in Zimtzucker wenden und mit Beeren oder Apfelmus servieren.',
  },
  {
    name: 'Apfelküchle – Apfelringe im Teig',
    category: 'pfanne',
    yield: '4 Portionen',
    durationMin: 30,
    ingredients: ['3 Äpfel', '150 g Mehl', '200 ml Milch', '2 Eier', '1 EL Zucker', '1 Prise Salz', 'Öl oder Butterschmalz zum Ausbacken', 'Zimtzucker', 'Vanillesoße zum Servieren'],
    instructions:
      'Mehl, Milch, Eier, Zucker und Salz zu einem dickflüssigen Teig rühren, 10 Min. quellen lassen.\nÄpfel schälen, Kerngehäuse ausstechen und in 1 cm dicke Ringe schneiden.\nFett in einer Pfanne erhitzen (ca. 1 cm hoch).\nApfelringe durch den Teig ziehen und von beiden Seiten goldbraun ausbacken, auf Küchenpapier abtropfen lassen.\nIn Zimtzucker wenden und mit Vanillesoße servieren.',
  },
  {
    name: 'Quarkkeulchen',
    category: 'pfanne',
    yield: '4 Portionen',
    durationMin: 35,
    ingredients: ['500 g mehligkochende Kartoffeln (am Vortag gekocht)', '250 g Magerquark', '1 Ei', '80 g Mehl', '50 g Zucker', '1 Pck. Vanillezucker', '1 Bio-Zitrone (Schale)', '40 g Rosinen (nach Wunsch)', 'Butterschmalz zum Braten', 'Apfelmus zum Servieren'],
    instructions:
      'Kartoffeln pellen und fein reiben oder durch die Presse drücken.\nMit Quark, Ei, Mehl, Zucker, Vanillezucker, Zitronenschale und Rosinen zu einem Teig verkneten.\nMit bemehlten Händen kleine flache Taler formen.\nIn Butterschmalz von beiden Seiten je 3–4 Min. goldbraun braten.\nMit Zimtzucker bestreuen und mit Apfelmus servieren.',
  },
  {
    name: 'Topfenknödel mit Butterbröseln',
    category: 'pfanne',
    yield: '4 Portionen (8 Knödel)',
    durationMin: 45,
    ingredients: ['250 g Magerquark (Topfen)', '1 Ei', '30 g weiche Butter', '1 EL Zucker', '1 Prise Salz', '60 g Weichweizengrieß', '40 g Semmelbrösel (Teig)', '60 g Butter', '80 g Semmelbrösel (zum Wälzen)', '2 EL Zucker', 'Zwetschgenröster oder Kompott'],
    instructions:
      'Quark gut abtropfen lassen. Mit Ei, weicher Butter, Zucker und Salz verrühren, Grieß und 40 g Brösel unterrühren.\nTeig 30 Min. kalt stellen.\nMit nassen Händen 8 Knödel formen und in leicht siedendem Salzwasser 10–12 Min. ziehen lassen.\nButter in einer Pfanne schmelzen, Brösel und Zucker darin goldbraun rösten.\nKnödel abtropfen lassen, in den Butterbröseln wälzen und mit Zwetschgenröster servieren.',
  },
  {
    name: 'Grießschnitten mit Kompott',
    category: 'pfanne',
    yield: '4 Portionen',
    durationMin: 40,
    ingredients: ['500 ml Milch', '100 g Weichweizengrieß', '2 EL Zucker', '1 Pck. Vanillezucker', '1 Prise Salz', '1 Ei', '50 g Semmelbrösel', '2 EL Butter', 'Kirsch- oder Apfelkompott'],
    instructions:
      'Milch mit Zucker, Vanillezucker und Salz aufkochen, Grieß einrühren und unter Rühren 5 Min. dick einkochen.\nMasse ca. 1,5 cm dick auf ein mit Wasser abgespültes Brett oder in eine Form streichen und 20 Min. abkühlen lassen.\nIn Rauten oder Rechtecke schneiden.\nErst in verquirltem Ei, dann in Semmelbröseln wenden.\nIn Butter von beiden Seiten goldbraun braten und mit Kompott servieren.',
  },
  {
    name: 'Dampfnudeln mit Vanillesoße',
    category: 'pfanne',
    yield: '4 Portionen (8 Stück)',
    durationMin: 120,
    ingredients: ['500 g Mehl', '1 Würfel frische Hefe (42 g)', '250 ml lauwarme Milch', '60 g Zucker', '60 g weiche Butter', '1 Ei', '1 Prise Salz', '150 ml Milch (für die Pfanne)', '30 g Butter (für die Pfanne)', '1 EL Zucker (für die Pfanne)', '500 ml Vanillesoße'],
    instructions:
      'Hefe in der lauwarmen Milch mit 1 TL Zucker auflösen.\nMit Mehl, restlichem Zucker, Butter, Ei und Salz zu einem glatten Teig kneten und zugedeckt 1 Std. gehen lassen.\nTeig in 8 Stücke teilen, zu Kugeln formen und weitere 15 Min. gehen lassen.\nIn einem großen Topf mit dicht schließendem Deckel Milch, Butter und Zucker erhitzen. Kugeln hineinsetzen.\nZugedeckt bei mittlerer Hitze ca. 25 Min. garen – Deckel nicht öffnen! Am Ende entsteht unten eine Kruste.\nMit warmer Vanillesoße servieren.',
  },
  {
    name: 'Apfel-Zimt-Pfannkuchen',
    category: 'pfanne',
    yield: '4 Portionen',
    durationMin: 30,
    ingredients: ['250 g Mehl', '500 ml Milch', '3 Eier', '1 EL Zucker', '1 Prise Salz', '2 Äpfel', 'Butter zum Braten', 'Zimtzucker'],
    instructions:
      'Mehl, Milch, Eier, Zucker und Salz zu einem glatten Teig rühren und 10 Min. ruhen lassen.\nÄpfel schälen, entkernen und in dünne Spalten schneiden.\nEtwas Butter in einer Pfanne erhitzen, einige Apfelspalten kurz anbraten.\nEine Kelle Teig darübergießen, goldbraun backen, wenden und fertig backen.\nMit Zimtzucker bestreuen. So weitermachen, bis Teig und Äpfel aufgebraucht sind.',
  },

  // ---------- Eis & Kaltes ----------
  {
    name: 'Bananen-Nicecream',
    category: 'eis',
    yield: '4 Portionen',
    durationMin: 10,
    ingredients: ['4 reife Bananen (geschält, in Scheiben eingefroren)', '2–4 EL Milch oder Haferdrink', '1 EL Kakaopulver oder 1 Handvoll TK-Beeren (nach Wunsch)'],
    instructions:
      'Bananenscheiben mindestens 4 Std. vorher einfrieren.\nGefrorene Bananen mit wenig Milch im Mixer oder mit einem starken Pürierstab cremig mixen, zwischendurch herunterschieben.\nNach Wunsch Kakao oder Beeren mitmixen.\nSofort als Softeis essen oder 30 Min. nachfrieren und mit dem Eisportionierer formen.',
  },
  {
    name: 'Frozen-Joghurt-Bruch mit Beeren',
    category: 'eis',
    yield: '1 Blech (ca. 16 Stücke)',
    durationMin: 15,
    ingredients: ['500 g griechischer Joghurt', '3 EL Honig', '1 Pck. Vanillezucker', '200 g Beeren', '30 g Schokodrops oder gehackte Schokolade'],
    instructions:
      'Joghurt mit Honig und Vanillezucker verrühren.\nEin Blech oder eine große Form mit Backpapier auslegen, den Joghurt ca. 1 cm dick daraufstreichen.\nBeeren und Schokolade darauf verteilen und leicht andrücken.\nMindestens 3 Std. einfrieren, dann in unregelmäßige Stücke brechen. Im Gefrierbeutel aufbewahren.',
  },
  {
    name: 'Erdbeer-Joghurt-Eis am Stiel',
    category: 'eis',
    yield: '6–8 Stück',
    durationMin: 10,
    ingredients: ['300 g Erdbeeren', '300 g Naturjoghurt', '3 EL Honig oder Zucker', '1 TL Zitronensaft'],
    instructions:
      'Erdbeeren waschen, putzen und mit Honig und Zitronensaft pürieren.\nJoghurt unterrühren (oder für Streifen abwechselnd einfüllen).\nIn Eis-am-Stiel-Formen füllen, Stiele einstecken.\nMindestens 5 Std. einfrieren. Zum Lösen die Formen kurz in warmes Wasser halten.',
  },
  {
    name: 'Mango-Sorbet ohne Eismaschine',
    category: 'eis',
    yield: '4 Portionen',
    durationMin: 10,
    ingredients: ['500 g TK-Mangowürfel', '2–3 EL Puderzucker oder Honig', '1 Limette (Saft)', '3–4 EL Wasser oder Orangensaft'],
    instructions:
      'Gefrorene Mango 5 Min. antauen lassen.\nMit Puderzucker, Limettensaft und wenig Flüssigkeit im Mixer cremig pürieren.\nSofort servieren oder in einer Dose 30–60 Min. nachfrieren.',
  },
  {
    name: 'Schoko-Bananen am Stiel',
    category: 'eis',
    yield: '8 Stück',
    durationMin: 15,
    ingredients: ['4 Bananen', '150 g Vollmilch- oder Zartbitterschokolade', '1 TL Kokosöl', 'Streusel, gehackte Nüsse oder Kokosraspel', '8 Holzstäbchen'],
    instructions:
      'Bananen schälen, halbieren und auf Holzstäbchen stecken. 30 Min. ins Gefrierfach legen.\nSchokolade mit Kokosöl schmelzen.\nBananen in die Schokolade tauchen und sofort in Streusel oder Nüssen wälzen.\nAuf Backpapier legen und mindestens 1 Std. einfrieren.',
  },
  {
    name: 'Spaghetti-Eis selbst gemacht',
    category: 'eis',
    yield: '4 Portionen',
    durationMin: 15,
    ingredients: ['500 ml Vanilleeis', '200 g Sahne', '300 g Erdbeeren', '1 EL Puderzucker', '2 EL weiße Schokoraspel oder Kokosraspel'],
    instructions:
      'Vanilleeis 10 Min. im Kühlschrank leicht antauen lassen. Sahne steif schlagen und auf 4 Teller verteilen.\nErdbeeren mit Puderzucker pürieren.\nEis portionsweise durch eine Kartoffelpresse direkt auf die Sahne drücken.\nErdbeersoße als „Tomatensoße“ darüber geben und mit Schokoraspeln als „Parmesan“ bestreuen. Sofort servieren.',
  },
  {
    name: 'Zitronen-Granita',
    category: 'eis',
    yield: '4 Portionen',
    durationMin: 15,
    ingredients: ['400 ml Wasser', '120 g Zucker', '4 Bio-Zitronen (Saft und etwas Schale)', 'Minze zum Garnieren'],
    instructions:
      'Wasser mit Zucker aufkochen, bis er sich gelöst hat, abkühlen lassen.\nZitronensaft und etwas abgeriebene Schale einrühren.\nIn eine flache Form gießen und einfrieren.\nAlle 30 Min. mit einer Gabel durchkratzen, insgesamt ca. 3 Std., bis feine Eiskristalle entstehen. Mit Minze servieren.',
  },
  {
    name: 'Pfirsich Melba',
    category: 'eis',
    yield: '4 Portionen',
    durationMin: 15,
    ingredients: ['4 Pfirsichhälften (frisch pochiert oder aus der Dose)', '200 g Himbeeren (auch TK)', '2 EL Puderzucker', '8 Kugeln Vanilleeis', '2 EL gehobelte Mandeln, geröstet'],
    instructions:
      'Himbeeren mit Puderzucker pürieren und durch ein Sieb streichen.\nJe 2 Kugeln Vanilleeis in eine Schale geben, eine Pfirsichhälfte darauf setzen.\nMit Himbeersoße übergießen und mit gerösteten Mandeln bestreuen.',
  },
];
