import { z } from "zod";
import type { ConnectRequest } from "@api-types";

export const ConnectRequestSchema: z.ZodType<ConnectRequest> = z.object({
  email: z.string().email("email must be a valid address"),
  appPassword: z.string().min(1, "appPassword is required"),
  senderAllowlist: z.array(z.string().min(1)).optional(),
});
