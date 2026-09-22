// Online předplatné a služby placené kartou: když k platbě do 7 dnů nepřijde
// faktura, jde do nákladů přímo z banky (pokyn Josefa 22. 9. 2026).
// Vzor se hledá v textu platby (obchodník z výpisu), bez ohledu na velikost písmen.
// Reklama (Google Ads, Meta/Facebook) sem NEPATŘÍ: u plátců je to reverse charge
// a faktura je potřeba, u ostatních je to podklad, který se po klientovi chce.
export const PREDPLATNE = [
  'APPLE\\.COM/BILL', 'SENDINBLUE', 'BREVO', 'SOFTINMOTION', 'AWS', 'AMAZON WEB SERVICES',
  'CONTABO', 'ADOBE', 'FIGMA', 'GODADDY', 'PLESK', 'OPENAI', 'CHATGPT',
  'ANTHROPIC', 'CLAUDE', 'OPENROUTER', 'MIDJOURNEY', 'GITHUB', 'GITLAB', 'LOVABLE', 'KLINGAI',
  'GOOGLE CLOUD', 'GOOGLE CHROME', 'GOOGLE WORKSPACE', 'ATLASSIAN', 'TRACKINGTIME',
  'DIGITALOCEAN', 'CAPCUT', 'CANVA', 'NOTION', 'DROPBOX', 'MICROSOFT', 'ZOOM', 'SLACK',
  'WEDOS', 'WEBHOSTING', 'MAILHOSTING', 'DOMENA', 'NAVYSENI PROSTORU', '1PASSWORD', 'VERCEL',
]
const RE = new RegExp(PREDPLATNE.join('|'), 'i')

export const jePredplatne = (t) => RE.test(`${t.counterparty_name ?? ''} ${t.message ?? ''}`.replace(/\+/g, ' '))
