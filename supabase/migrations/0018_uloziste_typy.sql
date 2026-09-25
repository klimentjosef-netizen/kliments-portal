-- 0018 · Do úložiště dokladů patří i soubory, které server pošle jako neznámý typ
-- (octet-stream), fotky z mobilu (heic, webp) a e-maily (.eml, .msg).
UPDATE storage.buckets SET allowed_mime_types = ARRAY[
  'application/pdf','application/octet-stream',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword',
  'application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.spreadsheet',
  'text/csv','text/plain','application/xml','text/xml','application/json','application/zip',
  'image/png','image/jpeg','image/gif','image/webp','image/heic','image/heif','image/tiff',
  'message/rfc822','application/vnd.ms-outlook','text/html','application/rtf','image/bmp','application/x-isdoc'
] WHERE id = 'documents';
