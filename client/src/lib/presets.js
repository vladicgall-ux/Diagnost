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

export const FUEL_TYPES = [
  "Бензин", "Дизель", "Гибрид", "Газ (ГБО)", "Электро",
];
