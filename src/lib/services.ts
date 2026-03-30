// Service → allowed routes mapping

export const SERVICE_ROUTES: Record<string, string[]> = {
  'CFO na volné noze': ['/dashboard', '/cfo', '/zpravy'],
  'Finanční diagnóza': ['/dashboard', '/diagnoza', '/zpravy'],
  'Prodej za maximum': ['/dashboard', '/valuace', '/zpravy'],
  'Příprava na investora': ['/dashboard', '/investor', '/zpravy'],
  'Mentoring': ['/dashboard', '/mentoring', '/zpravy'],
  'Rozjeď to správně': ['/dashboard', '/cfo', '/zpravy'],
  'Firemní audit': ['/dashboard', '/diagnoza', '/zpravy'],
  'Startup kit': ['/dashboard', '/cfo', '/investor', '/zpravy'],
}

// Default routes if service not mapped
const DEFAULT_ROUTES = ['/dashboard', '/zpravy']

export function getRoutesForService(service: string | undefined | null): string[] {
  if (!service) return DEFAULT_ROUTES
  return SERVICE_ROUTES[service] || DEFAULT_ROUTES
}
