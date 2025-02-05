import {
	ActionProvider,
	CreateAction,
	EvmWalletProvider,
	Network,
} from "@coinbase/agentkit";
import { encodeFunctionData, parseAbi } from "viem";
import { z } from "zod";
import { SimulateTransactionSchema } from "./schemas";

async function encodeContractData(
	functionSignature: string,
	args: any[]
): Promise<string> {
	// Wrap the function signature inside an array to ensure it's parsed correctly
	const abiSignature = `function ${functionSignature}`; // Ensure this is in the correct format
	const abi: any = parseAbi([abiSignature]);
	// Validate the parsed ABI
	if (!abi || abi.length === 0) {
		throw new Error(`Failed to parse ABI for function: ${functionSignature}`);
	}
	// Encode the function and parameters
	const encodedData = encodeFunctionData({
		abi: abi,
		functionName: functionSignature.split("(")[0].trim(), // Extract the function name (before the parentheses)
		args: args,
	});

	// The encoded data includes the method selector and the ABI-encoded arguments
	return encodedData.slice(2); // Remove the "0x" prefix for the final payload
}

interface TenderlyConfig {
	slug: string;
	accessKey: string;
	projectId: string;
}

export class TenderlySimulationProvider extends ActionProvider {
	private config: TenderlyConfig;

	constructor(config: TenderlyConfig) {
		super("tenderly_simulation", []);
		this.config = config;
	}

	@CreateAction({
		name: "simulate_transaction",
		description: `
      Simulates a transaction using Tenderly's API before executing it on-chain.
      
      Inputs:
      - to: The destination address
      - value: (optional) Amount of native tokens to send
      - data: (optional) Transaction data
      - from: (optional) Sender address
      - gas: (optional) Gas limit
      - gasPrice: (optional) Gas price
      `,
		schema: SimulateTransactionSchema,
	})
	async simulateTransaction(
		walletProvider: EvmWalletProvider,
		args: z.infer<typeof SimulateTransactionSchema>
	): Promise<string> {
		try {
			const networkInfo: any = await walletProvider.getNetwork();
			const from = args.from || (await walletProvider.getAddress());

			const simulationPayload = {
				network_id: networkInfo.chainId.toString(),
				from,
				to: args.to,
				input: args.data || "0x",
				value: args.value || "0x0",
				gas: args.gas,
				gas_price: args.gasPrice,
				save: true,
			};

			const response = await fetch(
				`https://api.tenderly.co/api/v1/account/${this.config.slug}/project/${this.config.projectId}/simulate`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-Access-Key": this.config.accessKey,
					},
					body: JSON.stringify(simulationPayload),
				}
			);

			if (!response.ok) {
				throw new Error(`Simulation failed: ${response.statusText}`);
			}

			const simulation = await response.json();
			// console.log(simulation)
			return `
          Simulation Results:
          Status: ${simulation.transaction.status ? "Success" : "Failed"}
          Gas Used: ${simulation.transaction.gas_used}
          Transaction to: ${args.to}
          Value: ${args.value || "0"}
          From: ${from}
          State Changes: ${JSON.stringify(simulation.state_changes, null, 2)}
        `;
		} catch (error) {
			return `Error simulating transaction: ${error}`;
		}
	}

	supportsNetwork = (network: Network): boolean => {
		const supportedNetworks = [
			1,
			5,
			11155111, // Ethereum + testnets
			137,
			80001, // Polygon + Mumbai
			56,
			97, // BSC + testnet
			43114,
			43113, // Avalanche + Fuji
			10,
			420, // Optimism + testnet
			42161,
			421613, // Arbitrum + testnet
		];
		return supportedNetworks.includes(Number(network.chainId));
	};
}

export const tenderlySimulationProvider = (config: TenderlyConfig) =>
	new TenderlySimulationProvider(config);
