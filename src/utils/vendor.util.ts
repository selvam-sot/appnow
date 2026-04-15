import VendorService from '../models/vendor-service.model';

/**
 * Get all vendor service IDs for a given vendor
 * Cached per request via the vendorId parameter
 */
const vendorServiceIdCache = new Map<string, { ids: string[]; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

export async function getVendorServiceIds(vendorId: string): Promise<string[]> {
  const cached = vendorServiceIdCache.get(vendorId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.ids;
  }

  const vendorServices = await VendorService.find({ vendorId }).select('_id').lean();
  const ids = vendorServices.map(s => s._id.toString());
  vendorServiceIdCache.set(vendorId, { ids, timestamp: Date.now() });
  return ids;
}

export function clearVendorServiceCache(vendorId?: string) {
  if (vendorId) {
    vendorServiceIdCache.delete(vendorId);
  } else {
    vendorServiceIdCache.clear();
  }
}
