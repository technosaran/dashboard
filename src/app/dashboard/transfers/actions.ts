"use server";

import { createTransfer as internalCreateTransfer } from "../accounts/actions";

// Explicitly re-export for clarity and to resolve build-time path resolution issues
export const createTransfer = internalCreateTransfer;


