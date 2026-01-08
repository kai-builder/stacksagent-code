import {
  getPrimaryName,
  fetchUserOwnedNames,
  getNameInfo,
  canResolveName,
  getBnsFromId,
  getIdFromBns,
  getOwner
} from 'bns-v2-sdk';

/**
 * Service for BNS (Bitcoin Name System) operations on Stacks
 */
export class BnsService {
  private network: 'mainnet' | 'testnet';

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network;
  }

  /**
   * Gets the primary BNS name for an address
   * @param address - Stacks address
   * @returns Primary BNS name (fully qualified) or null if not found
   */
  async getPrimaryName(address: string): Promise<string | null> {
    try {
      const result = await getPrimaryName({
        address,
        network: this.network,
      });

      if (!result) return null;

      // Combine name and namespace into fully qualified name
      return `${result.name}.${result.namespace}`;
    } catch (error: any) {
      throw new Error(`Failed to get primary name: ${error.message}`);
    }
  }

  /**
   * Gets all BNS names owned by an address
   * @param address - Stacks address
   * @returns Array of fully qualified BNS names
   */
  async getOwnedNames(address: string): Promise<string[]> {
    try {
      const names = await fetchUserOwnedNames({
        senderAddress: address,
        network: this.network,
      });

      // Convert to fully qualified names
      return names.map(n => `${n.name}.${n.namespace}`);
    } catch (error: any) {
      throw new Error(`Failed to get owned names: ${error.message}`);
    }
  }

  /**
   * Gets detailed information about a BNS name
   * @param fullyQualifiedName - Fully qualified BNS name (e.g., "muneeb.btc")
   * @returns Name information including owner address
   */
  async getNameInfo(fullyQualifiedName: string): Promise<{
    owner: string;
    registeredAt: bigint | string | number | null;
    renewalHeight: bigint | string | number;
    stxBurn: bigint | string | number;
  } | null> {
    try {
      const info = await getNameInfo({
        fullyQualifiedName,
        network: this.network,
      });

      return info || null;
    } catch (error: any) {
      throw new Error(`Failed to get name info: ${error.message}`);
    }
  }

  /**
   * Checks if a BNS name can be resolved
   * @param fullyQualifiedName - Fully qualified BNS name
   * @returns Object with renewal height and owner if resolvable, null otherwise
   */
  async canResolveName(fullyQualifiedName: string): Promise<{
    renewal: bigint | string | number;
    owner: string;
  } | null> {
    try {
      const result = await canResolveName({
        fullyQualifiedName,
        network: this.network,
      });

      return result || null;
    } catch (error: any) {
      throw new Error(`Failed to check name resolution: ${error.message}`);
    }
  }

  /**
   * Gets the BNS name from a token ID
   * @param tokenId - NFT token ID
   * @returns Fully qualified BNS name or null
   */
  async getBnsFromId(tokenId: bigint | string | number): Promise<string | null> {
    try {
      const result = await getBnsFromId({
        id: BigInt(tokenId),
        network: this.network,
      });

      if (!result) return null;

      return `${result.name}.${result.namespace}`;
    } catch (error: any) {
      throw new Error(`Failed to get BNS from ID: ${error.message}`);
    }
  }

  /**
   * Gets the token ID from a BNS name
   * @param fullyQualifiedName - Fully qualified BNS name
   * @returns Token ID
   */
  async getIdFromBns(fullyQualifiedName: string): Promise<bigint | string | number | null> {
    try {
      const id = await getIdFromBns({
        fullyQualifiedName,
        network: this.network,
      });

      return id !== undefined && id !== null ? id : null;
    } catch (error: any) {
      throw new Error(`Failed to get ID from BNS: ${error.message}`);
    }
  }

  /**
   * Resolves a BNS name to an address using getOwner
   * @param fullyQualifiedName - Fully qualified BNS name (e.g., "muneeb.btc")
   * @returns Stacks address or null if not found
   */
  async resolveNameToAddress(fullyQualifiedName: string): Promise<string | null> {
    try {
      const owner = await getOwner({
        fullyQualifiedName,
        network: this.network,
      });

      return owner || null;
    } catch (error: any) {
      throw new Error(`Failed to resolve name to address: ${error.message}`);
    }
  }

  /**
   * Resolves an address to its primary BNS name
   * @param address - Stacks address
   * @returns Fully qualified BNS name or null if not found
   */
  async resolveAddressToName(address: string): Promise<string | null> {
    try {
      return await this.getPrimaryName(address);
    } catch (error: any) {
      throw new Error(`Failed to resolve address to name: ${error.message}`);
    }
  }
}
