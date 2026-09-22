"""Vydané faktury z Pohoda XML exportu (dataPack, invoice.xsd) -> JSON dokladů pro import_json.mjs.

Použití: python pohoda_fv_to_json.py <export.xml> <ico klienta> <out.json>
Částka dokladu = souhrn dokladu (invoiceSummary) v domácí měně včetně zaokrouhlení.
"""
import json
import sys
import uuid
import xml.etree.ElementTree as ET

NS = {
    "dat": "http://www.stormware.cz/schema/version_2/data.xsd",
    "inv": "http://www.stormware.cz/schema/version_2/invoice.xsd",
    "typ": "http://www.stormware.cz/schema/version_2/type.xsd",
}
UID_NS = uuid.UUID("6f1d8a52-9d0e-4c55-9a8b-2a6f0c1e7c11")


def t(el, path):
    x = el.find(path, NS)
    return x.text.strip() if x is not None and x.text and x.text.strip() else None


def num(s):
    return float(s) if s not in (None, "") else 0.0


def main(src, ico, out):
    root = ET.parse(src).getroot()
    client_id = str(uuid.uuid5(UID_NS, f"client|{ico}"))
    docs, total = [], 0.0
    for inv in root.iter(f"{{{NS['inv']}}}invoice"):
        h = inv.find("inv:invoiceHeader", NS)
        if t(h, "inv:invoiceType") not in ("issuedInvoice", "issuedCreditNotice"):
            continue
        cislo = t(h, "inv:number/typ:numberRequested") or t(h, "inv:number/typ:numberRequested")
        items = inv.findall("inv:invoiceDetail/inv:invoiceItem", NS)
        sh = "inv:invoiceSummary/inv:homeCurrency/typ:"
        # celkem = souhrn dokladu (bez DPH + DPH v obou sazbách + haléřové zaokrouhlení)
        zaklad = sum(num(t(inv, sh + k)) for k in ("priceNone", "priceLow", "priceHigh", "price3"))
        dph = sum(num(t(inv, sh + k)) for k in ("priceLowVAT", "priceHighVAT", "price3VAT"))
        castka = zaklad + dph + num(t(inv, sh + "round/typ:priceRound"))
        popis = ", ".join(x for x in (t(i, "inv:text") for i in items) if x)
        obj = t(h, "inv:numberOrder")
        partner = t(h, "inv:partnerIdentity/typ:address/typ:company") or t(h, "inv:partnerIdentity/typ:address/typ:name")
        dobropis = t(h, "inv:invoiceType") == "issuedCreditNotice"
        total += castka
        docs.append(dict(
            id=str(uuid.uuid5(UID_NS, f"fv|{ico}|{cislo}")), client_id=client_id,
            kind="credit_note" if dobropis else "issued_invoice", source="import", status="reviewed",
            counterparty_name=partner, counterparty_ico=t(h, "inv:partnerIdentity/typ:address/typ:ico"),
            doc_number=cislo, var_symbol=t(h, "inv:symVar"),
            order_number=obj.lstrip("0") if obj else None,
            issue_date=t(h, "inv:date"), taxable_date=t(h, "inv:dateTax") or t(h, "inv:date"),
            due_date=t(h, "inv:dateDue"), currency="CZK",
            amount_total=round(castka, 2), amount_vat=round(dph, 2), amount_czk=round(castka, 2),
            description=popis, extraction_method="import",
            note="Vydaná faktura z exportu e-shopu (Pohoda XML), bez PDF",
        ))
    json.dump(dict(docs=docs), open(out, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"faktur {len(docs)}, celkem {total:,.2f} Kč".replace(",", " "))


if __name__ == "__main__":
    main(*sys.argv[1:4])
