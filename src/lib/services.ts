// Service → allowed routes mapping

export const SERVICE_ROUTES: Record<string, string[]> = {
  'CFO na volné noze': ['/dashboard', '/cfo', '/dokumenty', '/zpravy'],
  'Finanční diagnóza': ['/dashboard', '/diagnoza', '/dokumenty', '/zpravy'],
  'Prodej za maximum': ['/dashboard', '/valuace', '/dokumenty', '/zpravy'],
  'Příprava na investora': ['/dashboard', '/investor', '/dokumenty', '/zpravy'],
  'Mentoring': ['/dashboard', '/mentoring', '/dokumenty', '/zpravy'],
  'Rozjeď to správně': ['/dashboard', '/cfo', '/dokumenty', '/zpravy'],
  'Firemní audit': ['/dashboard', '/diagnoza', '/dokumenty', '/zpravy'],
  'Startup kit': ['/dashboard', '/cfo', '/investor', '/dokumenty', '/zpravy'],
}

// Default routes if service not mapped
const DEFAULT_ROUTES = ['/dashboard', '/dokumenty', '/zpravy']

export function getRoutesForService(service: string | undefined | null): string[] {
  if (!service) return DEFAULT_ROUTES

  // Support comma-separated multi-service (e.g. "CFO na volné noze, Rozjeď to správně")
  const services = service.split(',').map(s => s.trim()).filter(Boolean)
  const routes = new Set<string>(DEFAULT_ROUTES)

  for (const svc of services) {
    const svcRoutes = SERVICE_ROUTES[svc]
    if (svcRoutes) {
      for (const r of svcRoutes) routes.add(r)
    }
  }

  return Array.from(routes)
}
