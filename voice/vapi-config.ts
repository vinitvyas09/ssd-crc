export const envConfig = {
    vapi: {
      apiUrl: process.env.NEXT_PUBLIC_VAPI_API_BEARER_TOKEN ?? "https://api.vapi.ai",
      token: process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN ?? "vapi-web-token",
    },
};  