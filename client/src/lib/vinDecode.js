import { matchMake, matchModel } from "./carCatalog";

// Decodes a VIN into make/model/year using NHTSA's free public vPIC API.
// No key required, CORS-enabled. Coverage is strongest for vehicles sold
// in the US market — some region-only models may come back incomplete.
export async function decodeVIN(vin) {
  const res = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${encodeURIComponent(vin)}?format=json`
  );
  if (!res.ok) throw new Error("Сервис расшифровки VIN недоступен");

  const data = await res.json();
  const results = data?.Results || [];
  const get = (name) => results.find((r) => r.Variable === name)?.Value || "";

  const rawMake = get("Make");
  const rawModel = get("Model");
  const year = get("Model Year");

  if (!rawMake) {
    throw new Error("Не удалось распознать VIN этого автомобиля");
  }

  const make = matchMake(rawMake);
  const vehicle = { make };
  if (rawModel) vehicle.model = matchModel(make, rawModel);
  if (year) vehicle.year = year;
  return vehicle;
}
