/** "0x8f2c9a17bd4e0c3f5a6d21e9f0b8c7a1d3e641ab" -> "0x8f2c…41ab" — shared across every screen that shows a wallet without making it the point of the screen. */
export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
