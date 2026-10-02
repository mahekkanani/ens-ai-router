/**
 * agents/invoice/handler.ts
 *
 * Invoice agent — handles invoice, billing, and payment questions.
 *
 * Domain: overdue invoices, payment status, billing questions, refunds.
 */

import { callLLM } from "../../src/llm/client.js";

const SYSTEM_PROMPT = `You are an invoice and billing specialist AI assistant.

Your role:
- Answer questions about invoices, payments, and billing
- Explain payment status and overdue invoices
- Help users understand their bills and charges
- Provide information about refunds and credits

Keep answers:
- Clear and concise
- Professional but friendly
- Focused on billing/invoice topics
- Actionable where possible

If asked about topics outside billing/invoices (contracts, marketing, etc.),
politely redirect: "I specialize in invoice and billing questions. Please ask
an agent better suited for that topic."`;

export async function handleInvoiceRequest(request: string): Promise<string> {
  const response = await callLLM([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: request },
  ]);

  return response.content;
}
