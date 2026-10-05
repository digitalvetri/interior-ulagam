// GST split for invoices. Pure — integer paise only.

export interface GstSplit {
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

/**
 * Tax on a subtotal at the project's GST rate.
 * Intra-state: CGST + SGST, which always add up to exactly the rounded total GST
 * (CGST takes the odd paisa). Inter-state: IGST. No GST: all zero.
 */
export function splitGst(subtotalPaise: number, gstPct: number, opts: { isInterstate: boolean; noGst?: boolean }): GstSplit {
  if (opts.noGst || gstPct <= 0) return { cgstPaise: 0, sgstPaise: 0, igstPaise: 0 };
  const gst = Math.round((subtotalPaise * gstPct) / 100);
  if (opts.isInterstate) return { cgstPaise: 0, sgstPaise: 0, igstPaise: gst };
  const sgst = Math.floor(gst / 2);
  return { cgstPaise: gst - sgst, sgstPaise: sgst, igstPaise: 0 };
}

export function invoiceTotalPaise(inv: { subtotalPaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number }): number {
  return Number(inv.subtotalPaise) + Number(inv.cgstPaise) + Number(inv.sgstPaise) + Number(inv.igstPaise);
}

/**
 * What a milestone payment link charges: the invoice total incl. GST, capped at
 * what is still owed on the milestone (a part-paid milestone only collects the rest).
 */
export function milestoneLinkAmounts(
  subtotalPaise: number, gstPct: number, isInterstate: boolean, balancePaise: number,
): GstSplit & { invoiceTotalPaise: number; linkAmountPaise: number } {
  const split = splitGst(subtotalPaise, gstPct, { isInterstate });
  const total = subtotalPaise + split.cgstPaise + split.sgstPaise + split.igstPaise;
  return { ...split, invoiceTotalPaise: total, linkAmountPaise: Math.max(0, Math.min(total, balancePaise)) };
}

/** Invoice lifecycle status implied by what has been received against it. */
export function invoiceStatusFor(totalPaise: number, paidPaise: number): 'paid' | 'part_paid' | 'issued' {
  if (paidPaise > 0 && paidPaise >= totalPaise) return 'paid';
  if (paidPaise > 0) return 'part_paid';
  return 'issued';
}
