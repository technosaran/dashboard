import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import * as schema from "@/db/schema";
import { eq, gt, and } from "drizzle-orm";
import { fetchLiveMFNAV } from "@/app/dashboard/mutual-funds/actions";
import { fetchLiveStockPrice } from "@/app/dashboard/stocks/actions";

export async function GET(request: Request) {
  try {
    // 1. Cron Authentication check
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV !== "development") {
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const db = getDb();
    const now = new Date();

    // 3. Sync Mutual Fund NAVs (for active holdings where units > 0)
    let mfsUpdated = 0;
    const activeMfs = await db
      .selectDistinct({ schemeCode: schema.mutualFunds.scheme_code })
      .from(schema.mutualFunds)
      .where(gt(schema.mutualFunds.units, "0"));

    for (const mf of activeMfs) {
      if (!mf.schemeCode) continue;
      try {
        const navData = await fetchLiveMFNAV(mf.schemeCode);
        if (navData) {
          await db
            .update(schema.mutualFunds)
            .set({
              current_nav: navData.nav.toString(),
              previous_nav: navData.previousNav ? navData.previousNav.toString() : undefined,
              last_nav_updated_at: now,
              updated_at: now,
            })
            .where(eq(schema.mutualFunds.scheme_code, mf.schemeCode));
          mfsUpdated++;
        }
      } catch (err) {
        console.error(`Failed to sync NAV for fund: ${mf.schemeCode}`, err);
      }
    }

    // 4. Sync Stock Prices (for active holdings where quantity > 0)
    let stocksUpdated = 0;
    const activeStocks = await db
      .selectDistinct({ symbol: schema.investments.symbol })
      .from(schema.investments)
      .where(and(eq(schema.investments.type, "stock"), gt(schema.investments.quantity, "0")));

    for (const stock of activeStocks) {
      if (!stock.symbol) continue;
      try {
        const priceData = await fetchLiveStockPrice(stock.symbol);
        if (priceData) {
          await db
            .update(schema.investments)
            .set({
              current_price: priceData.price.toString(),
              previous_close: priceData.previousClose ? priceData.previousClose.toString() : undefined,
              last_fetch_at: now,
              updated_at: now,
            })
            .where(and(eq(schema.investments.type, "stock"), eq(schema.investments.symbol, stock.symbol)));
          stocksUpdated++;
        }
      } catch (err) {
        console.error(`Failed to sync price for stock: ${stock.symbol}`, err);
      }
    }

    // 5. Auto-Execute Recurring Expenses
    let expensesGenerated = 0;
    const recurringExpenses = await db
      .select()
      .from(schema.expenses)
      .where(eq(schema.expenses.is_recurring, true));

    for (const exp of recurringExpenses) {
      const lastGen = exp.last_generated_date 
        ? new Date(exp.last_generated_date) 
        : exp.date 
          ? new Date(exp.date) 
          : new Date(exp.created_at || now);

      if (exp.recurrence_end_date && now > new Date(exp.recurrence_end_date)) {
        continue;
      }

      let isDue = false;
      const diffMs = now.getTime() - lastGen.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (exp.recurrence_frequency === "daily" && diffDays >= 1) {
        isDue = true;
      } else if (exp.recurrence_frequency === "weekly" && diffDays >= 7) {
        isDue = true;
      } else if (exp.recurrence_frequency === "monthly") {
        const monthsDiff = (now.getFullYear() - lastGen.getFullYear()) * 12 + (now.getMonth() - lastGen.getMonth());
        if (monthsDiff >= 1) {
          const targetDay = exp.recurrence_day || 1;
          if (now.getDate() >= targetDay) {
            isDue = true;
          }
        }
      } else if (exp.recurrence_frequency === "yearly") {
        const yearsDiff = now.getFullYear() - lastGen.getFullYear();
        if (yearsDiff > 1) {
          isDue = true;
        } else if (yearsDiff === 1) {
          if (now.getMonth() > lastGen.getMonth() || (now.getMonth() === lastGen.getMonth() && now.getDate() >= lastGen.getDate())) {
            isDue = true;
          }
        }
      }

      if (isDue) {
        try {
          await db.transaction(async (tx) => {
            // Deduct balance and write logs if associated account is specified
            if (exp.account_id) {
              const [account] = await tx
                .select()
                .from(schema.accounts)
                .where(eq(schema.accounts.id, exp.account_id))
                .for("update");

              if (account) {
                const oldBalance = Number(account.balance);
                const newBalance = oldBalance - Number(exp.amount);

                await tx
                  .update(schema.accounts)
                  .set({ balance: newBalance.toString() })
                  .where(eq(schema.accounts.id, exp.account_id));

                await tx.insert(schema.ledgerLogs).values({
                  user_id: exp.user_id,
                  account_id: exp.account_id,
                  account_name: account.name,
                  action_type: "ADJUST_DOWN",
                  amount: exp.amount,
                  previous_balance: oldBalance.toString(),
                  new_balance: newBalance.toString(),
                  details: `Recurring Expense: ${exp.description} (${exp.category})`,
                  source_type: "expense",
                });

                await tx.insert(schema.transactions).values({
                  user_id: exp.user_id,
                  account_id: exp.account_id,
                  description: exp.description,
                  amount: exp.amount,
                  type: "expense",
                  category: exp.category,
                  date: now,
                });
              }
            }

            // Create generated transaction record
            await tx.insert(schema.expenses).values({
              user_id: exp.user_id,
              account_id: exp.account_id,
              description: exp.description,
              amount: exp.amount,
              category: exp.category,
              date: now,
              is_recurring: false,
            });

            // Update recurrence tracker template
            await tx
              .update(schema.expenses)
              .set({ last_generated_date: now })
              .where(eq(schema.expenses.id, exp.id));
          });
          expensesGenerated++;
        } catch (err) {
          console.error(`Failed to process transaction for recurring expense: ${exp.id}`, err);
        }
      }
    }

    // 6. Auto-Execute Recurring Incomes
    let incomesGenerated = 0;
    const recurringIncomes = await db
      .select()
      .from(schema.incomes)
      .where(eq(schema.incomes.is_recurring, true));

    for (const inc of recurringIncomes) {
      const lastGen = inc.last_generated_date 
        ? new Date(inc.last_generated_date) 
        : inc.date 
          ? new Date(inc.date) 
          : new Date(inc.created_at || now);

      if (inc.recurrence_end_date && now > new Date(inc.recurrence_end_date)) {
        continue;
      }

      let isDue = false;
      const diffMs = now.getTime() - lastGen.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (inc.recurrence_frequency === "daily" && diffDays >= 1) {
        isDue = true;
      } else if (inc.recurrence_frequency === "weekly" && diffDays >= 7) {
        isDue = true;
      } else if (inc.recurrence_frequency === "monthly") {
        const monthsDiff = (now.getFullYear() - lastGen.getFullYear()) * 12 + (now.getMonth() - lastGen.getMonth());
        if (monthsDiff >= 1) {
          const targetDay = inc.recurrence_day || 1;
          if (now.getDate() >= targetDay) {
            isDue = true;
          }
        }
      } else if (inc.recurrence_frequency === "yearly") {
        const yearsDiff = now.getFullYear() - lastGen.getFullYear();
        if (yearsDiff > 1) {
          isDue = true;
        } else if (yearsDiff === 1) {
          if (now.getMonth() > lastGen.getMonth() || (now.getMonth() === lastGen.getMonth() && now.getDate() >= lastGen.getDate())) {
            isDue = true;
          }
        }
      }

      if (isDue) {
        try {
          await db.transaction(async (tx) => {
            // Add to balance and write logs if associated account is specified
            if (inc.account_id) {
              const [account] = await tx
                .select()
                .from(schema.accounts)
                .where(eq(schema.accounts.id, inc.account_id))
                .for("update");

              if (account) {
                const oldBalance = Number(account.balance);
                const newBalance = oldBalance + Number(inc.amount);

                await tx
                  .update(schema.accounts)
                  .set({ balance: newBalance.toString() })
                  .where(eq(schema.accounts.id, inc.account_id));

                await tx.insert(schema.ledgerLogs).values({
                  user_id: inc.user_id,
                  account_id: inc.account_id,
                  account_name: account.name,
                  action_type: "ADJUST_UP",
                  amount: inc.amount,
                  previous_balance: oldBalance.toString(),
                  new_balance: newBalance.toString(),
                  details: `Recurring Income: ${inc.description} (${inc.category})`,
                  source_type: "income",
                });

                await tx.insert(schema.transactions).values({
                  user_id: inc.user_id,
                  account_id: inc.account_id,
                  description: inc.description,
                  amount: inc.amount,
                  type: "income",
                  category: inc.category,
                  date: now,
                });
              }
            }

            // Create generated transaction record
            await tx.insert(schema.incomes).values({
              user_id: inc.user_id,
              account_id: inc.account_id,
              description: inc.description,
              amount: inc.amount,
              category: inc.category,
              date: now,
              is_recurring: false,
            });

            // Update recurrence tracker template
            await tx
              .update(schema.incomes)
              .set({ last_generated_date: now })
              .where(eq(schema.incomes.id, inc.id));
          });
          incomesGenerated++;
        } catch (err) {
          console.error(`Failed to process transaction for recurring income: ${inc.id}`, err);
        }
      }
    }

    return NextResponse.json({
      success: true,
      stocks_updated: stocksUpdated,
      mfs_updated: mfsUpdated,
      expenses_generated: expensesGenerated,
      incomes_generated: incomesGenerated,
    });
  } catch (error) {
    console.error("Error in sync api:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
