import { z } from 'zod';
import { BnsService } from '../services/bns.js';

export const bnsTools = (bnsService: BnsService) => ({
  bns_get_primary_name: {
    description: 'Gets the primary BNS name for a Stacks address (e.g., SP17A1AM4TNYFPAZ75Z84X3D6R2F6DTJBDJ6B0YF -> muneeb.btc)',
    parameters: z.object({
      address: z.string().describe('Stacks address to lookup'),
    }),
    handler: async (args: { address: string }) => {
      try {
        const name = await bnsService.getPrimaryName(args.address);

        if (!name) {
          return {
            success: true,
            address: args.address,
            name: null,
            message: 'No BNS name found for this address',
          };
        }

        return {
          success: true,
          address: args.address,
          name,
          message: `Primary BNS name for ${args.address} is ${name}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  bns_resolve_name: {
    description: 'Resolves a BNS name to its Stacks address (e.g., muneeb.btc -> SP17A1AM4TNYFPAZ75Z84X3D6R2F6DTJBDJ6B0YF)',
    parameters: z.object({
      name: z.string().describe('BNS name to resolve (e.g., muneeb.btc)'),
    }),
    handler: async (args: { name: string }) => {
      try {
        const address = await bnsService.resolveNameToAddress(args.name);

        if (!address) {
          return {
            success: true,
            name: args.name,
            address: null,
            message: 'BNS name not found or not registered',
          };
        }

        return {
          success: true,
          name: args.name,
          address,
          message: `${args.name} resolves to ${address}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  bns_get_owned_names: {
    description: 'Gets all BNS names owned by a Stacks address',
    parameters: z.object({
      address: z.string().describe('Stacks address to lookup'),
    }),
    handler: async (args: { address: string }) => {
      try {
        const names = await bnsService.getOwnedNames(args.address);

        return {
          success: true,
          address: args.address,
          names,
          count: names.length,
          message: `Found ${names.length} BNS name(s) owned by ${args.address}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  bns_get_name_info: {
    description: 'Gets detailed information about a BNS name including owner, registration date, and renewal height',
    parameters: z.object({
      name: z.string().describe('BNS name to get info for (e.g., muneeb.btc)'),
    }),
    handler: async (args: { name: string }) => {
      try {
        const info = await bnsService.getNameInfo(args.name);

        if (!info) {
          return {
            success: true,
            name: args.name,
            info: null,
            message: 'BNS name not found',
          };
        }

        return {
          success: true,
          name: args.name,
          owner: info.owner,
          registeredAt: info.registeredAt?.toString() || 'N/A',
          renewalHeight: info.renewalHeight.toString(),
          stxBurn: info.stxBurn.toString(),
          message: `${args.name} is owned by ${info.owner}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  bns_can_resolve: {
    description: 'Checks if a BNS name can be resolved (is valid and registered)',
    parameters: z.object({
      name: z.string().describe('BNS name to check'),
    }),
    handler: async (args: { name: string }) => {
      try {
        const result = await bnsService.canResolveName(args.name);

        if (!result) {
          return {
            success: true,
            name: args.name,
            canResolve: false,
            message: `${args.name} cannot be resolved`,
          };
        }

        return {
          success: true,
          name: args.name,
          canResolve: true,
          owner: result.owner,
          renewalHeight: result.renewal.toString(),
          message: `${args.name} can be resolved`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  bns_get_name_from_id: {
    description: 'Gets the BNS name from a token ID',
    parameters: z.object({
      tokenId: z.coerce.number().describe('NFT token ID'),
    }),
    handler: async (args: { tokenId: number }) => {
      try {
        const name = await bnsService.getBnsFromId(args.tokenId);

        if (!name) {
          return {
            success: true,
            tokenId: args.tokenId,
            name: null,
            message: `No BNS name found for token ID ${args.tokenId}`,
          };
        }

        return {
          success: true,
          tokenId: args.tokenId,
          name,
          message: `Token ID ${args.tokenId} corresponds to ${name}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },

  bns_get_id_from_name: {
    description: 'Gets the token ID from a BNS name',
    parameters: z.object({
      name: z.string().describe('BNS name (e.g., muneeb.btc)'),
    }),
    handler: async (args: { name: string }) => {
      try {
        const tokenId = await bnsService.getIdFromBns(args.name);

        if (tokenId === null) {
          return {
            success: true,
            name: args.name,
            tokenId: null,
            message: `No token ID found for ${args.name}`,
          };
        }

        return {
          success: true,
          name: args.name,
          tokenId,
          message: `${args.name} has token ID ${tokenId}`,
        };
      } catch (error: any) {
        return {
          success: false,
          error: error.message,
        };
      }
    },
  },
});
