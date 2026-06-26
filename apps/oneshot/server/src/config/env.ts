import { z } from "zod";

const integerFromString = (name: string, min: number, max: number) =>
  z
    .string({ required_error: `${name} is required` })
    .transform((value, ctx) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${name} must be an integer between ${min} and ${max}`,
        });
        return z.NEVER;
      }
      return parsed;
    });

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    SERVER_HOST: z.string().min(1, "SERVER_HOST is required"),
    SERVER_PORT: integerFromString("SERVER_PORT", 1, 65535),
    PUBLIC_ORIGIN: z.string().url("PUBLIC_ORIGIN must be a URL"),
    ROOM_CODE_LENGTH: integerFromString("ROOM_CODE_LENGTH", 4, 6),
    ROOM_CODE_ALPHABET: z.string().min(8, "ROOM_CODE_ALPHABET is too short"),
    SESSION_SECRET: z.string().min(12, "SESSION_SECRET must be at least 12 characters"),
    COLYSEUS_RECONNECT_WINDOW_SECONDS: integerFromString(
      "COLYSEUS_RECONNECT_WINDOW_SECONDS",
      30,
      60 * 60 * 24 * 30,
    ),
    EMPTY_ROOM_TTL_SECONDS: integerFromString("EMPTY_ROOM_TTL_SECONDS", 60, 60 * 60 * 24 * 7),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && value.SESSION_SECRET === "dev-only-change-me") {
      ctx.addIssue({
        path: ["SESSION_SECRET"],
        code: z.ZodIssueCode.custom,
        message: "SESSION_SECRET must be changed in production",
      });
    }
  });

export type ServerConfig = z.infer<typeof serverEnvSchema>;

export const parseServerEnv = (source: NodeJS.ProcessEnv): ServerConfig =>
  serverEnvSchema.parse(source);

let cachedConfig: ServerConfig | null = null;

export const getServerConfig = (): ServerConfig => {
  cachedConfig ??= parseServerEnv(process.env);
  return cachedConfig;
};
