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
