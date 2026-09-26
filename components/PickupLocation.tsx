import { siteConfig } from "@/lib/site-config";

export function PickupLocation() {
  const pickup = siteConfig.pickupLocation;
  return (
    <>
      <h2>Retirada em São Paulo</h2>
      <p><strong>{pickup.name}</strong> · {pickup.streetAddress}, {pickup.city} - {pickup.state}.</p>
      <p>{pickup.note}</p>
    </>
  );
}
