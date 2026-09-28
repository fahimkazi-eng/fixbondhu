-- External sign-in identities.
--
-- Kept in their own table rather than a nullable googleSub column on users,
-- because a person may sign in with Google, a phone OTP and a password, and
-- because the unique constraint is what prevents two accounts claiming the
-- same external identity.
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "emailAtLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- The guarantee that matters: one external account, one FixBondhu user.
CREATE UNIQUE INDEX "auth_identities_provider_providerAccountId_key"
    ON "auth_identities"("provider", "providerAccountId");

CREATE INDEX "auth_identities_userId_idx" ON "auth_identities"("userId");

ALTER TABLE "auth_identities"
    ADD CONSTRAINT "auth_identities_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
