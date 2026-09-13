import {
  ListingCreateSchema,
  type CarAttributes,
  type ItemAttributes,
  type ListingCategory,
  type ListingCreate,
  type ListingIntent,
  type PropertyAttributes,
} from "./schemas/listing";

export type ListingFormDraft = {
  category: ListingCategory | null;
  intent: ListingIntent;
  title: string;
  description: string;
  price: string;
  itemCondition: ItemAttributes["condition"] | null;
  carMake: string;
  carModel: string;
  carYear: string;
  carMileage: string;
  carTransmission: CarAttributes["transmission"] | null;
  carFuelType: CarAttributes["fuel_type"] | null;
  propertyType: PropertyAttributes["property_type"] | null;
  bedrooms: string;
  bathrooms: string;
  areaSqm: string;
  furnishing: PropertyAttributes["furnishing"] | null;
};

export const EMPTY_LISTING_DRAFT: Omit<ListingFormDraft, "category" | "intent"> = {
  title: "",
  description: "",
  price: "",
  itemCondition: null,
  carMake: "",
  carModel: "",
  carYear: "",
  carMileage: "",
  carTransmission: null,
  carFuelType: null,
  propertyType: null,
  bedrooms: "",
  bathrooms: "",
  areaSqm: "",
  furnishing: null,
};

export const LISTING_FIELD_PLACEHOLDERS = {
  title: {
    ITEM: "Item title",
    CAR: "Vehicle title",
    PROPERTY: "Property title",
    SERVICE: "Service title",
  },
  description: "Details a neighbour should know",
  price: "Amount in EGP",
  carMake: "Vehicle make",
  carModel: "Vehicle model",
  carYear: "Model year",
  carMileage: "Kilometres driven",
  bedrooms: "Number of bedrooms",
  bathrooms: "Number of bathrooms",
  areaSqm: "Area in square metres",
} as const;

function parsedPrice(draft: ListingFormDraft): number | null | undefined {
  if (draft.intent === "FREE") return null;
  const raw = draft.price.trim();
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return value;
}

function parsedAttributes(draft: ListingFormDraft): ListingCreate["attributes"] | undefined {
  if (!draft.category || draft.category === "SERVICE") return null;
  if (draft.category === "ITEM") {
    if (!draft.itemCondition) return undefined;
    return { condition: draft.itemCondition };
  }
  if (draft.category === "CAR") {
    const year = Number(draft.carYear);
    const mileage = Number(draft.carMileage);
    if (
      !draft.carMake.trim() ||
      !draft.carModel.trim() ||
      !draft.carYear.trim() ||
      !draft.carMileage.trim() ||
      !draft.carTransmission ||
      !draft.carFuelType
    ) {
      return undefined;
    }
    if (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1) {
      return undefined;
    }
    if (!Number.isInteger(mileage) || mileage < 0) return undefined;
    return {
      make: draft.carMake.trim(),
      model: draft.carModel.trim(),
      year,
      mileage_km: mileage,
      transmission: draft.carTransmission,
      fuel_type: draft.carFuelType,
    };
  }
  const bedroomCount = Number(draft.bedrooms);
  const bathroomCount = Number(draft.bathrooms);
  const area = Number(draft.areaSqm);
  if (
    !draft.propertyType ||
    !draft.bedrooms.trim() ||
    !draft.bathrooms.trim() ||
    !draft.areaSqm.trim() ||
    !draft.furnishing
  ) {
    return undefined;
  }
  if (
    !Number.isInteger(bedroomCount) ||
    bedroomCount < 0 ||
    bedroomCount > 100 ||
    !Number.isInteger(bathroomCount) ||
    bathroomCount < 0 ||
    bathroomCount > 100
  ) {
    return undefined;
  }
  if (!Number.isFinite(area) || area <= 0) return undefined;
  return {
    property_type: draft.propertyType,
    bedrooms: bedroomCount,
    bathrooms: bathroomCount,
    area_sqm: area,
    furnishing: draft.furnishing,
  };
}

export function listingDraftToCreate(draft: ListingFormDraft): ListingCreate | null {
  if (!draft.category || !draft.title.trim()) return null;
  const price = parsedPrice(draft);
  if (price === undefined) return null;
  const attributes = parsedAttributes(draft);
  if (attributes === undefined) return null;
  const parsed = ListingCreateSchema.safeParse({
    category: draft.category,
    intent: draft.intent,
    title: draft.title.trim(),
    description: draft.description.trim() || undefined,
    price,
    currency: "EGP",
    attributes,
    image_urls: [],
  });
  return parsed.success ? parsed.data : null;
}

export function isListingPublishEnabled(draft: ListingFormDraft): boolean {
  return listingDraftToCreate(draft) != null;
}
