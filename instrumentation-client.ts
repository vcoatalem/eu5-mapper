import { PosthogHelper } from "@/app/lib/utils/posthog.helper";
import posthog from "posthog-js";

if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  throw new Error("NEXT_PUBLIC_POSTHOG_KEY is not set");
}

if (PosthogHelper.isPosthogEnabled()) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: "2026-01-30",
  });
  console.log("Posthog initialized");
} else {
  console.log("Posthog not initialized on this environment");
}
