export const STREAM_PRESETS = {
  temperature: {
    label: "Temperature (°C)",
    config: {
      intervalMs: 1000,
      windowSize: 5000,
      initialValue: 37.0,
      averageValue: 37.0,
      volatility: 0.1,
      outlierProbability: 0.05,
      preciseVolatilityFactor: 0.2,
      outlierVolatilityFactor: 2.6,
      expectedLower: 36.7,
      expectedUpper: 37.3,
      min: 36.2,
      max: 37.8,
    },
  },
  ph: {
    label: "pH (Matrigel environment)",
    config: {
      intervalMs: 1000,
      windowSize: 5000,
      initialValue: 7.3,
      averageValue: 7.3,
      volatility: 0.04,
      outlierProbability: 0.05,
      preciseVolatilityFactor: 0.25,
      outlierVolatilityFactor: 5.0,
      expectedLower: 7.2,
      expectedUpper: 7.4,
      min: 6.8,
      max: 7.8,
    },
  },
};

export const DEFAULT_STREAM_PRESET = "temperature";

export function createChartDataStream({
  intervalMs = 1000,
  windowSize = 60,
  initialValue = 25,
  averageValue = initialValue,
  volatility = 1.8,
  drift = 0,
  outlierProbability = 0.05,
  preciseVolatilityFactor = 0.2,
  outlierVolatilityFactor = 2.8,
  min = -Infinity,
  max = Infinity,
  labelFormatter = (tick) => `${tick}s`,
} = {}) {
  let timer = null;
  let tick = 0;
  let current = initialValue;
  let movingAverage = averageValue;
  let labels = [];
  let values = [];

  const clamp = (value) => Math.max(min, Math.min(max, value));
  const randomNormal = () => {
    let u = 0;
    let v = 0;

    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();

    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  const nextValue = () => {
    movingAverage += drift;

    const isOutlier = Math.random() < outlierProbability;
    const activeVolatility =
      volatility *
      (isOutlier ? outlierVolatilityFactor : preciseVolatilityFactor);
    const shock = randomNormal() * activeVolatility;
    current = clamp(movingAverage + shock);
    return Number(current.toFixed(2));
  };

  const pushPoint = () => {
    tick += 1;
    labels.push(labelFormatter(tick));
    values.push(nextValue());

    if (labels.length > windowSize) labels = labels.slice(-windowSize);
    if (values.length > windowSize) values = values.slice(-windowSize);

    return {
      labels: [...labels],
      values: [...values],
    };
  };

  return {
    start(onData) {
      if (timer) return;

      // immediate first point
      onData(pushPoint());

      timer = setInterval(() => {
        onData(pushPoint());
      }, intervalMs);
    },

    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },

    reset() {
      tick = 0;
      current = initialValue;
      movingAverage = averageValue;
      labels = [];
      values = [];
    },

    isRunning() {
      return timer !== null;
    },
  };
}
