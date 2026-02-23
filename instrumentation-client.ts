import posthog from 'posthog-js'
import { env, exit } from 'process';

if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    throw new Error("NEXT_PUBLIC_POSTHOG_KEY is not set");
}

if (env.NODE_ENV === 'development') {
    // disable posthog in development
    exit(0);
}

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: '2026-01-30'
})

console.log("Posthog initialized");