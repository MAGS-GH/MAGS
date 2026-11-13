# Visuel QA for MAGS

Sammenlignede den godkendte skitse `exec-1ab6b502-d8c2-4814-985a-4ba6f103948e.png` (1487 × 1058 px) med det lokale produktionsbuild på 1440 × 1025 CSS-pixel. Browseroptagelsen `full-desktop-final.jpg` er 1425 × 1014 px. Hele forsiden ved ankomst og særskilte hero-udsnit er lagt side om side i `mags-qa-full.jpg` og `mags-qa-hero.jpg` i chattens visualiseringsmappe, nedskaleret til samme bredde. Mobil blev gennemgået ved 390 × 844 CSS-pixel.

- Typografi og tekst: Playfair Display giver overskrift og navnetræk den store serif fra skitsen. Inter gør brødtekst, navigation og trinlinks læsbare på smalle skærme. Overskrift, beskrivelse og primær bookinghandling er synlige ved ankomst.
- Layout og farve: Creme, indigo og vermilion går igen. Det faste format holder grafikken på plads mellem det indledende billede og WebGL. Ydelserne følger den scrollstyrede fortælling. Fire almindelige trinlinks erstatter skitsens grafiketiketter, så de også virker med tastatur.
- Billede og scene: Det første WebP er et selvstændigt motiv fra ImageGen. WebGL viser et scenebygget værksted med formular, sagsbakke, kalender, invitation og opfølgning. De enkelte kapitlers WebP-billeder kommer fra den levende scene. Liveversionen bruger en roligere baggrund og enklere materialer end studiobilledet i skitsen.
- Iteration: Oversigtspladen blev zoomet ud efter beskæring i første test. Kontrasten i sagsbakken blev øget, bookingknappen forstørret, og mobilens ankeroffset blev rettet, så et trinlink aktiverer det rigtige kapitel. Den reviderede scene, mobilens kalendertrin, begge kalenderresultater, tastatur og skift mellem 3D og stillbilleder er afprøvet i browseren. Ingen konsolfejl i den afsluttende 3D-gennemgang.

final result: passed
