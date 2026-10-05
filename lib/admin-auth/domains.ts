export const SEED_ROLES = ["buyer", "seller"] as const;
export type SeedRole = (typeof SEED_ROLES)[number];

/** `ecommerce` is the Admin token; the `ecommerce_*` roles are test accounts entered through the popup. */
export type Domain = "ecommerce" | "community" | `ecommerce_${SeedRole}`;

export const seedDomain = (role: SeedRole): Domain => `ecommerce_${role}`;

export function isSeedRole(v: unknown): v is SeedRole {
  return v === "buyer" || v === "seller";
}

/** The only token domains the internal route may serve. */
export function parseTokenDomain(v: unknown): Domain | null {
  return v === "ecommerce" || v === "community" || v === "ecommerce_buyer" || v === "ecommerce_seller" ? v : null;
}
