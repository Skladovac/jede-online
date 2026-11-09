// Firma se bere z cookie, formuláře posílají jen hodnoty. Stránka, která zůstala otevřená, než člověk
// v jiném okně přepnul firmu, by proto zapsala do té přepnuté — a u „Nepracoval“, uzávěrky nebo nastavení
// firmy je to zápis do cizích dat, na který se nikdo nezeptá (první okno ta data nikdy nevidělo).
// Stránky, ze kterých se zapisuje, proto posílají, pro kterou firmu se vykreslily, a akce to porovnají
// jako PRVNÍ věc po kontrole oprávnění: před validací, před jakýmkoli dotazem a před zápisem.
//
// Chybějící hodnota je taky odmítnutí (fail-closed): stránka otevřená z doby před nasazením to pole nemá.
// Proto hláška mluví o neplatné stránce, ne o přepnuté firmě — platit musí pro oba případy.
export const STARA_STRANKA = 'Tahle stránka už neplatí (přepnutá firma nebo stará verze). Obnov ji a zkus to znovu.'
