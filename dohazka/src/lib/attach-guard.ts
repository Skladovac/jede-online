// Čisté rozhodnutí bez databáze a bez `server-only`, aby šlo testovat v Node a volat ze skriptu `user-add`.

/**
 * Musí operátor při přidání účtu do firmy vyměnit heslo?
 * Ano, když se EXISTUJÍCÍMU účtu zakládá NOVÉ členství, jeho heslo nenastavil majitel (`passwordSetByOwner` = false,
 * tedy ho vygeneroval admin nebo skript a někdo ho zná) a operátor nepožádal o `--reset-password`.
 */
export function vyzadujeResetHesla(o: { existujeUcet: boolean; heslaNastavilMajitel: boolean; noveClenstvi: boolean; resetHesla: boolean }): boolean {
  return o.existujeUcet && o.noveClenstvi && !o.heslaNastavilMajitel && !o.resetHesla
}
