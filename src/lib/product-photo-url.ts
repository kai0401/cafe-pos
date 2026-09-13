export function productPhotoUrl(productId: string, updatedAt?: Date | string | null) {
  const v = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  return `/api/product-photos/${productId}?v=${v}`;
}
