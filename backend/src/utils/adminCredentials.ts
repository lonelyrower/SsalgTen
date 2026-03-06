import crypto from "crypto";

export type AdminPasswordSource = "configured" | "generated";

export interface AdminPasswordSelection {
  password: string;
  source: AdminPasswordSource;
}

const readConfiguredAdminPassword = (): string =>
  (
    process.env.DEFAULT_ADMIN_PASSWORD ||
    process.env.ADMIN_BOOTSTRAP_PASSWORD ||
    ""
  ).trim();

export const resolveAdminBootstrapPassword = (): AdminPasswordSelection => {
  const configuredPassword = readConfiguredAdminPassword();
  if (configuredPassword) {
    return {
      password: configuredPassword,
      source: "configured",
    };
  }

  return {
    password: crypto.randomBytes(18).toString("base64url"),
    source: "generated",
  };
};
