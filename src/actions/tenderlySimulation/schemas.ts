import { z } from "zod";

export const SimulateTransactionSchema = z.object({
	to: z.string().describe("The destination address of the transaction"),
	value: z.string().optional().describe("The amount of native tokens to send"),
	data: z.string().optional().describe("The transaction data"),
	from: z.string().optional().describe("The sender address"),
	gas: z.number().optional().describe("Gas limit for the transaction"),
	gasPrice: z.string().optional().describe("Gas price for the transaction"),
});
