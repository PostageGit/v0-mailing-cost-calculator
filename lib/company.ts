/**
 * Company configuration -- single source of truth for branding.
 * Update these values to change the company identity across the entire app.
 */
export const COMPANY = {
  name: "Postage Plus",
  address: "100 Red Schoolhouse Rd Unit A-5",
  city: "Spring Valley",
  state: "NY",
  zip: "10977",
  phone: "845-290-8900",
  email: "Mail@thepostageplus.com",

  /** One-liner for quote / invoice footers */
  get fullAddress() {
    return `${this.address}, ${this.city}, ${this.state} ${this.zip}`
  },

  /** Multi-line block for formal documents */
  get block() {
    return [
      this.name,
      this.address,
      `${this.city}, ${this.state} ${this.zip}`,
      this.phone,
      this.email,
    ].join("\n")
  },
} as const
