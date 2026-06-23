import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getBankAccount, getBankTransactions } from "@/lib/banks/bank-sync-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!(await getBankAccount(user.id, id))) throw new Error("Bank account not found");
    return jsonOk(await getBankTransactions(user.id, id));
  } catch (error) {
    return jsonError(error);
  }
}
