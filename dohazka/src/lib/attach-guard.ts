// Čisté rozhodnutí bez databáze a bez `server-only`, aby šlo testovat v Node a volat ze skriptu `user-add`.

/**
 * Musí operátor před touto změnou vyměnit heslo účtu (`--reset-password`)?
 * Ano, když jde o EXISTUJÍCÍ účet, jehož heslo nenastavil majitel (`passwordSetByOwner` = false, tedy ho vygeneroval
 * admin nebo skript a někdo ho zná), operátor nepožádal o `--reset-password` a změna tomu, kdo heslo zná, rozšíří moc:
 *  - `noveClenstvi`: účet se přidává do další firmy (otevře se mu i ta), nebo
 *  - `udelujeSuperAdmin`: účtu se nastavuje `--super-admin` (otevře se mu celá služba).
 * Účet, který ještě neexistuje, dostane nové heslo sám, proto se ho to netýká. Úplná tabulka kombinací je v testu.
 */
export function vyzadujeResetHesla(o: {
  existujeUcet: boolean
  heslaNastavilMajitel: boolean
  noveClenstvi: boolean
  udelujeSuperAdmin: boolean
  resetHesla: boolean
}): boolean {
  return o.existujeUcet && !o.heslaNastavilMajitel && !o.resetHesla && (o.noveClenstvi || o.udelujeSuperAdmin)
}
