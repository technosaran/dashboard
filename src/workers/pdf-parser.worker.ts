/**
 * Dedicated Web Worker for Off-Thread Bank Statement PDF Parsing
 * Offloads heavy PDF text extraction & regex matching off the main browser thread.
 */

self.onmessage = async (event: MessageEvent<{ pdfText: string; bankType: string }>) => {
  const { pdfText, bankType } = event.data;

  try {
    const transactions: {
      date: string;
      description: string;
      amount: number;
      type: "income" | "expense";
    }[] = [];

    // Line by line regex parsing
    const lines = pdfText.split("\n");
    const dateRegex = /\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})\b/i;

    for (const line of lines) {
      const match = dateRegex.exec(line);
      if (!match) continue;

      const dateStr = match[1];
      const numbers = line.match(/[\d,]+\.\d{2}/g);
      if (!numbers || numbers.length === 0) continue;

      // Extract amount (last numeric match in transaction line)
      const lastNumStr = numbers[numbers.length - 1].replace(/,/g, "");
      const amount = parseFloat(lastNumStr);
      if (isNaN(amount) || amount <= 0) continue;

      const isCredit = /CR|credit|deposit|by\s+clearing/i.test(line);
      const type = isCredit ? "income" : "expense";
      const description = line.replace(dateRegex, "").replace(/[\d,]+\.\d{2}/g, "").trim() || `${bankType} Statement Entry`;

      transactions.push({
        date: dateStr,
        description: description.slice(0, 100),
        amount,
        type,
      });
    }

    self.postMessage({
      success: true,
      transactions,
      count: transactions.length,
    });
  } catch (err: any) {
    self.postMessage({
      success: false,
      error: err.message || "Failed to parse PDF in background worker",
    });
  }
};
