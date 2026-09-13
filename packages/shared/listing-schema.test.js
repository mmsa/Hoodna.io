const assert = require("node:assert/strict");
const test = require("node:test");

const { ListingCreateSchema } = require("./dist");

test("accepts category-specific marketplace attributes", () => {
  const car = ListingCreateSchema.safeParse({
    category: "CAR",
    title: "Toyota Corolla",
    intent: "SELL",
    attributes: {
      make: "Toyota",
      model: "Corolla",
      year: 2022,
      mileage_km: 30000,
      transmission: "AUTOMATIC",
      fuel_type: "PETROL",
    },
  });
  const property = ListingCreateSchema.safeParse({
    category: "PROPERTY",
    title: "Apartment",
    intent: "RENT",
    attributes: {
      property_type: "APARTMENT",
      bedrooms: 2,
      bathrooms: 2,
      area_sqm: 120,
      furnishing: "FURNISHED",
    },
  });

  assert.equal(car.success, true);
  assert.equal(property.success, true);
});

test("rejects rent intent for cars and items", () => {
  for (const category of ["CAR", "ITEM"]) {
    const result = ListingCreateSchema.safeParse({
      category,
      title: "Invalid rental",
      intent: "RENT",
    });
    assert.equal(result.success, false);
  }
});

test("rejects attributes from another category", () => {
  const result = ListingCreateSchema.safeParse({
    category: "ITEM",
    title: "Wrong details",
    intent: "SELL",
    attributes: {
      make: "Toyota",
      model: "Corolla",
      year: 2022,
      mileage_km: 30000,
      transmission: "AUTOMATIC",
      fuel_type: "PETROL",
    },
  });

  assert.equal(result.success, false);
});

test("blank item, car, and property drafts cannot publish", () => {
  const { EMPTY_LISTING_DRAFT, isListingPublishEnabled, listingDraftToCreate } = require("./dist");
  for (const category of ["ITEM", "CAR", "PROPERTY"]) {
    const draft = { ...EMPTY_LISTING_DRAFT, category, intent: "SELL" };
    assert.equal(isListingPublishEnabled(draft), false);
    assert.equal(listingDraftToCreate(draft), null);
  }
});

test("complete item, car, and property drafts can publish", () => {
  const { isListingPublishEnabled } = require("./dist");
  assert.equal(
    isListingPublishEnabled({
      category: "ITEM",
      intent: "SELL",
      title: "Dining table",
      description: "",
      price: "500",
      itemCondition: "USED",
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
    }),
    true,
  );
  assert.equal(
    isListingPublishEnabled({
      category: "CAR",
      intent: "SELL",
      title: "Family car",
      description: "",
      price: "200000",
      itemCondition: null,
      carMake: "Honda",
      carModel: "Civic",
      carYear: "2020",
      carMileage: "12000",
      carTransmission: "AUTOMATIC",
      carFuelType: "PETROL",
      propertyType: null,
      bedrooms: "",
      bathrooms: "",
      areaSqm: "",
      furnishing: null,
    }),
    true,
  );
  assert.equal(
    isListingPublishEnabled({
      category: "PROPERTY",
      intent: "RENT",
      title: "Garden apartment",
      description: "",
      price: "15000",
      itemCondition: null,
      carMake: "",
      carModel: "",
      carYear: "",
      carMileage: "",
      carTransmission: null,
      carFuelType: null,
      propertyType: "APARTMENT",
      bedrooms: "2",
      bathrooms: "1",
      areaSqm: "95",
      furnishing: "FURNISHED",
    }),
    true,
  );
});
