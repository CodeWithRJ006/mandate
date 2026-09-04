import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface LedgerBlock {
  index: number;
  timestamp: number;
  nonce: string;
  verdict: string;
  reason: string | null;
  prevHash: string;
  hash: string;
}

// File path for persistent ledger storage
const ledgerFilePath = path.resolve(process.cwd(), 'data', 'ledger.json');

function loadChain(): LedgerBlock[] {
  try {
    const data = fs.readFileSync(ledgerFilePath, 'utf-8');
    const parsed = JSON.parse(data) as LedgerBlock[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch { /* File not found or invalid JSON — start fresh */ }
  // If file missing or invalid, start with genesis block
  return [createGenesisBlock()];
}

function saveChain(chain: LedgerBlock[]) {
  try {
    const dir = path.dirname(ledgerFilePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ledgerFilePath, JSON.stringify(chain, null, 2), 'utf-8');
  } catch (saveErr) {
    console.error('Failed to persist ledger:', saveErr);
  }
}

function calculateHash(block: Omit<LedgerBlock, 'hash'>): string {
  const data = `${block.index}${block.timestamp}${block.nonce}${block.verdict}${block.reason}${block.prevHash}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

function createGenesisBlock(): LedgerBlock {
  const block: LedgerBlock = {
    index: 0,
    timestamp: Date.now(),
    nonce: 'GENESIS_NONCE',
    verdict: 'GENESIS',
    reason: null,
    prevHash: '0',
  } as LedgerBlock;
  block.hash = calculateHash(block);
  return block;
}

class Ledger {
  private chain: LedgerBlock[] = loadChain();

  public getLatestBlock(): LedgerBlock {
    return this.chain[this.chain.length - 1];
  }

  public getChain(): LedgerBlock[] {
    return [...this.chain];
  }

  public addBlock(nonce: string, verdict: string, reason: string | null): LedgerBlock {
    const prevBlock = this.getLatestBlock();
    const newBlock: Omit<LedgerBlock, 'hash'> = {
      index: prevBlock.index + 1,
      timestamp: Date.now(),
      nonce,
      verdict,
      reason,
      prevHash: prevBlock.hash,
    };
    const block: LedgerBlock = { ...newBlock, hash: calculateHash(newBlock) };
    this.chain.push(block);
    saveChain(this.chain);
    return block;
  }

  public verifyChainIntegrity(): { isValid: boolean; corruptedBlockIndex?: number } {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const prev = this.chain[i - 1];
      if (current.hash !== calculateHash(current)) {
        return { isValid: false, corruptedBlockIndex: i };
      }
      if (current.prevHash !== prev.hash) {
        return { isValid: false, corruptedBlockIndex: i };
      }
    }
    return { isValid: true };
  }

  public tamperWithBlock(index: number, newVerdict: string) {
    if (index > 0 && index < this.chain.length) {
      this.chain[index].verdict = newVerdict;
      // Intentionally do NOT update the hash to cause integrity failure.
      saveChain(this.chain);
    }
  }

  public resetLedger() {
    this.chain = [createGenesisBlock()];
    saveChain(this.chain);
  }
}

// Global singleton persisted across the process
export const globalLedger = new Ledger();
