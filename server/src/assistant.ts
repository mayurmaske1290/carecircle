import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { parseRequest, proposePlan, type Plan, type Store } from "./domain.js";

const region = process.env.AWS_REGION;
const modelId = process.env.BEDROCK_MODEL_ID;
const bedrock = region && modelId ? new BedrockRuntimeClient({ region }) : null;
export async function answerAssistant(message: string, store: Store): Promise<{ reply: string; plan?: Plan; awsUsed: boolean }> {
  if (message.length > 1000) throw new Error("Please keep requests under 1,000 characters.");
  const lower = message.toLowerCase();
  if (/\b(help|what can you do|examples)\b/.test(lower) && !/\bappointment|dinner|grocer|shop|take him|take her\b/.test(lower)) {
    return { reply: "I can coordinate a family appointment, check availability, suggest a task owner, and prepare a plan for approval. Try: ‘Dad has an appointment tomorrow at 5 PM. Who can take him?’ or ‘Help us coordinate a family dinner tomorrow at 7 PM.’", awsUsed: false };
  }
  const request = parseRequest(message);
  const plan = proposePlan(store, request.time, request.title, request.day);
  let reply = plan.recommendedMemberId
    ? `I checked the saved household schedule. ${plan.recommendedMemberName} appears available for the requested time. Review the proposed plan below and approve it if the family member confirms.`
    : `I couldn't find a household member who is available for the full hour at ${request.time}. I haven't assigned anyone. Consider one of the alternative times below or update availability.`;
  let awsUsed = false;
  if (bedrock) {
    try {
      const response = await bedrock.send(new ConverseCommand({
        modelId,
        system: [{ text: "You are CareCircle, a careful family coordination assistant. Do not invent availability, make bookings, contact people, or imply actions have happened. Rephrase the supplied deterministic plan clearly in at most 70 words. State that recommendations must be confirmed by the family member." }],
        messages: [{ role: "user", content: [{ text: JSON.stringify({ request: message, plan, deterministicReply: reply }) }] }],
        inferenceConfig: { maxTokens: 180, temperature: 0.2 }
      }));
      const text = response.output?.message?.content?.map(c => "text" in c ? c.text : "").join(" ").trim();
      if (text) { reply = text; awsUsed = true; }
    } catch (error) {
      console.error("Bedrock call failed; using deterministic response.", error);
    }
  }
  return { reply, plan, awsUsed };
}
