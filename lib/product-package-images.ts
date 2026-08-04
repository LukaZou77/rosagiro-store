const PACKAGE_IMAGE_FILE_PATTERN = /^(?:package|package-clean)-/i;

function imageFileName(image: string) {
  try {
    const url = new URL(image, "https://rosagiro.local");
    return url.pathname.split("/").pop() || "";
  } catch {
    return image.split(/[?#]/, 1)[0].split("/").pop() || "";
  }
}

export function isProductPackageImage(image: string) {
  return PACKAGE_IMAGE_FILE_PATTERN.test(imageFileName(image));
}

export function orderProductDetailImages(primaryImage: string, gallery: string[] = [], skuImages: string[] = []) {
  const unique = Array.from(new Set([primaryImage, ...gallery, ...skuImages].map((image) => image.trim()).filter(Boolean)));
  const primary = primaryImage.trim();
  const packageImages = unique.filter((image) => image !== primary && isProductPackageImage(image));
  const otherImages = unique.filter((image) => image !== primary && !isProductPackageImage(image));

  return [primary, ...packageImages, ...otherImages].filter(Boolean);
}
