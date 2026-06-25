import { describe, it, expect } from "vitest";
import { EMPLOYEE_ROLES } from "./RequireEmployee";

describe("EMPLOYEE_ROLES", () => {
  it("allows every role the employee portal is built to route/guard for", () => {
    // Regression guard: dispatcher was missing from this set despite
    // EmployeeLayout's navForRole explicitly expecting it, and despite
    // profiles.role now (post-migration) allowing it to be assigned.
    for (const role of ["admin", "support", "technician", "dispatcher", "employee", "customer_service", "sales"]) {
      expect(EMPLOYEE_ROLES.has(role as any)).toBe(true);
    }
  });

  it("does not allow the plain customer role into the employee portal", () => {
    expect(EMPLOYEE_ROLES.has("customer" as any)).toBe(false);
  });
});
