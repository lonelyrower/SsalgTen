
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const asLatencyData = (value: unknown): LatencyResultData =>
  typeof value === "object" && value !== null ? (value as LatencyResultData) : {};

const asTracerouteData = (value: unknown): TracerouteResultData =>
  typeof value === "object" && value !== null ? (value as TracerouteResultData) : {};
