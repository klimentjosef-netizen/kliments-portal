"""Pilot Maliiisa: zpracovaný xlsx 1-7/2026 -> JSON pro import do účetního jádra.

Zdroj pravdy je Maliiisa_ucetnictvi_1-7_2026.xlsx (rekonstrukce z bankovních výpisů,
součty sedí na výpisy). Soubory dokladů v něm nejsou, jen jejich názvy; k dokladům se
dotáhnou ze sběrného mailu. Částku dokladu bez souboru nevyplňujeme (neodvozujeme ji
z platby), párování nese částku platby.

Použití: python maliiisa_xlsx_to_json.py <xlsx> <out.json>
"""
import hashlib
import json
import sys
import uuid
from datetime import datetime

import openpyxl

CLIENT_ICO = "24051705"
NS = uuid.UUID("6f1d8a52-9d0e-4c55-9a8b-2a6f0c1e7c11")  # stabilní UUID => import je opakovatelný


def uid(*parts):
    return str(uuid.uuid5(NS, "|".join(str(p) for p in parts)))


def dt(s):
    if s is None:
        return None
    if isinstance(s, datetime):
        return s.date().isoformat()
    return datetime.strptime(str(s).strip(), "%d.%m.%Y").date().isoformat()


def txt(v):
    return None if v is None or str(v).strip() == "" else str(v).strip()


def main(xlsx, out):
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    client_id = uid("client", CLIENT_ICO)
    account_id = uid("account", "6893596004/5500")
    tx, docs, matches = [], [], []
    seen = {}

    def dedup(*key):
        base = hashlib.sha1("|".join(str(k) for k in key).encode()).hexdigest()[:16]
        seen[base] = seen.get(base, 0) + 1
        return f"xlsx:{base}:{seen[base]}"

    income_cat = {
        "Půjčka jednatele": "owner_loan",
        "Výplata z GoPay": "gateway_payout",
        "Přímá platba zákazníka": "customer_payment",
        "Vratka od dodavatele": "supplier_refund",
    }
    for r in wb["Příjmy"].iter_rows(min_row=4, values_only=True):
        if not r[0]:
            continue
        key = dedup("in", r[0], r[1], r[4], r[5], r[6])
        tx.append(dict(
            id=uid("tx", key), client_id=client_id, account_id=account_id,
            booked_on=dt(r[0]), amount=round(float(r[1]), 2),
            counterparty_name=txt(r[3]), counterparty_account=txt(r[4]),
            var_symbol=txt(r[5]), message=txt(r[6]), dedup_key=key,
            category=income_cat[r[2]], no_document_needed=False, note=None,
        ))

    method = {"symbol": "var_symbol", "částka+datum": "amount", "původní částka v EUR": "amount"}
    for r in wb["Odchozí platby"].iter_rows(min_row=4, values_only=True):
        if not r[0]:
            continue
        (datum, castka, dodavatel, protiucet, vs, typ, zprava, stav, cislo, soubor, zpusob) = r[:11]
        key = dedup("out", datum, castka, protiucet, vs, zprava)
        t = dict(
            id=uid("tx", key), client_id=client_id, account_id=account_id,
            booked_on=dt(datum), amount=-round(float(castka), 2),
            counterparty_name=txt(dodavatel), counterparty_account=txt(protiucet),
            var_symbol=txt(vs), message=txt(zprava), tx_type=txt(typ), dedup_key=key,
            category=None, no_document_needed=False, note=None,
        )
        if stav == "Kryto mzdovou agendou":
            t.update(category="payroll", no_document_needed=True, note=f"Kryto mzdovou agendou: {zpusob}")
        elif stav == "Vráceno dodavatelem":
            t.update(category="refunded", no_document_needed=True, note=zpusob)
        elif stav == "Doloženo":
            doc_id = uid("doc", cislo, soubor)
            docs.append(dict(
                id=doc_id, client_id=client_id, kind="received_invoice", source="import",
                status="reviewed", file_name=txt(soubor), counterparty_name=txt(dodavatel),
                doc_number=txt(cislo), var_symbol=txt(vs), extraction_method="import",
                note="Soubor čeká na stažení ze sběrného mailu",
            ))
            m = method[zpusob]
            matches.append(dict(
                client_id=client_id, bank_transaction_id=t["id"], document_id=doc_id,
                amount=round(float(castka), 2), method=m, confirmed=(m == "var_symbol"),
            ))
        elif stav != "CHYBÍ DOKLAD":
            raise SystemExit(f"neznámý stav {stav!r}")
        tx.append(t)

    for r in wb["Doklady bez platby"].iter_rows(min_row=4, values_only=True):
        if r[1] is None:
            continue
        datum, castka, mena, dodavatel, cislo, vs, davka, soubor = r[:8]
        docs.append(dict(
            id=uid("doc", cislo, soubor), client_id=client_id,
            kind="credit_note" if "vratka" in str(dodavatel).lower() else "received_invoice",
            source="import", status="reviewed", file_name=txt(soubor),
            counterparty_name=txt(dodavatel), doc_number=txt(cislo), var_symbol=txt(vs),
            issue_date=dt(datum), currency=mena, amount_total=round(float(castka), 2),
            extraction_method="import", note=f"Dávka {davka}; soubor čeká na stažení ze sběrného mailu",
        ))

    client = dict(
        id=client_id, name="Maliiisa s.r.o.", ico=CLIENT_ICO, legal_form="s.r.o.",
        address="U Sportoviště 1165/8, Ostrava-Poruba", vat_payer=False, intake_cadence="monthly",
        pricing={"basis": "bank_moves", "tiers": [
            {"to": 150, "price": 3000}, {"to": 300, "price": 5000},
            {"to": 600, "price": 7500}, {"to": 1000, "price": 10000}],
            "extras": {"hpp": 350, "dpp": 200, "pomocne_prace_h": 800, "poradenstvi_h": 2500}},
    )
    account = dict(id=account_id, client_id=client_id, number="6893596004/5500",
                   currency="CZK", name="Raiffeisenbank")
    json.dump(dict(client=client, account=account, tx=tx, docs=docs, matches=matches),
              open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"pohyby {len(tx)}, doklady {len(docs)}, párování {len(matches)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
