/**
 * Formats an integer cents amount as a dollar string. Whole-dollar amounts
 * show no decimals ("$175"); non-whole amounts show cents ("$0.50") instead
 * of being silently rounded away — .toFixed(0) on 50 cents previously
 * displayed the wrong "$1" (0.5 rounds up under zero decimal places).
 */
export function formatCents(cents: number): string {
  if (cents >= 100000) {
    return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return cents % 100 === 0 ? `$${(cents / 100).toFixed(0)}` : `$${(cents / 100).toFixed(2)}`;
}
