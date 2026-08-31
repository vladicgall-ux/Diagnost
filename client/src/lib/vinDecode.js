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

  const make = get("Make");
  const model = get("Model");
  const year = get("Model Year");

  if (!make) {
    throw new Error("Не удалось распознать VIN этого автомобиля");
  }

  const vehicle = {};
  if (make) vehicle.make = titleCase(make);
  if (model) vehicle.model = model;
  if (year) vehicle.year = year;
  return vehicle;
}

function titleCase(s) {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}
