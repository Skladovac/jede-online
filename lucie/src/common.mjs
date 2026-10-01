// Sdílené části webu a tiskovin: česká sazba a ornament olivové větvičky.

// Česká sazba: jednopísmenné předložky a spojky nezůstávají na konci řádku, čísla se nelámou.
// Upravuje jen text mezi značkami; skripty, styly a atributy zůstávají beze změny.
export function czechTypo(html) {
  const nbsp = '\u00a0';
  return html.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>)/g).map(part => part.startsWith('<') ? part : part
    .replace(/(?<=^|[\s(„])([kKsSvVzZoOuUaAiI]) (?=\S)/g, `$1${nbsp}`)
    .replace(/(\d) (?=\d{3}(?!\d))/g, `$1${nbsp}`)
    .replace(/(\d) (?=[\p{L}/])/gu, `$1${nbsp}`)
  ).join('');
}

// Olivová větvička (viewBox 0 0 120 48); lístky leží přesně na křivce stonku.
export const OLIVE = '<g stroke-width="1"><path d="M4 42C34 34 70 24 116 7"/><path d="M0 0c6.5 -4.8 18.5 -4.8 25 0c-6.5 4.8 -18.5 4.8 -25 0z" transform="translate(13.2 39.5) rotate(-59.1)"/><path d="M0 0c6.5 -4.8 18.5 -4.8 25 0c-6.5 4.8 -18.5 4.8 -25 0z" transform="translate(22.8 36.9) rotate(20.5)"/><path d="M0 0c6 -4.4 17 -4.4 23 0c-6 4.4 -17 4.4 -23 0z" transform="translate(34.8 33.5) rotate(-60)"/><path d="M0 0c5.7 -4.2 16.3 -4.2 22 0c-5.7 4.2 -16.3 4.2 -22 0z" transform="translate(47.4 29.9) rotate(19.4)"/><path d="M0 0c5.2 -3.8 14.8 -3.8 20 0c-5.2 3.8 -14.8 3.8 -20 0z" transform="translate(60.7 25.8) rotate(-61.3)"/><path d="M0 0c4.7 -3.4 13.3 -3.4 18 0c-4.7 3.4 -13.3 3.4 -18 0z" transform="translate(74.8 21.3) rotate(18)"/><path d="M0 0c4.2 -3 11.8 -3 16 0c-4.2 3 -11.8 3 -16 0z" transform="translate(89.6 16.4) rotate(-62.9)"/><path d="M0 0c3.4 -2.5 9.6 -2.5 13 0c-3.4 2.5 -9.6 2.5 -13 0z" transform="translate(102.5 11.9) rotate(16.4)"/><path d="M0 0c3 -2.2 9 -2.2 12 0c-3 2.2 -9 2.2 -12 0z" transform="translate(113 8) rotate(-20.3)"/></g>';
