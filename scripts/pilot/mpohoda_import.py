"""Exporty z mPohody (dataPack XML) -> JSON dokladů pro import_json.mjs.

Zpracuje:
  * vydané faktury (issuedInvoice) a dobropisy (issuedCreditNotice)
  * daňové doklady k přijaté platbě (intDoc) = výstup DPH ze záloh
Zálohové faktury (issuedAdvanceInvoice) se do DPH ani do výnosů nepočítají,
proto se přeskakují.

Použití: python mpohoda_import.py <ico> <out.json> <soubor.xml> [další.xml ...]
"""
import json
import sys
import uuid
import xml.etree.ElementTree as ET

NS = {
    "dat": "http://www.stormware.cz/schema/version_2/data.xsd",
    "inv": "http://www.stormware.cz/schema/version_2/invoice.xsd",
    "int": "http://www.stormware.cz/schema/version_2/intDoc.xsd",
    "typ": "http://www.stormware.cz/schema/version_2/type.xsd",
}
UID_NS = uuid.UUID("6f1d8a52-9d0e-4c55-9a8b-2a6f0c1e7c11")
SAZBY = {"none": 0, "low": 12, "high": 21, "third": 0}


def t(el, path):
    if el is None:
        return None
    x = el.find(path, NS)
    return x.text.strip() if x is not None and x.text and x.text.strip() else None


def num(s):
    return float(s) if s not in (None, "") else 0.0


def sazby_z_souhrnu(home):
    """Rozpis podle sazeb ze souhrnu dokladu."""
    out = []
    for klic, sazba in (("priceNone", 0), ("priceLow", 12), ("priceHigh", 21)):
        zaklad = num(t(home, f"typ:{klic}"))
        dph = num(t(home, f"typ:{klic}VAT")) if klic != "priceNone" else 0.0
        if zaklad or dph:
            out.append({"sazba": sazba, "zaklad": round(zaklad, 2), "dph": round(dph, 2)})
    return out


def celkem(home):
    z = sum(num(t(home, f"typ:{k}")) for k in ("priceNone", "priceLow", "priceHigh"))
    d = sum(num(t(home, f"typ:{k}VAT")) for k in ("priceLow", "priceHigh"))
    return round(z + d + num(t(home, "typ:round/typ:priceRound")), 2)


def partner(hlavicka, cesta):
    a = hlavicka.find(f"{cesta}/typ:address", NS)
    if a is None:
        return {}
    return {
        "counterparty_name": t(a, "typ:company") or t(a, "typ:name"),
        "counterparty_ico": t(a, "typ:ico"),
        "counterparty_dic": t(a, "typ:dic"),
    }


def faktura(inv, client_id, ico):
    h = inv.find("inv:invoiceHeader", NS)
    typ = t(h, "inv:invoiceType")
    if typ not in ("issuedInvoice", "issuedCreditNotice"):
        return None  # zálohové faktury do účetnictví nevstupují
    home = inv.find("inv:invoiceSummary/inv:homeCurrency", NS)
    cislo = t(h, "inv:number/typ:numberRequested") or t(h, "inv:symVar")
    znamenko = -1 if typ == "issuedCreditNotice" else 1
    sazby = [{**s, "zaklad": znamenko * s["zaklad"], "dph": znamenko * s["dph"]} for s in sazby_z_souhrnu(home)]
    castka = znamenko * celkem(home)
    polozky = [
        {
            "nazev": t(p, "inv:text") or "",
            "mnozstvi": num(t(p, "inv:quantity")) or 1,
            "mj": t(p, "inv:unit") or "ks",
            "cena_bez_dph": num(t(p, "inv:homeCurrency/typ:price")),
            "sazba_dph": SAZBY.get(t(p, "inv:rateVAT") or "none", 0),
            "cena_s_dph": num(t(p, "inv:homeCurrency/typ:price")) + num(t(p, "inv:homeCurrency/typ:priceVAT")),
        }
        for p in inv.findall("inv:invoiceDetail/inv:invoiceItem", NS)
    ]
    dph = round(sum(s["dph"] for s in sazby), 2)
    return dict(
        id=str(uuid.uuid5(UID_NS, f"mpohoda|{ico}|{typ}|{cislo}")),
        client_id=client_id, kind="credit_note" if znamenko < 0 else "issued_invoice",
        source="import", status="reviewed",
        **partner(h, "inv:partnerIdentity"),
        doc_number=cislo, var_symbol=t(h, "inv:symVar"),
        issue_date=t(h, "inv:date"), taxable_date=t(h, "inv:dateTax") or t(h, "inv:date"),
        due_date=t(h, "inv:dateDue"), currency="CZK",
        amount_total=castka, amount_czk=castka, amount_vat=dph,
        vat_breakdown=sazby, vat_regime="tuzemsko" if dph else "osvobozeno" if sazby else None,
        items=polozky,
        description=", ".join(x["nazev"] for x in polozky if x["nazev"])[:500] or t(h, "inv:text"),
        suggested_vat_class="UD" if dph else "UN",
        extraction_method="mpohoda", note="Vydaná faktura z mPohody",
    )


def danovy_doklad(doc, client_id, ico):
    """Daňový doklad k přijaté platbě (interní doklad) = výstup DPH ze zálohy."""
    h = doc.find("int:intDocHeader", NS)
    home = doc.find("int:intDocSummary/int:homeCurrency", NS)
    cislo = t(h, "int:number/typ:numberRequested") or t(h, "int:symVar")
    sazby = sazby_z_souhrnu(home)
    dph = round(sum(s["dph"] for s in sazby), 2)
    return dict(
        id=str(uuid.uuid5(UID_NS, f"mpohoda|{ico}|intDoc|{cislo}")),
        client_id=client_id, kind="issued_invoice", source="import", status="reviewed",
        **partner(h, "int:partnerIdentity"),
        doc_number=cislo, var_symbol=t(h, "int:symVar"),
        issue_date=t(h, "int:date"), taxable_date=t(h, "int:dateTax") or t(h, "int:date"),
        currency="CZK", amount_total=celkem(home), amount_czk=celkem(home), amount_vat=dph,
        vat_breakdown=sazby, vat_regime="tuzemsko" if dph else None,
        description=t(h, "int:text") or "Daňový doklad k přijaté platbě",
        suggested_vat_class="UD" if dph else "UN",
        extraction_method="mpohoda", note="Daňový doklad k přijaté platbě z mPohody",
    )


def main(ico, out, soubory):
    client_id = None  # doplní import_json.mjs podle IČO
    docs, preskoceno = [], 0
    for soubor in soubory:
        root = ET.parse(soubor).getroot()
        for inv in root.iter(f"{{{NS['inv']}}}invoice"):
            d = faktura(inv, client_id, ico)
            docs.append(d) if d else None
            preskoceno += 0 if d else 1
        for doc in root.iter(f"{{{NS['int']}}}intDoc"):
            docs.append(danovy_doklad(doc, client_id, ico))
    json.dump({"client_ico": ico, "docs": docs}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"dokladů {len(docs)} (přeskočeno zálohových {preskoceno}), "
          f"celkem {sum(d['amount_total'] for d in docs):,.2f} Kč, "
          f"DPH {sum(d['amount_vat'] for d in docs):,.2f} Kč".replace(",", " "))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3:])
