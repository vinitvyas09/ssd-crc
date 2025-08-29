import Vapi from "@vapi-ai/web";
import { envConfig } from "@/voice/vapi-config";

export const vapi = new Vapi(envConfig.vapi.token);