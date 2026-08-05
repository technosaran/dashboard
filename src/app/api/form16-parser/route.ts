import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const rawText = body.text || "";

    if (!rawText || typeof rawText !== "string") {
      return NextResponse.json({ error: "Please provide Form 16 statement text or uploaded PDF content." }, { status: 400 });
    }

    // Regex extraction for Form 16 Part-B fields
    const salaryMatch = rawText.match(/(?:Gross Salary|Salary as per provisions|17\(1\))[^\d]*([\d,]+(?:\.\d{2})?)/i);
    const allowancesMatch = rawText.match(/(?:Allowances to the extent exempt|Section 10)[^\d]*([\d,]+(?:\.\d{2})?)/i);
    const stdDedMatch = rawText.match(/(?:Standard deduction|16\(ia\))[^\d]*([\d,]+(?:\.\d{2})?)/i);
    const ded80CMatch = rawText.match(/(?:80C|Section 80C)[^\d]*([\d,]+(?:\.\d{2})?)/i);
    const ded80DMatch = rawText.match(/(?:80D|Section 80D)[^\d]*([\d,]+(?:\.\d{2})?)/i);
    const tdsMatch = rawText.match(/(?:Tax deducted at source|TDS|Section 192)[^\d]*([\d,]+(?:\.\d{2})?)/i);

    const parseNum = (str: string | undefined) => {
      if (!str) return 0;
      const cleaned = str.replace(/,/g, "");
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    };

    const grossSalary = parseNum(salaryMatch?.[1]);
    const warnings: string[] = [];

    if (!salaryMatch || grossSalary === 0) {
      warnings.push("Gross salary could not be automatically extracted from the provided text.");
    }

    const extracted = {
      grossSalary,
      allowancesExempt: parseNum(allowancesMatch?.[1]),
      standardDeduction: parseNum(stdDedMatch?.[1]),
      deductions80C: parseNum(ded80CMatch?.[1]) ? Math.min(150000, parseNum(ded80CMatch?.[1])) : 0,
      deductions80D: parseNum(ded80DMatch?.[1]) ? Math.min(25000, parseNum(ded80DMatch?.[1])) : 0,
      tdsPaid: parseNum(tdsMatch?.[1]),
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    return NextResponse.json({ success: true, data: extracted });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to parse Form 16" }, { status: 500 });
  }
}
