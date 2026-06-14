import { describe, expect, it } from "vitest";

import { stripUnitSuffix } from "./googleAddressService";

describe("stripUnitSuffix", () => {
  it("strips a comma-separated unit suffix", () => {
    expect(stripUnitSuffix("22216 Caminito Escobedo, Unit 31")).toEqual({
      stripped: "22216 Caminito Escobedo",
      hadUnit: true,
    });
  });

  it("strips a # suffix with no comma", () => {
    expect(stripUnitSuffix("22216 Caminito Escobedo #31")).toEqual({
      stripped: "22216 Caminito Escobedo",
      hadUnit: true,
    });
  });

  it("strips an Apt suffix", () => {
    expect(stripUnitSuffix("22216 Caminito Escobedo Apt 31")).toEqual({
      stripped: "22216 Caminito Escobedo",
      hadUnit: true,
    });
  });

  it("strips a Unit suffix with no comma", () => {
    expect(stripUnitSuffix("22216 Caminito Escobedo Unit 31")).toEqual({
      stripped: "22216 Caminito Escobedo",
      hadUnit: true,
    });
  });

  it("strips a Suite suffix with a letter unit", () => {
    expect(stripUnitSuffix("100 Main St, Suite B")).toEqual({
      stripped: "100 Main St",
      hadUnit: true,
    });
  });

  it("leaves an address with no unit suffix unchanged", () => {
    expect(stripUnitSuffix("22216 Caminito Escobedo")).toEqual({
      stripped: "22216 Caminito Escobedo",
      hadUnit: false,
    });
  });

  it("leaves a plain street address unchanged", () => {
    expect(stripUnitSuffix("100 Civic Center Dr")).toEqual({
      stripped: "100 Civic Center Dr",
      hadUnit: false,
    });
  });
});
