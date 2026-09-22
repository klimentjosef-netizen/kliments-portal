-- 0008 · Původní řádek bankovního výpisu (pro dohledání)
ALTER TABLE public.bank_transactions ADD COLUMN raw jsonb;
