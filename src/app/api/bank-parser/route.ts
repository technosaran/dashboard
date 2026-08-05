import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { parseBankStatementText } from "@/lib/bank-parsers/parser-engine";
import { BankType } from "@/lib/bank-parsers/types";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const contentType = request.headers.get("content-type") || "";

    let textContent = "";
    let bankType: BankType = "auto";
    let password = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const bankArg = (formData.get("bank") as BankType) || "auto";
      password = (formData.get("password") as string) || "";
      bankType = bankArg;

      if (!file) {
        return NextResponse.json({ error: "No statement file uploaded" }, { status: 400 });
      }

      const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: "Uploaded file size exceeds 10MB limit." }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const pdfParse = require("pdf-parse");
          const options: Record<string, any> = {};
          if (password) {
            options.password = password;
          }
          const pdfData = await pdfParse(buffer, options);
          textContent = pdfData.text || "";
        } catch (pdfErr: any) {
          const errMsg = pdfErr?.message || String(pdfErr);
          console.error("PDF parse error:", errMsg);

          if (
            pdfErr?.name === "PasswordException" ||
            errMsg.toLowerCase().includes("password") ||
            errMsg.toLowerCase().includes("encrypted")
          ) {
            return NextResponse.json(
              {
                error:
                  "This PDF statement is password-protected. Please enter your PDF password (e.g. DOB or PAN) in the password box to unlock it.",
              },
              { status: 400 }
            );
          }
          return NextResponse.json(
            { error: "Unable to extract text from the PDF statement. The file may be corrupted or in an unsupported format." },
            { status: 422 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Unable to extract text from the PDF statement. Please try uploading a different file." },
          { status: 422 }
        );
      }
    } else {
      const body = await request.json();
      textContent = body.text || "";
      bankType = body.bank || "auto";
      password = body.password || "";
    }

    if (!textContent || textContent.trim().length === 0) {
      return NextResponse.json(
        {
          error:
            "Could not extract text from statement file. If your PDF is password-protected, please enter your password above.",
        },
        { status: 400 }
      );
    }

    const parseResult = parseBankStatementText(textContent, bankType);
    if (!parseResult.transactions || parseResult.transactions.length === 0) {
      return NextResponse.json(
        {
          error:
            "No transactions found in statement. If your PDF is password-protected, make sure to enter the correct PDF password.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(parseResult);
  } catch (error: any) {
    console.error("Error parsing bank statement:", error);
    return NextResponse.json(
      { error: "Failed to parse bank statement" },
      { status: 500 }
    );
  }
}

