export const QUICK_PRESETS = [
  {
    label: "P0300 - Пропуски зажигания",
    dtc: "P0300",
    freezeFrame: { rpm: 850, coolantTemp: 92, stft: 4.2, ltft: 6.8, speed: 0 },
  },
  {
    label: "P0171 - Бедная смесь",
    dtc: "P0171",
    freezeFrame: { rpm: 1600, coolantTemp: 88, stft: 18.5, ltft: 22.1, speed: 45 },
  },
  {
    label: "P0420 - Катализатор",
    dtc: "P0420",
    freezeFrame: { rpm: 2200, coolantTemp: 90, stft: 1.1, ltft: 2.3, speed: 80 },
  },
];

export const MAKES = [
  "Toyota", "Volkswagen", "Kia", "Hyundai", "BMW", "Mercedes-Benz",
  "Lada", "Ford", "Chevrolet", "Nissan", "Audi", "Skoda", "Renault",
];

export const FUEL_TYPES = [
  "Бензин", "Дизель", "Гибрид", "Газ (ГБО)", "Электро",
];

export function randomFreezeFrame() {
  return {
    rpm: Math.floor(600 + Math.random() * 3000),
    coolantTemp: Math.floor(70 + Math.random() * 40),
    stft: +(Math.random() * 20 - 10).toFixed(1),
    ltft: +(Math.random() * 24 - 12).toFixed(1),
    speed: Math.floor(Math.random() * 140),
  };
}
