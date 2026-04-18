export function getExplorerTransactionUrl(reference?: string) {
  if (!reference?.startsWith("0x")) {
    return null;
  }

  return `https://explore.tempo.xyz/tx/${reference}`;
}

