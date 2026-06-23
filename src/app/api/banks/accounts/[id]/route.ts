import { jsonError, jsonOk } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getBankAccount, updateBankAccountLiquidCash } from "@/lib/banks/bank-sync-service";
import { updateBankAccountSchema } from "@/lib/validators";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const account = await getBankAccount(user.id, id);
    if (!account) throw new Error("Bank account not found");
    return jsonOk(account);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const input = updateBankAccountSchema.parse(await request.json());
    return jsonOk(await updateBankAccountLiquidCash(user.id, id, input.includeInLiquidCash));
  } catch (error) {
    return jsonError(error);
  }
}
