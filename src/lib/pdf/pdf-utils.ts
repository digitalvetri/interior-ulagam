/** Format paise as rupee string for PDFs: ₹ 1,23,456 */
export function fmtRupees(paise: number): string {
  const rupees = paise / 100;
  return '₹ ' + rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/** Format a Date or ISO string as "02 Sep 2026" */
export function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function wordsBelow1000(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '');
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + wordsBelow1000(n % 100) : '');
}

/** Convert paise to Indian-English amount-in-words: "Rupees One Lakh Twenty Thousand Only" */
export function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const paiseRemainder = Math.round(paise % 100);

  if (rupees === 0 && paiseRemainder === 0) return 'Rupees Zero Only';

  const parts: string[] = [];
  const crore = Math.floor(rupees / 10_000_000);
  const lakh  = Math.floor((rupees % 10_000_000) / 100_000);
  const thousand = Math.floor((rupees % 100_000) / 1_000);
  const remainder = rupees % 1_000;

  if (crore)    parts.push(wordsBelow1000(crore)    + ' Crore');
  if (lakh)     parts.push(wordsBelow1000(lakh)     + ' Lakh');
  if (thousand) parts.push(wordsBelow1000(thousand) + ' Thousand');
  if (remainder) parts.push(wordsBelow1000(remainder));

  let result = 'Rupees ' + parts.join(' ');
  if (paiseRemainder > 0) result += ' and ' + wordsBelow1000(paiseRemainder) + ' Paise';
  return result + ' Only';
}
