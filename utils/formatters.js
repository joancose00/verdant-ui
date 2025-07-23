// Utility functions for formatting values

export function formatNumber(value) {
  if (value === null || value === undefined) return '0';
  
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  
  // For decimal values, format with commas and preserve decimals
  if (num % 1 !== 0) {
    const [integerPart, decimalPart] = num.toString().split('.');
    return parseInt(integerPart).toLocaleString() + '.' + decimalPart;
  }
  
  // For integers, just add commas
  return parseInt(num).toLocaleString();
}

export function formatRatio(value) {
  if (value === null || value === undefined) return '0.00';
  
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';
  
  return num.toFixed(2);
}

export function formatAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}