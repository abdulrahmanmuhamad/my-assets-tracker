import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/encryption";

export async function saveProviderCredential(userId: string, provider: string, value: string) {
  return prisma.providerCredential.upsert({
    where: { userId_provider: { userId, provider } },
    update: { credentialEncrypted: encryptSecret(value) },
    create: { userId, provider, credentialEncrypted: encryptSecret(value) },
    select: { id: true, provider: true, updatedAt: true },
  });
}

export async function getProviderCredential(userId: string, provider: string) {
  const credential = await prisma.providerCredential.findUnique({
    where: { userId_provider: { userId, provider } },
    select: { credentialEncrypted: true },
  });
  return credential ? decryptSecret(credential.credentialEncrypted) : null;
}

export async function deleteProviderCredential(userId: string, provider: string) {
  return prisma.providerCredential.deleteMany({ where: { userId, provider } });
}
