import crypto from 'crypto';

export interface LedgerBlock {
  index: number;
  timestamp: number;
  nonce: string;
  verdict: string;
  reason: string | null;
  prevHash: string;
  hash: string;
}

class Ledger {
  private chain: LedgerBlock[] = [];

  constructor() {
    this.chain.push(this.createGenesisBlock());
  }

  private createGenesisBlock(): LedgerBlock {
    const block: LedgerBlock = {
      index: 0,
      timestamp: Date.now(),
      nonce: 'GENESIS_NONCE',
      verdict: 'GENESIS',
      reason: null,
      prevHash: '0'
    } as LedgerBlock;
    block.hash = this.calculateHash(block);
    return block;
  }

  public calculateHash(block: Omit<LedgerBlock, 'hash'>): string {
    const data = `${block.index}${block.timestamp}${block.nonce}${block.verdict}${block.reason}${block.prevHash}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  public getLatestBlock(): LedgerBlock {
    return this.chain[this.chain.length - 1];
  }

  public getChain(): LedgerBlock[] {
    return [...this.chain];
  }

  public addBlock(nonce: string, verdict: string, reason: string | null): LedgerBlock {
    const prevBlock = this.getLatestBlock();
    const newBlock: any = {
      index: prevBlock.index + 1,
      timestamp: Date.now(),
      nonce,
      verdict,
      reason,
      prevHash: prevBlock.hash
    };
    newBlock.hash = this.calculateHash(newBlock);
    this.chain.push(newBlock);
    return newBlock;
  }

  public verifyChainIntegrity(): { isValid: boolean; corruptedBlockIndex?: number } {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const prevBlock = this.chain[i - 1];

      // Re-verify hash
      if (currentBlock.hash !== this.calculateHash(currentBlock)) {
        return { isValid: false, corruptedBlockIndex: i };
      }

      // Re-verify chain link
      if (currentBlock.prevHash !== prevBlock.hash) {
        return { isValid: false, corruptedBlockIndex: i };
      }
    }
    return { isValid: true };
  }

  public tamperWithBlock(index: number, newVerdict: string) {
    if (index > 0 && index < this.chain.length) {
      // Modify the block but DO NOT update the hash or downstream blocks.
      // This will correctly cause verifyChainIntegrity to fail.
      this.chain[index].verdict = newVerdict;
    }
  }
}

// Global in-memory singleton for the hackathon
export const globalLedger = new Ledger();
